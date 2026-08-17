# 调研：做成「QQ 斗地主」体验该用什么游戏引擎

日期：2026-08-17  
范围：客户端表现层选型（不含牌型算法实现细节）  
对照产品：腾讯《欢乐斗地主》/ QQ 游戏斗地主一类——三人实时对局、手牌交互、桌面角色、出牌/炸弹特效、房间或匹配。

## 先拆需求：引擎实际要承担什么

「像 QQ 斗地主」几乎全是 **2.5D 棋牌客户端**，不是开放世界或物理射击。客户端典型工作：

- 手牌扇形排布、滑动多选、出牌飞入桌面、过牌/叫分按钮
- 三人座位、头像/角色、表情、聊天气泡
- 炸弹/火箭等 2D 特效与音效
- 与权威服务器同步回合（WebSocket）

引擎 **不负责** 洗牌、牌型判定、防作弊；那一层应在服务端。本仓库已是 Node + Socket.IO 权威逻辑（见 `docs/superpowers/specs/2026-08-16-cloud-drinking-mvp-design.md`），斗地主也应沿用同一模式。

## 腾讯那条产品线实际用过什么

| 证据 | 说法 | 来源 |
| --- | --- | --- |
| Cocos 品牌案例 | 《欢乐斗地主》列入 Cocos 代表作 | [Cocos 引擎简介](https://www.cocos.com/post/54963e5ec11d76db476ac1c915c76dbf) |
| H5 移植 | 《欢乐斗地主 H5》用 Cocos Play，从原生移植，美术与终端服共用 | 同期业界报道（Cocos 与腾讯合作移植 QQ 浏览器等渠道） |
| 车机版 | 特斯拉上的《欢乐斗地主》《欢乐麻将》《欢乐升级》由 **Cocos Creator** 研发 | [Cocos 官方稿 2019-12-20](https://www.cocos.com/post/6196) |

结论：国内对标「腾讯棋牌客户端」时，**Cocos 系是第一关联引擎**，不是 Unity/Unreal。微信小游戏官方文档也把 **Cocos / Laya / Egret** 列为已适配小游戏环境的 H5 引擎三家（[微信开放文档](https://developers.weixin.qq.com/minigame/dev/guide/game-engine/cocos-laya-egret.html)）。

独立开发者开源斗地主也高度集中在 Cocos Creator + Node 服，例如 [cocos_doudizhu_game](https://github.com/liangzi-aha/cocos_doudizhu_game)（Creator 3.8 + Node）、[ddz_game](https://github.com/tinyshu/ddz_game)（Creator 2.x + Node）。这只说明生态习惯，不证明必须照抄。

## 候选引擎对比（按本品类）

### 1. Cocos Creator（对标 QQ 棋牌时首选「完整引擎」）

- 2D UI、动画、图集、粒子是日常工作流；TypeScript 与现有 JS 栈接近。
- 官方可发 Web、微信小游戏、原生（[Creator 3.8 微信小游戏发布](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-wechatgame.html)）。
- 包体/渠道习惯符合国内棋牌（首包控制、远程资源）。
- 代价：整客户端要迁进编辑器工程，和当前「Express 托管 `public/` + three.js」不是同一套构建。

适合：单独做一款可上微信/H5/App 的斗地主产品，视觉和交互要对齐欢乐斗地主。

### 2. 继续 three.js + DOM/Canvas（适合当前「云喝酒」）

本仓库已定型：H5、分享链接进房、酒桌 3D 角色、无 App（见 MVP 设计）。斗地主手牌本质是 **2D UI**，可以叠在现有圆桌上：

- 3D：座位、角色、干杯（已有）
- 2D：手牌、按钮、出牌动画（DOM 或 Pixi/Canvas）

优点：不换栈、首包小、手机浏览器点开即玩。  
缺点：没有 Cocos 那种棋牌编辑器资产流；要做到「QQ 级」特效要自己堆动画。

适合：**在现有酒桌里加一款斗地主**，而不是做腾讯棋牌大厅。

### 3. Unity

- 3D 角色、动画、原生 iOS/Android 管线成熟；棋牌也可以用 uGUI 做 2D。
- WebGL 导出体积大、手机浏览器体验差，和「链接进房」冲突。
- 联网常用 Mirror / Netcode / Photon，和现有 Socket.IO 服要自己桥，或重写服。

适合：明确要做 **安装包 App**、高品质 3D 角色，且可以放弃「纯 H5 秒开」。

### 4. Godot 4

- 2D 节点、动画对卡牌友好；MIT、无分成。
- Web 导出依赖 WebAssembly + **WebGL 2.0 Compatibility**，官方写明移动端 Web 比原生差一截，Safari/WebGL2 有坑（[Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)）。
- 微信小游戏不是一等公民（不像 Cocos/Laya/Egret 官方适配页）。

适合：独立 2D 桌面/原生斗地主，不以微信/QQ 浏览器为第一渠道。

### 5. Phaser / PixiJS（JS 轻引擎，不是「大编辑器」）

- 纯 2D 卡牌、补间、图集足够；可继续挂在现有 Node 静态站上。
- 没有完整大厅/小游戏一键发布；3D 酒桌仍要 three.js 或放弃 3D。

适合：H5 手牌层比手写 DOM 更「游戏化」，但仍不想上 Cocos 编辑器。

### 6. 不推荐

- **Unreal**：渲染和管线远超棋牌需求，H5/小游戏几乎不可用。
- **Egret / Laya**：微信文档认可，国内 H5 曾常用；2026 年新开棋牌项目生态与案例已明显弱于 Cocos，除非团队已有积累。

## 和本仓库的匹配

| 目标 | 建议 |
| --- | --- |
| 酒桌再加斗地主，体验接近「桌上打牌 + 干杯」 | **不换引擎**：three.js 桌 + 2D 手牌 |
| 单独做一款「像欢乐斗地主」的棋牌客户端（大厅、特效、小游戏） | **Cocos Creator 3.x** + 现有或新建权威 Node 服 |
| 要上 App Store、3D 角色电影级 | **Unity**，接受非秒开 H5 |
| 只要 2D、开源、非国内渠道 | **Godot 4** |

引擎换不换，都不改变：**牌权在服务端**。

## 来源

- [Cocos 引擎简介（含欢乐斗地主案例）](https://www.cocos.com/post/54963e5ec11d76db476ac1c915c76dbf)
- [Cocos：特斯拉棋牌用 Cocos Creator](https://www.cocos.com/post/6196)
- [微信小游戏：Cocos/Laya/Egret 适配](https://developers.weixin.qq.com/minigame/dev/guide/game-engine/cocos-laya-egret.html)
- [Cocos Creator 3.8 发布到微信小游戏](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-wechatgame.html)
- [Godot：Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- 本仓库：`README.md`、`docs/superpowers/specs/2026-08-16-cloud-drinking-mvp-design.md`
