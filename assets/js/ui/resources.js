    /* Shared reading helpers: preserve text safely while distinguishing commands from prose. */
    const ResourceReading = {
      inline(text) {
        const pattern = /git\s+[a-z][a-z.-]*(?:\s+--?[a-z][a-z-]*)*|HEAD@\{\d+\}|HEAD(?:[~^]\d+)?|--[a-z][a-z-]*|\buser\.(?:name|email)\b|\borigin\/main\b/g;
        let result = '', offset = 0;
        for (const match of String(text).matchAll(pattern)) {result += escapeHTML(text.slice(offset, match.index)) + '<code class="inline-command">' + escapeHTML(match[0]) + '</code>'; offset = match.index + match[0].length}
        return result + escapeHTML(text.slice(offset));
      },
      code(command, label = 'BASH', action = true) {return '<div class="resource-code-card"><div class="resource-code-head"><span>' + escapeHTML(label) + '</span>' + (action ? '<button type="button" data-fill="' + escapeHTML(command) + '" aria-label="填入命令 ' + escapeHTML(command) + '">填入终端 <span aria-hidden="true">↗</span></button>' : '') + '</div><pre class="resource-code"><code>' + String(command).split('\n').map(line => CommandColors.command(line)).join('\n') + '</code></pre></div>'},
      heads: {
        config: ['提交作者是什么', '设置全局默认身份', '按仓库覆盖配置', '检查实际生效的配置', '恢复全局设置', '姓名邮箱与登录凭据'],
        first: ['建立第一个版本', '提交已跟踪文件的改动'],
        inspect: ['先查看，再保存', '限制输出与找回历史'],
        branch: ['分支指针与合并关系', '重命名本地分支', '只带走一次改动'],
        remote: ['理解本地与远程', '添加与修改远程地址', '模拟地址与真实服务器'],
        undo: ['选择要恢复的区域', 'reset 与 revert 的区别', '在模拟器中练习 revert', '找回移动前的提交'],
        stash: ['临时收起修改与标记版本'],
        conflict: ['完成一次冲突解决', '模拟规则与真实 Git', '继续或中止当前操作'],
        amend: ['最近一次提交如何被替换', '修改说明或补入文件', '自动暂存的范围', '改写历史前需要了解'],
        'cherry-pick': ['挑选的是改动', '按顺序完成练习', '遇到冲突如何处理'],
        reflog: ['提交历史与移动记录', '读懂 HEAD 引用', '建立恢复分支', '记录的范围与限制'],
        practice: ['把检查变成习惯']
      },
      commandLabel(command) {const all = REFERENCES.flatMap(ref => ref.examples || []); return all.find(example => example.command === command)?.label || REFERENCES.find(ref => command.startsWith('git ' + ref.name + ' ') || command === 'git ' + ref.name)?.summary || '练习命令'},
      flow() {return '<div class="lesson-zone-flow">' + [['01', '工作区', '正在编辑的文件', 'working'], ['02', '暂存区', '准备提交的快照', 'index'], ['03', '本地仓库', '已经保存的版本', 'local'], ['04', '远程仓库', '同步后的提交', 'remote']].map(([n, title, description, kind]) => '<div class="lesson-zone-step" data-zone-kind="' + kind + '"><span>' + n + '</span><strong>' + title + '</strong><small>' + description + '</small></div>').join('') + '</div>'}
    };
    Learning.lessons = function () {
      const query = $('lesson-search').value.trim().toLowerCase(), matches = LESSONS.filter(l => (l.title + l.body + l.commands.join(' ') + JSON.stringify(LessonGuidance[l.id] || {}) + LessonDemo.examples(l.id).map(e => e.title + e.description + e.steps.map(s => s.command || s.label).join(' ')).join(' ')).toLowerCase().includes(query));
      if (!matches.some(l => l.id === view.chapter)) view.chapter = matches[0]?.id || '';
      const list = $('lesson-tabs'), oldTop = list.scrollTop, oldLeft = list.scrollLeft;
      list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', window.matchMedia('(max-width:700px)').matches ? 'horizontal' : 'vertical');
      list.innerHTML = matches.map(l => {const index = LESSONS.findIndex(x => x.id === l.id); return '<button type="button" id="lesson-tab-' + l.id + '" class="lesson-tab ' + (l.id === view.chapter ? 'active' : '') + '" data-chapter="' + l.id + '" role="tab" aria-controls="lessons" aria-selected="' + (l.id === view.chapter) + '" tabindex="' + (l.id === view.chapter ? '0' : '-1') + '"><span class="lesson-tab-number">' + String(index + 1).padStart(2, '0') + '</span><span class="lesson-tab-title">' + escapeHTML(l.title) + '</span>' + (session.progress.lessons.includes(l.id) ? '<b aria-label="已学会">✓</b>' : '') + '</button>'}).join('') || '<div class="no-items">没有匹配章节</div>';
      list.scrollTop = oldTop; list.scrollLeft = oldLeft;
      $('lesson-count').textContent = matches.length + ' 个章节'; $('lesson-progress').textContent = session.progress.lessons.length + ' / ' + LESSONS.length + ' 已学会';
      const article = $('lessons'), l = matches.find(x => x.id === view.chapter), articleTop = article.scrollTop, focusedLearn = article.contains(document.activeElement) && document.activeElement.hasAttribute('data-learn');
      if (!l) {article.removeAttribute('aria-labelledby'); article.innerHTML = '<div class="resource-empty"><span class="eyebrow">LEARNING LIBRARY</span><h3>没有找到相关章节</h3><p>试试搜索「分支」「冲突」或「姓名」。</p></div>'; article.dataset.lessonId = ''; return }
      const number = LESSONS.findIndex(x => x.id === l.id) + 1, parts = l.body.split(/\n\n+/), heads = ResourceReading.heads[l.id] || [];
      article.setAttribute('aria-labelledby', 'lesson-tab-' + l.id);
      const prose = l.id === 'zones' ? ResourceReading.flow() + '<div class="lesson-note"><strong>观察内容如何流动</strong><p>' + ResourceReading.inline(l.body) + '</p></div>' : '<div class="lesson-sections">' + parts.map((paragraph, index) => '<section class="lesson-section"><h4><span class="lesson-section-number">' + String(index + 1).padStart(2, '0') + '</span>' + escapeHTML(heads[index] || '操作说明') + '</h4><p>' + ResourceReading.inline(paragraph) + '</p></section>').join('') + '</div>';
      article.innerHTML = '<article class="lesson-article"><header class="lesson-article-head"><span class="eyebrow">CHAPTER ' + String(number).padStart(2, '0') + '</span><h3>' + escapeHTML(l.title) + '</h3><p class="lesson-lead">' + escapeHTML(LessonGuidance[l.id]?.goal || '理解操作的作用，再回到工作台亲手试一遍。') + '</p></header>' + LessonDemo.html(l.id) + '<div class="lesson-checkpoints">' + (LessonGuidance[l.id]?.checkpoints || []).map(point => '<section class="lesson-checkpoint"><strong>' + escapeHTML(point.title) + '</strong><p>' + ResourceReading.inline(point.body) + '</p></section>').join('') + '</div>' + prose + '<section class="lesson-practice"><div class="lesson-practice-head"><h4>动手练习</h4><span>填入后按 Enter 执行</span></div><div class="lesson-commands">' + l.commands.map(command => '<div class="lesson-code-block"><h5>' + escapeHTML(ResourceReading.commandLabel(command)) + '</h5>' + ResourceReading.code(command) + '<p class="lesson-code-description">' + ResourceReading.inline(LessonGuidance[l.id]?.commands?.[command] || ResourceReading.commandLabel(command)) + '</p></div>').join('') + '</div></section><footer class="lesson-footer"><span>学习进度会自动保存</span><button type="button" class="learned" data-learn="' + l.id + '">' + (session.progress.lessons.includes(l.id) ? '✓ 已学会' : '标记为已学会') + '</button></footer></article>';
      article.scrollTop = article.dataset.lessonId === l.id ? articleTop : 0; article.dataset.lessonId = l.id; if (focusedLearn) article.querySelector('[data-learn]')?.focus({preventScroll: true});
    };
    $('lesson-tabs').addEventListener('keydown', event => {
      const tab = event.target.closest('[role="tab"]'); if (!tab || !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const tabs = [...$('lesson-tabs').querySelectorAll('[role="tab"]')], index = tabs.indexOf(tab), next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      tabs[next].click(); $('lesson-tab-' + view.chapter)?.focus({preventScroll: true}); $('lesson-tab-' + view.chapter)?.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });

