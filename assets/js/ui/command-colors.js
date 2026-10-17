    /* Terminal presentation: safe syntax colors and a clearable viewport. */
    const CommandColors = {
      helpSections: new Set(['用法', '作用', '示例', '常见误区', '操作提示', '继续查看', '开始与保存', '检查与历史', '文件与撤销', '分支与整合', '远程协作', '获取帮助', '从这里开始']),
      helpCategories: new Set(['开始与保存', '检查与历史', '文件与撤销', '分支与整合', '远程协作', '获取帮助']),
      command(line) {
        let word = 0, git = false, subcommand = false;
        return (String(line ?? '').match(/\s+|(?:[^\s"'\\]|\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"?|'[^']*'?)+|[\s\S]/g) || []).map(token => {
          if (/^\s+$/.test(token)) return token;
          let type = 'argument';
          if (word++ === 0) {git = token === 'git'; type = git ? 'git' : 'subcommand'}
          else if (/^--?[^\s]+/.test(token)) type = 'flag';
          else if (/^["']/.test(token)) type = 'string';
          else if (git && !subcommand) {type = 'subcommand'; subcommand = true}
          return '<span class="syntax-' + type + '">' + escapeHTML(token) + '</span>';
        }).join('');
      },
      helpCommand(value) {return '<span class="help-command">' + this.command(value) + '</span>'},
      helpCommandLine(line, section) {
        const indent = (line.match(/^\s*/) || [''])[0], body = line.slice(indent.length);
        if (this.helpCategories.has(section)) {
          const commands = body.split(/(\s{2,})/).map(part => /^\s+$/.test(part) ? part : this.helpCommand(part)).join('');
          return '<span class="help-command-row">' + escapeHTML(indent) + commands + '</span>';
        }
        const split = body.match(/^(.*?\S)(\s{2,})(\S.*)$/);
        const content = split ? this.helpCommand(split[1]) + split[2] + '<span class="output-annotation">' + escapeHTML(split[3]) + '</span>' : this.helpCommand(body);
        return '<span class="help-command-row">' + escapeHTML(indent) + content + '</span>';
      },
      help(output) {
        let section = '';
        return String(output ?? '').split('\n').map((line, index) => {
          if (!line) return '';
          if (index === 0) {
            const detail = line.match(/^(git\s+[^\s]+)(\s+·\s+)(.*)$/);
            if (detail) return '<span class="output-title">' + this.helpCommand(detail[1]) + escapeHTML(detail[2]) + '<span class="output-annotation">' + escapeHTML(detail[3]) + '</span></span>';
            return '<span class="output-title">' + escapeHTML(line) + '</span>';
          }
          if (this.helpSections.has(line)) {section = line; return '<span class="output-meta">' + escapeHTML(line) + '</span>'}
          if (/^\s*git\s/.test(line)) return this.helpCommandLine(line, section);
          if (/^(?:提示：|输入\s)/.test(line)) return '<span class="output-tip">' + escapeHTML(line) + '</span>';
          return '<span class="output-annotation">' + escapeHTML(line) + '</span>';
        }).join('\n');
      },
      output(output, error = false, sourceLine = '') {
        if (!error && /^(?:git\s+)?help(?:\s|$)/.test(String(sourceLine).trim())) return this.help(output);
        return String(output ?? '').split('\n').map(line => {
          let type = error ? 'error' : /^\+/.test(line) ? 'added' : /^-(?!--\s)/.test(line) ? 'removed' : /^(?:Git Atlas|用法|作用|示例|常见误区|操作提示|继续查看|开始与保存|检查与历史|文件与撤销|分支与整合|远程协作|获取帮助|从这里开始)$|^@@|^diff\s|^index\s|^commit\s|^On branch\s/.test(line) ? 'meta' : /^\s*(?:CONFLICT|冲突|fatal:|error:)/i.test(line) ? 'error' : /^\s*(?:new file:|A\s|已暂存)/.test(line) ? 'added' : /^\s*(?:modified:|deleted:|M\s|D\s|\?\?\s)/.test(line) ? 'changed' : '';
          return type ? '<span class="output-' + type + '">' + escapeHTML(line) + '</span>' : escapeHTML(line);
        }).join('\n');
      }
    };
    Terminal.clear = function () {
      session.terminalClearAt = session.history.length;
      this.render(); StateManager.save(); notify('终端已清空，命令历史已保留');
      const input = $('mobile-command-input'); (input?.offsetParent !== null ? input : $('command-input'))?.focus({preventScroll: true});
    };
    const executeGitCommand = Terminal.execute;
    Terminal.execute = function (line) {
      if (line.trim() === 'clear') {
        $('command-input').value = ''; $('mobile-command-input').value = '';
        view.historyIndex = session.history.length; view.draft = ''; this.clear(); return;
      }
      if (line.trim()) view.historySelected = session.history.length;
      executeGitCommand.call(this, line);
    };
    Terminal.render = function () {
      const total = session.history.length, offset = Number.isInteger(session.terminalClearAt) ? Math.max(0, Math.min(total, session.terminalClearAt)) : 0;
      const recent = session.history.slice(Math.max(offset, total - 35));
      $('terminal-output').innerHTML = recent.map(e => '<div class="terminal-entry"><div class="terminal-command">' + CommandColors.command(e.line) + '</div><pre class="' + (e.error ? 'terminal-error' : 'terminal-result') + '">' + CommandColors.output(e.output, e.error, e.line) + '</pre></div>').join('') || '<div class="terminal-empty"><span class="terminal-empty-mark" aria-hidden="true">❯_</span><p>' + (session.terminalClearAt !== undefined ? '终端已清空' : '从一条命令开始') + '</p><small>' + (session.terminalClearAt !== undefined ? '历史记录保存在右上方「命令历史」。' : sim.state.initialized ? '输入 git status，查看上方四区的文件状态。' : '输入 git init，初始化一个全新的仓库。') + '</small></div>';
      const output = $('terminal-output'); output.scrollTop = output.scrollHeight;
      $('terminal-branch').textContent = sim.branch(); $('terminal-branch').title = 'HEAD ' + (sim.head() || '尚无提交'); this.history();
    };
    $('terminal-clear').addEventListener('click', () => Terminal.clear());
    for (const input of [$('command-input'), $('mobile-command-input')]) input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {e.preventDefault(); Terminal.clear()}
    });
    // The workspace is always open practice; old saved exercises remain readable.
    Scenarios.update = function () { };
    Scenarios.render = function () { };

