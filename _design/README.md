# nanhwafs-site 设计系统抽取档（2026-09-22）

**这不是要重构网站，是给 Claude Design 画布做最后一步微调用的取样。** 主设计仍由 Claude Code 操刀；Design 只在界面小瑕疵阶段介入。本目录不改动任何生产页面，`organization/`、`board/`、`faculty/` 等原有内联 `<style>` 一律不动。

## 用途边界（别踩）

- ⛔ 不拆 15 个手写模板改成 import 这份 token——那是重构，没人要求，见 `feedback_one_off_design_not_a_system`：这是一次性作品，别当系统整
- ⛔ 不把这份当权威设计规范——真正权威是活着的生产页面，这份只是取样切片，会过期
- ✅ 用途只有一个：给 Claude Design 一个能载入画布、能点选微调的真实样本，调完能带着"为什么改"的答案传回来

## 第一优先级：手机端体验

用户原话："我更加重视的是 nanhwa-site 可以在手机端打开却不影响体验"。这是这份取样的**唯一选材标准**——三个组件（`news-card` / `faculty-card` / `hero`）不是随便挑的，是全站里"手机上最容易出事"的三处：
- `news-card`：唯一已修过 flex+aspect-ratio 坑的组件，当**对照组**
- `faculty-card`：结构相同但**没修**这个坑，当**测试对象**——375px 下拿真实直幅照片试一次就知道会不会撑爆
- `hero`：视口越小，`.doors` 五宫格越挤，760px 断点下会砍成两列且隐藏副标题文字

任何在 Design 画布上的改动，**收尾前必须过一次 375px 视口检查**，不能只看画布默认桌面视口好不好看。

## 两套配色是故意的，别合并

- **CI 区**（`--green` 南华绿系）：入口/顶层用，index.html hero、news.css 頁首
- **Paper 区**（`--cream`/`--gold` 米白暖金系）：内容页用，organization/board/faculty，以及 index.html hero 以下内容区

index.html 原注释（132-133 行）已经写明这是刻意设计的独立变量域。Design 画布如果建议"统一成一套颜色"，那是它没看到这段上下文，不代表真的该改。

## 字体栈：逐字保留

`--serif: "Noto Serif SC","Source Han Serif SC","STZhongsong","SimSun",serif`

改字序或删减任何一环，中文渲染会静默换字形（CJK fallback 坑，见 `reference_cjk_font_stack_fallback`）。Design 画布输出的任何 CSS，回填前先 diff 这一行有没有被"优化"掉。

## 既有铁律（Design 画布不知道，得靠人带进去）

- 真实照片禁止被替换成模板/示意图（见 `feedback_web_design_real_photos_no_transplant`）——画布默认爱塞占位图或 Unsplash，正式回填前逐张核对
- masonry 排版禁止强制裁切（`feedback_nanhwafs_site_design_details`）
- 图注无信息量宁可不放
- 官网受众是"择校家长"，不是设计师自己（`project_nanhwafs_site_audience_constitution`）

## 回填后的核对流程（下次接手直接照做）

1. `_design/` 里的文件已 git add，是这次抽取的**基线快照**
2. 在 Claude Design 画布里调完，`get_file` 把改动版本拉回本机（不是 write_files——那是本机推去画布，方向相反）
3. 写回同路径，跑 `git diff _design/` —— 这就是"动过哪些部分"的答案，git 原生给，不用另建比对工具
4. **逐个 diff hunk 问一句"为什么改这处"**，答案写进 `~/.claude/projects/C--Users-lee66/memory/feedback_nanhwafs_site_design_rationale.md`（暂未建档，第一次回填时新建），格式按 memory 系统的 feedback 类型：规则 + **Why:** + **How to apply:**
5. 该 feedback 档链接进 MEMORY.md 索引，下次 Claude Code 设计前先读这份，不用再猜他的取舍

## 已知阻塞

`/design-sync` 需要 `/design-login` 授权 claude.ai 账号，本 session（后台任务）跑不了这个交互式登入。这份抽取档已经就绪，授权一过就能直接 `finalize_plan` → `write_files` 推上去，不用重新抽取。
