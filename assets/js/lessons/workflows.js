    /* High-frequency workflows shown as dedicated learning chapters. */
    const CommonScenarioExamples = (() => {
      const commit = (repo, path, content, message) => {
        repo.state.workingTree[path] = content;
        repo.run('git add ' + path);
        repo.run('git commit -m "' + message + '"');
      };
      const initialize = repo => {
        repo.run('git init');
        commit(repo, 'README.md', '# 项目说明\n版本：v1\n', '创建项目说明');
      };
      return [
        {
          id: 'branch-cleanup', chapter: 'branch-cleanup', title: '合并完成后，功能分支还要保留吗？', path: 'README.md',
          description: 'feature 已保存一版功能说明，当前仍在 feature。切回 main、完成快进合并，再安全删除已经合入的本地分支。',
          setup(repo) {initialize(repo); repo.run('git switch -c feature'); commit(repo, 'README.md', '# 项目说明\n版本：feature 功能说明\n', '完成功能说明')},
          steps: [
            {command: 'git switch main', note: '先回到接收改动的 main。工作区与暂存区恢复为 main 的 v1，feature 提交仍然保留。', focus: ['working', 'index', 'local']},
            {command: 'git merge feature', note: 'main 没有独有提交，因此直接快进到 feature。两个分支暂时指向同一提交，文件也变成功能版本。', focus: ['working', 'index', 'local']},
            {command: 'git branch -d feature', note: 'feature 已完整合入当前 main，-d 安全删除这个本地分支引用。提交节点、合并结果和文件都不会消失。', focus: ['local']},
            {command: 'git branch -a', note: '列表只剩当前 main。-a 还会列出本地已有的远程跟踪分支；它不会查询服务器，也不会修改文件或提交。', focus: ['local']}
          ]
        },
        {
          id: 'remote-push-rejected', chapter: 'push-rejected', title: '远程先前进后，为什么 push 被拒绝？', path: 'README.md',
          description: '本地与远程从 v1 出发。本地已经提交 README.md 第二版，接着模拟协作者向远程新增文件，完整演示拒绝后的恢复流程。',
          setup(repo) {
            initialize(repo);
            repo.run('git remote add origin demo://lesson');
            repo.run('git push -u origin main');
            commit(repo, 'README.md', '# 项目说明\n版本：v2，本地更新\n', '本地更新项目说明');
          },
          steps: [
            {
              label: '模拟协作者新增 team.md 并推送', action(repo) {
                const peer = new GitSim();
                peer.state.remotes.origin = structuredClone(repo.state.remotes.origin);
                peer.run('git clone demo://lesson');
                commit(peer, 'team.md', '# 团队公告\n协作者更新远程版本。\n', '协作者更新团队公告');
                peer.run('git push');
                repo.state.remotes.origin = structuredClone(peer.state.remotes.origin);
                return {output: '协作者已向 origin/main 推送 team.md。', explanation: '远程产生了本地尚未获取的新提交，本地 main 与远程 main 现在从共同版本分叉。'};
              }, note: '协作者从共同的 v1 出发，让远程新增另一条提交。本地 main 与 origin/main 跟踪引用仍未移动。', focus: ['remote']
            },
            {command: 'git push', expectError: 'non-fast-forward', errorExplanation: '远程 main 含有本地历史没有的提交，Git 拒绝直接覆盖它。失败不会改变工作区、暂存区、本地分支或远程分支。', note: 'push 被 non-fast-forward 拒绝。这是在保护协作者的远程提交；重复 push 不会解决问题，应先获取并整合。', focus: ['local', 'remote']},
            {command: 'git fetch origin', note: '下载协作者提交并更新 origin/main。当前 main、工作区和暂存区仍保持本地第二版。', focus: ['local']},
            {command: 'git merge origin/main', note: '本地修改 README.md，远程新增 team.md，两边修改不同文件，可以自动合并。新提交记录两个父节点。', focus: ['working', 'index', 'local']},
            {command: 'git push', note: '合并提交同时包含本地与协作者历史，现在可以快进远程 main；HEAD、origin/main 与远程 main 最终一致。', focus: ['remote']}
          ]
        }
      ];
    })();

    /* Register common workflows as visible top-level learning chapters. */
    const registerLessonExample = example => {
      const existing = LessonExampleData.findIndex(item => item.id === example.id);
      if (existing >= 0) LessonExampleData.splice(existing, 1);
      LessonExampleData.push(example);
    };
    CommonScenarioExamples.forEach(registerLessonExample);

    const insertLessonAfter = (afterId, lesson) => {
      const existing = LESSONS.findIndex(item => item.id === lesson.id);
      if (existing >= 0) LESSONS.splice(existing, 1);
      const index = LESSONS.findIndex(item => item.id === afterId);
      LESSONS.splice(index < 0 ? LESSONS.length : index + 1, 0, lesson);
    };

    insertLessonAfter('branch', {
      id: 'branch-cleanup',
      title: '合并后清理分支',
      body: '功能开发完成后，先切回接收改动的 main，再合并 feature。确认 main 已经包含功能提交后，git branch -d feature 会安全删除本地 feature 引用。\n\n-d 带有未合并保护：如果 feature 仍有当前 HEAD 不可达的提交，Git 会拒绝删除。-D 会跳过这项保护，只应在明确放弃分支独有提交时使用；当前所在分支始终不能删除。\n\n删除分支只是移除指向提交的标签，不会删除已经合入 main 的提交、文件或分支图节点。git branch -a 可核对本地分支和本地保存的远程跟踪引用；删除本地分支也不会删除远程同名分支。',
      commands: ['git switch main', 'git merge feature', 'git branch -d feature', 'git branch -a']
    });

    insertLessonAfter('remote', {
      id: 'push-rejected',
      title: 'Push 被拒后的恢复',
      body: '协作者先向远程提交后，本地 main 如果也产生了不同提交，两端历史就会分叉。此时普通 git push 会被 non-fast-forward 拒绝，以免覆盖远程已有工作。\n\n先执行 git fetch origin 下载远程提交并更新 origin/main。fetch 不移动当前 main，也不覆盖工作区；随后用 git merge origin/main 把远程历史整合进当前分支。\n\n如果双方修改不同文件，merge 可以自动生成双父提交；修改同一内容时则需要先解决冲突并提交。确认历史已经包含双方工作后再次 git push，远程分支才会安全前进。',
      commands: ['git push', 'git fetch origin', 'git merge origin/main', 'git log --oneline --graph --all']
    });

    ResourceReading.heads['branch-cleanup'] = ['先合并，再清理', '-d 与 -D 的区别', '删除标签，不删除提交'];
    ResourceReading.heads['push-rejected'] = ['为什么会被拒绝', '获取并整合远程历史', '解决冲突后重新推送'];

    LessonGuidance['branch-cleanup'] = {
      goal: '完成一次功能分支合并，并理解安全删除分支时 Git 实际移除了什么。',
      checkpoints: [
        {title: '先站在接收分支上', body: '切回 main 后再 merge feature，确保合并方向正确，也避免尝试删除当前分支。'},
        {title: '让 -d 做安全检查', body: '-d 只删除已经合入当前 HEAD 的本地分支；未合并时会拒绝，-D 才会跳过保护。'},
        {title: '观察标签而不是文件', body: '删除后 feature 标签消失，但 main、工作区、提交数量和已经合并的提交节点保持不变。'}
      ],
      commands: {
        'git switch main': '切回接收改动的 main。工作区随 main 快照更新，feature 分支和它的提交仍然保留。',
        'git merge feature': '把 feature 可达的提交合入 main；没有分叉时通常直接快进。',
        'git branch -d feature': '安全删除已合并的本地 feature 引用，不删除提交、文件或远程分支。',
        'git branch -a': '核对剩余本地分支和已经获取的远程跟踪引用；该命令不会访问服务器。'
      }
    };

    LessonGuidance['push-rejected'] = {
      goal: '看懂 non-fast-forward 拒绝，并用 fetch、merge、push 安全恢复团队协作。',
      checkpoints: [
        {title: '拒绝是在保护远程历史', body: '远程含有本地尚未整合的提交时，push 不会覆盖它；失败不会改动四区或远程状态。'},
        {title: 'fetch 只更新远程跟踪引用', body: 'fetch 后 origin/main 前进，当前 main 和工作区保持原样，分支图会清楚显示分叉。'},
        {title: '整合后才能重新推送', body: 'merge 让当前历史包含双方提交；解决可能的冲突并提交后，再次 push 才能让远程安全前进。'}
      ],
      commands: {
        'git push': '把当前分支的已提交历史发送到上游；远程无法快进时会被 non-fast-forward 拒绝。',
        'git fetch origin': '下载 origin 的新提交并更新 origin/main，不移动 main，也不覆盖工作区。',
        'git merge origin/main': '把已获取的远程历史合入当前分支；可能自动合并、生成双父提交或进入冲突状态。',
        'git log --oneline --graph --all': '推送前查看本地、远程跟踪分支和合并关系，确认双方历史都已保留。'
      }
    };

    const branchReference = REFERENCES.find(reference => reference.name === 'branch');
    Object.assign(branchReference, {
      syntax: 'git branch\ngit branch [-a|--all]\ngit branch [-r|--remotes]\ngit branch <新分支名> [起点]\ngit branch -d <分支名>\ngit branch -D <分支名>\ngit branch (-m|-M) [旧分支名] <新分支名>',
      summary: '查看、创建、删除或重命名分支',
      example: 'git branch -a',
      pitfall: '不能删除当前分支；-D 会跳过未合并保护；-a / -r 只读取本地保存的引用，不会实时查询服务器',
      note: '-d 只删除已合并的本地分支；删除本地分支不会删除已经合入当前历史的提交，也不会删除远程分支',
      detail: '分支是指向提交的可移动引用。不带参数时只列本地分支；提供新名称时创建分支，可以再提供起点引用。创建后仍留在原分支，需要 git switch 才会切换。\n\n-a（--all）同时列出本地分支与本地已经获取的远程跟踪分支，-r（--remotes）只列远程跟踪分支。它们读取的是本地记录，不会实时查询服务器；需要最新状态时先 git fetch。\n\n-d 只允许删除已经合入当前 HEAD 的本地分支，适合在合并完成后清理 feature。不能删除当前分支，应先切回 main。-D 会跳过未合并保护，可能让尚未合入的提交失去容易找到的分支入口。两者都不会删除远程同名分支。\n\n删除分支只是移除引用。已经合入 main 的提交仍属于 main 历史，文件和提交节点不会消失。-m 用于改名；-M 允许覆盖重名的非当前分支。改名会同步当前 HEAD 和本地上游配置，但不会重命名远程服务器上的分支。',
      examples: [
        {label: '查看本地分支', command: 'git branch', description: '当前分支前有星号；命令只读取本地分支引用。'},
        {label: '查看全部本地记录', command: 'git branch -a', description: '同时列出本地分支与已获取的 origin/main 等远程跟踪分支，不会访问服务器。'},
        {label: '只看远程跟踪分支', command: 'git branch -r', description: '只列出本地保存的远程跟踪引用；需要最新结果时先 git fetch。'},
        {label: '从当前位置创建 feature', command: 'git branch feature', description: '要求 feature 尚不存在；创建后仍在当前分支，用 git switch feature 才会切换。'},
        {label: '安全删除已合并分支', command: 'git branch -d feature', description: '先切回 main 并合并 feature。-d 会拒绝删除尚未合入当前 HEAD 的分支。'},
        {label: '强制删除本地分支', command: 'git branch -D feature', description: '跳过未合并检查；只在确认不再需要该分支的独有提交时使用，不会删除远程分支。'},
        {label: '重命名当前分支', command: 'git branch -m topic', description: '要求 topic 尚不存在；当前分支与 HEAD 使用新名称，远程分支名称保持原样。'}
      ]
    });

    const pushReference = REFERENCES.find(reference => reference.name === 'push');
    Object.assign(pushReference, {
      syntax: 'git push [-u|--set-upstream] [<远程> [<分支>]]',
      summary: '发送本地已提交的历史到远程分支',
      example: 'git push',
      pitfall: '工作区和暂存区中尚未提交的内容不会上传；远程含有本地尚未整合的提交时会被 non-fast-forward 拒绝',
      note: '首次推送可用 -u 记录上游；被拒绝后先 fetch 并 merge 远程跟踪分支，确认合并结果后再 push',
      detail: 'push 发送的是提交对象和分支位置，不会直接上传尚未提交的工作区或暂存区内容。第一次发布分支时可用 -u 记录上游，之后在该分支上通常可以直接 git push。\n\n如果协作者已经让远程分支前进，而本地历史没有包含那次提交，普通 push 会被 non-fast-forward 拒绝。这是为了避免覆盖远程历史；失败本身不会改变本地文件、分支或远程内容。\n\n常见恢复顺序是 git fetch origin、git merge origin/main、git push。fetch 先更新本地保存的 origin/main，merge 把双方历史整合到当前分支；如果出现冲突，先解决并提交，再重新推送。',
      examples: [
        {label: '推送到已记录的上游', command: 'git push', description: '需要当前分支已经设置上游；只发送已经提交且远程可以快进的历史。'},
        {label: '首次推送并记录上游', command: 'git push -u origin main', description: '把本地 main 发布到 origin/main，并让之后的 git push 知道目标。'},
        {label: '被拒绝后先获取远程状态', command: 'git fetch origin', description: '更新 origin/main，不移动当前 main，也不覆盖工作区文件。'},
        {label: '整合已获取的远程历史', command: 'git merge origin/main', description: '在当前 main 上合入远程跟踪分支；可能快进、创建合并提交或产生冲突。'}
      ]
    });

