const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../assets/js/engine/git-sim.js');
const repo=()=>{const g=new GitSim();g.run('git init');g.state.workingTree['a.txt']='base';g.run('git add .');g.run('git commit -m base');g.run('git remote add origin demo://original');g.run('git push -u origin main');return g};
const atomic=(g,line,pattern)=>{const before=structuredClone(g.state);assert.throws(()=>g.run(line),pattern);assert.deepEqual(g.state,before,line)};

test('remote set-url changes only simulated address and get-url is read-only',()=>{
 const g=repo(),before=structuredClone(g.state);const result=g.run('git remote set-url origin https://example.com/team/repository.git');
 assert.equal(g.state.remotes.origin.url,'https://example.com/team/repository.git');before.remotes.origin.url=g.state.remotes.origin.url;assert.deepEqual(g.state,before);assert.match(result.explanation,/模拟|浏览器/);assert.match(result.explanation,/保留|不变/);
 const read=structuredClone(g.state);assert.equal(g.run('git remote get-url origin').output,'https://example.com/team/repository.git');assert.deepEqual(g.state,read);assert.match(g.run('git remote -v').output,/https:\/\/example.com\/team\/repository.git/);assert.equal(g.run('git remote').output,'origin');
});
test('URL changes preserve push/fetch/upstream behavior and survive hydration',()=>{
 const g=repo();g.run('remote set-url origin git@example.com:team/repository.git');const restored=new GitSim(g.state);assert.equal(restored.run('remote get-url origin').output,'git@example.com:team/repository.git');
 restored.state.workingTree['a.txt']='next';restored.run('commit -am next');restored.run('push');assert.equal(restored.state.remotes.origin.branches.main,restored.head());restored.run('fetch origin');assert.equal(restored.state.refs.remoteTracking['origin/main'],restored.head());assert.deepEqual(restored.state.upstream.main,{remote:'origin',branch:'main'});
});
test('remote URL operations reject missing remotes, invalid arguments and unsupported flags atomically',()=>{
 const g=repo();
 for(const line of ['remote set-url missing demo://new','remote get-url missing','remote set-url origin','remote set-url origin one two','remote get-url','remote get-url origin extra','remote set-url "" demo://new','remote get-url ""','remote set-url origin ""','remote set-url origin "   "','remote set-url origin "line\nbreak"','remote set-url origin "tab\tvalue"','remote set-url origin "nul\u0000value"','remote set-url origin "del\u007fvalue"','remote set-url --push origin demo://new','remote get-url --all origin','remote set-url -v origin demo://new','remote get-url -v origin','remote remove origin','remote rename origin upstream'])atomic(g,line);
});
test('remote add retains its existing behavior with the shared URL validation',()=>{
 const g=repo();g.run('remote add upstream demo://upstream');assert.equal(g.run('remote get-url upstream').output,'demo://upstream');assert.deepEqual(g.state.remotes.upstream.branches,{});assert.equal(g.state.remotes.upstream.commits.size,0);atomic(g,'remote add origin demo://duplicate',/存在/);
 for(const line of ['remote add empty ""','remote add empty "   "','remote add invalid "a\nb"','remote add invalid "a\u0085b"'])atomic(g,line);
});
