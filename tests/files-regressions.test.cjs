const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/js/engine/git-sim.js');

const repo = () => { const g = new GitSim(); g.run('git init'); return g; };
const commit = (g, files, message = 'snapshot') => {
  Object.assign(g.state.workingTree, files);
  g.run('git add .');
  g.run('git commit -m "' + message + '"');
  return g.head();
};
const atomic = (g, command, pattern) => {
  const before = structuredClone(g.state);
  assert.throws(() => g.run(command), pattern);
  assert.deepEqual(g.state, before, command);
};
const conflict = (deleteOurs = false) => {
  const g = repo();
  commit(g, {'f.txt': 'base', 'stable.txt': 'stable'});
  g.run('git switch -c feature');
  const theirs = commit(g, {'f.txt': 'theirs'}, 'theirs');
  g.run('git switch main');
  if (deleteOurs) g.run('git rm f.txt');
  const ours = commit(g, deleteOurs ? {} : {'f.txt': 'ours'}, 'ours');
  g.run('git merge feature');
  assert.deepEqual(g.state.conflicts, ['f.txt']);
  return {g, ours, theirs};
};

test('mv stages the original index blob and leaves private worktree edits unstaged', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.state.workingTree['a.txt'] = 'private-draft';
  g.run('git mv a.txt b.txt');
  assert.equal(g.state.index['b.txt'], 'base');
  assert.equal(g.state.workingTree['b.txt'], 'private-draft');
  assert.equal(g.state.index['a.txt'], undefined);
  assert.equal(g.state.workingTree['a.txt'], undefined);
  g.run('git commit -m renamed');
  assert.deepEqual(g.tree(), {'b.txt': 'base'});
  assert.equal(g.state.workingTree['b.txt'], 'private-draft');
  assert.match(g.run('git diff').output, /private-draft/);
});

test('mv retains separately staged content and staged additions', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.state.workingTree['a.txt'] = 'staged';
  g.run('git add a.txt');
  g.state.workingTree['a.txt'] = 'unstaged';
  g.run('git mv a.txt b.txt');
  assert.equal(g.state.index['b.txt'], 'staged');
  assert.equal(g.state.workingTree['b.txt'], 'unstaged');
  g.state.workingTree['new.txt'] = 'new staged';
  g.run('git add new.txt');
  g.state.workingTree['new.txt'] = 'new draft';
  g.run('git mv new.txt added.txt');
  assert.equal(g.state.index['added.txt'], 'new staged');
  assert.equal(g.state.workingTree['added.txt'], 'new draft');
});

test('mv rejects staged deletion, missing worktree sources and source-equals-target atomically', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  atomic(g, 'git mv a.txt a.txt');
  atomic(g, 'git mv a.txt a.txt/child.txt');
  delete g.state.workingTree['a.txt'];
  atomic(g, 'git mv a.txt b.txt');
  g.state.workingTree['a.txt'] = 'base';
  g.run('git rm --cached a.txt');
  atomic(g, 'git mv a.txt b.txt');
});

for (const location of ['index', 'workingTree']) {
  test('mv rejects a destination inside an ordinary ' + location + ' file atomically', () => {
    const g = repo();
    commit(g, {'a.txt': 'base'});
    g.state[location].src = 'ordinary file';
    atomic(g, 'git mv a.txt src/helper.js');
  });
  test('mv rejects a destination file that would replace a nonempty ' + location + ' directory', () => {
    const g = repo();
    commit(g, {'a.txt': 'base'});
    g.state[location]['dir/child.txt'] = 'child';
    atomic(g, 'git mv a.txt dir');
  });
}

test('mv rejects directory operands in the file-only simulator without changing children', () => {
  const g = repo();
  commit(g, {'src/a.txt': 'base', 'src/b.txt': 'second'});
  g.state.workingTree['src/a.txt'] = 'draft';
  g.state.workingTree['src/private.txt'] = 'private';
  atomic(g, 'git mv src dest');
  atomic(g, 'git mv src src/nested');
});

test('mv rejects an unresolved conflict source without moving its metadata', () => {
  const {g} = conflict();
  atomic(g, 'git mv f.txt renamed.txt', /冲突/);
});

test('checkout HEAD path restores the index and resolves a merge conflict for commit', () => {
  const {g, ours, theirs} = conflict();
  g.run('git checkout HEAD -- f.txt');
  assert.deepEqual(g.state.conflicts, []);
  assert.equal(g.state.index['f.txt'], 'ours');
  assert.equal(g.state.workingTree['f.txt'], 'ours');
  g.run('git commit -m resolved');
  assert.deepEqual(g.state.commits.get(g.head()).parents, [ours, theirs]);
  assert.equal(g.state.merge, null);
});

test('restore staged worktree resolves a conflict absent from the source as a deletion', () => {
  const {g, ours, theirs} = conflict(true);
  g.run('git restore --staged --worktree f.txt');
  assert.deepEqual(g.state.conflicts, []);
  assert.equal(g.state.index['f.txt'], undefined);
  assert.equal(g.state.workingTree['f.txt'], undefined);
  g.run('git commit -m resolved');
  assert.deepEqual(g.state.commits.get(g.head()).parents, [ours, theirs]);
  assert.equal(g.tree()['f.txt'], undefined);
});

test('checkout resolved source absent conflict path stages deletion', () => {
  const {g} = conflict(true);
  g.run('git checkout HEAD -- f.txt');
  assert.deepEqual(g.state.conflicts, []);
  assert.equal(g.state.index['f.txt'], undefined);
  assert.equal(g.state.workingTree['f.txt'], undefined);
});

test('worktree-only restore does not resolve conflicts until add', () => {
  const {g} = conflict();
  g.run('git restore --source HEAD f.txt');
  assert.deepEqual(g.state.conflicts, ['f.txt']);
  assert.equal(g.state.workingTree['f.txt'], 'ours');
  atomic(g, 'git commit -m unresolved', /冲突/);
  g.run('git checkout -- f.txt');
  assert.deepEqual(g.state.conflicts, ['f.txt']);
  g.run('git add f.txt');
  assert.deepEqual(g.state.conflicts, []);
});

test('restore staged resolves only selected conflict paths and preserves worktree edits', () => {
  const {g} = conflict();
  g.state.conflicts.push('missing.txt');
  g.state.workingTree['missing.txt'] = 'conflict';
  g.state.workingTree['f.txt'] = 'resolved draft';
  g.run('git restore --staged f.txt');
  assert.deepEqual(g.state.conflicts, ['missing.txt']);
  assert.equal(g.state.index['f.txt'], 'ours');
  assert.equal(g.state.workingTree['f.txt'], 'resolved draft');
});

test('restore from a commit resolves a cherry-pick conflict for continuation', () => {
  const g = repo();
  commit(g, {'f.txt': 'base'});
  g.run('git switch -c feature');
  const source = commit(g, {'f.txt': 'theirs'}, 'picked');
  g.run('git switch main');
  const ours = commit(g, {'f.txt': 'ours'}, 'ours');
  g.run('git cherry-pick ' + source);
  g.run('git restore --source ' + source + ' --staged --worktree f.txt');
  assert.deepEqual(g.state.conflicts, []);
  g.run('git cherry-pick --continue');
  assert.equal(g.tree()['f.txt'], 'theirs');
  assert.deepEqual(g.state.commits.get(g.head()).parents, [ours]);
  assert.equal(g.state.operation, null);
});

test('new branch from current HEAD keeps staged, unstaged and untracked files intact', () => {
  const g = repo();
  const head = commit(g, {'README.md': 'committed', 'staged.txt': 'base'});
  g.state.workingTree['README.md'] = 'default template draft';
  g.state.workingTree['staged.txt'] = 'staged';
  g.run('git add staged.txt');
  g.state.workingTree['staged.txt'] = 'unstaged';
  g.state.workingTree['private.txt'] = 'private';
  const index = structuredClone(g.state.index), working = structuredClone(g.state.workingTree);
  g.run('git checkout -b feature');
  assert.equal(g.branch(), 'feature');
  assert.equal(g.head(), head);
  assert.deepEqual(g.state.index, index);
  assert.deepEqual(g.state.workingTree, working);
});

test('safe branch switches carry staged and unstaged changes on unaffected paths', () => {
  const g = repo();
  commit(g, {'a.txt': 'base', 'b.txt': 'base', 'target.txt': 'old'});
  g.run('git switch -c feature');
  commit(g, {'target.txt': 'new'});
  g.run('git switch main');
  g.state.workingTree['a.txt'] = 'staged';
  g.run('git add a.txt');
  g.state.workingTree['a.txt'] = 'draft';
  g.state.workingTree['b.txt'] = 'unstaged';
  g.state.workingTree['untracked.txt'] = 'keep';
  g.run('git switch feature');
  assert.equal(g.state.index['a.txt'], 'staged');
  assert.equal(g.state.workingTree['a.txt'], 'draft');
  assert.equal(g.state.index['b.txt'], 'base');
  assert.equal(g.state.workingTree['b.txt'], 'unstaged');
  assert.equal(g.state.workingTree['target.txt'], 'new');
  assert.equal(g.state.workingTree['untracked.txt'], 'keep');
  g.run('git switch main');
  assert.equal(g.state.workingTree['untracked.txt'], 'keep');
});

test('switch carries staged additions and deletions on paths unchanged by the target', () => {
  const g = repo();
  commit(g, {'remove.txt': 'base', 'target.txt': 'old'});
  g.run('git switch -c feature');
  commit(g, {'target.txt': 'new'});
  g.run('git switch main');
  g.run('git rm --cached remove.txt');
  g.state.workingTree['remove.txt'] = 'now untracked';
  g.state.workingTree['added.txt'] = 'staged addition';
  g.run('git add added.txt');
  g.state.workingTree['added.txt'] = 'draft addition';
  g.run('git switch feature');
  assert.equal(g.state.index['remove.txt'], undefined);
  assert.equal(g.state.workingTree['remove.txt'], 'now untracked');
  assert.equal(g.state.index['added.txt'], 'staged addition');
  assert.equal(g.state.workingTree['added.txt'], 'draft addition');
  assert.equal(g.state.workingTree['target.txt'], 'new');
});

test('same-HEAD and detached checkout preserve local staged and unstaged changes', () => {
  const g = repo();
  const hash = commit(g, {'a.txt': 'base'});
  g.state.workingTree['a.txt'] = 'staged';
  g.run('git add a.txt');
  g.state.workingTree['a.txt'] = 'draft';
  g.run('git switch main');
  g.run('git checkout --detach HEAD');
  assert.equal(g.branch(), '(detached)');
  assert.equal(g.head(), hash);
  assert.equal(g.state.index['a.txt'], 'staged');
  assert.equal(g.state.workingTree['a.txt'], 'draft');
  g.run('git switch -c recovered');
  assert.equal(g.state.workingTree['a.txt'], 'draft');
});

test('branch creation before the first commit retains staged additions and worktree drafts', () => {
  const g = repo();
  g.state.workingTree['a.txt'] = 'staged';
  g.run('git add a.txt');
  g.state.workingTree['a.txt'] = 'draft';
  g.run('git switch -c feature');
  assert.equal(g.head(), null);
  assert.equal(g.state.index['a.txt'], 'staged');
  assert.equal(g.state.workingTree['a.txt'], 'draft');
});

test('switch accepts staged target content while retaining additional worktree edits', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'a.txt': 'target'});
  g.run('git switch main');
  g.state.workingTree['a.txt'] = 'target';
  g.run('git add a.txt');
  g.state.workingTree['a.txt'] = 'draft';
  g.run('git switch feature');
  assert.equal(g.state.index['a.txt'], 'target');
  assert.equal(g.state.workingTree['a.txt'], 'draft');
});

for (const staged of [false, true]) test('switch rejects destructive ' + (staged ? 'staged' : 'unstaged') + ' overlaps atomically', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'a.txt': 'target'});
  g.run('git switch main');
  g.state.workingTree['a.txt'] = 'private';
  if (staged) g.run('git add a.txt');
  atomic(g, 'git switch feature', /未提交|工作区|暂存/);
  atomic(g, 'git checkout -b new-branch feature');
});

test('switch rejects unstaged target-equal worktree content when the index differs', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'a.txt': 'target'});
  g.run('git switch main');
  g.state.workingTree['a.txt'] = 'target';
  atomic(g, 'git switch feature', /工作区|未提交/);
});

for (const collision of ['exact', 'ancestor', 'descendant']) test('switch rejects ' + collision + ' untracked collisions atomically', () => {
  const g = repo();
  commit(g, {'base.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'dir/file.txt': 'target'});
  g.run('git switch main');
  g.state.workingTree[collision === 'exact' ? 'dir/file.txt' : collision === 'ancestor' ? 'dir' : 'dir/file.txt/private.txt'] = 'private';
  atomic(g, 'git switch feature', /未跟踪|覆盖|冲突/);
});

test('switch refuses target file and carried staged directory prefix collisions', () => {
  const g = repo();
  commit(g, {'base.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'dir': 'target file'});
  g.run('git switch main');
  g.state.workingTree['dir/private.txt'] = 'private';
  g.run('git add dir/private.txt');
  atomic(g, 'git switch feature');
});

test('safe switch supports clean tracked file-directory transitions', () => {
  const g = repo();
  commit(g, {'item': 'file'});
  g.run('git switch -c feature');
  g.run('git rm item');
  commit(g, {'item/child.txt': 'child'});
  g.run('git switch main');
  assert.deepEqual(g.state.index, {'item': 'file'});
  g.run('git switch feature');
  assert.deepEqual(g.state.index, {'item/child.txt': 'child'});
  assert.deepEqual(g.state.workingTree, {'item/child.txt': 'child'});
});

test('switch may restore a missing tracked file from a changed target', () => {
  const g = repo();
  commit(g, {'a.txt': 'base'});
  g.run('git switch -c feature');
  commit(g, {'a.txt': 'target'});
  g.run('git switch main');
  delete g.state.workingTree['a.txt'];
  g.run('git switch feature');
  assert.equal(g.state.index['a.txt'], 'target');
  assert.equal(g.state.workingTree['a.txt'], 'target');
});

test('switch keeps unstaged tracked deletions on paths unchanged by the target', () => {
  const g = repo();
  commit(g, {'a.txt': 'base', 'target.txt': 'old'});
  g.run('git switch -c feature');
  commit(g, {'target.txt': 'new'});
  g.run('git switch main');
  delete g.state.workingTree['a.txt'];
  g.run('git switch feature');
  assert.equal(g.state.index['a.txt'], 'base');
  assert.equal(g.state.workingTree['a.txt'], undefined);
  assert.equal(g.state.workingTree['target.txt'], 'new');
});

test('switch carries a staged deletion matching the target and retains its untracked copy', () => {
  const g = repo();
  commit(g, {'a.txt': 'base', 'stable.txt': 'stable'});
  g.run('git switch -c feature');
  g.run('git rm a.txt');
  g.run('git commit -m removed');
  g.run('git switch main');
  g.run('git rm --cached a.txt');
  g.state.workingTree['a.txt'] = 'private';
  g.run('git switch feature');
  assert.equal(g.state.index['a.txt'], undefined);
  assert.equal(g.state.workingTree['a.txt'], 'private');
});

test('checkout protects active conflict operations even when creating a branch at HEAD', () => {
  const {g} = conflict();
  atomic(g, 'git checkout -b blocked', /冲突|解决/);
  g.run('git merge --abort');
  const feature = g.resolve('feature');
  g.run('git cherry-pick ' + feature);
  atomic(g, 'git switch -c blocked', /冲突|继续|中止/);
});
