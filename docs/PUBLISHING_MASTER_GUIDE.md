# 渡：GitHub 与应用商店发布总指导书

适用对象：第一次使用 GitHub，并计划以个人开发者身份发布“渡”的项目所有者。

文档版本：2026-08-06

这份手册解释当前账号和代码状态，并按实际发布顺序说明源码、签名材料、商店资料和安装包分别交到哪里。平台页面和政策会变化；涉及费用、身份验证、测试人数和备案要求时，以提交当天的官方控制台为准。

## 信息可信度约定

- `[Data-backed]`：已从当前本地仓库、Git 历史或构建配置核实。
- `[Research-backed]`：已从平台官方文档核实。
- `[Expert judgment]`：基于移动应用发布惯例给出的建议。
- `[To be confirmed]`：需要你本人决定或提供，不能由开发侧代填。

## 先理解四个互相独立的地方

发布“渡”不是把同一个文件上传四次。每个平台负责不同的事情。

| 地方                                | 当前用途                                   | 需要提交的核心内容                                    | 不应提交的内容                      |
| ----------------------------------- | ------------------------------------------ | ----------------------------------------------------- | ----------------------------------- |
| GitHub                              | 保存源码、版本历史、测试和文档             | React Native 源码、iOS/Android 工程、资源、测试、文档 | 证书、密码、签名私钥、真实用户数据  |
| Apple Developer / App Store Connect | 管理 iOS 身份、签名、测试和 App Store 发布 | Bundle ID、Xcode Archive、商店资料、截图、隐私申报    | Android AAB/APK、GitHub 密钥        |
| Google Play Console                 | 管理 Android 测试和 Google Play 发布       | 签名 AAB、商店资料、截图、数据安全问卷                | iOS Archive、Android 上传密钥原文件 |
| 中国大陆安卓厂商商店                | 分别管理华为、小米、OPPO、vivo 等渠道      | 签名 APK、商店资料、备案和平台要求的资质              | GitHub 仓库、JKS 密钥、密码         |

GitHub 不是应用商店。代码推送成功只代表源码已经备份到远端，不代表 Apple、Google 或国内安卓商店已经收到安装包。`[Expert judgment]`

## 当前 GitHub 账号和仓库状态

### 账号

当前仓库归属于 GitHub 个人账号：

```text
kkkkkk12138
```

项目仓库：

```text
https://github.com/kkkkkk12138/du-app
```

仓库目前设置为私有，未获授权的人不能查看源码。`[Data-backed]`

GitHub 账号与 Apple Account、Google Account 互不相同。GitHub 登录失效不会自动影响已上架应用，但会影响源码维护和后续版本推送。`[Expert judgment]`

以下账号安全状态无法通过代码仓库判断，需要你本人登录 GitHub 核对：

1. 登录邮箱是否长期可用。`[To be confirmed]`
2. 是否已经开启双重认证。`[To be confirmed]`
3. 是否保存恢复代码。`[To be confirmed]`
4. 手机号或验证器是否仍由本人控制。`[To be confirmed]`
5. GitHub 显示名、法定姓名和开发者品牌是否需要调整。`[To be confirmed]`

### 两条远端连接

本地项目配置了两个远端：

```text
origin     git@github.com:kkkkkk12138/du-app.git
prototype  https://github.com/kkkkkk12138/DU.git
```

- `origin` 是正式源码仓库，日常提交和发布版本都应推送到这里。`[Data-backed]`
- `prototype` 是原型参考仓库，不应把正式应用代码推送到这里。`[Data-backed]`

### 当前分支

远端目前有两条重要分支：

| 分支                                  | 当前提交  | 含义                               |
| ------------------------------------- | --------- | ---------------------------------- |
| `main`                                | `90e05aa` | 当前默认稳定分支，但不是最新代码   |
| `codex/prepare-ios-app-store-release` | `cc0369e` | 包含最新双端文字、城市和数据库修复 |

当前本地工作分支与远端 `codex/prepare-ios-app-store-release` 已同步。`[Data-backed]`

因此，现阶段下载或构建最新版时必须选择：

```text
codex/prepare-ios-app-store-release
```

直接从 GitHub 默认打开或下载 `main` 会得到较旧版本。`[Data-backed]`

### 发布前的分支处理建议

完成双端验收后，应把发布分支合并到 `main`，再从 `main` 创建版本标签。`[Expert judgment]`

建议发布记录：

```text
main
└── v1.0.0
```

不要在仍有未验收问题时提前合并或打标签。标签表示一个可以重新构建、定位和回滚的正式版本，不是普通进度标记。`[Expert judgment]`

## GitHub 中几个词分别是什么意思

### 仓库 Repository

仓库是项目在 GitHub 上的完整目录，包含源码、文档和每次修改的历史。“渡”的正式仓库是 `du-app`。

### 提交 Commit

提交是一组有说明的源码修改。例如：

```text
cc0369e fix: align cross-platform text and city tracking
```

提交创建后先存在本机；只有执行推送后，GitHub 才能看到它。

### 推送 Push

推送把本地提交发送到 GitHub。推送不会自动发布 App，也不会自动合并到 `main`。

### 分支 Branch

分支是一条独立开发线。修复可以先放在发布分支，验收后再并入 `main`，这样默认稳定版本不会被半成品覆盖。

### 拉取 Pull

拉取把 GitHub 上的新提交下载到本机。换电脑或多人维护前应先拉取，避免基于旧代码继续修改。

### Pull Request

Pull Request，简称 PR，是把一个分支合并到另一个分支前的审阅页面。个人项目也值得使用 PR，因为它集中展示修改、测试结果和合并记录。`[Expert judgment]`

### Release 与 Tag

Tag 是指向固定提交的版本标记，例如 `v1.0.0`。GitHub Release 是围绕 Tag 写的发布说明。移动应用商店不要求必须创建 GitHub Release，但使用 Tag 能让后续维护更可靠。`[Expert judgment]`

## GitHub 应该保存什么

### 应提交到 `du-app`

以下内容属于可重复构建项目所需材料：

- `src/`、`App.tsx`、`index.js`
- `ios/` 中的工程源码、`Podfile`、`Podfile.lock`
- `android/` 中的工程源码和 Gradle 配置
- `assets/` 中的字体、图标和应用资源
- `patches/`
- `__tests__/`
- `package.json`、`package-lock.json`
- `README.md`
- `docs/`
- `.gitignore`、ESLint、TypeScript、Metro、Babel 和 Jest 配置

### 绝不能提交

以下材料泄露后可能导致账号被盗、应用被冒名更新或用户数据暴露：

```text
.env
*.p8
*.p12
*.cer
*.mobileprovision
*.jks
*.keystore
android/keystore.properties
android/local.properties
node_modules/
ios/Pods/
DerivedData/
*.xcarchive
*.ipa
真实用户数据库
真实备份文件
商店账号密码
Apple 恢复密钥
GitHub 恢复代码
```

当前 `.gitignore` 已排除 Android 的 `keystore.properties`、`local.properties`、依赖目录和 Pods。`[Data-backed]`

Android 上传密钥当前保存在：

```text
~/Documents/DU-App-Release-Credentials/du-upload-key.jks
```

密码记录位于同目录的：

```text
README-KEEP-PRIVATE.txt
```

这两个文件应额外备份到本人控制的加密离线介质。丢失上传密钥会增加后续更新难度；泄露密钥和密码则可能危及发布身份。`[Expert judgment]`

### 不建议提交安装包

以下构建产物不应作为普通源码提交：

```text
android/app/build/outputs/bundle/release/app-release.aab
android/app/build/outputs/apk/release/app-release.apk
*.ipa
*.xcarchive
```

AAB 应直接上传 Google Play Console；APK 应直接上传对应国内安卓商店；iOS 构建应由 Xcode 上传 App Store Connect。`[Expert judgment]`

## 平时如何同步源码

以下命令适合开发侧操作，普通发布过程中不需要你手动执行：

```sh
git status
git add <明确的文件>
git commit -m "说明本次修改"
git push origin <当前分支>
```

每次推送完成后，应同时看到：

1. `git status` 显示工作区干净。
2. 当前本地分支不再显示 `ahead`。
3. GitHub 对应分支出现最新提交哈希。

不要直接使用 `git add .` 提交未知文件，也不要把密码复制到命令行、提交信息或 Issue。`[Expert judgment]`

## 发布前必须由你决定的固定信息

这些信息一旦用于正式商店建档，后续修改成本较高：

| 项目                       | 当前状态                                           |
| -------------------------- | -------------------------------------------------- |
| App 中文名                 | 渡                                                 |
| iOS 正式 Bundle ID         | `[To be confirmed]`，当前仍是 React Native 示例 ID |
| Android 正式 applicationId | `[To be confirmed]`，当前默认 `com.duapp`          |
| Apple 开发者主体           | `[To be confirmed]`，建议个人主体                  |
| Google Play 开发者主体     | `[To be confirmed]`，建议个人主体                  |
| 对外支持邮箱               | `[To be confirmed]`                                |
| 隐私政策主体姓名           | `[To be confirmed]`                                |
| 首发国家和地区             | `[To be confirmed]`                                |
| 是否首发中国大陆           | `[To be confirmed]`                                |
| 最终应用图标               | `[To be confirmed]`                                |
| 对外隐私政策 URL           | `[To be confirmed]`                                |
| 对外服务条款 URL           | `[To be confirmed]`                                |
| 对外支持页面 URL           | `[To be confirmed]`                                |

iOS 当前 Bundle ID 是：

```text
org.reactjs.native.example.duapp
```

Android 当前默认 applicationId 是：

```text
com.duapp
```

这两个值可以不同，但各自一旦首次发布就应长期保持。`[Expert judgment]`

## 公开隐私页面放在哪里

仓库内已经有：

```text
docs/app-store/PRIVACY_POLICY.md
docs/app-store/TERMS_OF_SERVICE.md
docs/app-store/SUPPORT.md
```

商店需要的是任何人无需登录即可打开的 HTTPS 网页，不是本机 Markdown 文件，也不是私有 GitHub 文件链接。`[Expert judgment]`

GitHub 官方说明：GitHub Free 只支持从公开仓库使用 Pages；私有仓库使用 Pages 需要 GitHub Pro、Team 或 Enterprise。即便源仓库私有，发布出来的普通 Pages 网站仍可能公开。`[Research-backed]`

低成本方案有两种：

### 方案 A：单独创建公开政策仓库

创建一个只放隐私政策、条款和支持页面的公开仓库，例如：

```text
du-legal
```

只复制公开文档，不复制应用源码、密钥或内部路线图。启用 GitHub Pages 后得到公开 HTTPS URL。

优点：GitHub Free 可用，维护成本低。`[Research-backed]`

缺点：法定姓名、联系邮箱和政策内容会公开，这是商店合规页面的正常属性。`[Expert judgment]`

### 方案 B：购买域名并使用静态托管

将政策页面部署到本人长期控制的域名。准备中国大陆发布或账号云同步时，这种方案更容易与备案、支持页面和注销页面统一。`[Expert judgment]`

首发只上架境外 App Store 和 Google Play 时，方案 A 成本更低。计划尽快进入中国大陆渠道时，优先方案 B。`[Expert judgment]`

## iOS 发布到 App Store

完整逐屏操作见：

```text
docs/IOS_PERSONAL_DEVELOPER_LAUNCH.md
```

### 需要开通什么

1. 准备本人长期持有的 Apple Account。
2. 开启双重认证。
3. 以个人身份加入 Apple Developer Program。
4. 使用法定姓名、真实电话和地址完成验证。
5. 支付会员年费。

Apple 官方当前列出的标准费用为每会员年度 99 美元，地区价格可能不同；个人卖家名称会显示法定姓名。`[Research-backed]`

官方入口：

```text
https://developer.apple.com/programs/enroll/
```

### 需要交给开发侧什么

以下信息可以提供给开发侧：

- Apple Developer Program 是否已经生效
- 正式 Bundle ID
- Team ID
- App Store 名称和备用名称
- 1024 × 1024 无透明通道 PNG 图标
- 支持邮箱
- 隐私政策、服务条款、支持页面 URL
- 首发地区

以下信息不要提供：

- Apple Account 密码
- 双重认证恢复密钥
- 银行卡完整信息
- App Store Connect API 私钥，除非明确建立受控自动化并单独管理

### 需要提交到 Apple 的内容

| 内容                      | 提交位置                                 |
| ------------------------- | ---------------------------------------- |
| 法定身份、联系方式、年费  | Apple Developer Program                  |
| 正式 Bundle ID            | Certificates, Identifiers & Profiles     |
| App 名称、SKU、语言       | App Store Connect 新建 App               |
| Xcode Archive             | Xcode Organizer 上传到 App Store Connect |
| 截图、描述、关键词、类别  | App Store Connect 版本页面               |
| 隐私政策 URL、App Privacy | App Store Connect                        |
| 审核联系人和审核说明      | App Store Connect                        |
| 测试构建                  | TestFlight                               |

### 当前 iOS 阻塞项

1. 正式 Bundle ID 尚未确定。`[Data-backed]`
2. Xcode 仍使用示例 Bundle ID。`[Data-backed]`
3. Apple Developer Team 和发布签名需要本人账号配置。`[To be confirmed]`
4. 正式 AppIcon 需要最终确认。`[To be confirmed]`
5. 三个公开 HTTPS 页面尚未提供最终 URL。`[To be confirmed]`
6. 必须完成真机与 TestFlight 验收。`[Expert judgment]`

### iOS 正式顺序

1. 开通 Apple Developer Program。
2. 确定正式 Bundle ID。
3. 在 Apple Developer Portal 注册 Bundle ID。
4. 在 Xcode 选择 Team 并修改 Bundle Identifier。
5. 补齐 AppIcon。
6. 创建公开政策页面。
7. 在 App Store Connect 新建“渡”。
8. 填写 `docs/app-store/APP_STORE_METADATA.md`。
9. 用真实 iPhone 完整验收。
10. 在 Xcode 生成 Release Archive。
11. 执行 Validate App。
12. 上传 App Store Connect。
13. 从 TestFlight 安装并复验。
14. 选择已验收的 Build。
15. 完成隐私、分级、出口合规、价格和地区。
16. 选择手动发布并提交审核。
17. 审核通过后再次核对页面，再手动发布。

预期结果：App Store Connect 中版本状态变为可供销售，用户可从所选地区的 App Store 下载。

## Android 发布到 Google Play

完整逐屏操作见：

```text
docs/ANDROID_GOOGLE_PLAY_LAUNCH.md
```

### 需要开通什么

1. 准备长期持有的 Google Account。
2. 注册个人 Play Console 开发者账号。
3. 接受开发者分发协议。
4. 支付一次性注册费。
5. 完成身份、联系方式和 Android 设备验证。

Google 官方当前列出的注册费为一次性 25 美元。新个人账号还需要满足测试与设备验证要求。`[Research-backed]`

官方入口：

```text
https://play.google.com/console/
```

### 新个人账号的封闭测试

Google 官方当前要求：2023 年 11 月 13 日之后创建的新个人开发者账号，在申请正式发布前，需要让至少 12 名测试者连续 14 天保持加入封闭测试。`[Research-backed]`

测试者不能中途退出后再把零散天数相加。提交正式版访问申请时，需要说明测试参与情况、收到的反馈、修复内容和正式发布准备情况。`[Research-backed]`

### 需要提交到 Google 的内容

| 内容                         | 提交位置                       |
| ---------------------------- | ------------------------------ |
| 法定身份、联系方式、注册费   | Play Console 账号注册          |
| App 名称、语言、免费状态     | 创建应用                       |
| 签名 AAB                     | 内部测试、封闭测试或正式版轨道 |
| 图标、功能图片、截图、介绍   | 商店发布资料                   |
| 隐私政策 URL                 | 应用内容                       |
| 数据安全问卷                 | 应用内容                       |
| 内容分级、目标受众、广告声明 | 应用内容                       |
| 测试人员名单或 Google 群组   | 封闭测试轨道                   |
| 测试反馈与修复说明           | 正式版访问申请                 |

### 当前 Android 产物

本机当前已经存在：

```text
android/app/build/outputs/bundle/release/app-release.aab
android/app/build/outputs/apk/release/app-release.apk
```

这表示工程可以生成 Release 产物，不表示包名、版本号、图标、商店资料或政策申报已经达到最终发布状态。`[Data-backed]`

### Android 正式顺序

1. 开通 Play Console 个人开发者账号。
2. 确定永久 applicationId。
3. 把 applicationId 固定到工程默认配置。
4. 备份上传密钥和密码。
5. 确定 `versionCode` 与 `versionName`。
6. 创建公开政策页面。
7. 在 Play Console 创建免费应用。
8. 填写 `docs/google-play/PLAY_STORE_METADATA.md`。
9. 按最终 Release 包复核 `docs/google-play/DATA_SAFETY.md`。
10. 生成签名 AAB。
11. 先上传内部测试。
12. 在真实 Android 设备复验。
13. 建立封闭测试，邀请至少 12 名合格测试者。
14. 连续维持至少 14 天并保留反馈。
15. 申请正式版访问。
16. 获批后上传最终 AAB 或沿用已验收构建。
17. 选择国家和地区。
18. 使用分阶段发布。
19. 观察崩溃、ANR 和用户反馈，再扩大范围。

预期结果：Play Console 正式版状态显示已发布，所选地区用户可以从 Google Play 安装。

## Android 发布到中国大陆应用商店

完整渠道说明见：

```text
docs/ANDROID_CHINA_STORES_LAUNCH.md
```

中国大陆不存在一个统一 Android 商店。华为、小米、OPPO、vivo、荣耀和应用宝需要分别注册、建档、上传和审核。`[Expert judgment]`

### 常见提交材料

- 个人身份证明和实名认证信息
- 应用名称、包名、版本号
- 同一生产签名生成的 APK
- 应用图标、功能介绍和真实截图
- 隐私政策、服务条款、支持和注销页面
- APP 备案信息
- 软件著作权或平台要求的权利证明
- 权限用途和第三方 SDK 清单
- 数据删除、账号注销与投诉联系方式

平台是否接受个人主体、是否要求软著以及具体类目材料会变化，必须在提交当天查看各开放平台控制台。`[To be confirmed]`

### 当前不建议立即提交大陆商店

当前仍缺正式包名、公开域名与政策页面、APP 备案、软著准备、真实安卓设备验收以及逐平台个人主体确认。`[Data-backed]`

优先完成 iOS 和 Google Play，可以先验证产品稳定性，同时避免在合规基础设施未确定时重复投递多个渠道。`[Expert judgment]`

## 软件著作权应准备什么

软件著作权申请通常需要围绕一个固定版本准备材料。各页面数量、格式和签章要求以中国版权保护中心当时系统为准。`[To be confirmed]`

项目侧可以准备：

- 软件全称、简称和版本号
- 开发完成日期与首次发表状态
- 权利人法定信息
- 源程序鉴别材料
- 用户操作说明书或软件设计说明书
- 主要功能截图
- 权利归属说明

不要把签名密钥、账号密码、真实用户数据或整个私有仓库交给不可信代办。`[Expert judgment]`

官方入口：

```text
https://www.ccopyright.com.cn/
```

## 首发需要准备的图片和文字

### 公共素材

- App 名称和副标题
- 一句话介绍
- 完整功能描述
- 版本更新说明
- 支持邮箱
- 隐私政策 URL
- 服务条款 URL
- 支持页面 URL
- 版权文字
- 审核说明

### iOS 素材

- 1024 × 1024 App 图标
- App Store Connect 当前接受尺寸的 iPhone 截图
- 若声明支持 iPad，则准备对应 iPad 截图
- TestFlight Beta 描述和反馈邮箱

### Google Play 素材

- 512 × 512 PNG 图标
- 1024 × 500 功能图片
- 至少两张真实 Android 手机截图
- 简短说明和完整说明
- 封闭测试说明与反馈记录

### 截图内容建议

1. 日迹
2. 写入与附件
3. 未来信
4. 足迹、念想或副本
5. 书架与散页
6. 数据与隐私

截图必须来自最终 Release 版本，不能出现调试菜单、私人数据、过时功能或未实现的云同步承诺。`[Expert judgment]`

## 免费发布与以后收费

首版可以让用户免费下载，但开发者账号本身仍可能收费：

- Apple Developer Program：每年 99 美元标准价，地区价格可能不同。`[Research-backed]`
- Google Play Console：一次性 25 美元注册费。`[Research-backed]`
- 中国大陆渠道：账号费、备案、服务器、域名和资质成本依渠道与方案而异。`[To be confirmed]`

以后收费建议通过应用内购买或订阅实现，不要把首版直接设为付费下载。这样可以保留免费获客路径，并为付费权益、恢复购买和订阅管理留出开发时间。`[Expert judgment]`

当前版本没有完成内购，不应在商店页面、应用按钮或隐私文案中展示尚未存在的收费能力。`[Data-backed]`

## 当前数据承诺

“渡”当前是本地优先应用：

- 不要求注册账号。`[Data-backed]`
- 不提供账号云同步。`[Data-backed]`
- 文字和附件默认保存在设备本地。`[Data-backed]`
- 用户可主动导出完整备份并恢复。`[Data-backed]`

因此不能在商店页面宣称：

- 登录后数据自动恢复
- 已自动上传 iCloud
- 已提供跨设备同步
- 卸载后数据一定不会丢失

账号同步方案仍是后续开发项，见：

```text
docs/ACCOUNT_SYNC_PLAN.md
```

## 每次发布新版本的标准流程

### 源码阶段

1. 在独立分支完成修改。
2. 运行 TypeScript、ESLint、Jest 和双端 Release 构建。
3. 检查数据库迁移和旧数据兼容。
4. 在真实设备完成关键流程。
5. 提交并推送到 GitHub。
6. 审阅差异后合并到 `main`。
7. 创建版本标签，例如 `v1.0.0`。

### iOS 阶段

1. 增加 Xcode Build。
2. 生成并验证 Archive。
3. 上传 App Store Connect。
4. 用 TestFlight 安装最终构建。
5. 更新版本说明和截图。
6. 提交审核。

### Android 阶段

1. 增加 `versionCode`。
2. 按需更新 `versionName`。
3. 使用同一上传密钥生成 AAB/APK。
4. 先上传测试轨道。
5. 安装商店分发版本复验。
6. 更新版本说明和政策申报。
7. 分阶段发布。

## 发布当天的停止条件

出现以下任何情况时，不应继续提交审核：

- GitHub 最新发布提交尚未合并或无法定位
- 正式包名仍未确定
- 使用 debug 签名或签名来源不明
- App 图标或截图仍是占位资源
- 隐私政策 URL 无法在未登录浏览器打开
- 商店文案声称了未实现功能
- 真机存在崩溃、数据丢失、无法返回或权限死循环
- 备份无法恢复
- 数据库升级破坏旧数据
- Apple Archive 或 Android AAB 验证失败
- Android 新个人账号未满足封闭测试要求
- 中国大陆渠道要求的备案或资质尚未完成

## 你现在最先要做的事

1. 登录 GitHub，核对邮箱、双重认证和恢复代码。
2. 决定正式 iOS Bundle ID。
3. 决定正式 Android applicationId。
4. 开通或确认 Apple Developer Program。
5. 开通或确认 Google Play Console。
6. 提供长期支持邮箱。
7. 确认是否首发中国大陆。
8. 确认最终 App 图标。
9. 选择公开政策页面方案。
10. 在完成当前功能验收后，授权把发布分支合并到 `main` 并创建 `v1.0.0` 标签。

## 应阅读的专业指导书

按顺序阅读：

1. `docs/PUBLISHING_MASTER_GUIDE.md`
   - 理解账号、仓库、材料去向和总流程。
2. `docs/IOS_PERSONAL_DEVELOPER_LAUNCH.md`
   - 实际执行 Apple Developer、Xcode、TestFlight 和 App Store 审核。
3. `docs/app-store/APP_STORE_METADATA.md`
   - 填写 iOS 商店文案、URL 和审核说明。
4. `docs/ANDROID_GOOGLE_PLAY_LAUNCH.md`
   - 实际执行签名、AAB、封闭测试和 Google Play 发布。
5. `docs/google-play/PLAY_STORE_METADATA.md`
   - 填写 Google Play 商店资料。
6. `docs/google-play/DATA_SAFETY.md`
   - 填写 Google Play 数据安全问卷。
7. `docs/ANDROID_CHINA_STORES_LAUNCH.md`
   - 准备中国大陆安卓渠道、备案和软著。
8. `docs/ACCOUNT_SYNC_PLAN.md`
   - 后续实现账号同步前理解数据、成本和合规边界。

遇到平台页面与文档不一致时，以平台当日官方页面为准，并先暂停提交，核对是否属于政策变化、账号类型差异或项目配置未更新。
