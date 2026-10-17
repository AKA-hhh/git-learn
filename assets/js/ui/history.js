    /* History browser: tab selection never executes a command. */
    const HistoryBrowser = {
      matches() {
        const query = $('history-search').value.trim().toLowerCase();
        return session.history.map((entry, index) => ({entry, index})).reverse().filter(({entry}) => (String(entry.line || '') + ' ' + String(entry.output || '') + ' ' + String(entry.explanation || '')).toLowerCase().includes(query));
      },
      date(value, short = false) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '时间未记录' : short ? date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}) : date.toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
      },
      render() {
        const query = $('history-search').value.trim(), matches = this.matches(), list = $('history-list'), detail = $('history-detail');
        const listTop = list.scrollTop, listLeft = list.scrollLeft, detailTop = detail.scrollTop;
        const focused = document.activeElement, focusedTab = list.contains(focused) ? focused.closest('[data-history-tab]')?.dataset.historyTab : null;
        const focusedAction = detail.contains(focused) ? focused.closest('[data-copy],[data-replay]') : null;
        const action = focusedAction ? (focusedAction.hasAttribute('data-copy') ? 'copy' : 'replay') : null;
        if (!matches.some(item => item.index === view.historySelected)) view.historySelected = matches[0]?.index ?? null;
        const selected = matches.find(item => item.index === view.historySelected);
        $('history-count').textContent = (query ? matches.length + ' / ' : '') + session.history.length + ' 条记录';
        list.setAttribute('aria-orientation', window.matchMedia('(max-width:640px)').matches ? 'horizontal' : 'vertical');
        list.innerHTML = matches.map(({entry, index}) => `<button id="history-tab-${index}" type="button" class="history-record ${index === view.historySelected ? 'active' : ''}" role="tab" aria-controls="history-detail" aria-selected="${index === view.historySelected}" tabindex="${index === view.historySelected ? 0 : -1}" data-history-tab="${index}" title="${escapeHTML(entry.line || '')}"><code class="history-record-command">${CommandColors.command(entry.line || '')}</code><span class="history-record-meta"><span class="history-record-index">#${String(index + 1).padStart(2, '0')}</span><span class="history-status ${entry.error ? 'failed' : ''}">${entry.error ? '失败' : '成功'}</span><time>${escapeHTML(this.date(entry.time, true))}</time></span></button>`).join('') || `<div class="no-items">${query ? '没有匹配的记录' : '执行命令后，记录会出现在这里。'}</div>`;
        list.scrollTop = listTop; list.scrollLeft = listLeft;
        if (!selected) {
          detail.removeAttribute('aria-labelledby');
          detail.innerHTML = `<div class="history-empty"><span class="eyebrow">COMMAND HISTORY</span><h3>${query ? '没有找到相关记录' : '从第一条命令开始'}</h3><p>${query ? '试试搜索命令名、输出内容或操作说明。' : '在终端输入 <code>git status</code>，就能在这里回顾命令、执行结果和每一步的作用。'}</p></div>`;
          detail.dataset.record = '';
        } else {
          const {entry, index} = selected, record = String(index) + '|' + String(entry.time) + '|' + String(entry.line);
          detail.setAttribute('aria-labelledby', 'history-tab-' + index);
          detail.innerHTML = `<header><div class="history-detail-head"><span class="eyebrow">RECORD ${String(index + 1).padStart(2, '0')}</span><span class="history-status ${entry.error ? 'failed' : ''}">${entry.error ? '执行失败' : '执行成功'}</span></div><h3>${escapeHTML((entry.line || '命令记录').trim().split(/\s+/).slice(0, entry.line?.startsWith('git ') ? 2 : 1).join(' '))}</h3><time class="history-detail-date">${escapeHTML(this.date(entry.time))}</time></header><section class="history-detail-section"><h4>执行命令</h4><div class="resource-code-card"><div class="resource-code-head"><span>COMMAND</span></div><pre class="history-detail-command"><code>${CommandColors.command(entry.line || '')}</code></pre></div><div class="history-detail-actions"><button type="button" data-copy="${index}">复制命令</button><button type="button" data-replay="${index}" title="在当前仓库中重新执行这条命令">重新执行 ↵</button><small>重新执行会作用于当前仓库</small></div></section><section class="history-detail-section"><h4>执行结果</h4><div class="resource-code-card ${entry.error ? 'code-card-error' : ''}"><div class="resource-code-head"><span>OUTPUT</span><span>${entry.error ? '执行未完成' : '执行完成'}</span></div><pre class="history-detail-output ${entry.error ? 'failed' : ''}"><code>${entry.output ? CommandColors.output(entry.output, entry.error, entry.line) : '（无输出）'}</code></pre></div></section><section class="history-detail-section"><h4>操作说明</h4><p class="history-explanation">${escapeHTML(entry.explanation || (entry.error ? '命令未能完成，可根据执行结果检查参数后重试。' : '命令已执行，可结合上方四区内容查看当前仓库状态。'))}</p></section>`;
          detail.scrollTop = detail.dataset.record === record ? detailTop : 0;
          detail.dataset.record = record;
        }
        if (focusedTab !== null && focusedTab !== undefined) {
          const target = $('history-tab-' + focusedTab) || $('history-tab-' + view.historySelected);
          (target || $('history-search')).focus({preventScroll: true});
        } else if (action) {
          const target = detail.querySelector('[data-' + action + ']');
          (target || $('history-search')).focus({preventScroll: true});
        }
      },
      select(index) {
        if (!this.matches().some(item => item.index === index)) return;
        view.historySelected = index; this.render();
        const tab = $('history-tab-' + index);
        tab?.focus({preventScroll: true}); tab?.scrollIntoView({block: 'nearest', inline: 'nearest'});
      },
      init() {
        const list = $('history-list');
        list.addEventListener('click', event => {
          const tab = event.target.closest('[data-history-tab]');
          if (tab && list.contains(tab)) this.select(Number(tab.dataset.historyTab));
        });
        list.addEventListener('keydown', event => {
          const tab = event.target.closest('[data-history-tab]');
          if (!tab || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const tabs = [...list.querySelectorAll('[data-history-tab]')], current = tabs.indexOf(tab);
          if (!tabs.length || current < 0) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
          this.select(Number(tabs[next].dataset.historyTab));
        });
        window.matchMedia('(max-width:640px)').addEventListener('change', event => list.setAttribute('aria-orientation', event.matches ? 'horizontal' : 'vertical'));
      }
    };
    Terminal.history = function () {HistoryBrowser.render()};
    HistoryBrowser.init();

