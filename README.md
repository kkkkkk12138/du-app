# 渡

“渡”是一款本地优先的日记与未来信应用，使用 React Native、WatermelonDB 以及 iOS、Android 原生能力构建。

当前发布优先级为 iOS，其次为 Android。两个平台共用业务与数据层，平台密钥和商店凭据只保存在发布机器。

第一次接触 GitHub 或应用商店时，先阅读 [GitHub 与应用商店发布总指导书](docs/PUBLISHING_MASTER_GUIDE.md)。其中说明当前账号、仓库和分支状态，以及源码、凭据、安装包和商店资料分别应提交到哪里。

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

仓库不会包含证书、描述文件、App Store Connect API 密钥或其他私密凭据。首次归档前需要在本机补充：

1. 将示例 Bundle ID 改为正式且长期不变的 Bundle ID。
2. 在 Xcode 中选择有效的 Apple Developer Team。
3. 补齐 `AppIcon.appiconset` 的正式图标文件。
4. 将公开隐私政策、服务条款和支持页面 URL 填入 App Store Connect。

逐步操作见 [iOS App Store 上架指导书](docs/IOS_PERSONAL_DEVELOPER_LAUNCH.md)。

商店资料草稿见 [App Store 资料模板](docs/app-store/APP_STORE_METADATA.md)。

## Android 开发

环境要求：

- Node.js 22.11 或更高版本
- JDK 17
- Android SDK 36、Build Tools 36.0.0 和 NDK 27.1

生成 Google Play AAB：

```sh
cd android
./gradlew bundleRelease
```

Release 签名从被 Git 忽略的 `android/keystore.properties` 读取，绝不能改回 debug 签名。逐步操作见 [Android Google Play 上架指导书](docs/ANDROID_GOOGLE_PLAY_LAUNCH.md)。

Google Play 资料草稿见 [商店资料模板](docs/google-play/PLAY_STORE_METADATA.md) 和 [数据安全草稿](docs/google-play/DATA_SAFETY.md)。

## 数据与安全

- 数据库 schema 当前为 v14。
- 完整备份使用 `.du-backup.json`，附件带 SHA-256 校验。
- 恢复前会生成救援备份，失败时自动回滚。
- 不要提交 `.env`、`.p8`、`.p12`、`.cer`、`.mobileprovision` 或生产签名文件。

## 当前验证

提交发布版本前必须重新运行以下验证，不能依赖文档中的历史测试数量：

```sh
npm test -- --runInBand
npx tsc --noEmit
npx eslint . --max-warnings=0
```

还必须重新生成 iOS Release Archive 和 Android Release AAB，并在真实设备或商店测试渠道复验最终构建。
