    const REFERENCES = [
      ['help', 'git help\ngit help <命令>\ngit help --all', '查看命令列表或某条命令的详细说明', 'git help commit', 'help 展示的是本站模拟器支持的范围，不是系统 Git 的完整手册', '指定命令后会显示语法、作用、示例、常见误区和操作提示', 'practice'],
      ['init', 'git init', '建立本地仓库', null, '不会自动提交文件', '生成仓库元数据', 'first'],
      ['status', 'git status', '检查文件状态', null, '不显示具体改动行', '操作前先看状态', 'zones'],
      ['add', 'git add <文件|.>', '更新暂存区快照', 'git add README.md', '再次编辑后需再次 add', '暂存不是持续同步', 'zones'],
      ['commit', 'git commit [-a|--all] -m "说明"\ngit commit -am "说明"\ngit commit [-a|--all] --amend (-m "新说明"|--no-edit)', '保存快照，或修正最近一次提交', 'git commit -m "完善说明"', '-a 不包含未跟踪文件；--amend 会替换最近一次提交，不是追加一条普通提交', '普通提交读取暂存区；--amend 保留原提交作者和父节点。修改已推送历史后，普通 push 可能被拒绝', 'first'],
      ['config', 'git config [--global|--local] <user.name|user.email> "值"\ngit config [--global|--local] [--get] <配置项>\ngit config [--global|--local] --list\ngit config [--global|--local] --unset <配置项>', '配置提交作者的姓名与邮箱', 'git config --global user.name "小明"', 'user.name 是配置项，不能直接写成 git user.name；姓名与邮箱也不是登录账号、密码或 SSH 凭据', '--list 可缩写为 -l；本模拟支持 user.name 和 user.email，配置只保存在本浏览器', 'config'],
      ['log', 'git log [--oneline] [--graph] [--all] [-n 数量|--max-count 数量|--max-count=数量|-数量] [引用]', '查看提交历史并限制输出条数', 'git log --oneline -n 5', '默认只回溯 HEAD 可达的提交；条数限制不筛选或删除历史', '--all 从各引用回溯；想找回 reset 或 amend 前的位置，可查看 reflog', 'inspect'],
      ['diff', 'git diff [--staged]', '比较区域内容', 'git diff --staged', '默认不比较 HEAD', '默认比较工作区与暂存区', 'inspect'],
      ['branch', 'git branch [新分支名 [起点]]\ngit branch -m [旧分支名] 新分支名\ngit branch -M [旧分支名] 新分支名', '查看、创建或重命名本地分支', 'git branch feature', '创建分支不会切换；本地改名不等于远程改名。-M 会覆盖已存在的其他非当前分支', '-m 遇到重名会拒绝；省略旧名称时改名当前分支，并同步 HEAD 和本地上游配置', 'branch'],
      ['checkout', 'git checkout <分支>', '传统的分支切换命令', 'git checkout main', '也有恢复文件等用途', '切分支可优先用 switch', 'branch'],
      ['switch', 'git switch [-c] <分支>', '切换分支', 'git switch -c feature', '可能被本地修改阻止', '-c 创建并切换', 'branch'],
      ['merge', 'git merge <分支>', '合入目标分支', 'git merge feature', '先确认当前分支', '可能快进或发生冲突', 'branch'],
      ['reset', 'git reset [--soft|--mixed|--hard] <提交>', '移动当前分支', 'git reset --soft HEAD~1', '--hard 丢弃已跟踪改动', '默认 --mixed；改写历史', 'undo'],
      ['restore', 'git restore [--staged] <文件>', '恢复文件或取消暂存', 'git restore --staged README.md', '默认会丢弃工作区改动', '默认从暂存区恢复文件', 'undo'],
      ['rm', 'git rm <文件>', '删除文件并暂存', 'git rm notes.md', '本地修改可能阻止删除', '还需 commit 保存', 'first'],
      ['mv', 'git mv <旧路径> <新路径>', '移动文件并暂存', 'git mv notes.md ideas.md', '避免覆盖目标文件', 'Git 根据内容识别重命名', 'first'],
      ['remote', 'git remote -v', '管理远程地址', null, 'origin 是约定名称', 'add 名称 地址 可配置远程', 'remote'],
      ['push', 'git push [-u] <远程> <分支>', '发送本地提交', 'git push -u origin main', '未提交内容不会推送', '-u 设置上游关系', 'remote'],
      ['pull', 'git pull [远程 分支]', '获取并整合更新', 'git pull origin main', '分叉时可能要求策略', '整合可用 merge 或 rebase', 'remote'],
      ['fetch', 'git fetch [远程]', '获取远程提交', 'git fetch origin', '不会自动合入当前分支', '更新本地远程跟踪引用', 'remote'],
      ['clone', 'git clone <地址>', '复制远程仓库', 'git clone demo://origin', '通常在仓库外运行', '默认配置 origin', 'remote'],
      ['stash', 'git stash [push|list|pop]', '收起未提交改动', 'git stash push -u', '默认不含未跟踪文件', 'pop 成功后移除记录', 'stash'],
      ['tag', 'git tag [标签名] [提交]', '为提交命名', 'git tag v1.0', '不随新提交移动', '常用于标记版本', 'stash'],
      ['show', 'git show [提交或标签]', '展开一次提交', 'git show HEAD', '不是工作区差异', 'HEAD 是当前检出位置', 'inspect'],
      ['revert', 'git revert <提交>\ngit revert --continue\ngit revert --abort', '新建逆向提交，撤销指定提交的改动', 'git revert HEAD', 'revert 保留旧提交；它不等同于 reset。双方改动同一文件时可能冲突', '本模拟支持单个普通提交（包括根提交），不支持范围、合并提交的 -m 主线选择或 --no-commit', 'undo'],
      ['cherry-pick', 'git cherry-pick <提交>\ngit cherry-pick --continue\ngit cherry-pick --abort', '把指定提交的改动应用到当前分支', 'git cherry-pick feature', '只挑选一次提交的改动，不会自动合入该分支全部历史；开始前已跟踪文件需要干净', '本模拟支持单个普通提交（包括根提交），创建新提交并保留来源作者；不移动来源分支', 'cherry-pick'],
      ['reflog', 'git reflog [show] [-n 数量|--max-count 数量|--max-count=数量]', '查看 HEAD 移动记录，找回先前的提交', 'git reflog -n 5', 'reflog 记录本地引用移动，不是提交历史，也不是远程共享记录；HEAD@{1} 不一定是 HEAD 的父提交', '本模拟记录会话内的 HEAD 移动与分支切换；旧存档仅补一条导入记录，不虚构过去记录', 'reflog']
    ].map(([name, syntax, summary, example, pitfall, note, chapter, supported = true]) => ({name, syntax, summary, example: example || syntax, pitfall, note, chapter, supported}));

    Object.assign(REFERENCES.find(r => r.name === 'help'), {
      detail: 'git help 是学习和查询命令的入口。不带参数时按工作流列出本站支持的命令；指定命令后，会直接在终端显示该命令的语法、作用、示例、常见误区和操作提示。\n\n本站不会打开系统手册，也不会调用电脑上的 Git。帮助内容与右上角“命令参考”共用同一份数据，所以查询结果会随本站已实现的命令一起更新。help 是只读操作，不会改变四区文件、HEAD、分支或远程状态。',
      examples: [
        {label: '查看入门导航', command: 'git help', description: '按开始、检查、撤销、分支和远程协作分类浏览可用命令。'},
        {label: '查看提交命令', command: 'git help commit', description: '显示 commit 的完整语法、示例以及暂存区相关注意事项。'},
        {label: '查看合并命令', command: 'git help merge', description: '了解接收分支、来源分支和可能发生的冲突。'},
        {label: '列出全部命令', command: 'git help --all', description: '逐行列出本站模拟器目前支持的全部命令和简要作用。'}
      ]
    });

    Object.assign(REFERENCES.find(r => r.name === 'remote'), {
      "syntax": "git remote -v\ngit remote add <名称> <地址>\ngit remote set-url <名称> <新地址>\ngit remote get-url <名称>",
      "summary": "查看、添加或修改模拟远程地址",
      "example": "git remote -v",
      "pitfall": "同名远程已经存在时，重复 add 会报错；修改已有地址要使用 set-url。origin 只是一个常用的远程名称。",
      "note": "本模拟对每个远程保存一个 Fetch / Push 共用的地址。set-url 仅修改地址标记，保留该模拟远程已有的提交、分支和上游关系，不访问网络；不支持 --push 或多个 URL。",
      "detail": "remote 管理远程名称与地址的对应关系。第一次连接一个模拟远程时，用 git remote add；以后需要更换地址时，用 git remote set-url。\n\n修改用户名和邮箱使用 git config，与远程地址分别配置。真实 Git 更换 URL 后会连接新位置，本学习网站只更新浏览器内的地址标记，远程内容仍保留，便于继续练习推送和拉取。\n\n用 git remote -v 查看所有地址，或用 git remote get-url origin 只查询 origin 的地址。「仓库信息」弹窗也会同步显示新地址。",
      "examples": [
        {
          "label": "查看所有远程地址",
          "command": "git remote -v",
          "description": "显示每个远程的名称及模拟 Fetch / Push 地址。"
        },
        {
          "label": "添加另一个模拟远程",
          "command": "git remote add backup demo://backup-repository",
          "description": "创建名为 backup 的空模拟远程；同名远程不能重复添加。"
        },
        {
          "label": "更换 origin 的地址",
          "command": "git remote set-url origin demo://my-repository",
          "description": "覆盖 origin 的旧地址；先将示例地址改成你想练习的模拟地址。"
        },
        {
          "label": "查看修改后的地址",
          "command": "git remote get-url origin",
          "description": "只输出 origin 当前配置的地址，方便确认修改结果。"
        }
      ]
    });

    Object.assign(REFERENCES.find(r => r.name === 'config'), {
      detail: 'git config 读取或设置 Git 配置。user.name 和 user.email 会组成新提交的作者身份，例如 小明 <xiaoming@example.com>。它们不负责登录远程仓库，也不提供推送权限。\n\n--global 设置全局默认值，--local 只设置当前仓库。写入时不指定范围等同于 --local；读取时不指定范围则返回实际生效的值。本地配置按键覆盖全局配置：只在本地设置姓名时，邮箱仍可沿用全局值。\n\n此网站在浏览器中模拟这两层配置，预置 Git Learner <learner@example.com> 便于直接练习。配置会随浏览器状态保存，重置或 clone 时保留模拟全局配置、清除原仓库配置；不会修改你电脑上的 Git。修改身份只影响后续新提交，已有提交的作者不会改变，四区文件内容也不会改变。',
      examples: [
        {label: '设置全局姓名', command: 'git config --global user.name "小明"', description: '为模拟仓库设置默认作者姓名。姓名含空格时需要使用引号。'},
        {label: '设置全局邮箱', command: 'git config --global user.email "xiaoming@example.com"', description: '为新提交填写作者邮箱；这不是邮箱登录或远程身份认证。'},
        {label: '为当前仓库覆盖姓名', command: 'git config --local user.name "小明（项目）"', description: '仅覆盖当前仓库的姓名，邮箱继续沿用全局设置。不加 --local 写入时也默认保存到当前仓库。'},
        {label: '为当前仓库覆盖邮箱', command: 'git config --local user.email "work@example.com"', description: '每个配置项单独覆盖，让此仓库使用工作邮箱。'},
        {label: '读取生效姓名', command: 'git config user.name', description: '不传入值即读取；当前仓库有姓名配置时优先返回该值。'},
        {label: '读取生效邮箱', command: 'git config --get user.email', description: '--get 明确表示读取；加 --global 或 --local 可只查询指定范围。'},
        {label: '列出全部配置', command: 'git config --list', description: '展示全局及当前仓库配置。若同一配置项出现两次，当前仓库的值优先；用 --get 查询最终生效值。'},
        {label: '只列出当前仓库配置', command: 'git config --local -l', description: '-l 是 --list 的缩写；将 --local 改为 --global 可查看模拟全局配置。'},
        {label: '移除当前仓库的姓名覆盖', command: 'git config --local --unset user.name', description: '只删除当前仓库的姓名设置，随后沿用全局姓名；邮箱配置不受影响。'}
      ]
    });


    /* Extended command guides: every example declares its required repository state. */
    Object.assign(REFERENCES.find(r => r.name === 'commit'), {
      detail: '普通 commit 把暂存区的完整快照写成新提交，移动当前分支；工作区里未暂存的修改会留下。提交后暂存区仍保留刚提交的内容。\n\n-a（--all）会在提交前自动暂存已跟踪文件的修改和删除，适合已有文件的编辑；它不会把新建、未跟踪文件加入提交。-am 是 -a 与 -m 的紧凑写法，也支持 -am"说明"。新文件仍先 git add。\n\n--amend 用当前暂存区创建替代最近一次提交的新提交，保留原父节点和作者。加 -m 可改说明，--no-edit 保留原说明；若只改说明，无需先修改文件。本模拟没有提交信息编辑器，因此 amend 请明确提供 -m 或 --no-edit。\n\n修正后提交哈希改变，原提交仍可通过 reflog 找回。已经推送过的提交被改写后，普通 push 可能因历史分叉被拒绝；修改协作历史前应与协作者协调。详见「修正最近一次提交」。',
      examples: [
        {label: '提交已暂存的快照', command: 'git commit -m "完善说明"', description: '先用 git add 暂存本次要保存的内容。未暂存修改会保留在工作区。'},
        {label: '自动暂存已跟踪文件再提交', command: 'git commit -a -m "更新已有文件"', description: '先编辑已跟踪文件。-a 包含它们的修改和删除，不包含新建、未跟踪文件。'},
        {label: '使用 -am 紧凑写法', command: 'git commit -am "更新项目说明"', description: '等同于 -a -m，适用于已经跟踪的文件；没有变更时不会新建空提交。'},
        {label: '修正最近一次提交的说明', command: 'git commit --amend -m "补充提交说明"', description: '需要已有提交。暂存区内容也会一起用于替代提交；原作者和父节点保留，哈希改变。'},
        {label: '补入暂存内容，沿用原说明', command: 'git commit --amend --no-edit', description: '先编辑文件并 git add，再执行此命令。--no-edit 保留最近一次提交的说明。'},
        {label: '自动暂存并修正最近一次提交', command: 'git commit -a --amend --no-edit', description: '需要已有提交及已跟踪文件修改；新文件仍要先 add。不要把 amend 当作普通追加提交。'}
      ]
    });
    Object.assign(REFERENCES.find(r => r.name === 'branch'), {
      detail: '分支是指向提交的可移动引用。git branch 只列出本地分支；提供新名称时创建分支，可以再提供起点引用。创建后仍留在原分支，需要 git switch 才会切换。\n\n-m 改名分支；省略旧名称时操作当前分支，显式给出旧名称时也可改名其他本地分支。当前分支改名会同步 HEAD，本地保存的上游配置也随名称迁移。\n\n-M 是允许覆盖重名分支的版本，会替换另一个非当前分支的引用。改名前先检查已有名称和提交位置；它不会替你重命名远程服务器上的分支，也不会把 origin/main 自动变成其他远程名称。',
      examples: [
        {label: '查看本地分支', command: 'git branch', description: '当前分支前有星号。先确认现有名称，再创建或改名。'},
        {label: '从当前位置创建 feature', command: 'git branch feature', description: '要求 feature 尚不存在；创建后仍在当前分支，用 git switch feature 才会切换。'},
        {label: '重命名当前分支', command: 'git branch -m topic', description: '要求 topic 尚不存在。当前分支及 HEAD 使用新名称，远程分支名称保持原样。'},
        {label: '重命名指定本地分支', command: 'git branch -m feature feature-ready', description: '要求 feature 已存在、feature-ready 尚不存在。可用于当前分支，也可用于其他本地分支。'},
        {label: '允许覆盖已有分支名', command: 'git branch -M feature archive', description: '要求 feature 已存在，且 archive 不是另一个当前分支。如果 archive 已存在，其原引用会被替换。'}
      ]
    });
    Object.assign(REFERENCES.find(r => r.name === 'log'), {
      detail: 'log 沿提交的父节点回溯历史；默认从 HEAD 开始。可在命令末尾提供分支、标签或提交引用，--all 则从各引用查看可达提交，--graph 显示拓扑关系。\n\n-n 数量、--max-count 数量、--max-count=数量和 -数量 都限制最多输出多少条提交。它们只控制显示，不会删除提交或限制分支地图。\n\nreset 或 amend 后，某些旧提交不再被当前分支指向。log 看的是提交之间的历史关系，reflog 另行记录 HEAD 曾经移动到哪里。',
      examples: [
        {label: '查看最近三次提交', command: 'git log --oneline -n 3', description: '从 HEAD 回溯，最多显示三条。--oneline 把每条提交压缩为一行。'},
        {label: '查看各引用的简短拓扑', command: 'git log --oneline --graph --all --max-count=5', description: '从各引用查看可达历史，最多显示五条；不会修改实际提交图。'},
        {label: '使用数字简写限制条数', command: 'git log --oneline -2', description: '-2 等同于最多显示两条提交。'},
        {label: '从 main 查看历史', command: 'git log --oneline --max-count 5 main', description: '要求 main 存在。提供引用只改变查看起点，不切换当前分支。'}
      ]
    });
    Object.assign(REFERENCES.find(r => r.name === 'revert'), {
      detail: 'revert 计算指定提交相对父提交的改动，再把这份改动反向应用到当前分支，成功后新建撤销提交。原提交仍在历史里，因此能够清楚记录「做过什么」和「为什么撤销」。它也可处理根提交；本模拟不处理合并提交或多个提交范围。\n\nreset 则移动当前分支指针：--soft 保留暂存区和工作区，默认 --mixed 同时重置暂存区，--hard 还恢复已跟踪工作区。想保留协作历史时通常选择 revert；整理本地尚未共享的历史时才考虑 reset。\n\n开始 revert 前，已跟踪文件必须干净。本模拟采用文件级三方合并：双方修改同一文件且结果不同时产生冲突；真实 Git 常能自动合并不重叠的行。冲突后编辑工作区，删除冲突标记，git add 标记解决，再 revert --continue；也可 git commit -m 完成处理。\n\n--abort 恢复操作前的工作区与暂存区。没有可撤销变化时会给出提示并撤回本次尝试，不创建空提交。',
      examples: [
        {label: '撤销最近一次普通提交', command: 'git revert HEAD', description: '需要已有非合并提交，且已跟踪文件干净；成功后新增逆向提交，旧提交保留。'},
        {label: '解决冲突后继续撤销', command: 'git revert --continue', description: '仅用于进行中的 revert：先编辑冲突文件、移除标记，并对每个已解决文件执行 git add。'},
        {label: '取消进行中的撤销', command: 'git revert --abort', description: '仅用于进行中的 revert；恢复操作前的工作区与暂存区。'}
      ]
    });
    Object.assign(REFERENCES.find(r => r.name === 'cherry-pick'), {
      detail: 'cherry-pick 把指定提交相对其父提交的改动应用到当前分支，成功后创建新提交，保留来源作者；来源分支不移动。它适合把一次独立修复带到另一分支，而不是合入来源分支的全部历史。\n\n本模拟每次支持一个普通提交或根提交。参数也可用指向该提交的分支名；例如 feature 指向所需普通提交时，可在 main 上执行 git cherry-pick feature。操作前先确保当前分支正确，已跟踪文件干净，并确认目标分支尚未包含这份改动。\n\n双方修改同一文件且结果不同时，本模拟按文件产生冲突；真实 Git 常能按行合并不重叠改动。出现冲突后编辑文件、移除标记、git add，再 cherry-pick --continue；也可 git commit -m 完成。--abort 恢复操作前的工作区和暂存区。\n\n不支持提交范围、合并提交的 -m 主线选择或 --no-commit。若改动已经存在而无事可做，会提示并撤回本次尝试，不创建空提交。',
      examples: [
        {label: '挑选 feature 顶端的一次提交', command: 'git cherry-pick feature', description: '先在 feature 上保存一次独立改动，再切回干净的 main；feature 顶端必须是普通提交，且 main 尚未包含该改动。'},
        {label: '解决冲突后继续挑选', command: 'git cherry-pick --continue', description: '仅用于进行中的 cherry-pick：先编辑冲突文件、移除标记，并 git add 标记所有文件已解决。'},
        {label: '取消进行中的挑选', command: 'git cherry-pick --abort', description: '仅用于进行中的 cherry-pick；恢复开始挑选前的工作区与暂存区。'}
      ]
    });
    Object.assign(REFERENCES.find(r => r.name === 'reflog'), {
      detail: 'reflog 列出 HEAD 的本地移动记录，包括新提交、reset、amend 和分支切换。HEAD@{0} 指最新一条记录，HEAD@{1} 指上一条记录的位置；编号越大，记录越早。它不等同于 HEAD~1：后者沿当前提交的父节点回溯。\n\n先用 reflog 查看记录，再用 git show HEAD@{1} 检查目标。确认后，可以 git branch recovered HEAD@{1} 创建恢复分支来保留提交，也可以在明确需要移动当前分支时使用 reset。每次新的 HEAD 移动会改变记录编号，执行恢复命令前应重新核对。\n\n本模拟只记录本地模拟仓库会话中的引用移动，随浏览器状态保存，不代表远程仓库的操作日志。载入旧版本存档时仅补一条导入记录；如果不存在上一条记录，HEAD@{1} 会明确报错。reflog 不会找回从未提交的文件编辑。',
      examples: [
        {label: '查看最近五条移动记录', command: 'git reflog -n 5', description: '查看记录编号、提交位置和移动原因；有记录后再使用 HEAD@{n}。'},
        {label: '使用 show 子命令与条数限制', command: 'git reflog show --max-count=5', description: 'show 可省略，--max-count=5 与 -n 5 都限制输出五条。'},
        {label: '检查上一条记录的提交', command: 'git show HEAD@{1}', description: '要求上一条记录存在且指向提交。先核对内容，分支切换记录并不一定是父提交。'},
        {label: '为旧提交建立恢复分支', command: 'git branch recovered HEAD@{1}', description: '要求该记录指向提交，且 recovered 尚不存在。创建分支后可 git switch recovered 查看。'},
        {label: '只把当前分支移回记录位置', command: 'git reset --soft HEAD@{1}', description: '先确认该记录就是目标。--soft 移动当前分支，保留暂存区和工作区；它会新增一条移动记录。'}
      ]
    });

    const LESSONS = [
      ['zones', 'Git 四区', '工作区保存编辑内容，暂存区保存下次提交的完整快照，本地仓库保存提交历史，远程仓库保存协作版本。add 更新暂存区，commit 写入本地历史，push 发送到远程。提交后暂存区不清空，而是与 HEAD 一致；本演示的远程在浏览器中模拟，不访问网络。', ['git status', 'git add README.md', 'git diff --staged']],
      ['config', '配置姓名与邮箱', '每次提交都会记录作者姓名和邮箱。正确命令是 git config user.name，而不是 git user.name。先配置身份，再创建提交，便于你和协作者追踪每次改动的来源。\n\n第一步：用 git config --global user.name 和 git config --global user.email 设置默认身份。真实 Git 的 --global 对当前系统用户生效；本网站只在浏览器里模拟，初始提供 Git Learner <learner@example.com>，不会修改电脑上的 Git 配置。\n\n第二步：需要按项目区分身份时，用 --local 覆盖当前仓库的姓名或邮箱。不写范围的设置命令默认写入当前仓库。本地值按配置项优先：只覆盖 user.name 时，user.email 仍继承全局邮箱；--local 需要已初始化的仓库。\n\n第三步：用 git config user.name 或 git config --get user.email 查看实际生效的身份。git config --list（简写 -l）列出配置，--global 与 --local 可限定查看范围。同一配置项可能在列表中出现两次，查询生效值时以本地配置为准。\n\n想恢复默认姓名，可执行 git config --local --unset user.name，之后会重新使用全局姓名。此网站会保存配置，重置模拟仓库或 clone 会保留全局默认值、清除原仓库配置。\n\n姓名和邮箱不是远程登录凭据，设置它们不会获得推送权限。修改配置只影响后续新提交，不会修改已有提交的作者，也不会让四区文件产生变化。可创建一次新提交，再用 git show HEAD 查看作者。', ['git config --global user.name "小明"', 'git config --global user.email "xiaoming@example.com"', 'git config --local user.name "小明（项目）"', 'git config user.name', 'git config --get user.email', 'git config --list', 'git config --local --unset user.name']],
      ['first', '第一次提交', 'init 建立仓库，add 选择内容，commit 创建版本。提交前可用 config --list 检查姓名与邮箱；如何设置身份见「配置姓名与邮箱」。未跟踪文件要先 add 才能进入历史。提交说明应交代改了什么；执行 commit 时生效的作者身份会随快照一起保存。\n\n修改已跟踪文件后，可用 git commit -a -m 或 -am 自动暂存并提交；-a 不会纳入未跟踪的新文件。若先 add，随后又编辑，普通 commit 仍保存 add 时的快照，后续修改留在工作区。', ['git init', 'git config --list', 'git add README.md', 'git commit -m "创建项目说明"', 'git commit -am "更新已有文件"']],
      ['inspect', '读懂变化', 'diff 比较工作区与暂存区，diff --staged 比较暂存区与 HEAD。log 展示历史，show 展开提交。先确认变化，再保存版本。\n\nlog 默认从 HEAD 回溯；--all 从各引用查看可达提交，--graph 显示关系。-n 3、--max-count 3、--max-count=3 和 -3 都表示最多显示三条，不会删改实际历史。要查看 HEAD 移动前的位置，使用 reflog，详见「找回移动前的提交」。', ['git diff', 'git diff --staged', 'git log --oneline --graph --all -n 5', 'git log --oneline --max-count=3', 'git show HEAD']],
      ['branch', '分支与合并', '分支指向提交，HEAD 通常指向当前分支；新提交推进当前分支。merge 将目标分支合入当前分支。没有分叉时可快进，分叉后成功合并会产生有两个父节点的提交。\n\nbranch 创建分支但不切换。branch -m 新名称 重命名当前分支，branch -m 旧名称 新名称 可指定被改名的本地分支。-m 遇重名拒绝，-M 允许覆盖另一个非当前分支。改名同步 HEAD 和本地上游配置，不重命名远程分支。\n\n只需要来源分支的一次独立改动时，可使用 cherry-pick，详见「挑选单次提交」。它创建新的提交，而 merge 整合分支历史。', ['git branch feature', 'git switch feature', 'git switch main', 'git merge feature', 'git branch -m topic']],
      ["remote", "本地与远程", "服务器与本地各自保存历史。fetch 获取提交并更新本地的 origin/main 等远程跟踪引用，不改当前分支。push 更新服务器分支；pull 先 fetch，再整合。\n\n第一次添加地址使用 git remote add；修改已有地址使用 git remote set-url，重复 add 同名远程会报错。用 git remote get-url 查询指定远程，或 git remote -v 查看全部。\n\n这里的远程仅在浏览器内模拟，set-url 修改地址标记后保留模拟远程的提交与分支。真实 Git 修改 URL 后会连接对应服务器，可能需要重新认证；user.name 和 user.email 只用于提交署名，不是登录凭据。", ["git remote -v", "git remote set-url origin demo://my-repository", "git remote get-url origin", "git fetch origin", "git merge origin/main", "git push -u origin main"]],
      ['undo', '选择撤销范围', 'restore 默认从暂存区恢复工作区；--staged 默认用 HEAD 恢复暂存区。reset --soft 只移动当前分支，--mixed 还恢复暂存区，--hard 再恢复已跟踪工作区。\n\nreset 会改写当前分支看到的历史，适合明确要整理的本地历史；--hard 会丢弃已跟踪的未提交改动。revert 则新建逆向提交来抵消指定提交的改动，原提交继续保留。已共享的改动通常用 revert 撤销，便于协作者理解和同步。\n\n本模拟 revert 每次处理一个普通提交（包括根提交），不支持合并提交主线或提交范围。先让已跟踪文件保持干净，再执行 git revert HEAD。冲突时编辑、git add，然后 git revert --continue；git revert --abort 可恢复操作前状态。\n\nreset 或 amend 后想找回旧提交，先查看 reflog，核对目标内容，再建立恢复分支。reflog 无法恢复从未保存成提交的文件编辑。', ['git restore --staged README.md', 'git restore README.md', 'git reset --soft HEAD~1', 'git revert HEAD', 'git reflog -n 5']],
      ['stash', 'stash 与 tag', 'stash 收起未提交改动，默认不含未跟踪文件，-u 可一并保存。pop 恢复成功后删除记录，恢复时也可能冲突。tag 为提交设置固定名称，不随新提交移动，常用于标记版本。', ['git stash push -u', 'git stash list', 'git stash pop', 'git tag v1.0']],
      ['conflict', '解决合并冲突', 'merge 冲突后，编辑工作区文件，保留所需内容并移除 <<<<<<<、=======、>>>>>>> 标记；git add 表示该文件已解决，git commit 完成合并。\n\n本模拟使用文件级三方合并：双方修改同一文件且结果不同时就会冲突。真实 Git 通常按行合并，可以自动整合同一文件中不重叠的修改。因此这里的冲突可能比真实 Git 更保守。\n\ncherry-pick 和 revert 使用相同的文件级规则。操作前已跟踪文件必须干净；发生冲突后仍先编辑、add，再执行相应的 --continue，也可 git commit -m 完成。想取消时使用相应的 --abort，恢复操作前工作区和暂存区。--continue 和 --abort 只适用于正在进行的对应操作。', ['git merge feature', 'git status', 'git add README.md', 'git commit -m "解决说明冲突"', 'git cherry-pick --continue', 'git revert --continue']],
      ['amend', '修正最近一次提交', '普通 commit 追加新版本，commit --amend 则创建替代最近一次提交的新提交，保留其父节点和作者，提交哈希会改变。它不会修改所有历史，也不会自动补入未暂存的新文件。\n\n只想改说明：先确认暂存区没有意外改动，再执行 git commit --amend -m "补充提交说明"。暂存区内容会一并用于替代提交。想补入漏掉的文件：先编辑、git add，再 git commit --amend --no-edit，沿用原说明。\n\n-a 可与 --amend 组合，自动暂存已跟踪文件的修改和删除；未跟踪文件仍需要 add。本模拟没有提交信息编辑器，amend 必须明确提供 -m 或 --no-edit。\n\n原提交仍可通过 reflog 找回。改写已推送的提交后，普通 push 可能因历史分叉被拒绝；先与协作者协调，不能把修改后的哈希当作原提交继续共享。', ['git commit --amend -m "补充提交说明"', 'git commit --amend --no-edit', 'git commit -a --amend --no-edit', 'git reflog -n 5']],
      ['cherry-pick', '挑选单次提交', 'cherry-pick 取出一次提交相对其父提交的改动，应用到当前分支并创建新提交，保留来源作者；来源分支不移动。它适合把单次独立修复带到另一分支，不会自动合入来源分支的全部提交。\n\n练习顺序：从干净的 main 创建 feature；编辑文件、add 并 commit；切回 main；确认工作区干净，再 git cherry-pick feature。此时 feature 指向的普通提交就是来源。用 log 查看新提交，用 show 核对快照。\n\n本模拟每次只处理一个普通提交或根提交，不支持多个提交范围、合并提交的 -m 主线选择或 --no-commit。双方对同一文件产生不同修改时按文件冲突；编辑后 add，再 cherry-pick --continue，或用 --abort 恢复操作前状态。已经包含的改动不会生成空提交。', ['git switch -c feature', 'git add README.md', 'git commit -m "独立修复"', 'git switch main', 'git cherry-pick feature', 'git log --oneline --all -n 5']],
      ['reflog', '找回移动前的提交', 'log 查看提交与父节点组成的历史；reflog 查看本地 HEAD 曾经移动到哪里。提交、reset、amend 或分支切换都会产生移动记录，这有助于找回不再被当前分支指向的提交。\n\nHEAD@{0} 是最新记录，HEAD@{1} 是上一条记录的位置；HEAD~1 才是当前提交的第一父提交。两者并不等同，尤其是切换分支之后。每次新移动也会改变 reflog 编号。\n\n恢复步骤：git reflog -n 5 查看记录；git show HEAD@{1} 核对目标；确认后 git branch recovered HEAD@{1} 为目标创建分支，再 git switch recovered。要求该记录存在、指向提交，且 recovered 尚不存在；必要时使用实际记录中的哈希。\n\n需要移动当前分支时才考虑 reset --soft 等方式。本模拟的 reflog 随浏览器状态保存，旧存档仅补一条导入记录，不虚构此前的移动；它不是远程日志，也无法恢复从未提交的文件编辑。', ['git reflog -n 5', 'git reflog show --max-count=5', 'git show HEAD@{1}', 'git branch recovered HEAD@{1}', 'git switch recovered']],
      ['practice', '形成操作习惯', '先看 status 和 diff，再 add、commit。推送前用 log 确认分支和提交。随时重置练习，观察文件、暂存区和历史的变化。', ['git status', 'git diff', 'git add .', 'git commit -m "完成修改"', 'git push origin main']]
    ].map(([id, title, body, commands]) => ({id, title, body, commands}));

    const SCENARIOS = [
      ['free', '自由探索', '随时实验', '已有两次提交、README.md 修改和未跟踪的 notes.md，远程落后一次提交。', [
        ['检查当前状态', '找出修改与未跟踪文件。', 'git status'],
        ['查看文件差异', '观察 README.md 的变化。', 'git diff'],
        ['自由尝试', '编辑、分支、提交，观察各区域变化。']]],
      ['first', '保存第一个版本', '入门 · 4 步', '从 README.md 开始，完成首次提交。', [
        ['初始化仓库', '建立本地 Git 仓库。', 'git init'],
        ['暂存项目说明', '把当前内容写入暂存区。', 'git add README.md'],
        ['创建第一次提交', '保存暂存区版本。', 'git commit -m "创建项目说明"'],
        ['查看提交记录', '找到刚创建的提交。', 'git log --oneline']]],
      ['branch', '在分支上开发', '分支 · 4 步', 'main 已有干净基础版本，在 feature 上修改并提交。', [
        ['创建并切换分支', '从当前位置建立 feature。', 'git switch -c feature'],
        ['编辑项目说明', '在文件编辑器修改并保存 README.md。'],
        ['暂存并提交', '先 add，再执行 git commit -m "完善说明"。', 'git add README.md'],
        ['查看分支历史', '提交后观察 feature 前进，main 留在原处。', 'git log --oneline --all']]],
      ['merge', '完成一次合并', '合并 · 2 步', 'main 和 feature 分别新增了不同文件，当前在 main。', [
        ['合入 feature', '将 feature 合并到当前 main。', 'git merge feature'],
        ['检查合并提交', '观察两个父节点及合并后的文件。', 'git log --oneline --all']]],
      ['conflict', '亲手解决冲突', '冲突 · 4 步', '两条分支都修改了 README.md，当前在 main。', [
        ['触发合并冲突', '尝试合入 feature。', 'git merge feature'],
        ['编辑解决冲突', '编辑 README.md，保留所需内容并删除冲突标记后保存。'],
        ['标记已解决', 'add 表示文件冲突已解决。', 'git add README.md'],
        ['完成合并提交', '保存最终版本。', 'git commit -m "解决说明冲突"']]],
      ['push', '推送到远程', '协作 · 3 步', 'origin 尚无提交，本地有基础版本和未提交的 notes.md。', [
        ['暂存笔记', '将 notes.md 纳入下次提交。', 'git add notes.md'],
        ['提交笔记', '推送前先保存版本。', 'git commit -m "添加学习笔记"'],
        ['推送并设置上游', '发送 main，建立跟踪关系。', 'git push -u origin main']]]
    ].map(([id, title, kicker, description, rows]) => ({id, title, kicker, description, steps: rows.map(([label, hint, command]) => ({label, hint, ...(command ? {command} : {})}))}));

