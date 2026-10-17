const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/js/engine/git-sim.js');
const repo = () => { assert.equal(typeof globalThis.GitSim, 'function', 'GitSim engine must exist'); const g = new GitSim(); g.run('git init'); return g; };
const commit = (g, text, message = text) => { g.state.workingTree['a.txt'] = text; g.run('git add .'); g.run(`git commit -m "${message}"`); return g.head(); };
const snapshot = g => structuredClone(g.state);

test('parser preserves quotes, empty strings and escapes; rejects incomplete input', () => {
  assert.equal(typeof globalThis.CommandParser, 'function', 'CommandParser must exist');
  assert.deepEqual(CommandParser.parse('git commit -m "a b"'), ['git', 'commit', '-m', 'a b']);
  assert.deepEqual(CommandParser.parse("git add 'space name' plain\\ name \"\""), ['git', 'add', 'space name', 'plain name', '']);
  assert.deepEqual(CommandParser.parse('git commit -m "say \\"hello\\""'), ['git', 'commit', '-m', 'say "hello"']);
  assert.throws(() => CommandParser.parse('git commit -m "open'), /引号/);
  assert.throws(() => CommandParser.parse('git add dangling\\'), /转义/);
});
test('init, staging and commits keep independent complete snapshots', () => {
  const g = repo(); const h = commit(g, 'one');
  assert.equal(g.branch(), 'main'); assert.equal(g.state.commits.get(h).tree['a.txt'], 'one');
  g.state.workingTree['a.txt'] = 'two'; assert.equal(g.state.index['a.txt'], 'one');
  g.run('add a.txt'); g.state.workingTree['a.txt'] = 'three';
  assert.equal(g.state.index['a.txt'], 'two'); assert.equal(g.tree()['a.txt'], 'one');
  const tree = g.tree(); tree['a.txt'] = 'oops'; assert.equal(g.tree()['a.txt'], 'one');
  const r = g.run('commit -m second'); assert.equal(r.command, 'commit'); assert.ok(r.explanation);
  assert.equal(g.tree()['a.txt'], 'two'); assert.equal(g.state.workingTree['a.txt'], 'three');
  assert.deepEqual(g.state.commits.get(g.head()).parents, [h]);
  assert.match(g.run('status').output, /a.txt/); assert.match(g.run('diff').output, /three/);
});
test('unknown flags, paths, dangerous names and invalid commands roll back atomically', () => {
  const g = repo(); commit(g, 'one');
  for (const line of ['add a.txt missing', 'commit --definitely-unsupported -m no', 'checkout -b __proto__', 'add constructor', 'branch bad..name', 'wat']) {
    const before = snapshot(g); assert.throws(() => g.run(line)); assert.deepEqual(g.state, before, line);
  }
  assert.equal({}.polluted, undefined);
});
test('reset soft, mixed, hard and tracked deletion are distinct', () => {
  const g = repo(); const a = commit(g, 'one'); commit(g, 'two');
  g.run('reset --soft HEAD~1'); assert.equal(g.head(), a); assert.equal(g.state.index['a.txt'], 'two');
  assert.match(g.run('diff --cached').output, /two/);
  g.run('reset --mixed'); assert.equal(g.state.index['a.txt'], 'one'); assert.equal(g.state.workingTree['a.txt'], 'two');
  g.state.workingTree['notes.txt'] = 'untracked'; g.run('reset --hard');
  assert.equal(g.state.workingTree['notes.txt'], 'untracked'); assert.equal(g.state.workingTree['a.txt'], 'one');
  delete g.state.workingTree['a.txt']; g.run('add -A'); g.run('commit -m deletion'); assert.deepEqual(g.tree(), { 'notes.txt': 'untracked' });
});
test('checkout/switch branches, detached HEAD and dirty protection', () => {
  const g = repo(); const a = commit(g, 'one'); g.run('switch -c feature'); commit(g, 'two');
  g.run('checkout main'); assert.equal(g.state.workingTree['a.txt'], 'one');
  g.state.workingTree['a.txt'] = 'dirty'; assert.throws(() => g.run('switch feature'), /未提交|工作区|暂存/);
  g.run('restore a.txt'); g.run(`checkout ${a}`); assert.equal(g.branch(), '(detached)');
  g.run('checkout feature'); assert.equal(g.state.workingTree['a.txt'], 'two');
  g.run('branch -d main'); assert.equal(g.state.refs.branches.main, undefined);
});
test('safe branch deletion rejects an unmerged branch and force deletion works', () => {
  const g = repo(); commit(g, 'one'); g.run('switch -c feature'); commit(g, 'two'); g.run('switch main');
  assert.throws(() => g.run('branch -d feature'), /合并/); g.run('branch -D feature'); assert.equal(g.state.refs.branches.feature, undefined);
});
test('merge fast-forwards and file-level three-way merge creates two parents', () => {
  const g = repo(); const a = commit(g, 'one'); g.run('switch -c feature'); const b = commit(g, 'two');
  g.run('switch main'); g.run('merge feature'); assert.equal(g.head(), b); assert.equal(g.tree()['a.txt'], 'two');
  g.run('switch -c other'); g.state.workingTree['other.txt'] = 'other'; g.run('add .'); g.run('commit -m other'); const c = g.head();
  g.run('switch main'); g.state.workingTree['main.txt'] = 'main'; g.run('add .'); g.run('commit -m main'); const d = g.head();
  g.run('merge other'); assert.deepEqual(g.state.commits.get(g.head()).parents, [d, c]);
  assert.equal(g.tree()['other.txt'], 'other'); assert.equal(g.tree()['main.txt'], 'main'); assert.ok(g.state.commits.has(a));
});
test('conflict blocks commit until edited and added; abort restores pre-merge state', () => {
  const g = repo(); commit(g, 'one'); g.run('switch -c feature'); const theirs = commit(g, 'theirs');
  g.run('switch main'); const ours = commit(g, 'ours'); const before = snapshot(g);
  const result = g.run('merge feature'); assert.match(result.output, /冲突|CONFLICT/);
  assert.match(g.state.workingTree['a.txt'], /<<<<<<< HEAD/); assert.deepEqual(g.state.conflicts, ['a.txt']);
  assert.throws(() => g.run('commit -m bad'), /冲突/); assert.throws(() => g.run('add a.txt'), /标记|冲突/);
  g.run('merge --abort'); assert.equal(g.head(), ours); assert.deepEqual(g.state.workingTree, before.workingTree); assert.equal(g.state.merge, null);
  g.run('merge feature'); g.state.workingTree['a.txt'] = 'resolved'; g.run('add a.txt'); g.run('commit -m resolved');
  assert.deepEqual(g.state.commits.get(g.head()).parents, [ours, theirs]); assert.deepEqual(g.state.conflicts, []); assert.equal(g.state.merge, null);
});
test('restore source, staged restore, rm cached and mv preserve expected data', () => {
  const g = repo(); const a = commit(g, 'one'); commit(g, 'two');
  g.run(`restore --source ${a} a.txt`); assert.equal(g.state.workingTree['a.txt'], 'one'); assert.equal(g.state.index['a.txt'], 'two');
  g.run('add .'); g.run('restore --staged a.txt'); assert.equal(g.state.index['a.txt'], 'two');
  g.run('restore a.txt'); g.run('mv a.txt b.txt'); assert.equal(g.state.index['b.txt'], 'two'); assert.equal(g.state.workingTree['a.txt'], undefined);
  g.run('rm --cached b.txt'); assert.equal(g.state.workingTree['b.txt'], 'two'); assert.equal(g.state.index['b.txt'], undefined);
});
test('remote fetch only changes objects and tracking; push checks ancestry; pull integrates', () => {
  const g = repo(); const a = commit(g, 'one'); g.run('remote add origin demo://mine'); g.run('push -u origin main');
  assert.equal(g.state.remotes.origin.branches.main, a); assert.deepEqual(g.state.upstream.main, { remote: 'origin', branch: 'main' });
  const remote = new GitSim(g.state); const b = commit(remote, 'remote');
  g.state.remotes.origin.commits = structuredClone(remote.state.commits); g.state.remotes.origin.branches.main = b;
  g.run('fetch origin'); assert.equal(g.head(), a); assert.equal(g.state.workingTree['a.txt'], 'one'); assert.equal(g.state.refs.remoteTracking['origin/main'], b);
  g.run('pull'); assert.equal(g.head(), b); assert.equal(g.tree()['a.txt'], 'remote');
  commit(g, 'local'); g.run('push'); assert.equal(g.state.remotes.origin.branches.main, g.head());
  g.run(`reset --hard ${a}`); assert.throws(() => g.run('push origin main'), /快进|non-fast-forward/);
});
test('stash restores index/worktree distinction only with --index and saves optional untracked files', () => {
  const g = repo(); commit(g, 'one'); g.state.workingTree['a.txt'] = 'staged'; g.run('add .'); g.state.workingTree['a.txt'] = 'work'; g.state.workingTree['extra.txt'] = 'extra';
  g.run('stash push -u'); assert.equal(g.state.workingTree['a.txt'], 'one'); assert.equal(g.state.workingTree['extra.txt'], undefined); assert.equal(g.state.stash.length, 1);
  assert.match(g.run('stash list').output, /stash@\{0\}/); g.run('stash apply --index'); assert.equal(g.state.workingTree['a.txt'], 'work'); assert.equal(g.state.index['a.txt'], 'staged'); assert.equal(g.state.stash.length, 1);
  g.run('reset --hard'); delete g.state.workingTree['extra.txt']; g.run('stash pop'); assert.equal(g.state.workingTree['extra.txt'], 'extra'); assert.equal(g.state.stash.length, 0);
});
test('stash default apply leaves restored tracked modifications unstaged', () => {
  const g = repo(); commit(g, 'base'); g.state.workingTree['a.txt'] = 'staged'; g.run('add .'); g.state.workingTree['a.txt'] = 'work';
  g.state.workingTree['added.txt'] = 'new staged'; g.run('add added.txt'); g.state.workingTree['added.txt'] = 'new work';
  g.state.workingTree['untracked.txt'] = 'untracked'; g.run('stash push -u'); g.run('stash pop');
  assert.equal(g.state.index['a.txt'], 'base'); assert.equal(g.state.workingTree['a.txt'], 'work');
  assert.equal(g.state.index['added.txt'], 'new work'); assert.equal(g.state.workingTree['added.txt'], 'new work');
  assert.equal(g.state.index['untracked.txt'], undefined); assert.equal(g.state.workingTree['untracked.txt'], 'untracked');
});
test('all-reference branch and log views include fetched remote branches and detached tags', () => {
  const g = repo(); const a = commit(g, 'base'); g.run('remote add origin demo://test'); g.run('push -u origin main');
  const remote = new GitSim(g.state); const b = commit(remote, 'remote', 'remote only');
  g.state.remotes.origin.commits = structuredClone(remote.state.commits); g.state.remotes.origin.branches.main = b; g.run('fetch');
  assert.match(g.run('branch -a').output, /remotes\/origin\/main/); assert.match(g.run('branch --remotes').output, /origin\/main/);
  assert.match(g.run('log --all --oneline').output, /remote only/); assert.equal(g.tree('refs/remotes/origin/main')['a.txt'], 'remote');
  g.run(`checkout ${a}`); const detached = commit(g, 'detached', 'tag only'); g.run('tag orphan'); g.run('switch main');
  assert.match(g.run('log --all --oneline').output, /tag only/); assert.equal(g.tree('refs/tags/orphan')['a.txt'], 'detached'); assert.notEqual(detached, b);
});
test('pull refuses a deleted remote branch even when a stale tracking ref remains', () => {
  const g = repo(); commit(g, 'base'); g.run('remote add origin demo://test'); g.run('push -u origin main');
  delete g.state.remotes.origin.branches.main; const before = snapshot(g);
  assert.throws(() => g.run('pull'), /远程没有/); assert.deepEqual(g.state, before);
});
test('restore can undo staged deletion or remove tracked paths absent from a source', () => {
  const g = repo(); const base = commit(g, 'base'); g.state.workingTree['new.txt'] = 'new'; g.run('add .'); g.run('commit -m added');
  g.run('restore --source ' + base + ' new.txt'); assert.equal(g.state.workingTree['new.txt'], undefined); assert.equal(g.state.index['new.txt'], 'new');
  g.run('add new.txt'); g.run('restore --staged new.txt'); assert.equal(g.state.index['new.txt'], 'new'); assert.equal(g.state.workingTree['new.txt'], undefined);
  g.run('restore new.txt'); assert.equal(g.state.workingTree['new.txt'], 'new');
});
test('tag, revision resolution, show and graph log inspect objects', () => {
  const g = repo(); const a = commit(g, 'one'); g.run('tag v1'); commit(g, 'two');
  assert.equal(g.tree('v1')['a.txt'], 'one'); assert.equal(g.tree('HEAD^')['a.txt'], 'one'); assert.equal(g.run('show v1:a.txt').output, 'one');
  assert.match(g.run('log --graph --oneline').output, /one/); assert.match(g.run(`show ${a}`).output, /one/);
  g.run('tag -d v1'); assert.equal(g.state.refs.tags.v1, undefined);
});
test('clone demo is explicit simulation and snapshots do not share remote objects', () => {
  const g = new GitSim(); g.run('clone demo://origin'); assert.ok(g.head()); assert.ok(g.state.initialized); assert.ok(g.state.remotes.origin.commits instanceof Map);
  const original = g.state.remotes.origin.commits.get(g.head()).tree; g.state.workingTree['README.md'] = 'local'; assert.notEqual(original['README.md'], 'local');
  const empty = new GitSim(); const r = empty.run('clone https://example.invalid/repo.git'); assert.match(r.output, /模拟|网络/); assert.equal(empty.head(), null);
});
test('merge deletion conflict may resolve to a deleted file and commit', () => {
  const g = repo(); commit(g, 'base'); g.run('switch -c feature'); commit(g, 'modified');
  g.run('switch main'); g.run('rm a.txt'); g.run('commit -m deleted'); g.run('merge feature');
  assert.deepEqual(g.state.conflicts, ['a.txt']); delete g.state.workingTree['a.txt'];
  g.run('add a.txt'); g.run('commit -m resolved'); assert.deepEqual(g.tree(), {});
});
test('rm protects staged changes and hard reset protects unrelated untracked paths', () => {
  const g = repo(); commit(g, 'base'); g.state.workingTree['a.txt'] = 'staged'; g.run('add .');
  const before = snapshot(g); assert.throws(() => g.run('rm a.txt'), /修改/); assert.deepEqual(g.state, before);
  g.run('rm --cached a.txt'); assert.equal(g.state.workingTree['a.txt'], 'staged');
});
test('checkout rejects untracked files that would be overwritten atomically', () => {
  const g = repo(); commit(g, 'base'); g.run('switch -c feature'); g.state.workingTree['new.txt'] = 'tracked'; g.run('add .'); g.run('commit -m feature');
  g.run('switch main'); g.state.workingTree['new.txt'] = 'mine'; const before = snapshot(g);
  assert.throws(() => g.run('switch feature'), /未跟踪/); assert.deepEqual(g.state, before);
});
test('force merge creates a merge commit even when a fast-forward is possible', () => {
  const g = repo(); const a = commit(g, 'base'); g.run('switch -c feature'); const b = commit(g, 'feature'); g.run('switch main');
  g.run('merge --no-ff -m combined feature'); assert.deepEqual(g.state.commits.get(g.head()).parents, [a, b]);
  assert.equal(g.state.commits.get(g.head()).message, 'combined');
  const graph = g.run('log --graph --oneline').output;
  assert.match(graph, new RegExp('├─ 父提交 ' + a)); assert.match(graph, new RegExp('└─ 父提交 ' + b));
});
