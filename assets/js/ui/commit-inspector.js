    /* Lossless, bounded line diff. Work and trace size are capped independently of file size. */
    const CommitDiff = {
      lines(value) {return String(value ?? '').match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) || []},
      compare(before, after) {
        const a = this.lines(before), b = this.lines(after); let start = 0, end = 0;
        while (start < a.length && start < b.length && a[start] === b[start]) start++;
        while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
        const left = a.slice(start, a.length - end), right = b.slice(start, b.length - end);
        const middle = this.myers(left, right), fallback = middle === null;
        const ops = [...a.slice(0, start).map(raw => ({kind: 'equal', raw})), ...(middle || [...left.map(raw => ({kind: 'delete', raw})), ...right.map(raw => ({kind: 'insert', raw}))]), ...a.slice(a.length - end).map(raw => ({kind: 'equal', raw}))];
        let beforeLine = 0, afterLine = 0; const rows = [];
        const line = (raw, number) => ({number, raw, text: raw.replace(/(?:\r\n|\n|\r)$/, ''), eol: raw.endsWith('\r\n') ? 'CRLF' : raw.endsWith('\n') ? 'LF' : raw.endsWith('\r') ? 'CR' : null});
        for (let i = 0; i < ops.length;) {
          const op = ops[i]; if (op.kind === 'equal') {rows.push({kind: 'equal', before: line(op.raw, ++beforeLine), after: line(op.raw, ++afterLine)}); i++; continue}
          const removed = [], added = []; while (i < ops.length && ops[i].kind !== 'equal') {const item = ops[i++]; if (item.kind === 'delete') removed.push(line(item.raw, ++beforeLine)); else added.push(line(item.raw, ++afterLine))}
          for (let j = 0; j < Math.max(removed.length, added.length); j++)rows.push({kind: removed[j] && added[j] ? 'replace' : removed[j] ? 'delete' : 'insert', before: removed[j] || null, after: added[j] || null});
        }
        return {ops, rows, fallback, beforeLines: a.length, afterLines: b.length, added: ops.filter(o => o.kind === 'insert').length, removed: ops.filter(o => o.kind === 'delete').length};
      },
      myers(a, b) {
        if (!a.length) return b.map(raw => ({kind: 'insert', raw})); if (!b.length) return a.map(raw => ({kind: 'delete', raw}));
        const trace = [], v = new Map([[1, 0]]); let work = 0;
        for (let d = 0; d <= Math.min(a.length + b.length, 160); d++) {
          trace.push(new Map(v));
          for (let k = -d; k <= d; k += 2) {
            if (++work > 300000) return null;
            let x = k === -d || (k !== d && (v.get(k - 1) ?? -Infinity) < (v.get(k + 1) ?? -Infinity)) ? v.get(k + 1) || 0 : (v.get(k - 1) || 0) + 1, y = x - k;
            while (x < a.length && y < b.length && a[x] === b[y]) {x++; y++; if (++work > 300000) return null} v.set(k, x);
            if (x >= a.length && y >= b.length) {
              const result = []; for (let back = d; back >= 0; back--) {
                const previous = trace[back], diagonal = x - y; const previousDiagonal = diagonal === -back || (diagonal !== back && (previous.get(diagonal - 1) ?? -Infinity) < (previous.get(diagonal + 1) ?? -Infinity)) ? diagonal + 1 : diagonal - 1; const px = previous.get(previousDiagonal) || 0, py = px - previousDiagonal;
                while (x > px && y > py) {result.push({kind: 'equal', raw: a[x - 1]}); x--; y--} if (back === 0) break; if (x === px) {result.push({kind: 'insert', raw: b[y - 1]}); y--} else {result.push({kind: 'delete', raw: a[x - 1]}); x--}
              }
              return result.reverse();
            }
          }
        }
        return null;
      }
    };

    /* Read-only comparison of a commit with one of its parents. */
    const CommitInspector = {
      hash: null, path: null, opener: null, parentIndex: 0, scope: 'changed', side: 'after', page: 0, pageSize: 160, diff: null, filesCache: [], syncing: false,
      refHash(value) {return typeof value === 'string' ? value : value?.hash || value?.target || null},
      remoteBranches(hash) {const result = []; for (const [remoteName, remote] of Object.entries(sim.state.remotes)) for (const [branch, tip] of Object.entries(remote.branches)) {const pending = [this.refHash(tip)], seen = new Set(); while (pending.length) {const current = pending.pop(); if (!current || seen.has(current)) continue; seen.add(current); if (current === hash) {result.push(remoteName + '/' + branch); break} pending.push(...(remote.commits.get(current)?.parents || []))} } return result},
      current() {return sim.state.commits.get(this.hash)},
      base(commit = this.current()) {return sim.state.commits.get(commit?.parents?.[this.parentIndex]) || null},
      files(commit) {const previous = this.base(commit)?.tree || {}; return [...new Set([...Object.keys(commit.tree), ...Object.keys(previous)])].sort((a, b) => a.localeCompare(b, 'zh-CN', {numeric: true})).map(path => {const hasAfter = own(commit.tree, path), hasBefore = own(previous, path), status = !hasAfter ? 'D' : !hasBefore ? 'A' : commit.tree[path] !== previous[path] ? 'M' : 'C'; return {path, status, hasBefore, hasAfter, before: hasBefore ? String(previous[path]) : '', after: hasAfter ? String(commit.tree[path]) : ''}})},
      statuses: {A: '新增', M: '修改', D: '删除', C: '未变化'},
      open(hash) {const commit = sim.state.commits.get(hash); if (!commit) return; const dialog = $('commit-inspector-dialog'); if (!dialog.open) this.opener = document.activeElement; if (this.hash !== hash) {this.path = null; this.parentIndex = 0; this.scope = 'changed'; this.page = 0; this.side = 'after'} this.hash = hash; view.commit = hash; BranchGraph.render(); this.render(); if (!dialog.open) dialog.showModal()},
      visibleFiles() {return this.scope === 'changed' ? this.filesCache.filter(file => file.status !== 'C') : this.filesCache},
      treeHTML(files) {
        const root = {folders: new Map(), files: []}; for (const file of files) {const parts = file.path.split('/'); let node = root; for (const name of parts.slice(0, -1)) {if (!node.folders.has(name)) node.folders.set(name, {folders: new Map(), files: []}); node = node.folders.get(name)} node.files.push({...file, name: parts.at(-1)})}
        const draw = node => [...node.folders].sort(([a], [b]) => a.localeCompare(b, 'zh-CN')).map(([name, folder]) => `<li class="inspector-folder"><details open><summary><span class="inspector-chevron" aria-hidden="true">›</span>${icon('folder')}<span>${escapeHTML(name)}</span></summary><ul>${draw(folder)}</ul></details></li>`).join('') + node.files.map(file => `<li><button type="button" class="inspector-file ${this.path === file.path ? 'active' : ''}" data-inspector-file="${escapeHTML(file.path)}" aria-pressed="${this.path === file.path}" title="${escapeHTML(file.path + ' · ' + this.statuses[file.status])}"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6"/></svg><span class="inspector-file-name">${escapeHTML(file.name)}</span><span class="inspector-change inspector-change-${file.status}" aria-label="${this.statuses[file.status]}">${file.status === 'C' ? '·' : file.status}</span></button></li>`).join('');
        return files.length ? '<ul class="inspector-tree-root">' + draw(root) + '</ul>' : `<p class="inspector-empty">${this.scope === 'changed' ? '与所选父提交相比，没有文件变化。切换“全部文件”可浏览快照。' : '两个版本中均没有文件。'}</p>`;
      },
      render() {
        const commit = this.current(); if (!commit) return; if (this.parentIndex >= commit.parents.length) this.parentIndex = 0;
        this.filesCache = this.files(commit); const files = this.visibleFiles(); if (!files.some(file => file.path === this.path)) this.path = files[0]?.path || null; this.page = 0;
        $('commit-inspector-title').textContent = commit.message || '无提交说明';
        const head = sim.head() === commit.hash, branches = Object.entries(sim.state.refs.branches).filter(([, hash]) => this.refHash(hash) === commit.hash).map(([name]) => name), tags = Object.entries(sim.state.refs.tags).filter(([, hash]) => this.refHash(hash) === commit.hash).map(([name]) => name), tracking = Object.entries(sim.state.refs.remoteTracking).filter(([, hash]) => this.refHash(hash) === commit.hash).map(([name]) => name), remote = this.remoteBranches(commit.hash), badge = (text, kind = '') => `<span class="inspector-badge ${kind}">${escapeHTML(text)}</span>`;
        $('commit-inspector-badges').innerHTML = (head ? badge('● 当前 HEAD', 'inspector-head') : '') + badge(commit.parents.length > 1 ? '合并提交' : '提交') + branches.map(name => badge('分支 ' + name)).join('') + tags.map(name => badge('标签 ' + name)).join('') + tracking.map(name => badge(name)).join('') + badge(remote.length ? '已推送' : '仅本地', remote.length ? 'inspector-pushed' : '');
        const date = new Date(commit.timestamp), dateLabel = Number.isNaN(date.getTime()) ? commit.timestamp : date.toLocaleString('zh-CN', {hour12: false}), pair = (title, value) => `<div><dt>${title}</dt><dd>${escapeHTML(value)}</dd></div>`;
        $('commit-inspector-meta').innerHTML = pair('提交', commit.hash) + pair('作者', commit.author || '未记录') + pair('时间', dateLabel) + pair('父提交', commit.parents.join(' · ') || '无 · 首次提交');
        $('commit-inspector-remote').textContent = remote.length ? '远程已包含：' + remote.join(' · ') : '尚未被模拟远程分支包含';
        const select = $('commit-inspector-base'); select.innerHTML = commit.parents.length ? commit.parents.map((hash, index) => `<option value="${index}">第 ${index + 1} 父提交 · ${escapeHTML(hash)}</option>`).join('') : '<option value="0">首次提交 · 空文件树</option>'; select.value = String(this.parentIndex); select.disabled = commit.parents.length < 2;
        const counts = {A: 0, M: 0, D: 0, C: 0}; for (const file of this.filesCache) counts[file.status]++;
        $('commit-inspector-summary').innerHTML = `<span class="inspector-change-A">+${counts.A} 新增</span><span class="inspector-change-M">${counts.M} 修改</span><span class="inspector-change-D">−${counts.D} 删除</span>`;
        $('commit-inspector-files-count').textContent = this.scope === 'changed' ? (counts.A + counts.M + counts.D) + ' 个变更' : Object.keys(commit.tree).length + ' 个快照文件' + (counts.D ? ' · ' + counts.D + ' 个删除' : '');
        $('commit-inspector-scopes').querySelectorAll('button').forEach(button => {const selected = button.dataset.inspectorScope === this.scope; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected))});
        $('commit-inspector-tree').innerHTML = this.treeHTML(files); this.renderContent();
      },
      renderContent() {
        const file = this.filesCache.find(file => file.path === this.path); this.page = 0; this.diff = file ? CommitDiff.compare(file.before, file.after) : null;
        $('commit-inspector-path').textContent = file?.path || '没有选中的文件'; $('commit-inspector-file-status').textContent = file ? this.statuses[file.status] : ''; $('commit-inspector-file-status').className = 'inspector-file-status inspector-change-' + (file?.status || 'C');
        $('commit-inspector-line-stats').textContent = this.diff ? '+' + this.diff.added + ' / −' + this.diff.removed + ' 行' : '';
        $('commit-inspector-origin').textContent = !file ? '从左侧选择文件，查看提交前后的内容。' : file.status === 'A' ? '新增文件：提交前不存在，提交后保存了该文件。' : file.status === 'D' ? '删除文件：左侧为原内容，提交后该路径已不存在。' : file.status === 'C' ? '该文件在两个版本中的内容一致。' : '红色 − 表示移除的行，绿色 + 表示新增的行；替换会同时出现。';
        $('commit-inspector-tree').querySelectorAll('[data-inspector-file]').forEach(button => {const selected = button.dataset.inspectorFile === this.path; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected))});
        this.renderDiff();
      },
      renderDiff() {
        const file = this.filesCache.find(file => file.path === this.path), diff = this.diff, base = this.base(), pages = Math.max(1, Math.ceil((diff?.rows.length || 0) / this.pageSize)); this.page = Math.max(0, Math.min(this.page, pages - 1)); const from = this.page * this.pageSize, rows = diff?.rows.slice(from, from + this.pageSize) || [];
        $('commit-inspector-before-ref').textContent = base?.hash || '空文件树'; $('commit-inspector-after-ref').textContent = this.hash || '';
        for (const side of ['before', 'after']) {
          const exists = file?.[side === 'before' ? 'hasBefore' : 'hasAfter'], value = file?.[side] || '', lineCount = diff?.[side === 'before' ? 'beforeLines' : 'afterLines'] || 0;
          $('commit-inspector-' + side + '-state').textContent = !file ? '未选择文件' : !exists ? '不存在' : value === '' ? '存在 · 空文件（0 字符）' : '存在 · ' + lineCount + ' 行';
          const container = $('commit-inspector-' + side + '-code');
          if (!file || !exists || value === '') container.innerHTML = `<div class="diff-empty-note">${!file ? '请选择要对比的文件' : !exists ? '此版本中不存在该文件' : '这是一个存在的空文件'}</div>`;
          else container.innerHTML = rows.map(row => {const line = row[side], changed = row.kind !== 'equal', kind = !line ? 'gap' : changed ? (side === 'before' ? 'removed' : 'added') : 'same'; return `<div class="diff-row diff-row-${kind}"><span class="diff-line-number" aria-hidden="true">${line?.number || ''}</span><span class="diff-marker" aria-hidden="true">${line && changed ? (side === 'before' ? '−' : '+') : ''}</span><code>${line ? escapeHTML(line.text) : ' '}${line ? `<span class="diff-eol ${line.eol ? '' : 'diff-no-newline'}" title="${line.eol ? '行尾换行：' + line.eol : '文件末尾没有换行'}">${line.eol ? (line.eol === 'LF' ? '↵' : line.eol) : '无末尾换行'}</span>` : ''}</code></div>`}).join('');
          container.scrollTop = 0; container.scrollLeft = 0;
        }
        $('commit-inspector-diff-note').textContent = diff?.fallback ? '文件差异较复杂：已保留共同首尾，中间区间按整段替换展示；所有内容均可分页查看。' : '';
        $('commit-inspector-diff-note').hidden = !diff?.fallback;
        $('commit-inspector-page-label').textContent = diff?.rows.length ? '第 ' + (from + 1) + '–' + Math.min(from + this.pageSize, diff.rows.length) + ' 对比行 / 共 ' + diff.rows.length + ' 行' : '没有文本行';
        $('commit-inspector-prev').disabled = this.page === 0; $('commit-inspector-next').disabled = this.page >= pages - 1;
        $('commit-inspector-pagination').hidden = pages === 1;
        this.renderSide();
      },
      renderSide() {
        $('commit-inspector-content').dataset.side = this.side;
        $('commit-inspector-side-tabs').querySelectorAll('button').forEach(button => {const selected = button.dataset.inspectorSide === this.side; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1});
      },
      init() {
        $('commit-inspector-tree').addEventListener('click', event => {const button = event.target.closest('[data-inspector-file]'); if (!button) return; this.path = button.dataset.inspectorFile; this.renderContent()});
        $('commit-inspector-scopes').addEventListener('click', event => {const button = event.target.closest('[data-inspector-scope]'); if (!button) return; this.scope = button.dataset.inspectorScope; this.render()});
        $('commit-inspector-base').addEventListener('change', event => {this.parentIndex = Number(event.target.value); this.render()});
        $('commit-inspector-side-tabs').addEventListener('click', event => {const button = event.target.closest('[data-inspector-side]'); if (!button) return; this.side = button.dataset.inspectorSide; this.renderSide()});
        $('commit-inspector-side-tabs').addEventListener('keydown', event => {if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); this.side = event.key === 'Home' ? 'before' : event.key === 'End' ? 'after' : this.side === 'before' ? 'after' : 'before'; this.renderSide(); $('commit-inspector-side-tabs').querySelector('[aria-selected="true"]').focus()});
        $('commit-inspector-prev').addEventListener('click', () => {this.page--; this.renderDiff()}); $('commit-inspector-next').addEventListener('click', () => {this.page++; this.renderDiff()});
        for (const side of ['before', 'after']) $('commit-inspector-' + side + '-code').addEventListener('scroll', event => {const peer = $('commit-inspector-' + (side === 'before' ? 'after' : 'before') + '-code'); if (peer.scrollTop !== event.target.scrollTop) peer.scrollTop = event.target.scrollTop}, {passive: true});
        $('commit-inspector-dialog').addEventListener('close', () => {const node = [...$('graph').querySelectorAll('[data-commit]')].find(node => node.dataset.commit === this.hash); if (node) node.focus({preventScroll: true}); else if (this.opener?.isConnected) this.opener.focus({preventScroll: true})});
      }
    };
    CommitInspector.init();

