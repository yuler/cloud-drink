# 云喝酒 (Cloud Drink)

异地好友线上干杯的 H5 虚拟酒桌。2-6 人通过浏览器进入同一房间，玩大话骰 / 真心话大冒险，输家触发 3D 角色干杯动画与音效。

## 快速开始

```bash
npm install
npm start
# 打开 http://localhost:3000
```

房主"创建房间"得到 4 位房号，把房号或页面地址发给好友，好友"加入房间"即可同桌。

## 测试

```bash
npm test
```

## 玩法

- 大话骰：每人 5 颗骰子，轮流叫数，下家加叫或"开"，服务端裁决，输家干杯。
- 真心话大冒险：骰子随机选中一人，选真心话或大冒险，完成后该玩家干杯。
- 干杯：输家角色自动举杯一饮而尽；任何玩家可点"干杯 🍻"送出碰杯助兴特效。喝得越多角色越红、越晃。

## 技术栈

Node.js + Express + Socket.IO（服务端权威游戏逻辑）+ three.js（3D 渲染）。无账号系统、无持久化。

## 结构

```
server/           服务端：app / sockets / rooms / games
public/           前端：落地页、牌桌页、three.js 场景、音效
test/             node:test 测试（服务端纯逻辑 + Socket.IO 集成）
```

## 部署提示

`npm start` 监听 `PORT` 环境变量（默认 3000）。部署到支持 Node 的平台（Render / Railway / Fly.io）时设为静态 3000 或设置 `PORT` 即可；WebSocket 需保持长连接。
