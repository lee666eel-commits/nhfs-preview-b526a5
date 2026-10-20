# 断点现状审计（2026-09-22 实测，未改动任何生产文件）

全站没有统一的响应式断点。逐页 grep `@media` 实测结果：

| 页面 | max-width 断点 | min-width 断点 |
|---|---|---|
| index.html | 1080 / 760 | — |
| organization/index.html | 880 / 640 | — |
| board/index.html | 900 / 560 / 420(×2) | — |
| faculty/index.html | 880(×2) | — |
| about/index.html | 640 / 760 | 840 |
| academic/index.html | 760 | 840 |
| admission/index.html | 760 | — |
| facilities/index.html | 760 | 840 |
| history/index.html | 640 / 760 | — |
| cocurricular/index.html | 760 | 840 |
| assets/news.css（唯一 mobile-first 写法） | 520 | 640 / 900 |
| templates/news-post.html | 无内联样式，走 news.css | — |

## 读法

- **about/academic/admission/facilities/history/cocurricular 六页**收敛在 **760px** 这个值上，像同源копи-paste——这组内部基本一致
- **index / organization / board / faculty 四页各自一套**，互不相同，且都不等于 760
- **840(min-width)** 只出现在那六页，语义是"桌面态生效"，与其余页的 max-width 写法（"手机态生效"）思路相反，两种写法混在同一个站
- news.css 是全站唯一真正 mobile-first（min-width 累加列数）的写法，也是唯一有文档化 aspect-ratio/flex 坑修复注释的文件——工程质量明显更高，可能是较晚写的

## 不是 bug 的部分（已在源码注释里说明，别误判）

- index.html 两套 `:root`（CI 绿区 vs `--w-` paper 区）——index.html 132-133 行原注释已写明"独立变量域，不覆盖…两套配色零冲突"，是有意设计，不是命名冲突

## 一个真实可疑点（未修，留给他核实）

`faculty/index.html` 的 `.portrait` 写了 `aspect-ratio:4/5` 但没写 `min-height:0`，而 `.card` 是 column flex 容器。`assets/news.css` 的 `.thumb` 遇到同一结构已经加了这个属性并写明原因（直幅图撑到 598px vs 应有 189px 的实测坑）。faculty 页目前用的照片是否会中招，得拿真实直幅头像在 375px 实测一次才知道，这份审计不下定论。见 `components/faculty-card.html` 里的复刻。
