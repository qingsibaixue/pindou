# 拼豆小世界

Cocos Creator 3.8.0 + TypeScript 的竖屏拼豆整理小游戏。设计分辨率为 720 × 1280，玩法是把错位的同色连通豆组移入暂存区，再放回对应底色。

## 当前内容

- 完整游戏流程：启动主页、开始、暂停、继续、重开、返回主页、胜利、下一关。
- 50 个大豆群关卡：前 10 关为手工像素剪影，开局托盘全部为空；豆群可超过20格托盘，形成分批中转与第二轮收尾。
- 关卡选择每页显示 8 关，共 7 页，并自动定位当前关卡。
- 关卡顺序解锁与本地完成进度，使用 `cc.sys.localStorage`，可跨 Web/小游戏运行。
- 微信 `wx`、抖音 `tt`、快手 `ks` 的轻量能力桥：分享菜单和通关震动，无 SDK 时自动回退。
- 独立关卡编辑器：`拼豆游戏/level-editor.html`，线上版本为 <https://pindoubianjiqi.qingsiai.site/>。
- 多尺寸图标：`assets/art/icon/game-icon-{128,256,512,1024}.png`。

## 开发与关卡

主场景是 `assets/scenes/Game.scene`。编辑器导出的 JSON 放到 `assets/resources/levels/`，文件名必须与 `id` 一致；托盘为 2×10、容量固定为 20，`trayBeans` 必须为空。

关卡设计以“大块拿起 → 托盘中转 → 大块落位”为核心，不使用开局托盘豆和单颗错位。详细规则见 [关卡设计原则](docs/LEVEL_DESIGN.md)。

重新生成内置关卡：

```bash
node tools/generate-levels.mjs
```

发布前请看 [多平台发布清单](docs/MULTI_PLATFORM_RELEASE.md)。
