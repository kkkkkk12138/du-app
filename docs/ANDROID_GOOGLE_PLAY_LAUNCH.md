# 渡 Android Google Play 上架指导书

适用对象：以个人开发者身份首次发布“渡”的维护者。本文覆盖本地签名、生成 AAB、Play Console 建档、封闭测试和正式发布，不包含中国大陆安卓应用商店的单独资质流程。

## 当前状态

工程已经具备以下发布基础：

- React Native New Architecture、Fabric 与 Hermes 已启用。
- `minSdkVersion` 为 26，`targetSdkVersion` 和 `compileSdkVersion` 为 36。
- Release 使用独立上传密钥，不再使用 debug 签名。
- 上传密钥和密码配置已被 `.gitignore` 排除。
- 相册选择使用系统选择器，不声明读取整个相册的权限。
- 文件导出和恢复使用 Android `FileProvider` 与系统文档选择器。
- 用户数据默认保存在设备本地，应用没有账号同步。

正式提交前仍需确定：

1. 永久 `applicationId`。当前值为 `com.duapp`，发布后不能更换。
2. 正式应用图标、功能图片和商店截图。
3. 支持邮箱、隐私政策 HTTPS URL 和服务条款 URL。
4. 是否接入 Firebase Crashlytics；接入时需提供本机 `google-services.json`。
5. 首发国家或地区，以及是否进入中国大陆的第三方安卓商店。

## 保护上传密钥

本机上传密钥位于：

```text
~/Documents/DU-App-Release-Credentials/du-upload-key.jks
```

密码和别名记录位于同目录的：

```text
README-KEEP-PRIVATE.txt
```

项目通过以下本地文件读取签名：

```text
android/keystore.properties
```

这三个文件都不能提交到 GitHub、发送到聊天工具或放入公开网盘。至少再复制一份到启用加密的离线存储。Google Play App Signing 可以保护最终应用签名密钥，但每次上传新版本仍需要当前上传密钥。

## 确定应用 ID

`applicationId` 是 Google Play 识别应用的永久标识。名称、图标和开发者展示名以后可以修改，`applicationId` 在首次上传后不能修改。

建议使用本人长期控制的反向域名，例如：

```text
com.yourname.du
```

在正式建档前运行：

```sh
cd android
./gradlew bundleRelease -PDU_APPLICATION_ID=com.yourname.du
```

当前 Gradle 允许通过 `DU_APPLICATION_ID` 覆盖默认值。确定正式值后，应将 `android/app/build.gradle` 中的默认值也改成正式 ID，避免后续忘记传参。

预期结果：构建成功，AAB 清单中的包名与 Play Console 创建的应用完全一致。

## 配置本机环境

当前机器已安装：

```text
JDK 17:
~/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home

Android SDK:
~/Library/Android/sdk
```

新终端可临时设置：

```sh
export JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

项目的 `android/local.properties` 已指向本机 SDK，文件不会上传 GitHub。

## 生成签名 AAB

进入 Android 工程：

```sh
cd android
```

生成正式包：

```sh
JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew clean bundleRelease
```

产物位于：

```text
android/app/build/outputs/bundle/release/app-release.aab
```

验证签名：

```sh
"$JAVA_HOME/bin/keytool" -printcert -jarfile \
  app/build/outputs/bundle/release/app-release.aab
```

预期结果：命令显示 `DU App Upload` 证书信息，Gradle 输出 `BUILD SUCCESSFUL`。

## 递增版本

Google Play 要求每次上传的 `versionCode` 都大于历史版本。当前工程支持构建参数：

```sh
./gradlew bundleRelease \
  -PDU_VERSION_CODE=2 \
  -PDU_VERSION_NAME=1.0.1
```

- `DU_VERSION_CODE`：仅用于商店判断新旧，必须是递增整数。
- `DU_VERSION_NAME`：用户可见版本号。

首次发布建议使用 `versionCode 1` 和 `versionName 1.0.0`。不要重复上传相同 `versionCode`。

## 注册 Play Console

1. 打开 `https://play.google.com/console/`。
2. 使用准备长期持有的 Google 账号登录。
3. 选择个人开发者账号。
4. 按页面显示金额支付一次性注册费；金额和税费以注册页面为准。
5. 提交真实姓名、地址、电话和开发者联系邮箱。
6. 完成身份证件、手机号和邮箱验证。
7. 等待账号验证通过后再创建应用。

个人账号的法定身份资料必须真实。商店公开展示哪些字段，以 Play Console 当前提示为准。

## 创建应用

1. 在 Play Console 首页点击“创建应用”。
2. 应用名称填写“渡”。
3. 默认语言选择“中文（简体）”。
4. 选择“应用”而不是“游戏”。
5. 选择“免费”。免费应用发布后不能直接改成付费下载；后续收费应使用应用内商品或订阅。
6. 确认开发者计划政策和美国出口法律声明。
7. 点击“创建应用”。

预期结果：进入“渡”的应用信息中心，左侧出现测试、正式版、商店发布和政策栏目。

## 填写应用内容

按 Play Console 左侧“政策和计划 > 应用内容”逐项完成。

### 隐私政策

填写公开可访问的 HTTPS 地址。页面不能要求登录，内容应与应用实际行为一致。模板见：

```text
docs/app-store/PRIVACY_POLICY.md
```

发布前要补齐法定姓名、支持邮箱、生效日期和政策 URL。

### 应用访问权限

选择“所有功能均可在没有特殊访问权限的情况下使用”。渡不要求账号登录，审核人员可以直接查看范例内容。

### 广告

当前版本没有广告 SDK，选择“不包含广告”。将来加入广告后必须更新此项和数据安全问卷。

### 目标受众和内容

按实际受众选择年龄段。渡不是儿童专用产品，不应为了扩大覆盖范围勾选儿童年龄段，否则会触发额外的家庭政策要求。

### 内容分级

填写真实联系邮箱并完成问卷。应用本身不提供赌博、暴力、成人内容或公开社交，但用户可以在私人日记中自行写入内容。问卷应依据应用提供的功能回答，不把用户私下输入误报成平台分发内容。

### 新闻、健康、金融和政府应用

均按当前事实选择“否”。如果产品以后增加相关服务，需要重新申报。

## 填写数据安全

当前版本的数据边界：

- 用户文字、照片、录音、手书、地点和备份默认只在设备本地处理。
- 系统权限只在用户主动使用相关功能时请求。
- 当前没有账号系统、广告 SDK 或跨设备云同步。
- 若启用 Firebase Crashlytics，崩溃信息和设备诊断数据可能发送给 Firebase，问卷必须同步申报。

逐字段草稿见：

```text
docs/google-play/DATA_SAFETY.md
```

不要在没有核对最终依赖和网络请求前直接提交问卷。启用或移除 Firebase、分析、广告、登录或云同步后，都要重新检查数据安全声明。

## 准备商店资料

填写草稿见：

```text
docs/google-play/PLAY_STORE_METADATA.md
```

至少准备：

- 应用名称
- 简短说明
- 完整说明
- 512 × 512 PNG 应用图标
- 1024 × 500 PNG 或 JPG 功能图片
- 至少两张手机截图
- 支持邮箱
- 隐私政策 URL

截图应来自真实 Android Release 版本，不使用 iOS 状态栏、导航栏或设备框。建议覆盖日迹、写入、未来信、远方、书架和数据备份。

## 上传封闭测试

新个人开发者账号可能需要先满足 Google Play 当时规定的封闭测试条件，Play Console 会显示测试人数和持续时间要求。

1. 打开“测试 > 封闭式测试”。
2. 创建测试轨道，例如 `closed-initial`。
3. 建立测试人员电子邮件列表或 Google 群组。
4. 创建新版本并上传 `app-release.aab`。
5. 填写版本说明。
6. 解决页面列出的错误；警告需要逐项判断，不能直接忽略。
7. 发布到封闭测试。
8. 把加入测试链接发给测试者。
9. 让测试者安装并在要求的持续期内保持加入状态。
10. 收集崩溃、权限、通知、文件恢复和不同屏幕尺寸的问题。

测试要求以当前账号控制台显示为准。完成后，Play Console 会开放申请正式版访问权限的入口。

## Android 真机验收

至少使用一台 Android 13 或更高版本真机验证：

1. 首次启动和范例数据加载。
2. 中文输入法候选词和长文本输入。
3. 相机、系统照片选择器、麦克风和定位。
4. 通知授权、每日提醒和未来信到达提醒。
5. 生物识别锁和应用切后台后的重新验证。
6. 写入、编辑、删除和撤销。
7. 书架续写、封面选择和散页拖动。
8. 完整备份导出、卸载前保存、重新安装后恢复。
9. 深链 `duapp://` 的启动行为。
10. 无网络状态下的核心记录能力。
11. 字体、状态栏、导航栏、系统返回和键盘遮挡。
12. Release 包冷启动、连续使用 30 分钟和低电量模式。

预期结果：没有崩溃、数据丢失、无法返回、权限死循环或 debug 专属行为。

## 申请正式版并发布

1. 满足控制台要求的测试条件。
2. 提交正式版访问申请，准确描述测试过程、反馈和修复内容。
3. 获批后打开“发布 > 正式版”。
4. 使用已经验收的同一 AAB，或上传更高 `versionCode` 的最终构建。
5. 填写简体中文版本说明。
6. 选择首发国家或地区。
7. 检查“发布概览”中的政策、商店资料和版本错误。
8. 选择分阶段发布，先向较小比例用户开放。
9. 审核通过后观察 Android Vitals、崩溃和 ANR。
10. 指标稳定后再扩大到全部用户。

## 常见失败

### 包名不一致

现象：Play Console 提示 AAB 的软件包名称与应用不一致。

处理：使用创建应用时的同一 `applicationId` 重新构建。不要通过新建另一个包名绕过，除非明确放弃原应用条目。

### 版本代码已使用

现象：上传时提示版本代码已存在。

处理：将 `DU_VERSION_CODE` 增加 1 后重新构建。

### AAB 未签名或签名错误

现象：Play Console 无法验证上传证书。

处理：确认 `android/keystore.properties` 存在，路径和密码正确，再运行 `bundleRelease`。不要改用 debug keystore。

### 找不到 Android SDK

现象：Gradle 提示 `SDK location not found`。

处理：确认 `android/local.properties` 包含：

```text
sdk.dir=/Users/bytedance/Library/Android/sdk
```

### Firebase 初始化失败

现象：Release 启动时 Firebase 报缺少应用配置。

处理：在 Firebase 创建与正式 `applicationId` 一致的 Android 应用，下载 `google-services.json` 到 `android/app/`，并核对数据安全声明。若首版不使用 Firebase，应禁用依赖 Firebase 的运行时代码，而不是提交空配置。

## 不应上传到 GitHub 的文件

```text
android/keystore.properties
android/local.properties
android/app/google-services.json
*.jks
*.keystore
```

GitHub 仓库只保存构建逻辑、源码、资源、测试和上架文档。Google Play AAB 可以保存在本机发布目录或 Play Console，不应作为源码提交。
