    /* Detailed terminal help is generated from the same references used by the command guide. */
    const HelpCommand = {
      categories: [
        ['开始与保存', ['init', 'config', 'status', 'add', 'commit']],
        ['检查与历史', ['diff', 'log', 'show', 'reflog']],
        ['文件与撤销', ['restore', 'reset', 'revert', 'rm', 'mv', 'stash']],
        ['分支与整合', ['branch', 'switch', 'checkout', 'merge', 'cherry-pick', 'tag']],
        ['远程协作', ['remote', 'fetch', 'pull', 'push', 'clone']],
        ['获取帮助', ['help']]
      ],
      matches(line) {
        try {const tokens = CommandParser.parse(String(line)); if (tokens[0] === 'git') tokens.shift(); return tokens[0] === 'help'} catch (error) {return /^(?:git\s+)?help(?:\s|$)/.test(String(line).trim())}
      },
      parse(line) {
        const tokens = CommandParser.parse(String(line)); if (tokens[0] === 'git') tokens.shift(); tokens.shift();
        if (!tokens.length || tokens.length === 1 && ['-h', '--help'].includes(tokens[0])) return {mode: 'overview'};
        if (tokens.length === 1 && ['-a', '--all'].includes(tokens[0])) return {mode: 'all'};
        if (tokens.length !== 1 || tokens[0].startsWith('-')) throw Error('用法：git help、git help <命令> 或 git help --all。');
        return {mode: 'command', name: tokens[0].replace(/^git-/, '')};
      },
      supported() {return REFERENCES.filter(reference => reference.supported)},
      overview() {
        const supported = new Set(this.supported().map(reference => reference.name));
        const groups = this.categories.map(([title, names]) => title + '\n  ' + names.filter(name => supported.has(name)).map(name => 'git ' + name).join('   ')).filter(group => !group.endsWith('\n  '));
        return 'Git Atlas 命令帮助\n\n用法\n  git help <命令>    查看语法、作用、示例和注意事项\n  git help --all     查看全部支持的命令\n\n' + groups.join('\n\n') + '\n\n从这里开始\n  git help status\n  git help add\n  git help commit\n\n提示：所有操作都在浏览器内模拟，不会调用电脑上的 Git。';
      },
      all() {
        const rows = this.supported().map(reference => ('git ' + reference.name).padEnd(19, ' ') + reference.summary);
        return 'Git Atlas 支持的全部命令（' + rows.length + '）\n\n' + rows.join('\n') + '\n\n输入 git help <命令> 查看详细说明，例如：git help merge';
      },
      command(name) {
        const reference = this.supported().find(item => item.name === name);
        if (!reference) {
          const suggestions = this.supported().filter(item => item.name.startsWith(name) || name.startsWith(item.name)).slice(0, 3).map(item => 'git help ' + item.name);
          throw Error('找不到命令帮助：' + name + '。' + (suggestions.length ? '你可能想查看 ' + suggestions.join('、') + '。' : '输入 git help --all 查看支持的命令。'));
        }
        const examples = reference.examples || [{label: '示例', command: reference.example, description: ''}];
        const blocks = [
          'git ' + reference.name + ' · ' + reference.summary,
          '用法\n' + reference.syntax.split('\n').map(line => '  ' + line).join('\n'),
          '作用\n  ' + (reference.detail ? reference.detail.split(/\n\n+/)[0].replace(/\n/g, '\n  ') : reference.summary)
        ];
        blocks.push('示例\n' + examples.slice(0, 5).map(example => '  ' + example.command + (example.label ? '\n    ' + example.label : '')).join('\n'));
        blocks.push('常见误区\n  ' + reference.pitfall);
        blocks.push('操作提示\n  ' + reference.note);
        blocks.push('继续查看\n  右上角“命令参考”已定位到 git ' + reference.name + '，可阅读完整说明。');
        return {reference, output: blocks.join('\n\n')};
      },
      result(line) {
        const request = this.parse(line);
        if (request.mode === 'overview') return {command: 'help', output: this.overview(), explanation: 'help 只读取说明，不会改变工作区、暂存区、提交或分支。输入 git help <命令> 可继续查看详情。'};
        if (request.mode === 'all') return {command: 'help', output: this.all(), explanation: '这里列出本站已模拟的全部 Git 命令；它不是系统 Git 的完整命令清单。'};
        const detail = this.command(request.name);
        return {command: detail.reference.name, output: detail.output, explanation: '已显示 git ' + detail.reference.name + ' 的帮助，并将“命令参考”定位到同一命令。'};
      }
    };

