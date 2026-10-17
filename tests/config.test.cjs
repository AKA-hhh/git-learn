const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../assets/js/engine/git-sim.js');
const repo=()=>{const g=new GitSim();g.run('git init');return g};
const commit=(g,text)=>{g.state.workingTree['a.txt']=text;g.run('git add .');g.run('git commit -m "'+text+'"');return g.state.commits.get(g.head())};
test('global config works before init; local needs a repository',()=>{
 const g=new GitSim();g.run('git config --global user.name "张 三"');g.run('git config --global user.email zhang@example.com');
 assert.equal(g.run('git config user.name').output,'张 三');assert.match(g.run('git config -l').output,/user.email=zhang@example.com/);
 for(const cmd of ['git config user.name Alice','git config --local user.name','git config --local --list'])assert.throws(()=>g.run(cmd),/初始化/);
 g.run('git init');assert.equal(commit(g,'first').author,'张 三 <zhang@example.com>');
});
test('scope precedence, list ordering and unset restore global values independently',()=>{
 const g=repo();g.run('config --global user.name Global');g.run('config user.name Local');
 g.run('config --global user.email global@example.com');
 assert.equal(g.run('config --get user.name').output,'Local');assert.equal(g.run('config --global user.name').output,'Global');
 assert.equal(g.run('config --local --list').output,'user.name=Local');
 assert.equal(g.run('config --list').output,'user.name=Global\nuser.email=global@example.com\nuser.name=Local');
 assert.equal(commit(g,'one').author,'Local <global@example.com>');
 g.run('config --unset user.name');assert.equal(g.run('config user.name').output,'Global');assert.throws(()=>g.run('config --local user.name'),/没有设置/);
});
test('new author applies to later commits; files and old commits remain unchanged',()=>{
 const g=repo();const c=commit(g,'one'),before=structuredClone(g.state);
 g.run('config --global user.name "New Author"');g.run('config --global user.email new@example.com');
 for(const key of ['workingTree','index','commits','refs','remotes','stash'])assert.deepEqual(g.state[key],before[key]);
 const next=commit(g,'two');assert.equal(next.author,'New Author <new@example.com>');assert.equal(g.state.commits.get(c.hash).author,c.author);
 assert.match(g.run('show HEAD').output,/Author: New Author <new@example.com>/);
 assert.match(g.run('log').output,/New Author/);
});
test('clone retains global identity and remote authors; rehydration preserves config',()=>{
 const g=new GitSim();g.run('config --global user.name Cloner');g.run('config --global user.email cloner@example.com');g.run('clone demo://origin');
 assert.equal(g.configValue('user.name'),'Cloner');assert.equal(g.state.commits.get(g.head()).author,'Git Learner <learner@example.com>');
 g.run('config user.name Project');const hydrated=new GitSim(structuredClone(g.state));assert.equal(hydrated.configValue('user.name'),'Project');
 assert.equal(commit(hydrated,'new').author,'Project <cloner@example.com>');
 const legacy=structuredClone(g.state);delete legacy.config;const migrated=new GitSim(legacy);assert.equal(migrated.configValue('user.name'),'Git Learner');assert.deepEqual(migrated.state.commits,g.state.commits);
});
test('invalid options and keys are atomic; missing identity blocks commit with help',()=>{
 const g=repo();
 for(const line of ['config --global --local user.name Bob','config --list --get user.name','config --get user.name Bob','config --list extra','config --unset user.name Bob','config core.editor vim','config user.name ""','config user.name "x<y>"','config user.name "bad\nname"','config --system user.name Bob','config __proto__.name Bob','user.name Bob']){const old=structuredClone(g.state);assert.throws(()=>g.run(line));assert.deepEqual(g.state,old,line)}
 g.run('config --global --unset user.email');g.state.workingTree['a.txt']='pending';g.run('add .');const before=structuredClone(g.state);assert.throws(()=>g.run('commit -m missing'),/user.email/);assert.deepEqual(g.state,before);
 const restored=new GitSim(g.state);assert.equal(restored.configValue('user.email'),undefined);
 restored.run('config user.email back@example.com');restored.run('commit -m ready');assert.match(restored.state.commits.get(restored.head()).author,/back@example.com/);
});
test('merge commits use current identity and config survives reset and switches',()=>{
 const g=repo();commit(g,'base');g.run('switch -c feature');g.state.workingTree['b.txt']='feature';g.run('add .');g.run('commit -m feature');g.run('switch main');
 g.run('config user.name Merger');g.run('config user.email merge@example.com');g.run('merge --no-ff feature');const merged=g.state.commits.get(g.head());assert.equal(merged.parents.length,2);assert.equal(merged.author,'Merger <merge@example.com>');g.run('reset --hard HEAD~1');assert.equal(g.configValue('user.name'),'Merger');
});
