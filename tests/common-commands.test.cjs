const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/js/engine/git-sim.js');
const repo=()=>{const g=new GitSim();g.run('git init');return g};
const commit=(g, files, message='commit')=>{Object.assign(g.state.workingTree, files);g.run('git add .');g.run('git commit -m "'+message+'"');return g.head()};
const atomic=(g,line,pattern)=>{const before=structuredClone(g.state);assert.throws(()=>g.run(line),pattern);assert.deepEqual(g.state,before,line)};

test('commit -a stages tracked modifications/deletions but never untracked files',()=>{
 const g=repo();commit(g,{'a.txt':'old','b.txt':'old'});g.state.workingTree['a.txt']='new';delete g.state.workingTree['b.txt'];g.state.workingTree['new.txt']='untracked';
 g.run('git commit -am "automatic staging"');assert.deepEqual(g.tree(),{'a.txt':'new'});assert.equal(g.state.workingTree['new.txt'],'untracked');assert.equal(g.state.index['new.txt'],undefined);
 g.state.workingTree['a.txt']='again';g.run('git commit -am"compact message"');assert.equal(g.state.commits.get(g.head()).message,'compact message');
 atomic(g,'git commit -a',/说明|message|-m/);
});
test('amend keeps parents/author/old snapshots and supports no-edit and unstaged leftovers',()=>{
 const g=repo(),first=commit(g,{'a.txt':'one'},'first'),old=commit(g,{'a.txt':'two'},'second'),snapshot=structuredClone(g.state.commits.get(old));
 g.run('git config user.name NewAuthor');g.state.workingTree['a.txt']='three';g.run('git add .');g.state.workingTree['a.txt']='unstaged';g.run('git commit --amend --no-edit');
 const current=g.state.commits.get(g.head());assert.notEqual(current.hash,old);assert.deepEqual(current.parents,[first]);assert.equal(current.message,'second');assert.equal(current.author,snapshot.author);assert.deepEqual(g.state.commits.get(old),snapshot);assert.equal(g.tree()['a.txt'],'three');assert.equal(g.state.workingTree['a.txt'],'unstaged');
 g.run('git commit -a --amend -m "updated"');assert.equal(g.state.commits.get(g.head()).message,'updated');assert.equal(g.tree()['a.txt'],'unstaged');
 const fresh=repo();atomic(fresh,'git commit --amend --no-edit',/提交/);
});
test('branch rename preserves current HEAD/upstream and force replacement protects current branch',()=>{
 const g=repo(),h=commit(g,{'a.txt':'base'});g.run('remote add origin demo://origin');g.run('push -u origin main');g.run('git branch -m trunk');assert.equal(g.branch(),'trunk');assert.equal(g.head(),h);assert.equal(g.state.refs.branches.main,undefined);assert.deepEqual(g.state.upstream.trunk,{remote:'origin',branch:'main'});assert.equal(g.state.remotes.origin.branches.main,h);
 g.run('branch feature');atomic(g,'branch -m trunk feature',/存在/);g.run('branch -M feature');assert.equal(g.branch(),'feature');assert.equal(g.head(),h);g.run('branch old');atomic(g,'branch -M old feature',/当前/);
});
test('log limits validate numbers and bound rendered commits',()=>{
 const g=repo();for(let i=0;i<5;i++)commit(g,{'a.txt':String(i)},'message-'+i);
 for(const flag of ['-n 2','--max-count 2','--max-count=2','-2']){const output=g.run('git log --oneline '+flag).output;assert.equal(output.split('\n').length,2,flag);assert.match(output,/message-4/);assert.doesNotMatch(output,/message-2/)}
 atomic(g,'git log -n nope',/数量|整数/);atomic(g,'git log --max-count=-1',/数量|整数/);
});
test('reflog remembers rewritten/abandoned HEAD and resolves HEAD@{n}',()=>{
 const g=repo(),a=commit(g,{'a.txt':'one'}),b=commit(g,{'a.txt':'two'});g.run('reset --hard '+a);
 assert.match(g.run('git reflog').output,/HEAD@\{0\}.*reset/);assert.equal(g.resolve('HEAD@{0}'),a);assert.equal(g.resolve('HEAD@{1}'),b);assert.match(g.run('show HEAD@{1}:a.txt').output,/two/);g.run('branch recovered HEAD@{1}');assert.equal(g.state.refs.branches.recovered,b);
 assert.equal(g.run('reflog -n 2').output.split('\n').length,2);const size=g.state.reflog.length;atomic(g,'switch missing',/引用|分支/);assert.equal(g.state.reflog.length,size);
 const restored=new GitSim(g.state);assert.equal(restored.resolve('HEAD@{1}'),b);const old=structuredClone(g.state);delete old.reflog;delete old.operation;const migrated=new GitSim(old);assert.equal(migrated.resolve('HEAD@{0}'),a);assert.equal(migrated.state.reflog.length,1);
});
test('cherry-pick applies only the chosen commit delta, preserves author, creates single parent',()=>{
 const g=repo(),base=commit(g,{'base.txt':'base'});g.run('switch -c feature');commit(g,{'skip.txt':'do not pick'});g.run('config user.name SourceAuthor');const source=commit(g,{'chosen.txt':'picked'},'chosen');g.run('switch main');g.run('config user.name Receiver');const ours=commit(g,{'local.txt':'local'},'local');
 g.run('git cherry-pick '+source);const current=g.state.commits.get(g.head());assert.deepEqual(current.parents,[ours]);assert.equal(current.author,g.state.commits.get(source).author);assert.equal(current.message,'chosen');assert.deepEqual(g.tree(),{'base.txt':'base','local.txt':'local','chosen.txt':'picked'});assert.equal(g.state.refs.branches.feature,source);assert.ok(g.state.commits.has(base));
});
test('revert creates inverse commit without rewriting source and supports root commits',()=>{
 const g=repo(),a=commit(g,{'a.txt':'one'}),b=commit(g,{'a.txt':'two'});commit(g,{'other.txt':'keep'});const previous=g.head();g.run('git revert '+b);assert.deepEqual(g.tree(),{'a.txt':'one','other.txt':'keep'});assert.deepEqual(g.state.commits.get(g.head()).parents,[previous]);assert.ok(g.state.commits.has(b));assert.match(g.state.commits.get(g.head()).message,/Revert/);
 const root=repo(),first=commit(root,{'root.txt':'root'});root.run('revert '+first);assert.deepEqual(root.tree(),{});assert.equal(root.state.commits.size,2);
});
test('cherry-pick root is supported and empty/merge commits fail atomically',()=>{
 const source=repo(),root=commit(source,{'root.txt':'source'});const target=repo();target.state.commits=structuredClone(source.state.commits);target.run('cherry-pick '+root);assert.equal(target.tree()['root.txt'],'source');assert.deepEqual(target.state.commits.get(target.head()).parents,[]);atomic(target,'cherry-pick '+root,/没有|为空|空改动/);
 source.run('branch feature');source.run('merge --no-ff feature'); // ancestor already included; create actual merge below
 source.run('switch feature');const picked=commit(source,{'new.txt':'new'});source.run('switch main');source.run('merge --no-ff feature');const merge=source.head();atomic(source,'revert '+merge,/合并提交/);atomic(source,'cherry-pick '+merge,/合并提交/);assert.ok(picked);
});
for(const kind of ['cherry-pick','revert'])test(kind+' conflict continuation creates the resolved commit; abort restores snapshots',()=>{
 const g=repo();const base=commit(g,{'a.txt':'base'});g.run('switch -c feature');const source=commit(g,{'a.txt':'source'},'source');g.run('switch main');const ours=commit(g,{'a.txt':'ours'},'ours');g.state.workingTree['untracked.txt']='keep';const before=structuredClone(g.state);
 const result=g.run(kind+' '+source);assert.match(result.output,/CONFLICT/);assert.deepEqual(g.state.conflicts,['a.txt']);assert.equal(g.head(),ours);assert.equal(g.state.operation.kind,kind);atomic(g,kind+' --continue',/冲突/);atomic(g,'switch feature',/继续|中止|冲突/);atomic(g,'stash push',/冲突|继续|中止/);
 const other=kind==='revert'?'cherry-pick':'revert';atomic(g,other+' --abort',/没有|当前/);g.run(kind+' --abort');assert.equal(g.head(),ours);assert.deepEqual(g.state.workingTree,before.workingTree);assert.deepEqual(g.state.index,before.index);assert.equal(g.state.operation,null);
 g.run(kind+' '+source);g.state.workingTree['a.txt']='resolved';g.run('add a.txt');const hydrated=new GitSim(g.state);hydrated.run(kind+' --continue');assert.deepEqual(hydrated.tree(),{'a.txt':'resolved'});assert.equal(hydrated.state.workingTree['untracked.txt'],'keep');assert.deepEqual(hydrated.state.commits.get(hydrated.head()).parents,[ours]);assert.equal(hydrated.state.operation,null);assert.ok(hydrated.state.commits.has(base));
});
test('conflicted operation can finish through commit and reset hard cancels operation',()=>{
 const g=repo();commit(g,{'a.txt':'base'});g.run('branch feature');g.run('switch feature');const source=commit(g,{'a.txt':'source'});g.run('switch main');const head=commit(g,{'a.txt':'ours'});g.run('cherry-pick '+source);atomic(g,'commit --amend -m nope',/进行|冲突|amend/);g.state.workingTree['a.txt']='resolved';g.run('add .');g.run('commit -m custom');assert.equal(g.state.operation,null);assert.equal(g.state.commits.get(g.head()).message,'custom');
 g.run('reset --hard '+head);g.run('cherry-pick '+source);atomic(g,'reset --soft',/期间|进行/);g.run('reset --hard');assert.equal(g.state.operation,null);assert.deepEqual(g.state.conflicts,[]);assert.equal(g.state.workingTree['a.txt'],'ours');
});
test('operation rejects dirty trees, destructive untracked collisions and invalid args atomically',()=>{
 const g=repo();commit(g,{'a.txt':'base'});g.run('switch -c feature');const source=commit(g,{'file.txt':'new'});g.run('switch main');g.state.workingTree['file.txt']='untracked';atomic(g,'cherry-pick '+source,/未跟踪/);delete g.state.workingTree['file.txt'];g.state.workingTree['a.txt']='dirty';atomic(g,'cherry-pick '+source,/未提交/);g.run('restore a.txt');
 for(const line of ['revert --no-commit '+source,'cherry-pick '+source+' '+source,'branch -m --all x','commit --amend --no-edit -m x'])atomic(g,line);
});

test('commit -a preserves an explicitly staged untracking deletion',()=>{
 const g=repo();commit(g,{'a.txt':'one','b.txt':'base'});g.run('rm --cached a.txt');g.state.workingTree['a.txt']='untracked now';g.state.workingTree['b.txt']='changed';g.run('commit -am untrack');assert.deepEqual(g.tree(),{'b.txt':'changed'});assert.equal(g.state.workingTree['a.txt'],'untracked now');assert.match(g.run('status --short').output,/\?\? a.txt/);
});
