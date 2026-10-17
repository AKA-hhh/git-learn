    const $ = id => document.getElementById(id);
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const allFiles = (...trees) => [...new Set(trees.flatMap(t => Object.keys(t)))].sort();
    const same = (a, b) => allFiles(a, b).every(k => a[k] === b[k]);
    const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const quote = s => '"' + s.replace(/(["\\$`])/g, '\\$1') + '"';
    let sim, session, saveTimer, toastTimer, pendingScene = 'free';
    const view = {file: 'README.md', commit: null, reference: 'status', chapter: 'zones', tab: 'reference', remote: '', historyIndex: 0, draft: '', graph: {x: 0, y: 0, scale: 1}};
    function notify(message) {$('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000)}

    /* StateManager: serialize Map objects without losing immutable commit trees. */
    const StateManager = {
      key: 'git-atlas-v1', notice: '',
      encode: v => JSON.stringify(v, (_, x) => x instanceof Map ? {__gitMap: [...x]} : x),
      decode: v => JSON.parse(v, (_, x) => x && Array.isArray(x.__gitMap) ? new Map(x.__gitMap) : x),
      load() {try {const raw = localStorage.getItem(this.key); if (!raw) return null; const data = this.decode(raw); if (data.version !== 1 || !(data.repo.commits instanceof Map) || !data.repo.refs.HEAD || !data.repo.workingTree || !data.repo.index || !data.repo.remotes || !data.repo.refs.tags || !data.repo.refs.remoteTracking || !Array.isArray(data.repo.conflicts) || !Array.isArray(data.repo.stash) || !data.repo.upstream || !Array.isArray(data.history) || !Array.isArray(data.progress?.lessons) || !Array.isArray(data.progress?.scenarios) || !Array.isArray(data.done) || !data.seen || !SCENARIOS.some(s => s.id === data.scenario)) throw Error('版本不兼容'); for (const c of data.repo.commits.values()) if (!c.tree || !Array.isArray(c.parents) || typeof c.timestamp !== 'string') throw Error('提交快照不完整'); for (const r of Object.values(data.repo.remotes)) if (!(r.commits instanceof Map) || !r.branches) throw Error('远程快照不完整'); new GitSim(data.repo).tree(); return data} catch (e) {this.notice = '无法读取保存数据，已载入示例。'; return null} },
      save() {clearTimeout(saveTimer); try {session.repo = sim.state; localStorage.setItem(this.key, this.encode(session)); this.saveFailed = false} catch (e) {if (!this.saveFailed) notify("浏览器无法保存；当前会话仍可使用"); this.saveFailed = true} },
      schedule() {clearTimeout(saveTimer); saveTimer = setTimeout(() => this.save(), 250)}
    };

    /* Scenarios: real command sequences build every exercise. */
    const Scenarios = {
      create(id, progress = {lessons: [], scenarios: []}) {
        const g = new GitSim(); g.state.workingTree['README.md'] = '# Hello, Git\n\n每一个好项目，都从一次提交开始。\n';
        if (id !== 'first') {
          g.run('git init'); g.run('git add .'); g.run('git commit -m "创建项目说明"');
          if (id === 'free') {
            g.run('git remote add origin demo://origin'); g.run('git push -u origin main');
            g.state.workingTree['src/hello.js'] = 'function greet(name) {\n  return `你好，${name}！`;\n}\n\ngreet("Git");\n';
            g.run('git add .'); g.run('git commit -m "添加问候函数"');
            g.state.workingTree['README.md'] += "\n今天开始，用 Git 记录每一次成长。\n";
            g.state.workingTree['notes.md'] = '# 学习笔记\n\n- 工作区：正在编辑\n- 暂存区：准备提交\n';
          }
          if (id === 'push') {g.run('git remote add origin demo://origin'); g.state.workingTree['notes.md'] = '# 学习笔记\n\n我的第一个远程版本。\n'}
          if (id === 'merge' || id === 'conflict') {
            g.run('git switch -c feature');
            g.state.workingTree[id === 'merge' ? 'feature.md' : 'README.md'] = id === 'merge' ? '# 新功能\n\n来自 feature 的功能说明。\n' : '# Hello, Git\n\n来自 feature：让协作更简单。\n';
            g.run('git add .'); g.run('git commit -m "feature：添加新想法"'); g.run('git switch main');
            g.state.workingTree[id === 'merge' ? 'roadmap.md' : 'README.md'] = id === 'merge' ? '# 开发计划\n\n来自 main 的下一步。\n' : '# Hello, Git\n\n来自 main：让版本看得见。\n';
            g.run('git add .'); g.run('git commit -m "main：更新项目计划"');
          }
        }
        return {version: 1, repo: g.state, scenario: id, history: [], progress, theme: session?.theme || 'light', done: [], seen: {}, baseline: g.state.commits.size, baseReadme: g.state.workingTree['README.md'], last: '工作区的修改只属于工作区。试着执行 git add README.md，对照四个区域的同名文件。'};
      },
      select(id) {const globalConfig = structuredClone(sim.state.config.global); session = this.create(id, session.progress); session.repo.config.global = globalConfig; sim = new GitSim(session.repo); view.file = 'README.md'; view.commit = null; view.remote = ''; view.graph = {x: 0, y: 0, scale: 1}; view.historyIndex = 0; $('command-input').value = ''; $('history-search').value = ''; session.last = '示例仓库已重置。输入 git status 查看文件状态。'; render(); StateManager.save(); notify('示例仓库已重置')},
      update(command = '') {
        const s = sim.state, h = s.commits.get(sim.head()), id = session.scenario, seen = session.seen; seen[command] = true; if (s.conflicts.length) seen.conflict = true;
        const changedReadme = s.workingTree['README.md'] !== session.baseReadme;
        const staged = own(s.index, 'README.md') && s.index['README.md'] === s.workingTree['README.md'];
        let flags = [];
        if (id === 'free') flags = [!!seen.status, !!seen.diff, !!seen.edit || s.commits.size > session.baseline];
        if (id === 'first') flags = [s.initialized, staged, s.commits.size > 0, !!seen.log && s.commits.size > 0];
        if (id === 'branch') flags = [sim.branch() !== 'main' && s.refs.HEAD.type === 'branch', changedReadme, s.commits.size > session.baseline && sim.branch() !== 'main', !!seen.log && s.commits.size > session.baseline];
        if (id === 'merge') flags = [h?.parents.length === 2 && sim.branch() === 'main', !!seen.log && h?.parents.length === 2];
        if (id === 'conflict') flags = [!!seen.conflict, !!seen.conflict && !Object.values(s.workingTree).some(t => /^(<<<<<<<|=======|>>>>>>>)/m.test(t)), !!seen.conflict && !s.conflicts.length && !!s.merge, !!seen.conflict && !s.merge && h?.parents.length === 2];
        if (id === 'push') flags = [own(s.index, 'notes.md'), s.commits.size > session.baseline, s.remotes.origin?.branches.main === sim.head() && s.commits.size > session.baseline];
        flags.forEach((yes, i) => {if (yes && (i === 0 || session.done.includes(i - 1)) && !session.done.includes(i)) session.done.push(i)});
        if (session.done.length === flags.length && flags.length && !session.progress.scenarios.includes(id)) {session.progress.scenarios.push(id); notify('✓ 练习完成！你已经掌握这一段 Git 旅程。')}
      },
      render() {if ($('scenario-select')) $('scenario-select').value = 'free';}
    };

