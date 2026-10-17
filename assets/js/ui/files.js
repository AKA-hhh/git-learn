    /* FileTree: nested native folder disclosures, stable across repository renders. */
    const FileTree = {
      closed: new Set(),
      glyph(kind) {return kind === 'folder' ? '<svg class="tree-icon folder-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5.5h6l2 2h8v9H2z"/><path d="M2 5.5V3.5h6l2 2h7v2"/></svg>' : '<svg class="tree-icon document-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4v11H5zM11 2.5v4h4M7.5 10h5M7.5 13h5"/></svg>'},
      fileType(path) {const ext = path.split('.').pop().toLowerCase(); return ['js', 'ts', 'jsx', 'tsx'].includes(ext) ? 'code' : ['md', 'txt'].includes(ext) ? 'text' : ['json', 'yaml', 'yml', 'toml'].includes(ext) ? 'config' : ['css', 'scss', 'html'].includes(ext) ? 'style' : 'other'},
      reveal(path, zone = 'working') {const parts = path.split('/'); for (let i = 1; i < parts.length; i++)this.closed.delete(zone + ':' + parts.slice(0, i).join('/'))},
      html(zone, tree) {
        const paths = zone === 'working' ? allFiles(tree, sim.state.index) : zone === 'index' ? allFiles(tree, sim.tree()) : Object.keys(tree).sort();
        if (!paths.length) return '<div class="tree-empty">' + this.glyph('folder') + '<span>暂无文件</span><small>' + (zone === 'working' ? '点击「新建文件」开始' : zone === 'index' ? '执行 git add 暂存文件' : zone === 'local' ? '执行 git commit 创建快照' : '执行 git push 同步提交') + '</small></div>';
        const root = {children: new Map(), count: 0};
        for (const path of paths) {let node = root; const parts = path.split('/'); parts.forEach((name, index) => {const key = (index === parts.length - 1 ? 'file:' : 'dir:') + name; if (!node.children.has(key)) node.children.set(key, {name, path: parts.slice(0, index + 1).join('/'), folder: index < parts.length - 1, children: new Map(), count: 0}); node = node.children.get(key); node.count++})}
        const draw = node => '<ul class="repo-tree">' + [...node.children.values()].sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name, 'zh-CN', {numeric: true})).map(item => {
          if (item.folder) {const expanded = !this.closed.has(zone + ':' + item.path); return '<li class="tree-directory"><details data-tree-folder="' + escapeHTML(item.path) + '"' + (expanded ? ' open' : '') + '><summary title="' + escapeHTML(item.path + '/') + '"><svg class="tree-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>' + this.glyph('folder') + '<span class="tree-folder-name">' + escapeHTML(item.name) + '</span><span class="tree-folder-count">' + item.count + '</span></summary>' + draw(item) + '</details></li>'}
          const path = item.path, exists = own(tree, path), status = FourZones.state(zone, path, tree), rename = zone === 'working' && exists;
          return '<li class="tree-file-row"><button type="button" class="file ' + (view.file === path ? 'selected ' : '') + (!exists ? 'deleted' : '') + '" data-file="' + escapeHTML(path) + '" data-state="' + escapeHTML(status[0]) + '" data-kind="' + this.fileType(path) + '" title="' + escapeHTML(path + ' · ' + status[1]) + '" aria-label="' + escapeHTML(path + '，' + status[1]) + '" aria-pressed="' + (view.file === path) + '">' + this.glyph('file') + '<span class="file-name">' + escapeHTML(item.name) + '</span><span class="file-code" aria-hidden="true">' + escapeHTML(status[0]) + '</span></button>' + (rename ? '<button type="button" class="file-rename" data-rename-file="' + escapeHTML(path) + '" title="重命名 ' + escapeHTML(path) + '" aria-label="重命名 ' + escapeHTML(path) + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4 4 4M4 16l1-4L14 3l3 3-9 9zM3 18h14"/></svg></button>' : '') + '</li>';
        }).join('') + '</ul>';
        return draw(root);
      },
      init() {
        $('zones').addEventListener('toggle', event => {const folder = event.target; if (!folder.matches?.('[data-tree-folder]')) return; const key = folder.closest('.zone').dataset.zone + ':' + folder.dataset.treeFolder; if (folder.open) this.closed.delete(key); else this.closed.add(key)}, true);
        $('zones').addEventListener('click', event => {const button = event.target.closest('[data-rename-file]'); if (button) FileModal.open(button.dataset.renameFile, 'working', true)});
      }
    };
    FileTree.init();
    FourZones.treeHTML = function (zone, tree) {return FileTree.html(zone, tree)};

    /* File viewer: edits remain drafts until explicitly saved to the working tree. */
    const FileModal = {
      active: null,
      labels: {working: '工作区', index: '暂存区', local: '本地仓库', remote: '远程仓库'},
      tree(zone) {return zone === 'working' ? sim.state.workingTree : zone === 'index' ? sim.state.index : zone === 'local' ? sim.tree() : FourZones.remote().tree},
      open(path, zone = 'working', focusName = false) {
        const tree = this.tree(zone), exists = own(tree, path), editable = zone === 'working' && exists;
        this.active = {path, zone, editable, original: exists ? tree[path] : ''}; view.file = path;
        const remote = zone === 'remote' ? FourZones.remote() : null;
        const source = zone === 'local' ? 'HEAD · ' + (sim.head() || '尚无提交') : zone === 'remote' ? remote.label + ' · ' + (remote.hash || '尚无提交') : zone === 'index' ? '下一次提交的完整快照' : '保存后可用 git add 暂存';
        $('file-view-title').textContent = path;
        $('file-view-path-field').hidden = !editable; $('file-view-path').value = path; $('file-view-path-error').textContent = '';
        $('file-view-meta').textContent = this.labels[zone] + ' · ' + source;
        $('file-view-status').textContent = FourZones.state(zone, path, tree)[1];
        $('file-view-mode').textContent = editable ? '可编辑' : '只读快照';
        $('file-view-editor').hidden = !editable; $('file-view-snapshot').hidden = editable;
        $('file-view-editor').value = this.active.original;
        $('file-view-editor').setAttribute('aria-label', '编辑工作区文件 ' + path);
        $('file-view-snapshot').textContent = exists ? (tree[path] || '（空文件）') : (zone === 'working' ? '此文件已从工作区删除，可用 git restore 恢复已跟踪文件。' : '该快照中没有此文件。');
        $('file-view-save').hidden = !editable; $('file-view-delete').hidden = !editable;
        $('file-discard-confirm').hidden = true; this.updateDraft();
        const dialog = $('file-view-dialog'); dialog.dataset.zone = zone; dialog.showModal();
        if (editable) {if (focusName) {$('file-view-path').focus(); $('file-view-path').select()} else $('file-view-editor').focus()} else $('file-view-snapshot').focus();
      },
      nextPath() {return $('file-view-path').value.trim().replace(/^\.\//, '')},
      pathError() {
        const item = this.active; if (!item?.editable) return '';
        const next = this.nextPath();
        if (!next || /[\x00-\x1f\\:]/.test(next) || next.split('/').some(part => !part || ['.', '..', '.git', '__proto__', 'prototype', 'constructor'].includes(part))) return '请输入有效的相对路径，例如 src/new-name.js。';
        if (next !== item.path && sim.state.conflicts.includes(item.path)) return '请先解决并暂存此文件的冲突，再修改文件名。';
        if (next !== item.path && Object.keys(sim.state.workingTree).some(p => p !== item.path && (p === next || p.startsWith(next + '/') || next.startsWith(p + '/')))) return '此路径已被文件或文件夹占用，请换一个名称。';
        return '';
      },
      dirty() {return this.active?.editable && ($('file-view-editor').value !== this.active.original || this.nextPath() !== this.active.path)},
      updateDraft() {const dirty = this.dirty(), error = this.pathError(); $('file-view-path-error').textContent = error; $('file-view-path').setAttribute('aria-invalid', String(!!error)); $('file-view-save').disabled = !dirty || !!error; $('file-view-draft').textContent = dirty ? '有未保存的修改' + (this.nextPath() !== this.active.path ? ' · 包含重命名' : '') : this.active?.editable ? 'Ctrl / ⌘ + S 保存到工作区' : '快照内容只读'; if (!dirty) $('file-discard-confirm').hidden = true},
      requestClose() {if (this.dirty()) {$('file-discard-confirm').hidden = false; $('file-keep-editing').focus()} else this.close()},
      close() {$('file-view-dialog').close()},
      restoreFocus() {
        const item = this.active; if (!item) return; FourZones.render();
        const row = [...$('zones').querySelectorAll('[data-file]')].find(b => b.dataset.file === item.path && b.closest('.zone').dataset.zone === item.zone);
        (row || $('new-file')).focus({preventScroll: true}); this.active = null;
      },
      save() {
        const item = this.active; if (!item?.editable || !this.dirty()) return;
        const error = this.pathError(); if (error) {this.updateDraft(); $('file-view-path').focus(); return }
        const oldPath = item.path, newPath = this.nextPath();
        if (newPath !== oldPath) delete sim.state.workingTree[oldPath];
        sim.state.workingTree[newPath] = $('file-view-editor').value; item.path = newPath; view.file = newPath; FileTree.reveal(newPath);
        session.last = newPath !== oldPath ? '已重命名 ' + oldPath + ' → ' + newPath + '。执行 git add . 暂存这次改动。' : '已保存 ' + newPath + ' 的工作区修改。执行 git add 可更新暂存区。';
        Scenarios.update('edit'); render(); StateManager.save(); this.close(); notify('已保存到工作区');
      },
      remove() {
        const item = this.active; if (!item?.editable) return;
        delete sim.state.workingTree[item.path]; session.last = '已从工作区删除 ' + item.path + '。git add . 可暂存删除，git restore 可恢复已跟踪文件。';
        Scenarios.update('edit'); render(); StateManager.save(); this.close(); notify('已从工作区删除文件');
      },
      init() {
        const dialog = $('file-view-dialog');
        $('file-view-save').onclick = () => this.save(); $('file-view-delete').onclick = () => this.remove();
        $('file-view-editor').addEventListener('input', () => this.updateDraft());
        $('file-view-path').addEventListener('input', () => this.updateDraft());
        dialog.addEventListener('keydown', e => {if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {e.preventDefault(); this.save()} });
        dialog.addEventListener('cancel', e => {e.preventDefault(); this.requestClose()});
        dialog.addEventListener('close', () => this.restoreFocus());
        dialog.querySelectorAll('[data-file-close]').forEach(b => b.onclick = () => this.requestClose());
        $('file-keep-editing').onclick = () => {$('file-discard-confirm').hidden = true; $('file-view-editor').focus()};
        $('file-discard').onclick = () => this.close();
      }
    };
    FourZones.render = function () {
      const positions = new Map([...$('zones').querySelectorAll('.zone')].map(zone => [zone.dataset.zone, zone.querySelector('.file-tree')?.scrollTop || 0]));
      const remote = this.remote();
      const defs = [['working', '工作区', 'WORKING TREE', 'folder', sim.state.workingTree, '编辑、重命名后保存'], ['index', '暂存区', 'STAGING AREA', 'stage', sim.state.index, '下一次提交的完整快照'], ['local', '本地仓库', 'LOCAL REPOSITORY', 'repo', sim.tree(), 'HEAD · ' + (sim.head() || '尚无提交')], ['remote', '远程仓库', 'REMOTE REPOSITORY', 'cloud', remote.tree, '已同步的远程快照']];
      $('zones').innerHTML = defs.map(([id, title, en, symbol, tree, source], i) => {
        const p = view.file, st = this.state(id, p, tree);
        const context = id === 'working' ? '~/git-playground' : id === 'index' ? 'index · 待提交快照' : id === 'local' ? 'HEAD → ' + sim.branch() : remote.label;
        const options = this.remoteOptions();
        const sub = id === 'remote' && options.length ? `<select id="remote-select" aria-label="选择远程分支">${options.map(o => `<option value="${escapeHTML(o.key)}" ${o.key === view.remote ? 'selected' : ''}>${escapeHTML(o.key)}</option>`).join('')}</select>` : `<span title="${escapeHTML(context)}">${escapeHTML(context)}</span>`;
        return `<article class="panel zone" data-zone="${id}"><header class="zone-head"><span class="zone-symbol">${icon(symbol)}</span><div class="zone-heading"><h3>${title}</h3><small title="${escapeHTML(source)}">${escapeHTML(source)}</small></div><span class="zone-count" title="${Object.keys(tree).length} 个文件"><strong>${Object.keys(tree).length}</strong><span>文件</span></span></header><div class="zone-sub">${sub}${id === 'working' ? '<button id="new-file" class="zone-create" type="button" title="新建工作区文件" aria-label="新建工作区文件">＋ 新建文件</button>' : ''}</div><div class="file-tree" aria-label="${title}文件目录">${this.treeHTML(id, tree)}</div></article>`;
      }).join('');
      for (const zone of $('zones').querySelectorAll('.zone')) zone.querySelector('.file-tree').scrollTop = positions.get(zone.dataset.zone) || 0;
    };
    FileModal.init();


