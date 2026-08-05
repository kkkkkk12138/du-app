# 渡

“渡”是一款本地优先的 iOS 日记与未来信应用，使用 React Native、WatermelonDB 和原生 iOS 能力构建。

当前发布优先级为 iOS。Android 源码保留在仓库中，但尚未完成本机 Gradle 构建和发布验收。

## 当前能力

- 日迹、信件、未来信、念想与副本
- 书架、书内续写与自由散页
- 本地照片、录音、手书和位置附件
- 完整本地备份、校验、恢复与失败回滚
- 生物识别锁、通知提醒和 Reduce Motion

用户正文和附件默认保存在设备本地。当前版本不提供账号同步，不应对外宣称数据已自动上传云端。

## iOS 开发

环境要求：

- macOS
- Node.js 22.11 或更高版本
- Xcode 与对应 iOS Simulator
- CocoaPods

安装依赖：

```sh
npm ci
cd ios && pod install
```

运行：

```sh
npm run ios
```

验证：

```sh
npm test -- --runInBand
npx tsc --noEmit
npx eslint . --max-warnings=0
```

## 发布前必填

仓库不会包含证书、描述文件、App Store Connect API 密钥、Firebase 配置或其他私密凭据。首次归档前需要在本机补充：

1. 将示例 Bundle ID 改为正式且长期不变的 Bundle ID。
2. 在 Xcode 中选择有效的 Apple Developer Team。
3. 补齐 `AppIcon.appiconset` 的正式图标文件。
4. 从 Firebase 下载 `GoogleService-Info.plist` 并放到 iOS 工程中；该文件已被 `.gitignore` 排除。
5. 将公开隐私政策、服务条款和支持页面 URL 填入 App Store Connect。

逐步操作见 [iOS App Store 上架指导书](docs/IOS_PERSONAL_DEVELOPER_LAUNCH.md)。

商店资料草稿见 [App Store 资料模板](docs/app-store/APP_STORE_METADATA.md)。

## 数据与安全

- 数据库 schema 当前为 v13。
- 完整备份使用 `.du-backup.json`，附件带 SHA-256 校验。
- 恢复前会生成救援备份，失败时自动回滚。
- 不要提交 `.env`、`GoogleService-Info.plist`、`.p8`、`.p12`、`.cer`、`.mobileprovision` 或生产签名文件。

## 当前验证

- Jest：35 个测试套件，120 项测试通过
- TypeScript：通过
- 严格 ESLint：通过
- iOS Release Simulator：`arm64 + x86_64` 构建通过
- Android：尚未完成本机 JDK/Gradle 构建
