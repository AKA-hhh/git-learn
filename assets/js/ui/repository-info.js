    /* Read-only effective identity and simulated remotes. */
    const RepositoryInfo = {
      field(key, title) {
        const config = sim.state.config, value = sim.configValue(key), configured = typeof value === 'string' && value.trim().length > 0;
        const source = own(config.local, key) ? 'local' : own(config.global, key) ? 'global' : null;
        const scopeValue = scope => own(config[scope], key) ? escapeHTML(config[scope][key] || '（空值）') : '未设置';
        return '<article class="identity-card" data-config-key="' + key + '"><div class="identity-label"><span>' + title + '</span><code>' + key + '</code></div><strong class="identity-value' + (configured ? '' : ' is-missing') + '">' + (configured ? escapeHTML(value) : '未配置') + '</strong><span class="identity-source ' + (source === 'local' ? 'is-local' : '') + '">' + (source === 'local' ? '当前仓库 · local' : source === 'global' ? '全局默认 · global' : '尚无生效配置') + '</span><dl class="identity-scopes"><div><dt>当前仓库</dt><dd>' + scopeValue('local') + '</dd></div><div><dt>全局默认</dt><dd>' + scopeValue('global') + '</dd></div></dl></article>';
      },
      render() {
        $('repository-identity').innerHTML = this.field('user.name', '用户名') + this.field('user.email', '邮箱');
        const remotes = Object.entries(sim.state.remotes), upstream = sim.state.upstream[sim.branch()];
        $('repository-remote-count').textContent = remotes.length + ' 个远程';
        $('repository-remotes').innerHTML = remotes.map(([name, remote]) => {
          const tracked = upstream?.remote === name, changeCommand = 'git remote set-url ' + JSON.stringify(name) + ' "demo://my-repository"';
          return '<article class="repository-remote"><div class="repository-remote-head"><span class="repository-remote-name"><svg class="icon" aria-hidden="true"><use href="#i-cloud"/></svg><strong>' + escapeHTML(name) + '</strong></span><div class="repository-remote-actions"><span class="repository-simulated-label">模拟地址</span><button type="button" data-fill="' + escapeHTML(changeCommand) + '" title="填入修改命令，更换地址后按 Enter 执行">修改地址 ↗</button></div></div><code class="repository-remote-url">' + escapeHTML(remote.url || '未设置地址') + '</code><div class="repository-remote-meta"><span>Fetch / Push</span><span>' + Object.keys(remote.branches || {}).length + ' 个远程分支</span>' + (tracked ? '<span class="repository-upstream">当前上游 · ' + escapeHTML(name + '/' + upstream.branch) + '</span>' : '') + '</div></article>';
        }).join('') || '<div class="repository-empty"><strong>尚未配置远程仓库</strong><p>在终端添加一个模拟远程，即可练习推送和拉取。</p>' + ResourceReading.code('git remote add origin demo://my-repository', '添加模拟远程') + '</div>';
        $('repository-config-commands').innerHTML = ResourceReading.code('git config --local user.name "你的名字"', '修改当前仓库的用户名') + ResourceReading.code('git config --local user.email "you@example.com"', '修改当前仓库的邮箱');
        $('repository-info-commands').innerHTML = ResourceReading.code('git config --list', '查看配置') + ResourceReading.code('git remote -v', '查看远程');
      },
      open() {this.render(); $('repository-info-dialog').showModal()},
      init() {$('open-repository-info').onclick = () => this.open();}
    };

