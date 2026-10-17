
    /* A deterministic, in-memory teaching model. No filesystem or network access. */
    (function (root) {
      'use strict';
      const copy = value => structuredClone(value);
      const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
      const keys = (...trees) => [...new Set(trees.flatMap(tree => Object.keys(tree)))].sort();
      const equal = (a, b) => keys(a, b).every(key => a[key] === b[key]);
      const changed = (a, b) => keys(a, b).filter(key => a[key] !== b[key]);
      const safe = value => {
        if (!value || value.split('/').some(p => ['__proto__', 'prototype', 'constructor'].includes(p))) throw Error('名称为空或包含不安全的字段。');
        return value;
      };
      const path = value => {
        value = value.replace(/^\.\//, ''); safe(value);
        if (value.startsWith('/') || /[\x00-\x1f\\:]/.test(value) || value.split('/').some(p => p === '..' || p === '.')) throw Error('请使用仓库内的相对文件路径。');
        return value.replace(/\/$/, '');
      };
      const name = value => {
        safe(value);
        if (value === 'HEAD' || /[\s~^:?*\[\\]/.test(value) || value.includes('..') || value.includes('@{') || value.startsWith('-') || value.startsWith('/') || value.endsWith('/') || value.split('/').some(p => !p || p.startsWith('.') || p.endsWith('.') || p.endsWith('.lock'))) throw Error('无效的引用名称：' + value);
        return value;
      };
      class CommandParser {
        static parse(line) {
          const result = []; let token = '', quote = '', active = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (quote === "'") {if (c === "'") quote = ''; else token += c; continue;}
            if (c === '\\') {
              if (i + 1 === line.length) throw Error('命令结尾的转义符不完整。');
              const next = line[i + 1];
              if (quote && !['"', '\\', '$', '`'].includes(next)) token += c;
              else {token += next; i++;}
              active = true; continue;
            }
            if (quote) {if (c === quote) quote = ''; else token += c; continue;}
            if (c === '"' || c === "'") {quote = c; active = true;}
            else if (/\s/.test(c)) {if (active) {result.push(token); token = ''; active = false;} }
            else {token += c; active = true;}
          }
          if (quote) throw Error('引号尚未闭合，请补齐引号。');
          if (active) result.push(token);
          return result;
        }
      }
      class GitSim {
        static fresh(initialized = false) {
          return {initialized, config: {global: {'user.name': 'Git Learner', 'user.email': 'learner@example.com'}, local: {}}, workingTree: {}, index: {}, commits: new Map(), refs: {branches: {main: null}, HEAD: {type: 'branch', name: 'main'}, tags: {}, remoteTracking: {}}, remotes: {}, stash: [], conflicts: [], merge: null, operation: null, reflog: [], upstream: {}};
        }
        constructor(state = GitSim.fresh()) {
          this.state = copy(state);
          // Older saved repositories have no operation or reflog fields.
          if (!owns(this.state, 'operation')) this.state.operation = null;
          if (!Array.isArray(this.state.reflog)) this.state.reflog = this.head() ? [{hash: this.head(), oldHash: null, branch: this.branch(), action: 'import: 从已有存档开始记录', timestamp: new Date().toISOString()}] : [];
          const saved = this.state.config;
          if (!saved) this.state.config = copy(GitSim.fresh().config);
          else {
            const validScope = value => Object.fromEntries(['user.name', 'user.email'].filter(key => value && owns(value, key) && typeof value[key] === 'string').map(key => [key, value[key]]));
            this.state.config = saved.user
              ? {global: copy(GitSim.fresh().config.global), local: validScope({'user.name': saved.user.name, 'user.email': saved.user.email})}
              : {global: validScope(saved.global), local: validScope(saved.local)};
          }
        }
        configValue(key) {
          const config = this.state.config;
          return owns(config.local, key) ? config.local[key] : config.global[key];
        }
        authorIdentity() {
          const username = this.configValue('user.name'), email = this.configValue('user.email');
          if (!username?.trim() || !email?.trim()) throw Error('尚未完整配置提交作者。请运行 git config user.name "你的名字" 和 git config user.email "you@example.com"，然后重试提交。');
          return username + ' <' + email + '>';
        }
        head() {const h = this.state.refs.HEAD; return h.type === 'branch' ? this.state.refs.branches[h.name] || null : h.hash || null;}
        branch() {return this.state.refs.HEAD.type === 'branch' ? this.state.refs.HEAD.name : '(detached)';}
        tree(ref = 'HEAD') {const hash = this.resolve(ref); return hash ? copy(this.state.commits.get(hash).tree) : {};}
        resolve(ref = 'HEAD') {
          const suffix = ref.match(/([~^])(\d*)$/);
          if (suffix) {
            let h = this.resolve(ref.slice(0, suffix.index)); const n = suffix[2] === '' ? 1 : Number(suffix[2]);
            if (suffix[1] === '^') h = n === 0 ? h : this.state.commits.get(h)?.parents[n - 1];
            else for (let i = 0; i < n; i++) h = this.state.commits.get(h)?.parents[0];
            if (!h) throw Error('该引用没有指定的父提交：' + ref); return h;
          }
          const logRef = ref.match(/^HEAD@\{(\d+)\}$/);
          if (logRef) {
            const entry = this.state.reflog[this.state.reflog.length - 1 - Number(logRef[1])];
            if (!entry?.hash || !this.state.commits.has(entry.hash)) throw Error('找不到 HEAD 的这条 reflog 记录：' + ref);
            return entry.hash;
          }
          if (ref === 'HEAD') return this.head();
          const fullRef = ref.match(/^refs\/(heads|tags|remotes)\/(.+)$/);
          if (fullRef) {const table = this.state.refs[{heads: 'branches', tags: 'tags', remotes: 'remoteTracking'}[fullRef[1]]]; if (owns(table, fullRef[2])) return table[fullRef[2]]; throw Error('找不到引用：' + ref);}
          const shortened = ref;
          for (const collection of [this.state.refs.branches, this.state.refs.tags, this.state.refs.remoteTracking]) if (owns(collection, shortened)) return collection[shortened];
          const matches = [...this.state.commits.keys()].filter(h => h.startsWith(ref));
          if (ref && matches.length === 1) return matches[0];
          throw Error(matches.length > 1 ? '提交哈希不唯一，请输入更多字符。' : '找不到引用：' + ref);
        }
        options(args, spec = {}) {
          const flags = {}, positional = []; let literal = false;
          for (let i = 0; i < args.length; i++) {
            const a = args[i]; if (a === '--' && !literal) {literal = true; continue;}
            if (!literal && a.startsWith('-')) {
              if (!owns(spec, a)) throw Error('本教程暂不支持参数 ' + a + '，请查看命令帮助。');
              if (spec[a]) {if (i + 1 >= args.length || args[i + 1].startsWith('-')) throw Error(a + ' 后需要一个值。'); flags[a] = args[++i];}
              else flags[a] = true;
            } else positional.push(a);
          }
          return [positional, flags];
        }
        countOptions(args, spec = {}) {
          const normalized = []; let literal = false, countSeen = false;
          const count = value => {if (!/^\d+$/.test(value || '') || !Number.isSafeInteger(Number(value))) throw Error('提交数量必须是非负整数。'); if (countSeen) throw Error('每次只能指定一个提交数量限制。'); countSeen = true; normalized.push('-n', value);};
          for (let i = 0; i < args.length; i++) {
            const value = args[i];
            if (value === '--') {literal = true; normalized.push(value);}
            else if (!literal && (value === '-n' || value === '--max-count')) count(args[++i]);
            else if (!literal && value.startsWith('--max-count=')) count(value.slice(12));
            else if (!literal && /^-n\d+$/.test(value)) count(value.slice(2));
            else if (!literal && /^-\d+$/.test(value)) count(value.slice(1));
            else normalized.push(value);
          }
          return this.options(normalized, {...spec, '-n': 1});
        }
        expect(args, min = 0, max = min) {if (args.length < min || args.length > max) throw Error('参数数量不正确，请查看本命令的用法。');}
        trackedDirty() {
          const tracked = {}; for (const p of keys(this.tree(), this.state.index)) if (owns(this.state.workingTree, p)) tracked[p] = this.state.workingTree[p];
          return !equal(this.tree(), this.state.index) || !equal(this.state.index, tracked);
        }
        clean() {
          if (this.state.operation) throw Error('当前正在进行 ' + this.state.operation.kind + '；请解决冲突后执行 git ' + this.state.operation.kind + ' --continue，或用 --abort 中止。');
          if (this.state.merge || this.state.conflicts.length) throw Error('请先解决并提交当前冲突，或执行 git merge --abort。');
          if (this.trackedDirty()) throw Error('工作区或暂存区有未提交更改；请先 commit、stash 或 restore。教学模拟保守地要求已跟踪文件干净，真实 Git 允许保留不受影响的修改。');
        }
        setHead(hash) {if (this.state.refs.HEAD.type === 'branch') this.state.refs.branches[this.branch()] = hash; else this.state.refs.HEAD.hash = hash;}
        install(tree, force = false) {
          const tracked = keys(this.tree(), this.state.index);
          if (!force) for (const p of Object.keys(tree)) if (owns(this.state.workingTree, p) && !tracked.includes(p)) throw Error('未跟踪文件会被覆盖：' + p);
          for (const p of tracked) delete this.state.workingTree[p];
          Object.assign(this.state.workingTree, copy(tree)); this.state.index = copy(tree);
        }
        paths(args, ...sources) {
          if (!args.length) throw Error('请提供文件路径，或使用 . 选择全部文件。');
          const all = keys(...sources), result = new Set();
          for (const raw of args) {
            if (raw === '.') {all.forEach(p => result.add(p)); continue;}
            const p = path(raw), matches = all.filter(k => k === p || k.startsWith(p + '/'));
            if (!matches.length) throw Error('找不到路径：' + p);
            matches.forEach(k => {path(k); result.add(k);});
          }
          return [...result];
        }
        ancestors(hash) {
          const seen = new Map(), queue = hash ? [[hash, 0]] : [];
          for (let i = 0; i < queue.length; i++) {const [h, n] = queue[i]; if (seen.has(h)) continue; seen.set(h, n); for (const p of this.state.commits.get(h)?.parents || []) queue.push([p, n + 1]);}
          return seen;
        }
        ancestor(a, b) {return a === null || this.ancestors(b).has(a);}
        common(a, b) {
          const aa = this.ancestors(a), bb = this.ancestors(b);
          const common = [...aa.keys()].filter(h => bb.has(h));
          const best = common.filter(h => !common.some(other => other !== h && this.ancestor(h, other)));
          if (best.length > 1) throw Error('存在多个最佳共同祖先；本教程暂不支持此类交叉合并历史。');
          return best[0] || null;
        }
        restoreAbortedOperation(before, base, incoming) {
          // Changed incoming paths may have been unstaged while resolving conflicts.
          const related = new Set([...keys(before.index, this.state.index), ...this.state.conflicts, ...changed(base, incoming).filter(p => owns(incoming, p))]);
          const preserved = Object.keys(this.state.workingTree).filter(p => !related.has(p));
          for (const p of Object.keys(before.index)) if (owns(before.workingTree, p)) {
            for (const other of preserved) if (p.startsWith(other + '/') || other.startsWith(p + '/')) throw Error('未跟踪文件与中止操作要恢复的路径冲突：' + other + ' / ' + p);
          }
          const workingTree = copy(this.state.workingTree);
          for (const p of related) {
            if (owns(before.index, p) && owns(before.workingTree, p)) workingTree[p] = before.workingTree[p];
            else delete workingTree[p];
          }
          this.state.workingTree = workingTree; this.state.index = copy(before.index);
        }
        createCommit(message, parents = this.head() ? [this.head()] : [], author = this.authorIdentity()) {
          const data = {parents: [...parents], message, author, timestamp: new Date().toISOString(), tree: copy(this.state.index), branch: this.branch()};
          let nonce = this.state.commits.size, hash;
          do {let code = 2166136261; const input = JSON.stringify(data) + nonce++; for (const c of input) code = Math.imul(code ^ c.charCodeAt(0), 16777619); hash = (code >>> 0).toString(16).padStart(8, '0');} while (this.state.commits.has(hash));
          this.state.commits.set(hash, {hash, ...data}); this.setHead(hash); return hash;
        }
        diffTrees(before, after) {
          return changed(before, after).map(p => {
            const old = owns(before, p), current = owns(after, p);
            return 'diff --git a/' + p + ' b/' + p + '\n--- ' + (old ? 'a/' + p : '/dev/null') + '\n+++ ' + (current ? 'b/' + p : '/dev/null') + '\n@@ 文件内容对比 @@\n' + (old ? before[p].split('\n').map(l => '-' + l).join('\n') + '\n' : '') + (current ? after[p].split('\n').map(l => '+' + l).join('\n') : '');
          }).join('\n') || '没有差异。';
        }
        result(command, output, explanation) {return {command, output, explanation};}
        run(line) {
          const backup = copy(this.state);
          try {
            const tokens = CommandParser.parse(String(line)); if (tokens[0] === 'git') tokens.shift();
            const command = tokens.shift(); if (!command) throw Error('请输入 Git 命令。');
            if (!['init', 'clone', 'help', 'config'].includes(command) && !this.state.initialized) throw Error('尚未初始化仓库，请先运行 git init 或 git clone demo://origin。');
            if (command === 'user.name' || command === 'user.email') throw Error('配置项不是子命令，请使用 git config ' + command + ' "' + (command === 'user.name' ? '你的名字' : 'you@example.com') + '"。');
            const method = this['cmd_' + command]; if (typeof method !== 'function') throw Error('本教程暂不支持 git ' + command + '。输入 git help 查看支持的命令。');
            const action = command + (tokens.length ? ': ' + tokens.join(' ') : ''), oldHead = backup.refs.HEAD.type === 'branch' ? backup.refs.branches[backup.refs.HEAD.name] || null : backup.refs.HEAD.hash || null;
            const [output, explanation] = method.call(this, tokens);
            if (this.head() && (this.head() !== oldHead || JSON.stringify(backup.refs.HEAD) !== JSON.stringify(this.state.refs.HEAD))) {
              this.state.reflog.push({hash: this.head(), oldHash: oldHead, branch: this.branch(), action, timestamp: new Date().toISOString()});
            }
            return this.result(command, output, explanation);
          } catch (error) {this.state = backup; throw error;}
        }
        cmd_help(args) {
          const [a, f] = this.options(args, {'-a': 0, '--all': 0, '-h': 0, '--help': 0});
          const commands = ['init', 'status', 'add', 'commit', 'config', 'log', 'diff', 'branch', 'checkout', 'switch', 'merge', 'cherry-pick', 'revert', 'reflog', 'reset', 'restore', 'rm', 'mv', 'remote', 'fetch', 'pull', 'push', 'clone', 'stash', 'tag', 'show', 'help'];
          if ((f['-a'] || f['--all']) && (a.length || f['-h'] || f['--help'])) throw Error('用法：git help、git help <命令> 或 git help --all。');
          if (f['-h'] || f['--help']) {if (a.length) throw Error('用法：git help、git help <命令> 或 git help --all。'); return ['用法：\n  git help\n  git help <命令>\n  git help --all', 'help 只读取帮助信息，不改变仓库。网页终端会同时展示命令参考中的详细说明。'];}
          if (f['-a'] || f['--all']) return [commands.join('\n'), '列出本教程实现的全部命令；在网页终端中输入 git help <命令> 可查看详细语法和示例。'];
          this.expect(a, 0, 1);
          if (a.length) {
            const command = a[0].replace(/^git-/, '');
            if (!commands.includes(command)) throw Error('找不到命令帮助：' + a[0] + '。输入 git help --all 查看支持的命令。');
            return ['git ' + command + '\n\n该命令已在本教程中实现。', '网页终端会从“命令参考”中补充该命令的语法、示例、常见误区和操作提示。'];
          }
          return ['Git Atlas 帮助\n\n用法：\n  git help <命令>    查看某条命令的详细说明\n  git help --all     列出全部支持的命令\n\n支持的命令：\n' + commands.join(' · '), '所有命令仅改变当前页面内的模拟仓库，不读写磁盘，也不访问真实远程仓库。'];
        }
        cmd_init(args) {
          const [a, f] = this.options(args, {'-b': 1}); this.expect(a);
          if (this.state.initialized) return ['已重新初始化现有模拟仓库。', '已有文件、提交和分支均保留。'];
          const branch = f['-b'] ? name(f['-b']) : 'main'; this.state.initialized = true;
          this.state.refs.branches = {[branch]: null}; this.state.refs.HEAD = {type: 'branch', name: branch};
          return ['已初始化空的 Git 模拟仓库，当前分支：' + branch, 'init 建立仓库元数据；文件尚未暂存或提交。'];
        }
        cmd_config(args) {
          const [a, f] = this.options(args, {'--global': 0, '--local': 0, '--list': 0, '-l': 0, '--get': 0, '--unset': 0});
          if (f['--global'] && f['--local']) throw Error('--global 和 --local 不能同时使用。');
          const list = !!(f['--list'] || f['-l']);
          if (Number(list) + Number(!!f['--get']) + Number(!!f['--unset']) > 1) throw Error('--list、--get、--unset 每次只能选择一个操作。');
          if (!a.length && !list) throw Error('用法：git config [--global|--local] user.name "姓名"；设置邮箱用 user.email；查看配置用 git config --list。');
          this.expect(a, list ? 0 : 1, list ? 0 : f['--get'] || f['--unset'] ? 1 : 2);
          const scope = f['--global'] ? 'global' : f['--local'] ? 'local' : null;
          const writing = !!f['--unset'] || a.length === 2;
          if (!this.state.initialized && (scope === 'local' || (writing && scope !== 'global'))) throw Error('当前未初始化仓库；先执行 git init，或使用 git config --global 配置模拟全局身份。');
          const label = scope === 'global' ? '模拟全局配置' : scope === 'local' ? '当前仓库配置' : '当前有效配置';
          const config = this.state.config;
          if (list) {
            const tables = scope ? [config[scope]] : this.state.initialized ? [config.global, config.local] : [config.global];
            const output = tables.flatMap(table => Object.entries(table).map(([key, value]) => key + '=' + value)).join('\n');
            return [output || '（没有配置项）', label + '。不指定范围时按全局、仓库顺序列出，同一键以仓库配置为准。本网站只保存到浏览器，不修改电脑上的 Git 配置。'];
          }
          const key = a[0].toLowerCase();
          if (!['user.name', 'user.email'].includes(key)) throw Error('目前支持 user.name 和 user.email。其他 git config 配置项暂未模拟。');
          const target = scope || 'local';
          if (f['--unset']) {
            if (!owns(config[target], key)) throw Error((target === 'global' ? '模拟全局' : '当前仓库') + '中没有配置 ' + key + '。');
            delete config[target][key];
            const effective = this.configValue(key);
            return ['已移除 ' + (target === 'global' ? 'global' : 'local') + ' 的 ' + key, '删除该范围的设置后，' + key + (effective === undefined ? ' 尚未配置。' : ' 当前生效值为：' + effective)];
          }
          if (!writing) {
            const value = scope ? config[scope][key] : this.state.initialized ? this.configValue(key) : config.global[key];
            if (value === undefined) throw Error(label + '中没有设置 ' + key + '。可使用 git config ' + (scope === 'global' ? '--global ' : '') + key + ' "值"。');
            return [value, label + '中的 ' + key + '；未指定范围时，仓库设置优先于全局设置。'];
          }
          const value = a[1].trim();
          if (!value || /[\x00-\x1f\x7f<>]/.test(value)) throw Error('姓名或邮箱不能为空，也不能包含换行、控制字符或尖括号。');
          config[target][key] = value;
          const overridden = target === 'global' && owns(config.local, key);
          return ['已设置 ' + (target === 'global' ? 'global' : 'local') + ' ' + key + '=' + value,
          (overridden ? '当前仓库已有同名配置，优先使用：' + config.local[key] + '。' : '新身份用于之后创建的提交，已有提交的作者保持不变。') + '此操作只改变浏览器内的模拟配置，不改变四区文件。'];
        }
        cmd_status(args) {
          const [a, f] = this.options(args, {'--short': 0, '-s': 0}); this.expect(a);
          const h = this.tree(), i = this.state.index, w = this.state.workingTree, lines = [];
          for (const p of keys(h, i, w)) {
            if (this.state.conflicts.includes(p)) {lines.push('UU ' + p + '  (合并冲突)'); continue;}
            if (!owns(h, p) && !owns(i, p)) {lines.push('?? ' + p + '  (未跟踪)'); continue;}
            const flag = (x, y) => x[p] === y[p] ? ' ' : !owns(y, p) ? 'D' : !owns(x, p) ? 'A' : 'M';
            const code = flag(h, i) + flag(i, w); if (code !== '  ') lines.push(code + ' ' + p);
          }
          return [(f['--short'] || f['-s'] ? '' : '当前分支：' + this.branch() + '\n') + (lines.join('\n') || '工作区干净，没有需要提交的更改。'), '状态两列：左列比较 HEAD → 暂存区，右列比较暂存区 → 工作区；?? 表示未跟踪。'];
        }
        cmd_add(args) {
          const [a, f] = this.options(args, {'-A': 0, '--all': 0});
          const paths = this.paths(a.length ? a : f['-A'] || f['--all'] ? ['.'] : [], this.state.workingTree, this.state.index, Object.fromEntries(this.state.conflicts.map(p => [p, ''])));
          for (const p of paths) {
            path(p); if (this.state.conflicts.includes(p) && /^(<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(this.state.workingTree[p] || '')) throw Error('文件仍包含冲突标记，请编辑解决后再 add：' + p);
            if (owns(this.state.workingTree, p)) this.state.index[p] = this.state.workingTree[p]; else delete this.state.index[p];
            this.state.conflicts = this.state.conflicts.filter(x => x !== p);
          }
          return ['已暂存 ' + paths.length + ' 个文件的当前状态。', 'add 复制这一刻的工作区内容到暂存区；之后的编辑不会自动进入暂存区。'];
        }
        cmd_commit(args) {
          const normalized = []; let literal = false;
          for (let i = 0; i < args.length; i++) {
            const value = args[i];
            if (value === '--') {literal = true; normalized.push(value);}
            else if (!literal && (value === '-m' || value === '--message')) {normalized.push(value); if (i + 1 < args.length) normalized.push(args[++i]);}
            else if (!literal && value.startsWith('-am')) {normalized.push('-a', '-m'); if (value.length > 3) normalized.push(value.slice(3)); else if (i + 1 < args.length) normalized.push(args[++i]);}
            else if (!literal && value.startsWith('-m') && value.length > 2) normalized.push('-m', value.slice(2));
            else normalized.push(value);
          }
          const [a, f] = this.options(normalized, {'-m': 1, '--message': 1, '-a': 0, '--all': 0, '--amend': 0, '--no-edit': 0}); this.expect(a);
          const previous = this.state.commits.get(this.head()), operation = this.state.operation;
          if (f['--amend'] && !previous) throw Error('还没有提交，无法使用 --amend。');
          if (f['--amend'] && (this.state.merge || operation)) throw Error('合并或提交应用正在进行期间不能使用 --amend；请先继续或中止当前操作。');
          let message = f['-m'] ?? f['--message'];
          if (f['--no-edit'] && message !== undefined) throw Error('--no-edit 和 -m / --message 不能同时使用。');
          if (f['--no-edit']) message = f['--amend'] ? previous.message : operation?.message || this.state.merge?.message;
          if (!message?.trim()) throw Error('请使用 git commit -m "提交说明"；改写并保留原说明可用 git commit --amend --no-edit。');
          if (this.state.conflicts.length) throw Error('仍有未解决的合并冲突，请编辑文件并 git add。');
          if (f['-a'] || f['--all']) for (const p of Object.keys(this.state.index)) {
            if (owns(this.state.workingTree, p)) this.state.index[p] = this.state.workingTree[p]; else delete this.state.index[p];
          }
          if (!this.state.merge && !f['--amend'] && equal(this.tree(), this.state.index)) throw Error('没有已暂存的更改，请先 git add；未跟踪文件不会被 commit -a 自动加入。');
          const parents = f['--amend'] ? previous.parents : this.state.merge?.parents;
          const author = f['--amend'] ? previous.author : operation?.author || this.authorIdentity();
          const hash = this.createCommit(message, parents, author); this.state.merge = null; this.state.operation = null;
          const explanation = f['--amend'] ? 'amend 用暂存区快照创建替代当前提交的新提交，保留原父提交和作者；旧提交仍可通过 reflog 找回。改写已推送提交后普通 push 可能被拒绝。' : operation ? '已记录冲突解决结果并完成 ' + operation.kind + '；新提交只以操作前的 HEAD 为父提交。' : 'commit 保存暂存区完整快照并移动当前分支指针；未暂存修改仍留在工作区。';
          return ['[' + this.branch() + ' ' + hash + '] ' + message, explanation + (f['-a'] || f['--all'] ? ' -a 仅自动暂存已跟踪文件的修改与删除。' : '')];
        }
        cmd_diff(args) {
          const [a, f] = this.options(args, {'--cached': 0, '--staged': 0}); this.expect(a);
          const cached = f['--cached'] || f['--staged']; let before = cached ? this.tree() : this.state.index, after = cached ? this.state.index : this.state.workingTree;
          if (!cached) {after = {}; for (const p of Object.keys(before)) if (owns(this.state.workingTree, p)) after[p] = this.state.workingTree[p];}
          return [this.diffTrees(before, after), cached ? '比较 HEAD 与暂存区：这些差异将进入下一次提交。' : '比较暂存区与工作区；未跟踪文件不在 diff 中。教学模式按文件展示完整前后内容。'];
        }
        cmd_log(args) {
          const [a, f] = this.countOptions(args, {'--oneline': 0, '--graph': 0, '--all': 0}); this.expect(a, 0, 1);
          const starts = f['--all'] ? [this.head(), ...Object.values(this.state.refs.branches), ...Object.values(this.state.refs.tags), ...Object.values(this.state.refs.remoteTracking)].filter(Boolean) : [this.resolve(a[0] || 'HEAD')];
          const reachable = new Set(starts.flatMap(h => [...this.ancestors(h).keys()]));
          const commits = [...this.state.commits.values()].reverse().filter(c => reachable.has(c.hash)).slice(0, f['-n'] === undefined ? undefined : Number(f['-n']));
          const output = commits.map(c => {
            const refs = Object.entries(this.state.refs.branches).filter(([, h]) => h === c.hash).map(([n]) => n === this.branch() ? 'HEAD → ' + n : n);
            refs.push(...Object.entries(this.state.refs.tags).filter(([, h]) => h === c.hash).map(([n]) => 'tag: ' + n));
            refs.push(...Object.entries(this.state.refs.remoteTracking).filter(([, h]) => h === c.hash).map(([n]) => n));
            if (this.branch() === '(detached)' && c.hash === this.head()) refs.unshift('HEAD');
            const prefix = f['--graph'] ? '* ' : '', label = refs.length ? ' (' + refs.join(', ') + ')' : '';
            const row = f['--oneline'] ? prefix + c.hash + label + ' ' + c.message : prefix + 'commit ' + c.hash + label + '\nAuthor: ' + c.author + '\nDate: ' + c.timestamp + '\n\n    ' + c.message;
            const edges = f['--graph'] ? c.parents.map((h, i) => '\n  ' + (i === c.parents.length - 1 ? '└─' : '├─') + ' 父提交 ' + h).join('') : '';
            return row + edges;
          }).join('\n');
          return [output || (f['-n'] === '0' ? '数量限制为 0，没有显示提交。' : '还没有提交。'), f['--graph'] ? '教学文本图逐项列出提交及其父提交边；合并有两个父提交。完整连线关系见页面提交图。' : 'log 沿父提交查看历史；--all 包括本地分支、标签和远程跟踪引用。'];
        }
        cmd_branch(args) {
          const [a, f] = this.options(args, {'-d': 0, '-D': 0, '-a': 0, '--all': 0, '-r': 0, '--remotes': 0, '-m': 0, '-M': 0}); this.expect(a, 0, 2);
          const all = f['-a'] || f['--all'], remote = f['-r'] || f['--remotes'];
          if (f['-m'] || f['-M']) {
            this.expect(a, 1, 2);
            if (all || remote || f['-d'] || f['-D'] || f['-m'] && f['-M']) throw Error('分支重命名不能同时指定列举、删除或多个重命名模式。');
            if (a.length === 1 && this.branch() === '(detached)') throw Error('当前为游离 HEAD，请指定旧分支名称。');
            const from = name(a.length === 1 ? this.branch() : a[0]), to = name(a.at(-1));
            if (!owns(this.state.refs.branches, from)) throw Error('找不到分支：' + from);
            if (from === to) return ['分支名称没有改变：' + from, '新旧名称相同，提交和分支指针保持原样。'];
            if (to === this.branch()) throw Error('不能覆盖当前正在使用的分支：' + to);
            if (owns(this.state.refs.branches, to) && !f['-M']) throw Error('分支已存在：' + to + '。需要覆盖时可使用 branch -M。');
            const current = from === this.branch(); this.state.refs.branches[to] = this.state.refs.branches[from]; delete this.state.refs.branches[from];
            if (owns(this.state.upstream, from)) this.state.upstream[to] = this.state.upstream[from]; else delete this.state.upstream[to];
            delete this.state.upstream[from]; if (current) this.state.refs.HEAD.name = to;
            return ['已重命名分支 ' + from + ' → ' + to, '本地分支改名并保留提交与上游配置；当前分支的 HEAD 同步更新，远程分支名称不变。'];
          }
          if (!a.length) {
            if (f['-d'] || f['-D']) throw Error('请指定要删除的分支。');
            const localLines = Object.entries(this.state.refs.branches).map(([n, h]) => (n === this.branch() ? '* ' : '  ') + n + ' ' + (h || '(尚无提交)'));
            const remoteLines = Object.entries(this.state.refs.remoteTracking).map(([n, h]) => '  ' + (all ? 'remotes/' : '') + n + ' ' + h);
            return [[...(!remote || all ? localLines : []), ...(all || remote ? remoteLines : [])].join('\n') || '没有匹配的分支。', '星号标出当前分支；-a 列出本地与远程跟踪分支，-r 仅列出远程跟踪分支。'];
          }
          if (all || remote) throw Error('本教程的 -a / -r 参数仅用于列出分支，不能与创建或删除同时使用。');
          const n = name(a[0]);
          if (f['-d'] || f['-D']) {
            this.expect(a, 1); if (!owns(this.state.refs.branches, n)) throw Error('找不到分支：' + n);
            if (n === this.branch()) throw Error('不能删除当前分支。');
            if (!f['-D'] && !this.ancestor(this.state.refs.branches[n], this.head())) throw Error('该分支尚未合并；确认不再需要后可使用 branch -D。');
            delete this.state.refs.branches[n]; delete this.state.upstream[n]; return ['已删除分支 ' + n, '删除分支移除引用；提交对象仍保存在模拟对象库。'];
          }
          if (owns(this.state.refs.branches, n)) throw Error('分支已存在：' + n);
          this.state.refs.branches[n] = this.resolve(a[1] || 'HEAD'); return ['已创建分支 ' + n, 'branch 创建指针，不自动切换；使用 switch 切换分支。'];
        }
        filePathCollision(tree) {
          for (const p of Object.keys(tree)) {
            let split = p.indexOf('/');
            while (split !== -1) {
              if (owns(tree, p.slice(0, split))) return p.slice(0, split);
              split = p.indexOf('/', split + 1);
            }
          }
          return null;
        }
        checkout(args, switching) {
          if (!switching && args.includes('--')) {
            const split = args.indexOf('--'), pre = args.slice(0, split), files = args.slice(split + 1); this.expect(pre, 0, 1);
            const source = pre.length ? this.tree(pre[0]) : this.state.index;
            const paths = this.paths(files, source, this.state.index, Object.fromEntries(this.state.conflicts.map(p => [p, ''])));
            for (const p of paths) {if (owns(source, p)) this.state.workingTree[p] = source[p]; else delete this.state.workingTree[p]; if (pre.length) {if (owns(source, p)) this.state.index[p] = source[p]; else delete this.state.index[p];} }
            if (pre.length) this.state.conflicts = this.state.conflicts.filter(p => !paths.includes(p));
            return ['已恢复 ' + paths.length + ' 个文件。', pre.length ? 'checkout 引用 -- 路径同时恢复暂存区和工作区。' : 'checkout -- 路径从暂存区恢复工作区，丢弃对应未暂存编辑。'];
          }
          const [a, f] = this.options(args, switching ? {'-c': 1, '--detach': 0} : {'-b': 1, '--detach': 0});
          const create = f[switching ? '-c' : '-b']; this.expect(a, create ? 0 : 1, 1);
          if (this.state.operation) throw Error('当前正在进行 ' + this.state.operation.kind + '；请解决冲突后执行 git ' + this.state.operation.kind + ' --continue，或用 --abort 中止。');
          if (this.state.merge || this.state.conflicts.length) throw Error('请先解决并提交当前冲突，或执行 git merge --abort。');
          const ref = a[0] || 'HEAD', hash = this.resolve(ref), n = create ? name(create) : ref;
          if (create && owns(this.state.refs.branches, n)) throw Error('分支已存在：' + n);
          if (switching && !create && !f['--detach'] && !owns(this.state.refs.branches, n)) throw Error('switch 需要分支名称；游离 HEAD 请使用 switch --detach。');
          const tree = hash ? this.state.commits.get(hash).tree : {}, head = this.tree(), index = this.state.index, working = this.state.workingTree;
          const nextIndex = copy(index), nextWork = copy(working);
          for (const p of keys(head, index, tree)) {
            // The target may reuse the current HEAD or an already staged blob without touching local edits.
            if (head[p] === tree[p] || index[p] === tree[p]) continue;
            if (index[p] !== head[p]) throw Error('暂存区有未提交更改，切换会覆盖：' + p);
            if (owns(working, p) && working[p] !== index[p]) throw Error((owns(index, p) ? '工作区有未提交更改，切换会覆盖：' : '未跟踪文件会被覆盖：') + p);
            if (owns(tree, p)) {nextIndex[p] = tree[p]; nextWork[p] = tree[p];}
            else {delete nextIndex[p]; delete nextWork[p];}
          }
          const indexCollision = this.filePathCollision(nextIndex), workCollision = this.filePathCollision(nextWork);
          if (indexCollision) throw Error('暂存区文件与目录路径冲突，切换会覆盖：' + indexCollision);
          if (workCollision) throw Error('未跟踪文件或工作区更改会被覆盖，文件与目录路径冲突：' + workCollision);
          this.state.index = nextIndex; this.state.workingTree = nextWork;
          if (create) this.state.refs.branches[n] = hash;
          this.state.refs.HEAD = !f['--detach'] && (create || owns(this.state.refs.branches, n)) ? {type: 'branch', name: n} : {type: 'detached', hash};
          return ['已切换到 ' + (this.branch() === '(detached)' ? '游离 HEAD：' + hash : '分支 ' + this.branch()), '切换 HEAD，并更新目标提交中改变的文件；不受影响的暂存、工作区修改与未跟踪文件保留。可能覆盖本地更改时拒绝切换。'];
        }
        cmd_checkout(args) {return this.checkout(args, false);}
        cmd_switch(args) {return this.checkout(args, true);}
        cmd_merge(args) {
          const [a, f] = this.options(args, {'--abort': 0, '--no-ff': 0, '-m': 1});
          if (f['--abort']) {
            this.expect(a); if (!this.state.merge) throw Error('当前没有可中止的合并。');
            const operation = this.state.merge, [ours, theirs] = operation.parents, incoming = this.state.commits.get(theirs)?.tree;
            if (!incoming) throw Error('无法读取本次合并的提交，无法安全中止。');
            let common = operation.base;
            if (!owns(operation, 'base')) {
              // Legacy pending merges used the shortest-distance base, not today's best base.
              const aa = this.ancestors(ours), bb = this.ancestors(theirs);
              common = [...aa.keys()].filter(h => bb.has(h)).sort((x, y) => aa.get(x) + bb.get(x) - aa.get(y) - bb.get(y))[0] || null;
            }
            const base = common ? this.state.commits.get(common).tree : {};
            this.restoreAbortedOperation(operation.before, base, incoming); this.state.conflicts = []; this.state.merge = null;
            return ['已中止合并并恢复合并前的文件状态。', 'merge --abort 放弃本次合并及冲突处理中的编辑。'];
          }
          this.expect(a, 1); this.clean(); const ours = this.head(), theirs = this.resolve(a[0]);
          if (!theirs || this.ancestor(theirs, ours)) return ['已经是最新状态。', '目标提交已经包含在当前分支历史中。'];
          if (this.ancestor(ours, theirs) && !f['--no-ff']) {this.install(this.state.commits.get(theirs).tree); this.setHead(theirs); return ['Fast-forward：' + (ours || '(空)') + ' → ' + theirs, '当前分支没有独有提交，直接前移分支指针，不创建合并提交。'];}
          const common = this.common(ours, theirs); if (!common && ours) throw Error('两个分支没有共同祖先；本教程不支持合并无关历史。');
          const base = common ? this.state.commits.get(common).tree : {}, left = this.tree(), right = this.state.commits.get(theirs).tree, merged = {}, conflicts = [];
          for (const p of keys(base, left, right)) {
            let value;
            if (left[p] === right[p] || right[p] === base[p]) value = left[p];
            else if (left[p] === base[p]) value = right[p];
            else {conflicts.push(p); value = '<<<<<<< HEAD\n' + (left[p] ?? '') + '\n=======\n' + (right[p] ?? '') + '\n>>>>>>> ' + a[0] + '\n';}
            if (value !== undefined) merged[p] = value;
          }
          const before = {workingTree: copy(this.state.workingTree), index: copy(this.state.index)};
          this.install(merged); const parents = [ours, theirs].filter(Boolean), message = f['-m'] || "Merge branch '" + a[0] + "'";
          if (conflicts.length) {
            this.state.conflicts = conflicts; this.state.merge = {parents, message, before, base: common};
            for (const p of conflicts) {if (owns(left, p)) this.state.index[p] = left[p]; else delete this.state.index[p];}
            return ['CONFLICT：' + conflicts.join(', ') + '\n请编辑冲突标记，git add 后 git commit。', '教学模拟使用文件级三方合并：双方都修改同一个文件且结果不同时产生冲突，即使修改的是不同行。'];
          }
          const hash = this.createCommit(message, parents); return ['合并完成，创建提交 ' + hash, '基于共同祖先进行文件级三方合并，新提交记录两个父提交。'];
        }
        cmd_reflog(args) {
          const [a, f] = this.countOptions(args, {'--oneline': 0}); this.expect(a, 0, 1);
          if (a.length && a[0] !== 'show') throw Error('本教程支持 git reflog [show] [-n 数量]，只记录 HEAD。');
          const entries = [...this.state.reflog].reverse().slice(0, f['-n'] === undefined ? undefined : Number(f['-n']));
          return [entries.map((entry, i) => entry.hash + ' HEAD@{' + i + '}: ' + entry.action).join('\n') || '没有可显示的 HEAD 记录。', 'reflog 记录本地 HEAD 移动和分支切换；可用 HEAD@{1} 读取此前记录，并通过 show、branch 或 reset 找回提交。旧存档只从导入时开始记录。'];
        }
        applyCommit(args, kind) {
          const [a, f] = this.options(args, {'--continue': 0, '--abort': 0});
          if (f['--continue'] && f['--abort']) throw Error('--continue 和 --abort 不能同时使用。');
          if (f['--continue'] || f['--abort']) {
            this.expect(a); const operation = this.state.operation;
            if (!operation || operation.kind !== kind) throw Error('当前没有正在进行的 ' + kind + ' 操作。');
            if (f['--abort']) {
              const target = this.state.commits.get(operation.targetHash);
              if (!target) throw Error('无法读取本次操作的提交，无法安全中止。');
              const parentTree = target.parents.length ? this.state.commits.get(target.parents[0])?.tree : {};
              if (!parentTree) throw Error('无法读取本次操作的父提交，无法安全中止。');
              this.restoreAbortedOperation(operation.before, kind === 'revert' ? target.tree : parentTree, kind === 'revert' ? parentTree : target.tree);
              this.state.conflicts = []; this.state.operation = null;
              return ['已中止 ' + kind + ' 并恢复操作前的文件状态。', '--abort 放弃本次冲突解决中的编辑；原 HEAD 与已有提交不变。'];
            }
            if (this.state.conflicts.length) throw Error('仍有未解决的冲突，请先编辑文件并 git add，然后执行 git ' + kind + ' --continue。');
            if (equal(this.tree(), this.state.index)) throw Error('解决后的暂存区没有改动，本次操作为空；可执行 git ' + kind + ' --abort 中止。');
            const hash = this.createCommit(operation.message, undefined, operation.author); this.state.operation = null;
            return ['已完成 ' + kind + '，创建提交 ' + hash, '冲突解决结果已写入新提交，原有历史保留，新提交以此前 HEAD 为唯一父提交。'];
          }
          this.expect(a, 1); this.clean(); const targetHash = this.resolve(a[0]), target = this.state.commits.get(targetHash);
          if (!target) throw Error('指定引用还没有提交。');
          if (target.parents.length > 1) throw Error('本教程暂不支持对合并提交执行 ' + kind + '；请选择只有一个父提交的普通提交或根提交。');
          const parentTree = target.parents.length ? this.state.commits.get(target.parents[0]).tree : {};
          const base = kind === 'revert' ? target.tree : parentTree, incoming = kind === 'revert' ? parentTree : target.tree;
          const current = this.tree(), merged = {}, conflicts = [];
          for (const p of keys(base, current, incoming)) {
            let value;
            if (current[p] === incoming[p] || incoming[p] === base[p]) value = current[p];
            else if (current[p] === base[p]) value = incoming[p];
            else {conflicts.push(p); value = '<<<<<<< HEAD\n' + (current[p] ?? '') + '\n=======\n' + (incoming[p] ?? '') + '\n>>>>>>> ' + kind + ' ' + targetHash + '\n';}
            if (value !== undefined) merged[p] = value;
          }
          if (!conflicts.length && equal(current, merged)) throw Error('本次 ' + kind + ' 没有产生改动（可能已经应用），未创建空提交。');
          const before = {workingTree: copy(this.state.workingTree), index: copy(this.state.index)};
          const message = kind === 'revert' ? 'Revert "' + target.message + '"' : target.message, author = kind === 'revert' ? this.authorIdentity() : target.author;
          this.install(merged);
          if (conflicts.length) {
            this.state.conflicts = conflicts; this.state.operation = {kind, targetHash, message, author, before};
            for (const p of conflicts) {if (owns(current, p)) this.state.index[p] = current[p]; else delete this.state.index[p];}
            return ['CONFLICT：' + conflicts.join(', ') + '\n请编辑冲突标记，git add 后执行 git ' + kind + ' --continue；放弃用 git ' + kind + ' --abort。', '本模拟采用文件级三方合并：双方对同一文件的改动结果不同时产生冲突；真实 Git 通常可以自动组合不重叠的行。'];
          }
          const hash = this.createCommit(message, undefined, author);
          return ['[' + this.branch() + ' ' + hash + '] ' + message, kind === 'revert' ? 'revert 将指定提交的改动反向应用并创建新提交；原提交和后续历史都保留。' : 'cherry-pick 仅把选中提交相对父提交的改动应用到当前分支，创建新提交并保留来源作者；来源分支不移动。'];
        }
        ['cmd_cherry-pick'](args) {return this.applyCommit(args, 'cherry-pick');}
        cmd_revert(args) {return this.applyCommit(args, 'revert');}
        cmd_reset(args) {
          const [a, f] = this.options(args, {'--soft': 0, '--mixed': 0, '--hard': 0}); this.expect(a, 0, 1);
          if (Object.keys(f).length > 1) throw Error('reset 只能选择一种模式。');
          const hash = this.resolve(a[0] || 'HEAD'), tree = hash ? this.state.commits.get(hash).tree : {}, mode = f['--hard'] ? 'hard' : f['--soft'] ? 'soft' : 'mixed';
          if ((this.state.merge || this.state.operation) && mode === 'soft') throw Error('合并或提交应用进行期间不能执行 soft reset。');
          if (mode === 'hard') this.install(tree, true); else if (mode === 'mixed') this.state.index = copy(tree);
          this.setHead(hash); this.state.conflicts = []; this.state.merge = null; this.state.operation = null;
          return ['HEAD 已移动到 ' + (hash || '(空)') + '，模式：' + mode, {soft: '仅移动分支指针，暂存区和工作区保持原样。', mixed: '移动分支并重置暂存区；工作区保留，差异成为未暂存修改。', hard: '移动分支，并重置暂存区和已跟踪工作区；无关未跟踪文件保留。'}[mode]];
        }
        cmd_restore(args) {
          const [a, f] = this.options(args, {'--staged': 0, '--worktree': 0, '--source': 1, '-s': 1});
          const staged = !!f['--staged'], work = !!f['--worktree'] || !staged, ref = f['--source'] || f['-s'];
          const source = ref ? this.tree(ref) : staged ? this.tree() : this.state.index;
          const paths = this.paths(a, source, this.state.index, Object.fromEntries(this.state.conflicts.map(p => [p, ''])));
          for (const p of paths) for (const target of [...(staged ? [this.state.index] : []), ...(work ? [this.state.workingTree] : [])]) {if (owns(source, p)) target[p] = source[p]; else delete target[p];}
          if (staged) this.state.conflicts = this.state.conflicts.filter(p => !paths.includes(p));
          return ['已恢复 ' + paths.length + ' 个文件的' + (staged && work ? '暂存区与工作区' : staged ? '暂存区' : '工作区') + '。', 'restore 默认从暂存区恢复工作区；--staged 默认从 HEAD 恢复暂存区；--source 指定来源。'];
        }
        cmd_rm(args) {
          const [a, f] = this.options(args, {'--cached': 0, '-f': 0}); const paths = this.paths(a, this.state.index);
          for (const p of paths) {
            if (!f['-f'] && (f['--cached'] ? this.state.index[p] !== this.tree()[p] && this.state.index[p] !== this.state.workingTree[p] : this.state.index[p] !== this.tree()[p] || this.state.index[p] !== this.state.workingTree[p])) throw Error('文件有未提交修改，删除前请保存或使用 rm -f：' + p);
            delete this.state.index[p]; if (!f['--cached']) delete this.state.workingTree[p]; this.state.conflicts = this.state.conflicts.filter(x => x !== p);
          }
          return ['已' + (f['--cached'] ? '取消跟踪' : '删除') + '：' + paths.join(', '), f['--cached'] ? '只从暂存区移除文件，工作区副本保留；下次提交记录删除。' : '同时移除工作区和暂存区文件，删除已暂存。'];
        }
        cmd_mv(args) {
          const [a] = this.options(args); this.expect(a, 2); const source = path(a[0]), target = path(a[1]);
          if (source === target) throw Error('源路径与目标路径不能相同。');
          const paths = keys(this.state.index, this.state.workingTree);
          if (paths.some(p => p.startsWith(source + '/') || p.startsWith(target + '/'))) throw Error('本教程的 mv 仅支持单个文件，不能把目录作为源或目标。');
          if (!owns(this.state.index, source) || !owns(this.state.workingTree, source)) throw Error('源文件不存在或未跟踪。');
          if (this.state.conflicts.includes(source)) throw Error('源文件仍有未解决的冲突，请先解决并 git add。');
          if (owns(this.state.workingTree, target) || owns(this.state.index, target)) throw Error('目标文件已经存在。');
          if (paths.some(p => target.startsWith(p + '/'))) throw Error('目标路径的父级是普通文件，不能创建文件与目录冲突。');
          this.state.workingTree[target] = this.state.workingTree[source]; this.state.index[target] = this.state.index[source]; delete this.state.workingTree[source]; delete this.state.index[source];
          return ['已重命名 ' + source + ' → ' + target, 'mv 更新工作区并暂存重命名；暂存内容与未暂存编辑分别保留。提交快照以旧路径删除、新路径新增表示。'];
        }
        cmd_remote(args) {
          const [a, f] = this.options(args, {'-v': 0});
          if (!a.length) return [Object.entries(this.state.remotes).map(([n, r]) => n + (f['-v'] ? '\t' + r.url + ' (模拟 fetch / push)' : '')).join('\n') || '尚未配置远程仓库。', 'remote 维护本地模拟远程仓库的名称和 URL，不访问网络。'];
          const verb = a[0];
          if (!['add', 'set-url', 'get-url'].includes(verb)) throw Error('本教程支持 remote add <名称> <URL>、remote set-url <名称> <URL>、remote get-url <名称> 和 remote -v。');
          if (f['-v'] && verb !== 'add') throw Error('本教程的 -v 只用于列出远程仓库；修改或读取地址请使用 remote ' + verb + ' <名称>' + (verb === 'set-url' ? ' <URL>。' : '。'));
          this.expect(a, verb === 'get-url' ? 2 : 3);
          const n = name(a[1]);
          if (verb === 'get-url') {this.remoteName(n); return [this.state.remotes[n].url, 'get-url 只读取本浏览器中保存的模拟远程地址，不访问网络，也不改变仓库。'];}
          const url = a[2];
          if (!url.trim() || /[\x00-\x1f\x7f-\x9f]/.test(url)) throw Error('远程地址不能为空，也不能包含换行、制表符或其他控制字符。请提供有效的 URL 或模拟地址，例如 demo://origin。');
          if (verb === 'set-url') {
            this.remoteName(n); this.state.remotes[n].url = url;
            return ['已更新模拟远程 ' + n + ' 的地址：' + url, 'set-url 仅修改本浏览器中的模拟地址标记；远程提交与分支、本地远程跟踪引用及上游关系全部保留，不访问网络。'];
          }
          if (owns(this.state.remotes, n)) throw Error('远程仓库已存在：' + n + '。修改地址请使用 git remote set-url ' + n + ' <URL>。');
          this.state.remotes[n] = {url, branches: {}, commits: new Map()}; return ['已添加模拟远程 ' + n + '：' + url, '新远程在本模拟中为空；push 可上传本地提交，fetch 可读取模拟远程中的提交。'];
        }
        remoteName(n) {n = n || 'origin'; if (!owns(this.state.remotes, n)) throw Error('找不到远程仓库：' + n); return n;}
        fetchRemote(n) {
          const remote = this.state.remotes[n]; for (const [h, c] of remote.commits) this.state.commits.set(h, copy(c));
          for (const [branch, h] of Object.entries(remote.branches)) this.state.refs.remoteTracking[n + '/' + branch] = h;
        }
        cmd_fetch(args) {
          const [a] = this.options(args); this.expect(a, 0, 1); const n = this.remoteName(a[0]); this.fetchRemote(n);
          return ['已从模拟远程 ' + n + ' 获取 ' + this.state.remotes[n].commits.size + ' 个提交对象。', 'fetch 只更新对象库和远程跟踪引用，当前分支、暂存区和工作区不移动。'];
        }
        cmd_push(args) {
          const [a, f] = this.options(args, {'-u': 0, '--set-upstream': 0}); this.expect(a, 0, 2);
          const up = this.state.upstream[this.branch()]; if (!a.length && !up) throw Error('当前分支没有上游，请使用 git push -u origin ' + this.branch());
          const n = this.remoteName(a[0] || up?.remote), source = name(a[1] || this.branch()), target = a.length ? source : name(up.branch);
          if (!owns(this.state.refs.branches, source)) throw Error('找不到本地分支：' + source); const h = this.state.refs.branches[source]; if (!h) throw Error('没有可推送的提交。');
          const remote = this.state.remotes[n], previous = remote.branches[target] || null;
          if (previous && !this.ancestor(previous, h)) throw Error('推送被拒绝：non-fast-forward（非快进）。请先 fetch / pull 整合远程历史。');
          for (const hash of this.ancestors(h).keys()) remote.commits.set(hash, copy(this.state.commits.get(hash)));
          remote.branches[target] = h; this.state.refs.remoteTracking[n + '/' + target] = h;
          if (f['-u'] || f['--set-upstream']) this.state.upstream[source] = {remote: n, branch: target};
          return ['已推送 ' + source + ' → ' + n + '/' + target, 'push 将可达提交复制到模拟远程，并前移远程分支；-u 同时记录上游关系。'];
        }
        cmd_pull(args) {
          const [a] = this.options(args); this.expect(a, 0, 2); this.clean(); const up = this.state.upstream[this.branch()];
          if (!a.length && !up) throw Error('当前分支没有上游，请指定 git pull origin main。');
          const n = this.remoteName(a[0] || up?.remote), b = name(a[1] || up?.branch || this.branch()); this.fetchRemote(n);
          if (!owns(this.state.remotes[n].branches, b)) throw Error('远程没有分支：' + b);
          const result = this.cmd_merge(['refs/remotes/' + n + '/' + b]); return [result[0], 'pull = fetch 后 merge。' + result[1]];
        }
        cmd_clone(args) {
          const [a] = this.options(args); this.expect(a, 1);
          if (this.state.initialized || Object.keys(this.state.workingTree).length) throw Error('clone 需要空的未初始化工作区；请新建或重置实验场景。');
          const source = Object.values(this.state.remotes).find(r => r.url === a[0]);
          const fresh = GitSim.fresh(true); fresh.config.global = copy(this.state.config.global); this.state = fresh;
          if (source) {this.state.remotes.origin = copy(source); this.fetchRemote('origin');}
          else if (a[0] === 'demo://origin') {
            this.state.index = {'README.md': '# Git 远程演示仓库\n\n欢迎练习 clone、fetch、pull 与 push。\n'}; this.createCommit('初始化远程示例', [], 'Git Learner <learner@example.com>');
            this.state.remotes.origin = {url: a[0], branches: {main: this.head()}, commits: copy(this.state.commits)}; this.fetchRemote('origin');
          } else this.state.remotes.origin = {url: a[0], branches: {}, commits: new Map()};
          const first = owns(this.state.remotes.origin.branches, 'main') ? 'main' : Object.keys(this.state.remotes.origin.branches)[0] || 'main';
          const hash = this.state.remotes.origin.branches[first] || null; this.state.refs.branches = {[first]: hash}; this.state.refs.HEAD = {type: 'branch', name: first};
          this.state.index = this.tree(); this.state.workingTree = this.tree(); this.state.upstream[first] = {remote: 'origin', branch: first};
          return ['已克隆模拟仓库 ' + a[0] + (hash ? '' : '\n未进行网络请求；此 URL 创建的是空的模拟远程。'), 'clone 复制模拟远程对象、创建 origin 和本地分支，并检出文件；demo://origin 提供内置示例。'];
        }
        cmd_stash(args) {
          let verb = args[0] && !args[0].startsWith('-') ? args.shift() : 'push';
          const [a, f] = this.options(args, verb === 'push' ? {'-u': 0, '--include-untracked': 0, '-m': 1} : ['apply', 'pop'].includes(verb) ? {'--index': 0} : {});
          if (verb === 'list') {this.expect(a); return [this.state.stash.map((s, i) => 'stash@{' + i + '}: ' + s.message).join('\n') || 'stash 列表为空。', 'stash 是最近保存的临时更改栈，编号 0 为最新一项。'];}
          if (verb === 'clear') {this.expect(a); this.state.stash = []; return ['已清空 stash。', 'clear 丢弃全部临时保存项。'];}
          if (verb === 'push') {
            this.expect(a); if (this.state.merge || this.state.operation || this.state.conflicts.length) throw Error('请先解决冲突并继续当前操作，或使用对应命令的 --abort 中止。');
            const include = f['-u'] || f['--include-untracked'], base = this.tree(), working = {};
            for (const p of keys(base, this.state.index, ...(include ? [this.state.workingTree] : []))) if (owns(this.state.workingTree, p)) working[p] = this.state.workingTree[p];
            if (equal(base, this.state.index) && equal(base, working)) throw Error('没有可保存的本地更改。');
            this.state.stash.unshift({base, index: copy(this.state.index), workingTree: working, message: f['-m'] || 'WIP on ' + this.branch(), hash: this.head()});
            this.install(base, true); if (include) for (const p of Object.keys(working)) if (!owns(base, p)) delete this.state.workingTree[p];
            return ['已保存工作区和暂存区，恢复到 HEAD。', 'stash 保存未提交的临时快照；默认保留未跟踪文件，-u 将未跟踪文件一并保存。'];
          }
          if (!['apply', 'pop', 'drop'].includes(verb)) throw Error('支持 stash push / list / apply / pop / drop / clear。');
          this.expect(a, 0, 1); const text = a[0] || 'stash@{0}', match = text.match(/^(?:stash@\{(\d+)\}|(\d+))$/); if (!match) throw Error('请使用 stash@{0} 形式指定保存项。');
          const n = Number(match[1] || match[2] || 0), item = this.state.stash[n]; if (!item) throw Error('找不到指定的 stash。');
          if (verb !== 'drop') {
            this.clean(); const current = this.tree(), nextIndex = copy(this.state.index), nextWork = copy(this.state.workingTree);
            for (const p of keys(item.base, item.index, item.workingTree)) {
              const workChanged = item.workingTree[p] !== item.base[p], indexChanged = item.index[p] !== item.base[p];
              if (current[p] !== item.base[p] && ((workChanged && current[p] !== item.workingTree[p]) || (f['--index'] && indexChanged && current[p] !== item.index[p]))) throw Error('stash 与当前提交在文件 ' + p + ' 上有冲突，请切回原分支或先保存更改。');
              if (!owns(item.base, p) && owns(nextWork, p) && (!owns(current, p) || !owns(item.index, p))) throw Error('stash 会覆盖未跟踪文件：' + p);
              if (f['--index'] && item.index[p] !== item.base[p]) {if (owns(item.index, p)) nextIndex[p] = item.index[p]; else delete nextIndex[p];}
              else if (!f['--index'] && !owns(item.base, p) && owns(item.index, p) && owns(item.workingTree, p)) nextIndex[p] = item.workingTree[p];
              if (item.workingTree[p] !== item.base[p]) {if (owns(item.workingTree, p)) nextWork[p] = item.workingTree[p]; else delete nextWork[p];}
            }
            const indexCollision = this.filePathCollision(nextIndex), workCollision = this.filePathCollision(nextWork);
            if (indexCollision) throw Error('stash 暂存区文件与目录路径冲突：' + indexCollision + '。保存项仍保留。');
            if (workCollision) throw Error('stash 工作区文件与目录路径冲突：' + workCollision + '。保存项仍保留。');
            this.state.index = nextIndex; this.state.workingTree = nextWork;
          }
          if (verb !== 'apply') this.state.stash.splice(n, 1);
          return [verb === 'drop' ? '已删除 ' + text : '已恢复 ' + text + (verb === 'pop' ? ' 并从列表移除。' : '，保存项仍在列表中。'), '默认恢复的已有文件修改不暂存；--index 同时恢复原暂存状态。此前新增并跟踪的文件会重新暂存。教学模拟遇到文件冲突会停止并保留保存项。'];
        }
        cmd_tag(args) {
          const [a, f] = this.options(args, {'-d': 0}); this.expect(a, 0, 2);
          if (!a.length) {if (f['-d']) throw Error('请指定标签名称。'); return [Object.keys(this.state.refs.tags).join('\n') || '还没有标签。', '标签是固定指向某个提交的命名引用。'];}
          const n = name(a[0]); if (f['-d']) {this.expect(a, 1); if (!owns(this.state.refs.tags, n)) throw Error('找不到标签：' + n); delete this.state.refs.tags[n]; return ['已删除标签 ' + n, '删除标签不删除对应提交。'];}
          if (owns(this.state.refs.tags, n)) throw Error('标签已存在：' + n); const h = this.resolve(a[1] || 'HEAD'); if (!h) throw Error('没有可标记的提交。'); this.state.refs.tags[n] = h;
          return ['已创建标签 ' + n + ' → ' + h, '轻量标签固定标记这个提交，不随后续提交移动。'];
        }
        cmd_show(args) {
          const [a] = this.options(args); this.expect(a, 0, 1); const ref = a[0] || 'HEAD', colon = ref.indexOf(':');
          if (colon >= 0) {const tree = this.tree(ref.slice(0, colon) || 'HEAD'), p = path(ref.slice(colon + 1)); if (!owns(tree, p)) throw Error('该提交中没有文件：' + p); return [tree[p], 'show 引用:路径 读取已提交快照中的文件，不改变工作区。'];}
          const h = this.resolve(ref), c = this.state.commits.get(h); if (!c) throw Error('还没有提交。');
          return ['commit ' + h + '\nAuthor: ' + c.author + '\nDate: ' + c.timestamp + '\n\n    ' + c.message + '\n\n' + this.diffTrees(c.parents.length ? this.state.commits.get(c.parents[0]).tree : {}, c.tree), 'show 查看提交详情，以及相对于第一个父提交的文件变化。'];
        }
      }
      root.CommandParser = CommandParser; root.GitSim = GitSim;
    })(globalThis);

