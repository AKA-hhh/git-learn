const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/js/engine/git-sim.js');

const repo = () => {
  const g = new GitSim();
  g.run('git init');
  commit(g, { 'f.txt': 'base' }, 'base');
  return g;
};
const commit = (g, updates, message) => {
  for (const [path, value] of Object.entries(updates)) {
    if (value === undefined) delete g.state.workingTree[path];
    else g.state.workingTree[path] = value;
  }
  g.run('git add -A');
  g.run(`git commit -m "${message}"`);
  return g.head();
};
const connect = g => {
  g.run('git remote add origin demo://origin');
  g.run('git push -u origin main');
};
const atomic = (g, line, pattern) => {
  const before = structuredClone(g.state);
  assert.throws(() => g.run(line), pattern);
  assert.deepEqual(g.state, before, line);
};

for (const recreateMain of [false, true]) {
  test(`plain push uses the renamed current branch after hydration${recreateMain ? ' with a stale main branch' : ''}`, () => {
    const original = repo(), base = original.head();
    connect(original);
    original.run('git branch -m topic');
    const tip = commit(original, { 'f.txt': 'topic' }, 'topic');
    if (recreateMain) original.run('git branch main HEAD~1');
    const g = new GitSim(original.state);
    assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'main' });

    const result = g.run('git push');

    assert.equal(g.state.remotes.origin.branches.main, tip);
    assert.equal(g.state.refs.remoteTracking['origin/main'], tip);
    assert.equal(g.state.remotes.origin.branches.topic, undefined);
    assert.equal(g.state.refs.remoteTracking['origin/topic'], undefined);
    assert.equal(g.state.refs.branches.topic, tip);
    assert.equal(g.state.refs.branches.main, recreateMain ? base : undefined);
    assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'main' });
    assert.match(result.output, /topic.*origin\/main/);
  });
}

test('explicit push branch and remote-only push keep their source and destination semantics', () => {
  const g = repo(), base = g.head();
  connect(g);
  g.run('git branch -m topic');
  const tip = commit(g, { 'f.txt': 'topic' }, 'topic');
  g.run('git branch main HEAD~1');

  assert.match(g.run('git push -u origin main').output, /main.*origin\/main/);
  assert.equal(g.state.remotes.origin.branches.main, base);
  assert.equal(g.state.remotes.origin.branches.topic, undefined);
  assert.deepEqual(g.state.upstream.main, { remote: 'origin', branch: 'main' });
  assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'main' });

  assert.match(g.run('git push origin').output, /topic.*origin\/topic/);
  assert.equal(g.state.remotes.origin.branches.main, base);
  assert.equal(g.state.remotes.origin.branches.topic, tip);
  assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'main' });

  g.run('git push --set-upstream');
  assert.equal(g.state.remotes.origin.branches.main, tip);
  assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'main' });
  g.run('git push -u origin');
  assert.deepEqual(g.state.upstream.topic, { remote: 'origin', branch: 'topic' });
  assert.equal(g.state.refs.branches.main, base);
  assert.equal(g.state.refs.branches.topic, tip);
});

test('renamed-branch push preserves atomic non-fast-forward rejection and unsupported force flags', () => {
  const g = repo();
  connect(g);
  g.run('git branch -m topic');
  const remote = new GitSim(g.state);
  commit(g, { 'f.txt': 'local' }, 'local');
  const remoteTip = commit(remote, { 'f.txt': 'remote' }, 'remote');
  g.state.remotes.origin.commits = structuredClone(remote.state.commits);
  g.state.remotes.origin.branches.main = remoteTip;

  atomic(g, 'git push', /non-fast-forward/);
  atomic(g, 'git push --force', /参数/);
  atomic(g, 'git push -f origin topic', /参数/);
});

for (const collision of ['branch', 'tag']) {
  test(`pull uses the remote-tracking ref even when a local ${collision} shadows origin/main`, () => {
    const g = repo(), base = g.head();
    connect(g);
    g.run(`git ${collision} origin/main`);
    const tip = commit(g, { 'f.txt': 'remote tip' }, 'remote tip');
    g.run('git push origin main');
    g.run('git reset --hard HEAD~1');

    g.run('git pull origin main');

    assert.equal(g.head(), tip);
    assert.deepEqual(g.state.index, { 'f.txt': 'remote tip' });
    assert.deepEqual(g.state.workingTree, { 'f.txt': 'remote tip' });
    assert.equal(g.state.refs.remoteTracking['origin/main'], tip);
    assert.equal(g.resolve(`refs/${collision === 'branch' ? 'heads' : 'tags'}/origin/main`), base);
    assert.equal(g.state.merge, null);
    assert.deepEqual(g.state.conflicts, []);
  });
}

test('failed pull rolls back newly fetched commits and remote refs before merge', () => {
  const g = repo();
  connect(g);
  const remote = new GitSim(g.state);
  const tip = commit(remote, { 'new.txt': 'remote' }, 'remote addition');
  g.state.remotes.origin.commits = structuredClone(remote.state.commits);
  g.state.remotes.origin.branches.main = tip;
  g.state.remotes.origin.branches.side = tip;

  atomic(g, 'git pull origin missing', /远程没有/);
  g.state.workingTree['new.txt'] = 'local untracked';
  atomic(g, 'git pull origin main', /未跟踪/);
  assert.equal(g.state.commits.has(tip), false);
  assert.equal(g.state.refs.remoteTracking['origin/side'], undefined);
});

for (const kind of ['content', 'deletion', 'addition']) {
  for (const verb of ['apply', 'pop']) {
    for (const withIndex of [false, true]) {
      test(`stash ${verb}${withIndex ? ' --index' : ''} accepts identical committed ${kind}`, () => {
        const original = repo();
        original.run('git branch feature');
        const updates = kind === 'addition' ? { 'added.txt': 'same' } : { 'f.txt': kind === 'deletion' ? undefined : 'same' };
        for (const [path, value] of Object.entries(updates)) {
          if (value === undefined) delete original.state.workingTree[path];
          else original.state.workingTree[path] = value;
        }
        if (withIndex || kind === 'addition') original.run('git add -A');
        original.state.workingTree['other.txt'] = 'needed';
        original.run('git stash push -u');
        original.run('git switch feature');
        const tip = commit(original, updates, 'same final result');
        const g = new GitSim(original.state), saved = structuredClone(g.state.stash);
        const expected = { ...g.tree(), 'other.txt': 'needed' };

        g.run(`git stash ${verb}${withIndex ? ' --index' : ''}`);

        assert.equal(g.head(), tip);
        assert.deepEqual(g.state.index, g.tree());
        assert.deepEqual(g.state.workingTree, expected);
        assert.deepEqual(g.state.stash, verb === 'apply' ? saved : []);
        assert.deepEqual(g.state.conflicts, []);
        assert.equal(g.state.merge, null);
        assert.equal(g.state.operation, null);
      });
    }
  }
}

test('stash --index rejects a different staged result even when final work content matches', () => {
  const g = repo();
  g.run('git branch feature');
  g.state.workingTree['f.txt'] = 'staged';
  g.run('git add f.txt');
  g.state.workingTree['f.txt'] = 'same';
  g.state.workingTree['other.txt'] = 'needed';
  g.run('git stash push -u');
  g.run('git switch feature');
  commit(g, { 'f.txt': 'same' }, 'same work result');

  atomic(g, 'git stash pop --index', /冲突/);
  g.run('git stash pop');
  assert.deepEqual(g.state.index, { 'f.txt': 'same' });
  assert.deepEqual(g.state.workingTree, { 'f.txt': 'same', 'other.txt': 'needed' });
  assert.deepEqual(g.state.stash, []);
});

for (const kind of ['content', 'deletion', 'addition']) {
  test(`stash preserves atomic rejection of conflicting ${kind} results`, () => {
    const g = repo();
    g.run('git branch feature');
    const path = kind === 'addition' ? 'added.txt' : 'f.txt';
    g.state.workingTree[path] = kind === 'content' ? 'same index' : 'stashed';
    g.run('git add -A');
    if (kind === 'deletion') delete g.state.workingTree[path];
    else if (kind === 'content') g.state.workingTree[path] = 'different work';
    g.state.workingTree['a-other.txt'] = 'needed';
    g.run('git stash push -u');
    g.run('git switch feature');
    commit(g, { [path]: kind === 'content' ? 'same index' : 'committed' }, 'conflicting result');

    for (const command of ['apply', 'apply --index', 'pop', 'pop --index']) {
      atomic(g, `git stash ${command}`, /冲突/);
    }
  });
}

for (const verb of ['apply', 'pop']) {
  for (const content of ['needed', 'collision']) {
    test(`stash ${verb} protects an existing untracked file with ${content === 'needed' ? 'identical' : 'different'} content`, () => {
      const g = repo();
      g.state.workingTree['f.txt'] = 'work';
      g.state.workingTree['other.txt'] = 'needed';
      g.run('git stash push -u');
      g.state.workingTree['other.txt'] = content;

      atomic(g, `git stash ${verb}`, /未跟踪/);
      atomic(g, `git stash ${verb} --index`, /未跟踪/);
    });
  }
}

test('stash keeps stored untracked files protected when the destination now tracks that path', () => {
  const g = repo();
  g.run('git branch feature');
  g.state.workingTree['other.txt'] = 'needed';
  g.run('git stash push -u');
  g.run('git switch feature');
  commit(g, { 'other.txt': 'needed' }, 'track other');

  atomic(g, 'git stash pop', /冲突|未跟踪/);
  atomic(g, 'git stash pop --index', /冲突|未跟踪/);
});

for (const direction of ['ancestor', 'descendant']) {
  for (const saved of ['tracked-new', 'untracked']) {
    for (const destination of ['untracked', 'committed']) {
      for (const command of ['apply', 'apply --index', 'pop', 'pop --index']) {
        test(`stash ${command} blocks ${saved} prefix collision with a ${destination} ${direction}`, () => {
          const g = repo();
          g.run('git branch feature');
          const savedPath = direction === 'ancestor' ? 'dir/file.txt' : 'dir';
          const destinationPath = direction === 'ancestor' ? 'dir' : 'dir/private.txt';
          g.state.workingTree[savedPath] = 'saved';
          if (saved === 'tracked-new') g.run(`git add ${savedPath}`);
          g.run(`git stash push${saved === 'untracked' ? ' -u' : ''}`);
          if (destination === 'committed') {
            g.run('git switch feature');
            commit(g, { [destinationPath]: 'valuable' }, 'committed destination');
          } else g.state.workingTree[destinationPath] = 'valuable';

          atomic(g, `git stash ${command}`, /文件与目录|路径冲突/);
          assert.equal(g.state.workingTree[destinationPath], 'valuable');
          assert.equal(g.state.stash.length, 1);
        });
      }
    }
  }
}

for (const direction of ['file to directory', 'directory to file']) {
  for (const command of ['apply', 'apply --index', 'pop', 'pop --index']) {
    test(`stash ${command} handles a clean ${direction} structural transition atomically`, () => {
      const g = repo();
      const oldPath = direction === 'file to directory' ? 'dir' : 'dir/file.txt';
      const newPath = direction === 'file to directory' ? 'dir/file.txt' : 'dir';
      commit(g, { [oldPath]: 'base path' }, 'structural base');
      g.run(`git rm ${oldPath}`);
      g.state.workingTree[newPath] = 'saved path';
      g.run(`git add ${newPath}`);
      const index = structuredClone(g.state.index), work = structuredClone(g.state.workingTree);
      g.run('git stash push');

      if (!command.includes('--index')) {
        atomic(g, `git stash ${command}`, /文件与目录|路径冲突/);
        assert.equal(g.state.stash.length, 1);
      } else {
        g.run(`git stash ${command}`);
        assert.deepEqual(g.state.index, index);
        assert.deepEqual(g.state.workingTree, work);
        assert.equal(g.state.stash.length, command.startsWith('apply') ? 1 : 0);
        assert.equal(g.filePathCollision(g.state.index), null);
        assert.equal(g.filePathCollision(g.state.workingTree), null);
      }
    });
  }
}

const trackedRoundTrips = [
  ['clean', 'base', 'base'],
  ['unstaged edit', 'base', 'work'],
  ['staged edit', 'staged', 'staged'],
  ['staged and unstaged edits', 'staged', 'work'],
  ['staged edit reverted in worktree', 'staged', 'base'],
  ['unstaged deletion', 'base', undefined],
  ['staged deletion', undefined, undefined],
  ['staged deletion restored in worktree', undefined, 'base'],
  ['staged deletion with different worktree content', undefined, 'work']
];

for (const [label, indexed, working] of trackedRoundTrips) {
  test(`stash --index round-trip matrix preserves ${label}`, () => {
    let roundTrips = 0;
    for (const addedIndex of [undefined, 'added staged', '']) {
      for (const addedWork of [undefined, 'added work', '']) {
        for (const untracked of [undefined, 'untracked', '']) {
          const g = repo();
          commit(g, { 'marker.txt': 'base' }, 'matrix base');
          const assign = (tree, path, value) => {
            if (value === undefined) delete tree[path];
            else tree[path] = value;
          };
          assign(g.state.index, 'f.txt', indexed);
          assign(g.state.workingTree, 'f.txt', working);
          assign(g.state.index, 'added.txt', addedIndex);
          assign(g.state.workingTree, 'added.txt', addedWork);
          assign(g.state.workingTree, 'untracked.txt', untracked);
          g.state.workingTree['marker.txt'] = 'always saved';
          const index = structuredClone(g.state.index), work = structuredClone(g.state.workingTree), tip = g.head();
          const detail = JSON.stringify({ label, addedIndex, addedWork, untracked });
          g.run('git stash push -u');
          assert.deepEqual(g.state.index, g.tree(), detail);
          assert.deepEqual(g.state.workingTree, g.tree(), detail);

          for (const verb of ['apply', 'pop']) {
            const restored = new GitSim(g.state);
            restored.run(`git stash ${verb} --index`);
            assert.deepEqual(restored.state.index, index, detail);
            assert.deepEqual(restored.state.workingTree, work, detail);
            assert.equal(restored.head(), tip, detail);
            assert.equal(restored.state.stash.length, verb === 'apply' ? 1 : 0, detail);
            assert.deepEqual(restored.state.conflicts, [], detail);
            assert.equal(restored.state.merge, null, detail);
            assert.equal(restored.state.operation, null, detail);
            roundTrips++;
          }
        }
      }
    }
    assert.equal(roundTrips, 54);
  });
}
