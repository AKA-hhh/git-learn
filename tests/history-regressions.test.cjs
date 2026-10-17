const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/js/engine/git-sim.js');

const repo = () => { const g = new GitSim(); g.run('git init'); return g; };
const snapshot = g => structuredClone(g.state);
const commit = (g, changes, message) => {
  for (const [path, content] of Object.entries(changes)) {
    if (content === null) delete g.state.workingTree[path];
    else g.state.workingTree[path] = content;
  }
  g.run('git add -- ' + Object.keys(changes).map(path => JSON.stringify(path)).join(' '));
  g.run('git commit -m ' + JSON.stringify(message));
  return g.head();
};
const conflictingOperation = (kind, {trackedPath = 'f.txt', withAddition = false, withUnchangedUntracked = false} = {}) => {
  const g = repo(), baseFiles = {[trackedPath]: 'base'};
  if (withAddition && kind === 'revert') baseFiles['introduced.txt'] = 'original';
  if (withUnchangedUntracked) baseFiles['ignored.txt'] = 'original';
  commit(g, baseFiles, 'base');
  g.run('git switch -c feature');
  const targetFiles = {[trackedPath]: 'theirs'};
  if (withAddition) targetFiles['introduced.txt'] = kind === 'revert' ? null : 'incoming';
  const target = commit(g, targetFiles, 'theirs');
  g.run('git switch main');
  const ourFiles = {[trackedPath]: 'ours'};
  if (withAddition && kind === 'revert') ourFiles['introduced.txt'] = null;
  if (withUnchangedUntracked) ourFiles['ignored.txt'] = null;
  commit(g, ourFiles, 'ours');
  g.state.workingTree['old.txt'] = 'original';
  g.state.workingTree['removed.txt'] = 'original';
  if (withUnchangedUntracked) g.state.workingTree['ignored.txt'] = 'untracked before';
  const before = snapshot(g);
  const result = g.run('git ' + kind + ' ' + (kind === 'merge' ? 'feature' : target));
  assert.match(result.output, /CONFLICT/);
  return {g, before};
};

for (const kind of ['merge', 'cherry-pick', 'revert']) {
  test(kind + ' --abort preserves current additions, edits and deletions of unrelated untracked files', () => {
    const {g, before} = conflictingOperation(kind);
    g.state.workingTree['new.txt'] = 'valuable';
    g.state.workingTree['old.txt'] = 'edited';
    delete g.state.workingTree['removed.txt'];
    g.run('git ' + kind + ' --abort');
    assert.deepEqual(g.state.workingTree, {'f.txt': 'ours', 'old.txt': 'edited', 'new.txt': 'valuable'});
    assert.deepEqual(g.state.index, before.index);
    assert.equal(g.head(), before.refs.branches.main);
    assert.deepEqual(g.state.conflicts, []);
    assert.equal(g.state.merge, null);
    assert.equal(g.state.operation, null);
  });

  test(kind + ' --abort removes operation-added files even after rm --cached', () => {
    const {g, before} = conflictingOperation(kind, {withAddition: true});
    assert.ok(Object.hasOwn(g.state.index, 'introduced.txt'));
    g.run('git rm --cached introduced.txt');
    assert.ok(Object.hasOwn(g.state.workingTree, 'introduced.txt'));
    g.run('git ' + kind + ' --abort');
    assert.deepEqual(g.state.workingTree, before.workingTree);
    assert.deepEqual(g.state.index, before.index);
  });

  test(kind + ' --abort does not treat unchanged incoming paths as operation-owned', () => {
    const {g} = conflictingOperation(kind, {withUnchangedUntracked: true});
    g.state.workingTree['ignored.txt'] = 'edited after conflict';
    g.run('git ' + kind + ' --abort');
    assert.equal(g.state.workingTree['ignored.txt'], 'edited after conflict');
    assert.equal(g.state.index['ignored.txt'], undefined);
  });

  for (const [trackedPath, untrackedPath] of [['f.txt', 'f.txt/notes.txt'], ['folder/f.txt', 'folder']]) {
    test(kind + ' --abort atomically rejects untracked prefix collisions at ' + untrackedPath, () => {
      const {g} = conflictingOperation(kind, {trackedPath});
      delete g.state.workingTree[trackedPath];
      g.state.workingTree[untrackedPath] = 'valuable';
      const before = snapshot(g);
      assert.throws(() => g.run('git ' + kind + ' --abort'), /未跟踪|路径|覆盖/);
      assert.deepEqual(g.state, before);
    });
  }

  test(kind + ' --abort accepts legacy operation snapshots after reload', () => {
    const {g, before} = conflictingOperation(kind);
    const stored = snapshot(g);
    const pending = kind === 'merge' ? stored.merge : stored.operation;
    pending.before = {workingTree: structuredClone(pending.before.workingTree), index: structuredClone(pending.before.index)};
    if (kind === 'merge') delete pending.base;
    const reloaded = new GitSim(stored);
    reloaded.state.workingTree['new.txt'] = 'valuable after reload';
    reloaded.run('git ' + kind + ' --abort');
    assert.deepEqual(reloaded.state.index, before.index);
    assert.equal(reloaded.state.workingTree['new.txt'], 'valuable after reload');
    assert.equal(reloaded.state.workingTree['f.txt'], 'ours');
  });
}

test('merge chooses the unique ancestry-maximal common ancestor instead of a shorter older ancestor', () => {
  const g = repo();
  commit(g, {'f.txt': 'base'}, 'A');
  g.run('git branch side1'); g.run('git branch side2');
  commit(g, {'f.txt': 'common'}, 'B');
  g.run('git branch right');
  commit(g, {'f.txt': 'base'}, 'L1');
  commit(g, {'l.txt': 'left'}, 'L2');
  commit(g, {'l2.txt': 'left two'}, 'L3');
  g.run('git switch side1'); commit(g, {'s1.txt': 'side one'}, 'S1');
  g.run('git switch main'); g.run('git merge side1');
  g.run('git switch side2'); commit(g, {'s2.txt': 'side two'}, 'S2');
  g.run('git switch right'); g.run('git merge side2');
  g.run('git switch main'); g.run('git merge right');
  assert.equal(g.tree()['f.txt'], 'base');
  assert.equal(g.tree()['s1.txt'], 'side one');
  assert.equal(g.tree()['s2.txt'], 'side two');
});

test('merge atomically rejects criss-cross history with multiple best common ancestors', () => {
  const g = repo();
  commit(g, {'f.txt': 'base'}, 'base');
  g.run('git branch right');
  commit(g, {'left.txt': 'left'}, 'left');
  g.run('git branch left-tip');
  g.run('git switch right'); commit(g, {'right.txt': 'right'}, 'right');
  g.run('git switch main'); g.run('git merge right');
  g.run('git switch right'); g.run('git merge left-tip');
  g.run('git switch main');
  const before = snapshot(g);
  assert.throws(() => g.run('git merge right'), /多个|歧义|ambig|不支持/i);
  assert.deepEqual(g.state, before);
});

const skewedConflictingMerge = () => {
  const g = repo();
  commit(g, {'f.txt': 'base', 'legacy.txt': 'stable'}, 'A');
  g.run('git branch side1'); g.run('git branch side2');
  const base = commit(g, {'f.txt': 'common', 'legacy.txt': 'changed'}, 'B');
  g.run('git branch right');
  commit(g, {'f.txt': 'ours', 'legacy.txt': null}, 'L1');
  commit(g, {'l.txt': 'left'}, 'L2');
  commit(g, {'l2.txt': 'left two'}, 'L3');
  g.run('git switch side1'); commit(g, {'s1.txt': 'side one'}, 'S1');
  g.run('git switch main'); g.run('git merge side1');
  g.run('git switch side2'); commit(g, {'s2.txt': 'side two'}, 'S2');
  g.run('git switch right'); commit(g, {'f.txt': 'theirs', 'legacy.txt': 'stable'}, 'R1');
  g.run('git merge side2'); g.run('git switch main');
  const before = snapshot(g);
  g.run('git merge right');
  return {g, before, base};
};

test('abort of an old shortest-base merge preserves a path that legacy merging never installed', () => {
  const {g, before} = skewedConflictingMerge();
  const stored = snapshot(g);
  delete stored.merge.base;
  // The legacy A base kept this path deleted; only f.txt was conflicted.
  stored.conflicts = stored.conflicts.filter(path => path !== 'legacy.txt');
  delete stored.index['legacy.txt'];
  stored.workingTree['legacy.txt'] = 'valuable untracked after the old merge';
  const reloaded = new GitSim(stored);
  reloaded.run('git merge --abort');
  assert.deepEqual(reloaded.state.workingTree, {...before.workingTree, 'legacy.txt': 'valuable untracked after the old merge'});
  assert.deepEqual(reloaded.state.index, before.index);
});

test('abort after reloading a new skewed-base merge removes its own untracked conflict resolution', () => {
  const {g, before} = skewedConflictingMerge();
  g.state.workingTree['legacy.txt'] = 'resolved';
  g.run('git add legacy.txt'); g.run('git rm --cached legacy.txt');
  const reloaded = new GitSim(snapshot(g));
  reloaded.run('git merge --abort');
  assert.deepEqual(reloaded.state.workingTree, before.workingTree);
  assert.deepEqual(reloaded.state.index, before.index);
});
