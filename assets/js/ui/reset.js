    /* Reset templates: sample repository or a completely empty, uninitialized directory. */
    const ResetTemplates = {
      selected() {return document.querySelector('input[name="reset-template"]:checked')?.value || 'default'},
      update() {const empty = this.selected() === 'empty'; $('confirm-reset').textContent = empty ? '载入空模板' : '载入默认模板'},
      clearView(file = '') {
        view.file = file; view.commit = null; view.remote = ''; view.graph = {x: 0, y: 0, scale: 1}; view.historyIndex = 0; view.historySelected = null; view.draft = '';
        $('command-input').value = ''; $('mobile-command-input').value = ''; $('history-search').value = '';
      },
      open() {
        $('reset-template-default').checked = true; this.update(); $('reset-dialog').showModal(); $('reset-template-default').focus({preventScroll: true});
      },
      empty() {
        const globalConfig = structuredClone(sim.state.config.global), progress = structuredClone(session.progress), theme = session.theme;
        const repo = GitSim.fresh(false); repo.config.global = globalConfig;
        session = {version: 1, repo, scenario: 'free', history: [], progress, theme, done: [], seen: {}, baseline: 0, baseReadme: '', last: '空模板已载入。先执行 git init 初始化仓库，或在工作区新建文件。'};
        sim = new GitSim(repo); this.clearView(); render(); StateManager.save(); notify('已载入空模板');
      },
      apply() {
        const template = this.selected(); $('reset-dialog').close();
        if (template === 'empty') {this.empty(); return }
        Scenarios.select('free'); this.clearView('README.md'); render(); StateManager.save();
      }
    };
    $('reset-dialog').addEventListener('change', event => {if (event.target.name === 'reset-template') ResetTemplates.update()});

