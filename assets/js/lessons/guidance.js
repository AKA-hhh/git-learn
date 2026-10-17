    /* Chapter-specific learning goals, observations and exact command guidance. */
    const LessonGuidance = {
      "zones": {
        "goal": "通过一次编辑、暂存和提交，分清四个区域保存的是哪个版本。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "看到文件在多个区域出现、状态不同，或不确定下一条命令会保存什么时，先比较这四份内容。"
          },
          {
            "title": "观察结果",
            "body": "修改 README.md 后工作区变化；add 后暂存区更新；commit 后本地 HEAD 前进；push 后远程分支才追上。"
          },
          {
            "title": "常见误区",
            "body": "暂存区不是提交后自动清空的待办列表。它一直保留完整快照，工作区后续编辑也不会自动同步进去。"
          }
        ],
        "commands": {
          "git status": "汇总工作区相对暂存区、暂存区相对 HEAD 的状态，只读取信息。先用它找出未跟踪、未暂存和已暂存的文件。",
          "git add README.md": "把工作区此刻的 README.md 写入暂存区，也可以暂存这个已跟踪文件的删除；不会创建提交。执行后再编辑文件，会同时看到已暂存与未暂存的变化。",
          "git diff --staged": "比较暂存区和当前 HEAD，检查下一次普通提交将保存哪些改动。输出为空通常表示暂存区与 HEAD 相同，而不代表工作区没有修改。"
        }
      },
      "config": {
        "goal": "设置提交署名，并验证当前仓库实际使用的姓名与邮箱。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "第一次练习提交，或希望某个项目使用不同署名时，先配置全局默认值，再按需设置当前仓库的覆盖值。"
          },
          {
            "title": "观察结果",
            "body": "用读取命令核对生效值，再创建新提交并查看作者。四区文件不会因身份设置而变化，已有提交的作者也不会被改写。"
          },
          {
            "title": "常见误区",
            "body": "user.name 和 user.email 是 git config 的配置项，不是独立命令，也不是远程登录凭据。本网站只修改浏览器中的模拟配置。"
          }
        ],
        "commands": {
          "git config --global user.name \"小明\"": "设置模拟全局默认姓名；当前仓库没有本地姓名覆盖时，新提交会使用“小明”。即使仓库尚未初始化，也可设置全局项。",
          "git config --global user.email \"xiaoming@example.com\"": "设置模拟全局默认邮箱，作为后续提交作者身份的一部分。它不会发送邮件，也不会连接或认证远程仓库。",
          "git config --local user.name \"小明（项目）\"": "为已初始化的当前仓库单独设置姓名，优先于全局姓名。没有本地邮箱覆盖时，邮箱仍沿用全局值。",
          "git config user.name": "读取当前实际生效的姓名，优先查看本地配置，再回退到全局配置。没有提供新值，因此不会更改配置。",
          "git config --get user.email": "明确读取实际生效的邮箱；查询结果能帮助检查本地邮箱是否覆盖了全局默认值。四区文件和提交历史保持原样。",
          "git config --list": "列出模拟全局与当前仓库配置。同一项可能出现两次；要确认最终生效值，使用不限定范围的 --get 查询。",
          "git config --local --unset user.name": "删除当前仓库已经设置的姓名覆盖，随后重新采用全局姓名。它不删除全局姓名，也不改变邮箱；本地项不存在时会提示无法删除。"
        }
      },
      "first": {
        "goal": "把工作区的一次修改保存成可回看的本地提交。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "准备记录一个完成的小改动时使用 add 与 commit。练习站已载入示例仓库，不必反复 init。"
          },
          {
            "title": "观察结果",
            "body": "暂存前后比较 README.md，再提交。成功后本地仓库显示新快照，HEAD 前进，远程仓库仍停在原版本。"
          },
          {
            "title": "常见误区",
            "body": "普通 commit 读取暂存区，不会自动保存全部工作区编辑；-am 也只处理已跟踪文件，新文件仍需先 add。"
          }
        ],
        "commands": {
          "git init": "初始化当前模拟仓库；在已有仓库里执行不会清空文件或历史。它只准备仓库结构，不会自动暂存或提交文件。",
          "git config --list": "提交前检查作者的姓名和邮箱配置，不修改任何文件。若存在本地与全局同名项，本地项优先。",
          "git add README.md": "把当前 README.md 的内容放进暂存区，供下一次提交使用。文件应当存在于工作区，或是已跟踪但刚被删除的路径。",
          "git commit -m \"创建项目说明\"": "用暂存区快照创建说明为“创建项目说明”的提交，并推进当前分支。先确保有已暂存变化且没有未解决冲突；未暂存编辑仍留在工作区。",
          "git commit -am \"更新已有文件\"": "先暂存已跟踪文件的修改与删除，再创建提交。练习前需要已有文件修改；未跟踪的新文件不会被纳入。"
        }
      },
      "inspect": {
        "goal": "分别读懂未暂存差异、待提交差异与已经保存的提交历史。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "编辑后看 diff，add 后看 diff --staged，提交后看 log 或 show，用不同视角核对每一步。"
          },
          {
            "title": "观察结果",
            "body": "暂存同一份修改后，它会从默认 diff 的比较结果转到 --staged 的比较结果；成功提交后，它会出现在 log 和 show 中。"
          },
          {
            "title": "常见误区",
            "body": "log 的条数限制只控制终端输出，不删除历史；默认 diff 也不会把未跟踪文件的全部内容当作已跟踪差异显示。"
          }
        ],
        "commands": {
          "git diff": "比较工作区与暂存区，显示尚未暂存的已跟踪文件改动。只读取差异；先在工作区编辑已跟踪文件才能看到对应变化。",
          "git diff --staged": "比较暂存区与 HEAD，显示下次普通提交相对当前提交的变化。适合在 commit 前检查是否暂存了想要的内容。",
          "git log --oneline --graph --all -n 5": "从各引用回溯历史，以简短文本与连线显示最多五条提交。它帮助比较分支位置，不会移动 HEAD，也不会修改分支地图的数据。",
          "git log --oneline --max-count=3": "从当前 HEAD 回溯，最多列出三条简短提交记录。--max-count=3 与 -n 3 的限制作用相同，未显示的提交仍保留。",
          "git show HEAD": "显示当前提交的作者、时间、说明和相对第一父提交的文件变化。需要已有提交；这里显示的是提交快照的变化，不是当前工作区编辑。"
        }
      },
      "branch": {
        "goal": "在开发分支保存改动，再把它合入指定的接收分支。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "希望独立尝试功能时先创建分支；完成提交后，切换到要接收改动的分支，再执行 merge 来源分支。"
          },
          {
            "title": "观察结果",
            "body": "branch 后只有新标签，switch 后 HEAD 所在分支改变。若双方已分叉，成功 merge 会出现连接两个父提交的新节点。"
          },
          {
            "title": "常见误区",
            "body": "git merge feature 合入的是 feature，接收方是当前分支。分叉本身不会触发冲突；本模拟在双方把同一文件改成不同内容时判冲突。"
          }
        ],
        "commands": {
          "git branch feature": "在当前提交处新建 feature 标签，不切换当前分支，也不复制一套工作区。需要名称尚未使用；创建后用 switch 才会进入它。",
          "git switch feature": "切换到已经存在的 feature 分支，并检出它的快照。先处理未提交的已跟踪修改，避免切换被模拟器阻止。",
          "git switch main": "切回已存在的 main，准备把其他分支的改动合入 main。成功后工作区与暂存区跟随目标快照，HEAD 指向 main。",
          "git merge feature": "把 feature 的历史与改动合入当前分支；要合入 main，应先切到 main。结果可能是无需更新、快进、合并提交或文件冲突，远程不受影响。",
          "git branch -m topic": "把当前本地分支改名为 topic，保持它指向的提交不变。topic 必须未被占用；这不会把模拟远程的同名分支一并改名。"
        }
      },
      "remote": {
        "goal": "区分远程地址、远程跟踪引用和实际推送的提交内容。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "先用 remote 查看地址；获取远程状态用 fetch，把更新带进当前分支用 merge，分享本地已提交版本用 push。"
          },
          {
            "title": "观察结果",
            "body": "fetch 更新 origin/main 等跟踪引用，但当前文件不变；merge 才可能更新当前分支文件；push 后远程快照追到本地分支。"
          },
          {
            "title": "常见误区",
            "body": "本模拟的 set-url 只更换地址标记，保留模拟远程内容，不会访问新服务器。push 传递提交，未提交的工作区或暂存区内容不会上传。"
          }
        ],
        "commands": {
          "git remote -v": "列出已配置的模拟远程名称和地址，只读取信息。示例仓库通常已有 origin，看到它后可继续练习 fetch 与 push。",
          "git remote set-url origin demo://my-repository": "把已有 origin 的地址标记改为 demo://my-repository。模拟远程提交、分支、跟踪引用和上游关系保持原样；origin 不存在时需先 remote add。",
          "git remote get-url origin": "读取已有 origin 当前保存的地址，适合在 set-url 后核对结果。不会连接远程，也不会改变四区内容。",
          "git fetch origin": "把模拟 origin 的提交复制到本地对象库，并更新 origin/main 等远程跟踪引用。当前分支、工作区和暂存区不移动。",
          "git merge origin/main": "把已获取的 origin/main 合入当前分支；先 fetch，并确认当前分支就是接收方。该引用必须存在，合并仍可能发生冲突。",
          "git push -u origin main": "将本地 main 的可达提交发送到模拟 origin/main，并记录 main 的上游关系。需要已有 main 提交；如果远程历史不能快进，推送会被拒绝。"
        }
      },
      "undo": {
        "goal": "根据要保留的内容，选择取消暂存、丢弃编辑、移动分支或创建逆向提交。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "只想撤销 add 用 restore --staged；只想撤销未暂存编辑用 restore；重新组织最后一次提交可考虑 reset --soft。"
          },
          {
            "title": "观察结果",
            "body": "分别看暂存区、工作区和 HEAD：restore 只恢复指定区域；soft reset 移动分支但保留两个文件区域；revert 会新增提交。"
          },
          {
            "title": "常见误区",
            "body": "HEAD~1 需要当前提交有父提交。revert 不会删除旧提交；reflog 也无法找回从未保存为提交的文件编辑。"
          }
        ],
        "commands": {
          "git restore --staged README.md": "用 HEAD 中的 README.md 恢复暂存区，取消该文件已暂存的变化。工作区内容保留；新加入且 HEAD 中没有的文件会回到未跟踪状态。",
          "git restore README.md": "用暂存区版本覆盖工作区的 README.md，丢弃它未暂存的编辑。它不会把文件恢复到任意历史版本，来源默认是暂存区。",
          "git reset --soft HEAD~1": "将当前分支退到当前提交的第一父提交，保留工作区与暂存区内容。需要父提交存在，且没有正在进行的合并或提交应用操作。",
          "git revert HEAD": "为当前普通提交创建一个抵消其改动的新提交，旧历史仍保留。先保持已跟踪文件干净；本模拟不接受合并提交的主线选择。",
          "git reflog -n 5": "查看最近五条 HEAD 移动记录，寻找 reset 或 amend 前的位置。只读记录；找回前先用 show 核对目标提交，再建立分支。"
        }
      },
      "stash": {
        "goal": "临时收起未完成的修改，并用标签标记一个固定的已提交版本。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "需要暂时离开未完成的工作时用 stash；需要给一个已提交版本起固定名称时用 tag，两者解决的问题不同。"
          },
          {
            "title": "观察结果",
            "body": "stash push 后工作区回到 HEAD；pop 后保存的改动回来。tag 创建后留在原提交，即使当前分支继续提交也不会前移。"
          },
          {
            "title": "常见误区",
            "body": "stash 不是普通提交，默认也不保存未跟踪文件。pop 遇文件冲突时，本模拟会停止并保留保存项，不会悄悄覆盖。"
          }
        ],
        "commands": {
          "git stash push -u": "保存当前未提交改动，并把未跟踪文件一并收起，工作区与暂存区恢复到 HEAD。需要有可保存变化，且没有尚未完成的冲突操作。",
          "git stash list": "列出临时保存项，stash@{0} 是最近一项。只读取列表，不恢复文件，也不创建提交。",
          "git stash pop": "恢复最近的保存项，成功后从列表移除；需要当前已跟踪文件干净。默认已有文件修改恢复为未暂存状态，遇文件冲突则停止并保留保存项。",
          "git tag v1.0": "给当前提交建立名为 v1.0 的轻量标签，不改变文件或当前分支。需要已有提交且该标签名未使用；后续提交不会自动移动它。"
        }
      },
      "conflict": {
        "goal": "读懂冲突状态，手动决定最终文件内容并完成正在进行的操作。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "merge、cherry-pick 或 revert 提示冲突后，先查看 status，再打开工作区中的冲突文件决定最终内容。"
          },
          {
            "title": "观察结果",
            "body": "文件最初带有冲突标记；编辑并 add 后冲突状态消失，但操作还未结束。commit 或对应 --continue 成功后才保存最终提交。"
          },
          {
            "title": "常见误区",
            "body": "本模拟采用文件级合并，同一文件的不同行被两边修改也可能冲突。cherry-pick --continue 和 revert --continue 不能用于普通 merge。"
          }
        ],
        "commands": {
          "git merge feature": "尝试把 feature 合入当前分支。要练习冲突，需先让两个分支相对共同版本对同一文件产生不同修改，并保持已跟踪工作区干净。",
          "git status": "查看哪些文件仍处于冲突状态，以及正在完成哪一种操作。它只读取状态，可在每次编辑与 add 之后重复检查。",
          "git add README.md": "把已经手动整理好的 README.md 放进暂存区，并标记该文件的冲突已解决。先删除冲突标记并保存最终内容；仅执行 add 不代表内容已经正确。",
          "git commit -m \"解决说明冲突\"": "在所有冲突文件都完成编辑并 add 后创建最终提交。普通 merge 会保存两个父提交；若仍有冲突，模拟器会拒绝完成。",
          "git cherry-pick --continue": "仅在一次 cherry-pick 因冲突暂停、且所有冲突都已解决并 add 后继续。它完成这次挑选提交，不会继续普通 merge 或 revert。",
          "git revert --continue": "仅在一次 revert 因冲突暂停、且所有冲突都已解决并 add 后继续。它保存逆向改动的新提交，原来被撤销的提交仍保留。"
        }
      },
      "amend": {
        "goal": "修改最近一次提交的说明或补入遗漏内容，并理解提交哈希为何改变。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "刚提交后发现说明不准确或漏掉文件时，用 amend 修正最近一次提交；补文件前先编辑并 add。"
          },
          {
            "title": "观察结果",
            "body": "当前分支指向新的替代提交，哈希改变，父节点与原作者保留。用 reflog 可以找到被替换的旧提交。"
          },
          {
            "title": "常见误区",
            "body": "即使只想改说明，暂存区内容也会进入替代提交。--no-edit 只保留提交说明，并不表示文件快照不变。"
          }
        ],
        "commands": {
          "git commit --amend -m \"补充提交说明\"": "用当前暂存区创建替代最近一次提交的版本，并改写说明。需要已有提交；只想改说明时，先确认暂存区没有意外改动。",
          "git commit --amend --no-edit": "用当前暂存区补正最近一次提交，沿用原说明。适合先 add 漏掉的文件再执行；原作者和父节点保留，哈希会改变。",
          "git commit -a --amend --no-edit": "先暂存已跟踪文件的修改和删除，再替换最近一次提交并保留说明。未跟踪的新文件仍不会自动加入。",
          "git reflog -n 5": "查看最近五次 HEAD 移动，定位 amend 之前的旧提交。读取后可用 show 核对旧快照，必要时为它建立恢复分支。"
        }
      },
      "cherry-pick": {
        "goal": "将另一条分支的一次独立提交应用到当前分支，而不合并全部历史。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "只需要来源分支中的某一次修复时使用 cherry-pick。先定位这个普通提交，再切到需要接收修复的分支。"
          },
          {
            "title": "观察结果",
            "body": "接收分支新增提交，保存来源提交的改动与作者，但哈希和父节点按当前分支重新生成；来源分支仍停在原处。"
          },
          {
            "title": "常见误区",
            "body": "cherry-pick feature 只挑选 feature 当前指向的一次提交，不会带来该分支全部历史。本模拟每次只处理一个普通提交或根提交。"
          }
        ],
        "commands": {
          "git switch -c feature": "从当前提交创建并切换到 feature，准备保存一份独立修复。先确认 feature 尚不存在、已跟踪文件干净，且当前起点是期望的主分支。",
          "git add README.md": "把在 feature 上完成的 README.md 修复暂存。应先在工作区编辑并保存文件，否则可能没有新的内容可提交。",
          "git commit -m \"独立修复\"": "把 feature 的暂存区保存成一次独立提交。后续 cherry-pick feature 会把这个提交相对其父提交的改动作为来源。",
          "git switch main": "切回 main 作为接收方，检出 main 的快照。切换前应已提交 feature 的修复，避免未提交改动阻止切换。",
          "git cherry-pick feature": "将 feature 指向的普通提交的改动应用到当前分支，并创建新提交。当前已跟踪文件必须干净；若改动已包含或产生冲突，按终端提示处理。",
          "git log --oneline --all -n 5": "从各引用查看最多五条简短提交记录，对比来源提交与新生成的提交。只读取历史，不改变任何分支。"
        }
      },
      "reflog": {
        "goal": "找到 HEAD 曾经所在的提交，并通过新分支保留那个版本。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "reset、amend 或切换分支后，想找回之前的提交位置时查看 reflog。先核对内容，再决定是否恢复。"
          },
          {
            "title": "观察结果",
            "body": "记录列出 HEAD@{序号} 和哈希；建立 recovered 分支后，分支地图多一个指向目标提交的标签，切换后才检出它的文件。"
          },
          {
            "title": "常见误区",
            "body": "HEAD@{1} 是上一条移动记录的位置，HEAD~1 才是当前提交的第一父提交。新移动会改变记录序号，必要时记下已核对的哈希。"
          }
        ],
        "commands": {
          "git reflog -n 5": "查看最近五条 HEAD 移动记录，找出目标位置与哈希。它包含分支切换等移动，与只展示提交关系的 log 不同。",
          "git reflog show --max-count=5": "显式使用 show 子命令查看最多五条移动记录，与本章前一条命令用途相同。记录来自此浏览器存档，不是远程活动日志。",
          "git show HEAD@{1}": "检查上一条 HEAD 移动记录指向的提交详情。需要该记录存在且指向有效提交；它未必是当前提交的父提交。",
          "git branch recovered HEAD@{1}": "在上一条 HEAD 记录的位置创建 recovered 分支，先保留目标而不切换工作区。需要目标有效且 recovered 未被占用；执行前先核对引用内容。",
          "git switch recovered": "切到已经建立的 recovered 分支，检出已确认的恢复版本。先处理未提交的已跟踪修改；切换本身会新增一条 HEAD 移动记录。"
        }
      },
      "practice": {
        "goal": "形成“检查差异—选择内容—保存提交—核对推送”的固定操作顺序。",
        "checkpoints": [
          {
            "title": "何时用",
            "body": "每完成一个小改动就按此顺序检查，不必等到多个无关修改堆在一起。可以先编辑 README.md，再逐条观察。"
          },
          {
            "title": "观察结果",
            "body": "status 与 diff 帮你确认范围；add 后看暂存区；commit 后看本地节点；push 后看远程标签和快照。"
          },
          {
            "title": "常见误区",
            "body": "add . 会把当前仓库中所有文件变化纳入暂存，包括新建和删除。提交前仍需核对范围；push origin main 推送的是 main，不一定是当前分支。"
          }
        ],
        "commands": {
          "git status": "先检查当前分支和各文件状态，确认哪些修改属于这次工作。只读取信息，适合每个关键步骤前后执行。",
          "git diff": "阅读尚未暂存的已跟踪文件差异，确认修改内容。若已 add，改用 diff --staged 查看待提交内容；未跟踪文件需直接打开核对。",
          "git add .": "把当前工作区的所有文件变化写入暂存区，包括新增、修改与删除。它不创建提交，执行后可再用 diff --staged 检查。",
          "git commit -m \"完成修改\"": "把已经检查过的暂存区保存成一次提交，推进当前分支。若暂存区没有变化，模拟器会提示没有可提交内容。",
          "git push origin main": "将本地 main 的提交推送到已有的模拟 origin/main。先确认改动确实已提交到 main；未提交内容不会上传，非快进更新会被拒绝。"
        }
      }
    };

