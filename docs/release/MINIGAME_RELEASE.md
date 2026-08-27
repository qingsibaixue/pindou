# 微信与抖音小游戏发布准备

核对日期：2026-08-27；引擎：Cocos Creator 3.8.0。

## 共同配置

- 游戏名：拼豆小世界
- 方向：Portrait（竖屏）
- 首场景：`db://assets/scenes/Game.scene`
- AppID：必须在各自平台申请后填写，不能提交占位值。
- 开放数据域：当前不需要。
- 远程资源：首版先关闭；若平台包体检查不通过，再启用首场景分包/远程资源。
- 调试包必须关闭 source maps，并使用 release 构建。

## 微信小游戏

1. 安装微信开发者工具，并在 Cocos Creator 的“偏好设置 → 外部程序”中设置路径。
2. 构建发布选择“微信小游戏”，填写正式 AppID，方向选择 Portrait。
3. 构建结果应包含 `game.json` 和 `project.config.json`。
4. 在微信开发者工具中检查启动、触摸、后台自动暂停、震动、分享入口、弱网/离线和真机内存。
5. Cocos 3.8 文档说明微信小游戏主包上限为4MB；当前 Web 构建约5MB，小游戏构建后必须以微信工具的“代码质量/包体分析”为准，必要时使用引擎分离、初始场景分包或远程资源。

官方参考：https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html

## 抖音小游戏

1. 安装抖音开发者工具，在平台完成小游戏申请并取得 AppID。
2. 构建发布选择“抖音小游戏”，填写正式 AppID，方向选择 Portrait。
3. 构建结果应包含 `game.json` 和 `project.config.json`，使用抖音开发者工具打开构建目录。
4. 检查 Android 与 iOS 真机上的启动、触摸、后台暂停、震动、分享入口和内存。
5. Cocos 3.8 文档说明普通包总上限20MB；启用分包时主包不超过4MB、整体不超过20MB。最终以抖音开发者工具当期校验结果为准。

官方参考：https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-bytedance-mini-game.html

## Cocos 构建字段模板

```json
{
  "wechatgame": {
    "appid": "<WECHAT_MINIGAME_APPID>",
    "orientation": "portrait",
    "buildOpenDataContextTemplate": false
  },
  "bytedance-mini-game": {
    "appid": "<DOUYIN_MINIGAME_APPID>",
    "orientation": "portrait",
    "buildOpenDataContextTemplate": false
  }
}
```

Cocos 官方建议先在构建发布面板配置并导出完整参数，再用于命令行构建；不要直接提交上面的占位 AppID。

## 提审前检查表

- [ ] 正式 AppID 已填入对应平台构建任务。
- [ ] 50关资源全部进入构建包。
- [ ] 托盘开局为空且固定20格。
- [ ] 第10、21、31、41、50关完成两轮分批真机测试。
- [ ] 首页、选关7页、暂停、继续、重开、返回主页、通关、下一关正常。
- [ ] iPhone安全区和常见安卓长屏无裁切。
- [ ] 后台切回时保持暂停，不发生悬浮豆丢失。
- [ ] 平台包体、代码质量和隐私检查通过。
- [ ] 商店图标、截图、文案、版本号和更新说明上传。
- [ ] 若加入任何SDK或联网功能，隐私清单已同步更新。
