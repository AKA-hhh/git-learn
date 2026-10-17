    /* Executable lesson examples; each run receives a separate GitSim repository. */
    const LessonExampleData = (() => {
      const file = 'README.md';
      const text = version => '# 项目说明\n版本：' + version + '\n';
      const write = (repo, content) => {repo.state.workingTree[file] = content};
      const record = (repo, content, message) => {write(repo, content); repo.run('git add README.md'); repo.run('git commit -m "' + message + '"')};
      const base = (repo, version = 'v1') => {repo.run('git init'); record(repo, text(version), '创建项目说明')};
      const publish = repo => {repo.run('git remote add origin demo://lesson'); repo.run('git push -u origin main')};
      const twoVersions = repo => {base(repo); record(repo, text('v2'), '更新项目说明'); publish(repo)};
      return [
        {
          id: 'zones-snapshots', chapter: 'zones', title: '一次暂存，只记住那一刻', path: file,
          description: '从四区内容一致开始，先暂存第一稿，再编辑第二稿。观察提交和推送为什么仍然保存第一稿。',
          setup(repo) {base(repo, '初始'); publish(repo)},
          steps: [
            {label: '编辑 README.md：写入第一稿', action(repo) {write(repo, text('第一稿'))}, note: '编辑只改变工作区；暂存区、本地 HEAD 与远程仍保留初始版本。', focus: ['working']},
            {command: 'git add README.md', note: '第一稿复制到暂存区。本地提交和远程内容暂时没有变化。', focus: ['index']},
            {label: '继续编辑 README.md：写入第二稿', action(repo) {write(repo, text('第二稿'))}, note: '工作区现在是第二稿，暂存区仍是第一稿；add 保存的快照不会随编辑自动更新。', focus: ['working', 'index']},
            {command: 'git commit -m "保存第一稿"', note: '本地新增提交，内容取自暂存区的第一稿。工作区第二稿仍未提交，远程还在初始版本。', focus: ['local']},
            {command: 'git push', note: '远程同步已提交的第一稿。push 不上传尚未提交的工作区第二稿。', focus: ['remote']}
          ]
        },
        {
          id: 'config-scopes', chapter: 'config', title: '改全局身份，为什么作者还没变？', path: file,
          description: '已有一个提交，工作区另有待提交修改。依次设置全局与仓库身份，观察 local 优先级以及作者只影响之后的提交。',
          setup(repo) {base(repo); write(repo, text('待提交的身份示例'))},
          steps: [
            {command: 'git config --global user.name "全局作者"', note: '设置模拟全局用户名；四区文件内容与既有提交作者均不改变。', focus: []},
            {command: 'git config user.name "项目作者"', note: '当前仓库用户名覆盖全局默认值，之后的普通提交优先使用“项目作者”。四区文件不变。', focus: []},
            {command: 'git config --global user.name "新全局作者"', note: '全局值已修改，但当前仓库仍被 local 的“项目作者”覆盖；这不是配置没有保存。', focus: []},
            {command: 'git config user.email "project@example.com"', note: '为当前仓库设置邮箱；用户名和邮箱分别按各自的 local/global 优先级解析。文件不变。', focus: []},
            {command: 'git config --unset user.name', note: '删除仓库级用户名覆盖后，生效用户名回退到“新全局作者”；仓库邮箱仍然有效。', focus: []},
            {command: 'git config --list', note: '只读取配置。列表按全局、仓库顺序显示，同一配置项以仓库值为准。', focus: []},
            {command: 'git commit -am "记录新身份"', note: '暂存并提交已跟踪的待提交修改。新提交作者为新全局作者与仓库邮箱，旧提交作者保留。', focus: ['index', 'local']}
          ]
        },
        {
          id: 'first-commit', chapter: 'first', title: '从一个普通文件到第一次提交', path: file,
          description: '起点只有一个尚未初始化的工作区文件。init 建立仓库，add 准备快照，commit 才会生成历史节点。',
          setup(repo) {write(repo, '# 我的第一个 Git 项目\n欢迎来到版本管理。\n')},
          steps: [
            {command: 'git init', note: '初始化仓库并建立 main 分支；已有文件仍只在工作区，尚未暂存，也没有提交。', focus: ['local']},
            {command: 'git status --short', note: '?? README.md 表示未跟踪。status 只观察状态，不复制文件，也不产生提交。', focus: ['working']},
            {command: 'git add README.md', note: 'README.md 加入暂存区；工作区内容不变，本地仓库仍没有提交。', focus: ['index']},
            {command: 'git commit -m "第一次提交"', note: '从暂存区建立第一个完整快照，main 与 HEAD 指向新节点；远程尚未配置。', focus: ['local']},
            {command: 'git log --oneline', note: '显示第一个提交的哈希和说明。log 是只读操作，四区文件没有变化。', focus: ['local']}
          ]
        },
        {
          id: 'inspect-differences', chapter: 'inspect', title: '同一个文件，为什么两个 diff 不一样？', path: file,
          description: '工作区开始就比 HEAD 多一次编辑。先看未暂存差异，再暂存它，比较 diff 与 diff --cached 的观察范围。',
          setup(repo) {base(repo); write(repo, text('v2：补充使用说明'))},
          steps: [
            {command: 'git status --short', note: '右列 M 表示工作区相对暂存区有修改。命令只读取状态，四区内容不变。', focus: ['working', 'index']},
            {command: 'git diff', note: '比较暂存区与工作区，能看到 v1 → v2 的未暂存变化；不与远程比较。', focus: ['working', 'index']},
            {command: 'git add README.md', note: '暂存区现在也是 v2，工作区不变，本地提交仍是 v1。', focus: ['index']},
            {command: 'git diff --cached', note: '比较 HEAD 与暂存区，展示下一次提交将保存的 v1 → v2 变化；本命令不修改快照。', focus: ['index', 'local']},
            {command: 'git diff', note: '暂存区和工作区已一致，所以普通 diff 没有差异；这不等于没有待提交更改。', focus: ['working', 'index']}
          ]
        },
        {
          id: 'branch-switch', chapter: 'branch', title: '创建指针与切换文件是两件事', path: file,
          description: 'main 从 v1 开始。创建 feature 后单独开发，再来回切换，观察 HEAD 与文件快照如何跟随分支变化。',
          setup(repo) {base(repo)},
          steps: [
            {command: 'git branch feature', note: '只创建指向当前提交的 feature 指针，HEAD 仍在 main，四区文件没有变化。', focus: ['local']},
            {command: 'git switch feature', note: 'HEAD 切到 feature。两个分支此时指向同一提交，所以工作区和暂存区看起来相同。', focus: ['local']},
            {label: '在 feature 中编辑 README.md', action(repo) {write(repo, text('feature：新增功能说明'))}, note: '只编辑工作区，分支指针尚未移动；main 的提交也没有改变。', focus: ['working']},
            {command: 'git commit -am "补充功能说明"', note: '自动暂存已跟踪文件并创建新提交。feature 前移，main 仍留在 v1。', focus: ['index', 'local']},
            {command: 'git switch main', note: 'HEAD 返回 main，工作区和暂存区恢复为 main 的 v1；feature 上的新提交仍在。', focus: ['working', 'index', 'local']},
            {command: 'git switch feature', note: '重新检出 feature 的功能说明。切换复用了已有提交，没有再创建新节点。', focus: ['working', 'index', 'local']}
          ]
        },
        {
          id: 'branch-merge', chapter: 'branch', title: '两边都有提交，如何合成一个结果？', path: file,
          description: 'feature 修改 README.md，main 新增 src/app.js。双方改的是不同文件，合并能自动保留两边成果。',
          setup(repo) {base(repo); repo.run('git switch -c feature'); record(repo, text('feature：新增功能说明'), '补充功能说明'); repo.run('git switch main'); repo.state.workingTree['src/app.js'] = 'console.log("main ready");\n'; repo.run('git add src/app.js'); repo.run('git commit -m "增加应用入口"')},
          steps: [
            {command: 'git log --oneline --graph --all', note: '先观察 main 与 feature 各有一个独有提交；只读检查不会改变文件或分支。', focus: ['local']},
            {command: 'git merge feature', note: '把 feature 合入当前 main。README.md 获得功能说明，src/app.js 保留；新合并提交有两个父节点。', focus: ['working', 'index', 'local']},
            {command: 'git status', note: '工作区与暂存区匹配合并快照，状态干净。feature 分支仍然保留，合并不会自动删除它。', focus: ['local']}
          ]
        },
        {
          id: 'remote-push', chapter: 'remote', title: '配置远程不等于已经推送', path: file,
          description: '本地已经有一次提交，远程还不存在。添加模拟地址、设置上游，再观察普通 push 的作用。',
          setup(repo) {base(repo)},
          steps: [
            {command: 'git remote add origin demo://my-project', note: '新增一个空的模拟远程地址；工作区、暂存区和本地提交不变，远程暂时没有文件。', focus: ['remote']},
            {command: 'git push -u origin main', note: '第一次上传 main 的可达提交，远程出现 README.md；-u 还记录上游，方便之后直接 push。', focus: ['remote']},
            {label: '编辑 README.md：准备发布第二版', action(repo) {write(repo, text('v2：准备发布'))}, note: '只修改工作区。远程和本地 HEAD 仍是已提交的 v1，编辑本身不会自动同步。', focus: ['working']},
            {command: 'git commit -am "准备第二版"', note: '本地提交升级为 v2，远程仍停留在 v1；已配置上游也不会自动上传提交。', focus: ['index', 'local']},
            {command: 'git push', note: '根据已记录的上游更新 origin/main。远程现在与本地 HEAD 内容一致，工作区不受影响。', focus: ['remote']}
          ]
        },
        {
          id: 'remote-fetch-merge', chapter: 'remote', title: 'fetch 看到了更新，为什么文件还没变？', path: file,
          description: '本地与远程最初都是 v1。模拟协作者先向远程提交更新，再拆开观察 fetch 和 merge 两个阶段。',
          setup(repo) {base(repo); publish(repo)},
          steps: [
            {label: '模拟协作者提交并推送 README.md', action(repo) {const collaborator = new GitSim(repo.state); record(collaborator, text('v2：协作者的更新'), '协作者更新项目说明'); collaborator.run('git push'); repo.state.remotes.origin = structuredClone(collaborator.state.remotes.origin)}, note: '协作者只让模拟远程前进一步。本地 main、origin/main 跟踪引用、工作区和暂存区都还不知道这次更新。', focus: ['remote']},
            {command: 'git fetch origin', note: '下载提交对象并更新本地 origin/main 跟踪引用。当前 main 与文件仍是 v1，因此四区中的本地 HEAD 快照暂时不变。', focus: ['local']},
            {command: 'git merge origin/main', note: '把已获取的远程更新合入当前分支。这次是快进：main、工作区和暂存区一起到 v2，不额外创建合并提交。', focus: ['working', 'index', 'local']},
            {command: 'git status', note: '本地文件现在匹配远程更新，工作区干净；本例展示的 fetch 后 merge 就是默认 pull 的两个阶段。', focus: []}
          ]
        },
        {
          id: 'undo-soft', chapter: 'undo', title: 'reset --soft：撤回提交，保留暂存', path: file,
          description: '从已提交并推送的 v2 回到 v1。对比另外两个 reset 示例，注意暂存区与工作区仍保存 v2。',
          setup(repo) {twoVersions(repo)},
          steps: [
            {command: 'git reset --soft HEAD~1', note: '仅把本地 main 与 HEAD 移回 v1；暂存区、工作区仍是 v2，远程也仍是 v2。', focus: ['local']},
            {command: 'git diff --cached', note: 'v1 → v2 成为已暂存差异，可重新提交。该检查不改变文件，旧 v2 提交对象也仍可被 reflog 找回。', focus: ['index', 'local']},
            {command: 'git status --short', note: '左列 M 表示修改已经暂存，右列为空表示工作区匹配暂存区。reset 没有撤回远程历史。', focus: ['working', 'index']}
          ]
        },
        {
          id: 'undo-mixed', chapter: 'undo', title: 'reset --mixed：撤回提交和暂存', path: file,
          description: '与 soft 使用同样的 v1/v2 起点。mixed 会同时重置暂存区，但保留工作区文件供继续编辑。',
          setup(repo) {twoVersions(repo)},
          steps: [
            {command: 'git reset --mixed HEAD~1', note: '本地 HEAD 和暂存区回到 v1；工作区保留 v2，因此变化成为未暂存修改。远程仍是 v2。', focus: ['index', 'local']},
            {command: 'git diff', note: '普通 diff 此时能看到 v1 → v2，因为暂存区与工作区不同；本命令只读取差异。', focus: ['working', 'index']},
            {command: 'git status --short', note: '右列 M 表示需要重新 add。省略 reset 的模式时，默认也使用 mixed。', focus: ['working', 'index']}
          ]
        },
        {
          id: 'undo-hard', chapter: 'undo', title: 'reset --hard：让三个本地区域一起回退', path: file,
          description: '仍然从已推送的 v2 开始。hard 将已跟踪文件也恢复到 v1，和 soft/mixed 的结果明显不同。',
          setup(repo) {twoVersions(repo)},
          steps: [
            {command: 'git reset --hard HEAD~1', note: 'HEAD、暂存区、已跟踪工作区全部回到 v1。这里的 v2 有提交可找回，但真实未提交编辑不会被 reflog 保存；远程仍是 v2。', focus: ['working', 'index', 'local']},
            {command: 'git status', note: '三个本地区域一致，所以工作区干净；干净不代表本地和远程版本相同。', focus: ['working', 'index', 'local']},
            {command: 'git log --oneline', note: '当前 main 历史只到 v1；远程引用和 reflog 仍能指向旧 v2。hard reset 不会自动改动远程。', focus: ['local', 'remote']}
          ]
        },
        {
          id: 'undo-restore', chapter: 'undo', title: 'restore 的来源取决于你恢复哪个区', path: file,
          description: '起点有三个版本：HEAD 是 v1、暂存区是“已暂存版本”、工作区还有“未暂存修改”。逐步恢复并看清默认来源。',
          setup(repo) {base(repo); write(repo, text('已暂存版本')); repo.run('git add README.md'); write(repo, text('未暂存修改'))},
          steps: [
            {command: 'git restore README.md', note: '默认从暂存区恢复工作区，所以工作区变为“已暂存版本”，不是 HEAD 的 v1。提交历史不变。', focus: ['working']},
            {command: 'git restore --staged README.md', note: '默认从 HEAD 恢复暂存区，暂存区回到 v1；工作区仍保留“已暂存版本”，相当于取消暂存。', focus: ['index']},
            {command: 'git restore README.md', note: '再次从暂存区恢复工作区，这次来源已经是 v1，因此三个本地区域一致。HEAD 从未移动。', focus: ['working']},
            {command: 'git status', note: '恢复操作只改对应文件区，没有新增或撤回提交。此时工作区干净，远程始终没有变化。', focus: []}
          ]
        },
        {
          id: 'undo-revert', chapter: 'undo', title: 'revert：保留历史，再提交一次反向修改', path: file,
          description: 'v2 已经推送，想撤销这次修改。revert 通过新增提交让内容回到 v1，比改写共享提交更适合协作。',
          setup(repo) {twoVersions(repo)},
          steps: [
            {command: 'git revert HEAD', note: '新增一个撤销 v2 的提交；本地内容恢复为 v1，但 v1→v2 的历史仍完整保留。远程尚未同步。', focus: ['working', 'index', 'local']},
            {command: 'git log --oneline', note: '可以看到“创建说明 → 更新说明 → Revert”三次提交；这与 reset 直接移动分支指针不同。', focus: ['local']},
            {command: 'git push', note: '把新的逆向提交正常推送到远程。远程文件也回到 v1，同时保留原来的 v2 历史。', focus: ['remote']}
          ]
        },
        {
          id: 'stash-roundtrip', chapter: 'stash', title: '暂时收起修改，回来再接着写', path: file,
          description: 'README.md 有未提交的第二稿。先 stash 清理工作区，随后 pop 找回编辑，观察默认恢复不会自动暂存已有文件的修改。',
          setup(repo) {base(repo); write(repo, text('第二稿：写到一半'))},
          steps: [
            {command: 'git stash push -m "写到一半的说明"', note: '把未提交改动存入 stash，并让工作区和暂存区恢复为 HEAD 的 v1。本地分支不增加新提交。', focus: ['working', 'index']},
            {command: 'git stash list', note: '只查看临时保存项；stash@{0} 是最近一项。四区仍保持收起修改后的状态。', focus: []},
            {command: 'git stash pop', note: '第二稿回到工作区，同时移除成功恢复的保存项。默认 pop 保留暂存区的 v1，恢复的修改仍未暂存。', focus: ['working']},
            {command: 'git status --short', note: '右列 M 说明可以继续编辑或 git add 后提交。stash 不是推送，也不会改变远程。', focus: ['working', 'index']}
          ]
        },
        {
          id: 'tag-release', chapter: 'stash', title: '标签固定在版本上，分支继续向前', path: file,
          description: '给 v1 打一个轻量标签，再提交 v2。观察标签不跟着 HEAD 移动，并用 show 读取被标记的旧文件。',
          setup(repo) {base(repo)},
          steps: [
            {command: 'git tag v1', note: '新增 v1 标签指向当前提交；没有复制文件，也没有创建新的提交节点。', focus: ['local']},
            {label: '编辑 README.md：开始下一版本', action(repo) {write(repo, text('v2'))}, note: '工作区变成 v2；HEAD、暂存区和 v1 标签仍对应旧版本。', focus: ['working']},
            {command: 'git commit -am "开始第二版本"', note: 'main 与 HEAD 前移到新提交，暂存区同步 v2；v1 标签仍固定指向第一个提交。', focus: ['index', 'local']},
            {command: 'git show v1:README.md', note: '只读取标签 v1 中的文件，输出是 v1；不会把当前工作区的 v2 换回旧内容。', focus: ['local']}
          ]
        },
        {
          id: 'conflict-resolve', chapter: 'conflict', title: '同一个文件，两种修改，手动决定最终内容', path: file,
          description: 'main 和 feature 都把 README.md 改成不同内容。教学模型采用文件级三方合并，因此会暂停并等待你解决冲突。',
          setup(repo) {base(repo); repo.run('git switch -c feature'); record(repo, '# 项目说明\n标题：功能分支说明\n', '功能分支修改标题'); repo.run('git switch main'); record(repo, '# 项目说明\n标题：主线说明\n', '主线修改标题')},
          steps: [
            {command: 'git merge feature', note: '工作区写入冲突标记，HEAD 不移动。暂存区仍保留当前侧内容，需要先编辑并 add 才能完成合并。', focus: ['working', 'index']},
            {label: '编辑 README.md：合并两边意思并删除标记', action(repo) {write(repo, '# 项目说明\n标题：主线与功能说明已合并\n')}, note: '手动决定最终内容，并清除 <<<<<<<、=======、>>>>>>>。此时只修改工作区，冲突尚未通过 add 标记解决。', focus: ['working']},
            {command: 'git add README.md', note: '把解决后的文件写入暂存区并标记冲突已解决；HEAD 仍停留在合并开始前。', focus: ['index']},
            {command: 'git commit -m "合并并解决标题冲突"', note: '从解决后的暂存区建立合并提交，记录 main 与 feature 两个父节点，结束合并状态。', focus: ['local']},
            {command: 'git log --oneline --graph', note: '只读检查合并关系。真实 Git 常能自动合并同一文件中不重叠的行；本教学模型按整个文件判断冲突。', focus: ['local']}
          ]
        },
        {
          id: 'amend-latest', chapter: 'amend', title: '补改最近一次提交，而不追加一个修补节点', path: file,
          description: '最近的“更新说明”漏了一句话。先补入内容，再改提交说明，观察 amend 创建替代提交并保留原父节点。',
          setup(repo) {base(repo); record(repo, text('v2：说明尚不完整'), '更新说明')},
          steps: [
            {label: '编辑 README.md：补上遗漏说明', action(repo) {write(repo, '# 项目说明\n版本：v2\n补充：启动前请阅读使用指南。\n')}, note: '补充内容先只在工作区；当前提交快照尚未改变。', focus: ['working']},
            {command: 'git commit -a --amend --no-edit', note: '暂存已跟踪修改并生成替代提交，保留原说明、原作者和父节点；旧提交仍可通过 reflog 找回。', focus: ['index', 'local']},
            {command: 'git commit --amend -m "完善第二版使用说明"', note: '再次替换最近提交，这次只改说明，四区文件内容相同但提交哈希改变。改写已推送提交会影响协作，本例尚未推送。', focus: ['local']},
            {command: 'git log --oneline', note: '当前分支历史展示完善后的提交与原父提交；被替换的版本不再位于 main 的可达历史中。', focus: ['local']}
          ]
        },
        {
          id: 'cherry-pick-one', chapter: 'cherry-pick', title: '只拿修复提交，不拿整个功能分支', path: file,
          description: 'feature 先新增 draft.txt，再单独修复 README.md。main 只需要最后那次修复，用 cherry-pick 复制它的改动。',
          setup(repo) {base(repo); repo.run('git switch -c feature'); repo.state.workingTree['draft.txt'] = '尚未发布的功能草稿\n'; repo.run('git add draft.txt'); repo.run('git commit -m "增加功能草稿"'); record(repo, text('v1：修复使用说明'), '修复使用说明'); repo.run('git switch main')},
          steps: [
            {command: 'git show feature', note: '查看 feature 顶端提交相对其父提交的改动：这一次只修复 README.md；之前的 draft.txt 不属于该提交增量。', focus: ['local']},
            {command: 'git cherry-pick feature', note: '把这次修复应用到 main，创建单父节点的新提交。draft.txt 不会带过来，feature 原指针也不移动。', focus: ['working', 'index', 'local']},
            {command: 'git log --oneline --graph --all', note: '两条分支都有这项修复，但它们是不同提交；cherry-pick 不会创建两个父节点的合并关系。', focus: ['local']}
          ]
        },
        {
          id: 'reflog-recover', chapter: 'reflog', title: '误退回一步后，找回原来的提交', path: file,
          description: 'main 已有 v1 和 v2 两次提交。模拟一次 hard reset，再从 HEAD 的本地移动记录中建立恢复分支。',
          setup(repo) {base(repo); record(repo, text('v2：希望保留的说明'), '完善项目说明')},
          steps: [
            {command: 'git reset --hard HEAD~1', note: 'main、暂存区和工作区退回 v1。v2 的提交对象仍在，刚才的 HEAD 移动会写入 reflog。', focus: ['working', 'index', 'local']},
            {command: 'git reflog -n 3', note: '只读取本地 HEAD 记录：HEAD@{0} 是 reset 后的 v1，HEAD@{1} 是 reset 前的 v2。编号随之后的 HEAD 移动变化。', focus: ['local']},
            {command: 'git branch recovered HEAD@{1}', note: '用明确的分支指针重新保留 v2。只创建分支，当前 HEAD 和文件仍在 main 的 v1。', focus: ['local']},
            {command: 'git switch recovered', note: '切到恢复分支，工作区和暂存区重新显示 v2。reflog 能找回已提交对象，不能找回从未提交或 stash 的编辑。', focus: ['working', 'index', 'local']}
          ]
        },
        {
          id: 'practice-small-commit', chapter: 'practice', title: '一个小改动，检查两次，再提交推送', path: file,
          description: '准备发布一段说明。把工作区检查、暂存检查、本地提交、远程同步串起来，建立每次都可重复的小步习惯。',
          setup(repo) {base(repo); publish(repo)},
          steps: [
            {command: 'git status', note: '先确认起点干净、当前分支正确。检查不改变四区，避免把上次剩余修改混进本次提交。', focus: []},
            {label: '编辑 README.md：补充启动命令', action(repo) {write(repo, '# 项目说明\n版本：v1\n启动：双击 index.html。\n')}, note: '只写入这次相关的小改动；暂存区、本地历史和远程都暂时保留原版本。', focus: ['working']},
            {command: 'git diff', note: '在暂存前检查工作区差异，确认只修改了预期内容。只读检查不会自动暂存。', focus: ['working', 'index']},
            {command: 'git add README.md', note: '明确选择这个文件进入下一次提交，暂存区冻结检查过的内容；远程仍没有变化。', focus: ['index']},
            {command: 'git diff --cached', note: '提交前再检查实际暂存内容。commit 会保存这里展示的快照，而不是自动保存所有工作区编辑。', focus: ['index', 'local']},
            {command: 'git commit -m "补充本地启动方式"', note: '用描述具体变化的说明建立本地提交。提交成功后文件已记录，但协作者还看不到它。', focus: ['local']},
            {command: 'git push', note: '最后把已检查的提交同步到上游远程，四区内容一致。本地提交与推送是两个独立步骤。', focus: ['remote']}
          ]
        }
      ];
    })();

