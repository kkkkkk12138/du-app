# 渡 iOS App Store 上架指导书

适用对象：个人开发者首次发布免费 iPhone App，后续再通过 App 内购买提供增值功能。

适用版本：1.0.1（Build 2）

更新日期：2026-08-07

第一次使用 GitHub 或应用商店时，先阅读：

```text
docs/PUBLISHING_MASTER_GUIDE.md
```

## 先看当前状态

当前代码已完成 TypeScript、严格 ESLint、Jest 和 iOS Release Simulator 验证。App 图标、隐私清单、权限说明、商店文案和公开政策页面已准备。发布前必须基于最终提交重新运行全部检查；模拟器构建不能替代真机归档、TestFlight 和 App Store 上传。

目前仍有以下发布阻塞：

1. Xcode 中的 Bundle ID 仍为 `org.reactjs.native.example.duapp`。
2. Xcode 尚未配置你的 Apple Developer Team 和 App Store 签名。
3. 尚未在 App Store Connect 创建正式 App 记录。
4. 尚未完成真机、Archive 和 TestFlight 最终验收。
5. App Store 截图尚未从最终 Release 构建生成。

完成这些事项前，不要提交正式审核。

## 免费首发策略

“免费上架”表示用户免费下载，不表示 Apple 开发者身份免费。发布到 App Store 仍需有效的 Apple Developer Program 会员，标准年费为 99 美元，实际人民币金额以 Apple 结算页面为准。

1. App Store 价格选择免费。
2. 1.0.1 不创建应用内购买、订阅、广告或付费按钮。
3. 不签署只为收款所需的 Paid Apps Agreement，不填写收款银行账户，除非 App Store Connect 要求或后续开始收费。
4. 不在描述、截图、审核说明和隐私政策中承诺未来收费功能。
5. 后续收费优先通过 Apple 应用内购买实现，并在新版本中补齐购买、恢复购买、权益校验和退款说明。

## 1. 准备账户和资料

### 需要的账户

1. 准备一个长期使用且已开启双重认证的 Apple Account。
2. 打开 <https://developer.apple.com/programs/enroll/>。
3. 选择 `Individual`，按身份证件填写法定姓名、电话和地址。
4. 支付 Apple Developer Program 年费。Apple 的标准价格为每年 99 美元，实际扣款货币以当地页面为准。
5. 等待会员状态变为有效，再登录 <https://appstoreconnect.apple.com/>。

个人账号的 App Store 卖家名称会显示法定姓名。未经注册的工作室名称不能替代个人卖家名称。

### 需要提前决定的内容

在 Xcode 或 App Store Connect 中创建任何正式记录前，先写下：

| 项目             | 建议或待填写内容    |
| ---------------- | ------------------- |
| App 名称         | 渡                  |
| 备用名称         | 渡 · 写给未来       |
| 正式 Bundle ID   | `[本人注册后填写]`  |
| SKU              | `du-ios-001`        |
| 主语言           | 简体中文            |
| 主要类别         | 生活                |
| 次要类别         | 效率                |
| 支持邮箱         | `2161511899@qq.com` |
| 是否首发中国大陆 | `[是 / 否]`         |

Bundle ID 与 App、Keychain、通知、内购和后续升级绑定。正式创建后不要更换。

## 2. 把源码安全保存到 GitHub

GitHub 用来保存源码和文档，不用来保存签名凭据或生产配置。

### 应上传

- `src/`、`App.tsx` 和 React Native 配置
- `ios/` 中的工程源码、`Podfile` 与 `Podfile.lock`
- `package.json` 与 `package-lock.json`
- `assets/`、`patches/`、测试和必要文档
- `README.md`
- 本指导书和 `docs/app-store/` 中的资料模板

### 不应上传

- `node_modules/`、`ios/Pods/`、DerivedData、Archive 和 `.ipa`
- `.env`
- `.p8`、`.p12`、`.cer`、`.mobileprovision`
- App Store Connect API 私钥
- 浏览器或模拟器临时文件
- 含真实用户数据的数据库或备份

### 克隆后恢复 iOS 工程

```sh
npm ci
cd ios
pod install
open duapp.xcworkspace
```

必须打开 `duapp.xcworkspace`，不要打开 `duapp.xcodeproj`。

预期结果：Xcode 能加载 `duapp` scheme，模拟器构建不缺少 Pods。

## 3. 注册正式 Bundle ID

1. 登录 <https://developer.apple.com/account/>。
2. 打开 `Certificates, Identifiers & Profiles`。
3. 进入 `Identifiers`，点击加号。
4. 选择 `App IDs`，再选择 `App`。
5. Description 填写 `渡`。
6. Bundle ID 选择 `Explicit`。
7. 输入已经决定的正式 Bundle ID，例如 `com.example.du`。
8. 按实际能力启用所需服务。当前至少涉及通知和 Keychain；不要开启未使用的能力。
9. 点击 `Register`。

预期结果：Identifiers 列表中出现正式 Bundle ID。

## 4. 修改 Xcode 工程身份

1. 在项目根目录运行：

```sh
cd ios
pod install
open duapp.xcworkspace
```

2. 在左侧选择蓝色 `duapp` 工程。
3. 选择 `TARGETS > duapp > Signing & Capabilities`。
4. 勾选 `Automatically manage signing`。
5. Team 选择你的个人开发者团队。
6. 将 Bundle Identifier 改为正式 Bundle ID。
7. 在 `General` 中确认：
   - Display Name：`渡`
   - Version：`1.0.1`
   - Build：`2`
   - Deployment Target：与你准备支持的最低 iOS 版本一致
8. 在 `Capabilities` 中核对通知与 Keychain 能力，不添加未使用的能力。

若 Xcode 提示 Bundle ID 不可用，说明该 ID 未注册、被其他团队占用，或当前 Team 选择错误。

## 5. 补齐正式图标和启动资源

仓库已生成无透明通道的 iOS 图标母版和完整 iPhone 图标槽位：

```text
assets/store/ios/app-icon-1024.png
ios/duapp/Images.xcassets/AppIcon.appiconset/
```

1. 打开 `ios/duapp/Images.xcassets`。
2. 选择 `AppIcon`，确认所有 iPhone 槽位均显示图片。
3. 在 Xcode Build Log 中确认没有 AppIcon 缺失或透明通道错误。
4. 用真机和浅色、深色主屏幕检查辨识度。

不要把截图、圆角蒙版或 Apple 设备外框直接做进 App 图标。

预期结果：Asset Catalog 不再显示 AppIcon 缺失警告。

## 6. 发布隐私政策、服务条款和支持页面

App Store Connect 要求所有 App 提供公开可访问的隐私政策 URL。以下页面已上线并通过匿名 HTTPS 验证：

- 隐私政策：<https://kkkkkk12138.github.io/du-legal/privacy/>
- 服务条款：<https://kkkkkk12138.github.io/du-legal/terms/>
- 使用支持：<https://kkkkkk12138.github.io/du-legal/support/>

### 低成本发布方式

源码继续保存在私有 `du-app`；公开政策单独保存在 `du-legal`。不要把源码仓库改为公开，也不要把手机号、证件、签名文件、备份或用户数据复制到政策仓库。

若计划进入中国大陆商店或提供账号同步，优先使用本人长期控制的域名和合规托管方案。

政策必须说明：

- 文字、照片、录音、手书、地点和信件默认保存在本机。
- 当前没有账号同步。
- 卸载或清除 App 数据可能造成内容丢失。
- 用户可以主动导出和恢复完整备份。
- 当前版本不包含第三方崩溃采集或分析 SDK。
- 相机、相册、麦克风、位置、通知和生物识别的用途。
- 联系邮箱和生效日期。

## 7. 决定是否首发中国大陆

若首发包含中国大陆，需要按适用流程完成 APP 备案。材料和办理入口会随接入服务商、地区及政策变化，提交前以工信部和接入服务商当时要求为准。

当前备案编号尚未取得。若先发布 iOS：

1. 在 App Store Connect 的销售地区中取消中国大陆。
2. 先选择其他计划发布的国家或地区。
3. 备案完成后再新增中国大陆销售地区。

不要在未完成备案时把中国大陆列为首发地区。

## 8. 创建 App Store Connect 记录

Apple 要求先创建 App 记录，再上传构建版本。

1. 登录 <https://appstoreconnect.apple.com/>。
2. 打开 `App`，点击左上角加号。
3. 选择 `新建 App`。
4. 平台选择 `iOS`。
5. 名称填写 `渡`；若不可用，使用已准备的备用名称。
6. 主语言选择 `简体中文`。
7. Bundle ID 选择第 3 步注册的正式 ID。
8. SKU 填写 `du-ios-001` 或你自己的稳定内部编号。
9. 用户访问权限保持完全访问，除非你已建立多人团队权限。
10. 点击创建。

预期结果：App 状态显示“准备提交”。

Apple 官方操作页：<https://developer.apple.com/cn/help/app-store-connect/create-an-app-record/add-a-new-app>

## 9. 填写 App Store 页面

打开 `docs/app-store/APP_STORE_METADATA.md`，逐项填写到 App Store Connect。

必须完成：

1. App 名称、副标题、宣传文本、描述和关键词。
2. 支持 URL、隐私政策 URL。
3. 主要类别和次要类别。
4. 年龄分级问卷。
5. App 版权信息。
6. App Privacy。
7. 审核联系人和审核说明。
8. 价格设为免费，不创建应用内购买。
9. 销售地区。

### App Privacy 的保守申报原则

先按实际 SDK 和数据流逐项回答，不要因为数据主要保存在本地就把所有问题都选“否”。

- 用户日记正文和附件：当前默认只在本机处理，不上传给开发者。
- 位置：仅在用户主动添加地点时使用；是否构成“收集”取决于数据是否离开设备。
- 标识符、使用数据和诊断：当前版本不通过第三方 SDK 收集；以最终构建和实际网络请求为准。
- Tracking：当前产品不应使用广告追踪；若后台或 SDK 配置不一致，先修代码再填写问卷。

Apple 官方 App Privacy 说明：<https://developer.apple.com/cn/help/app-store-connect/reference/app-information/app-privacy>

## 10. 准备 App Store 截图

截图尺寸和设备组以 App Store Connect 当前上传框为准。每组只上传来自最终 Release 构建的 JPG 或 PNG，不用设计稿冒充真实界面。

推荐准备 6 张竖屏截图：

1. 日迹：首页和真实范例内容。
2. 写下：文字、照片、录音和手书入口。
3. 信：未来信与已拆信。
4. 远方：足迹、念想或副本。
5. 书架：书封、阅读和续写。
6. 数据与隐私：本地优先、完整备份和恢复。

截图规则：

- 使用当前真实界面，不展示已删除功能。
- 不放真实姓名、地址、坐标、私人照片或真实信件。
- 文案不能宣称账号同步、iCloud 自动备份或 Android 已发布。
- 不使用模拟器调试菜单、鼠标光标或系统弹窗。
- 所有本地化版本保持同一套叙事顺序。

Apple 官方尺寸页：<https://developer.apple.com/cn/help/app-store-connect/reference/screenshot-specifications>

## 11. 真机发布验收

必须使用真机测试，模拟器不能验证相机、麦克风、生物识别和完整权限行为。

按顺序测试：

1. 全新安装并完成首次引导。
2. 创建、查看、编辑和删除日迹。
3. 创建未来信，验证年月日时分和通知。
4. 拍照、从相册选图、录音和手书。
5. 拒绝每项权限，再从系统设置恢复授权。
6. 开启生物识别锁，测试取消、后台锁定和重新解锁。
7. 创建书、续在本页、另起新页、删除书和删除页。
8. 拖动、删除和撤销散页。
9. 导出完整备份到“文件”。
10. 新建少量测试数据后，从备份恢复，核对附件和数量。
11. 开启 Reduce Motion、深色模式和大字体检查关键流程。
12. 在飞行模式、低存储和 App 被系统终止后重新启动。
13. 覆盖安装下一 Build，确认旧数据库无损迁移。

发现崩溃、数据丢失、无法返回、权限死循环或备份不能恢复时，不要上传审核版本。

## 12. 生成 Archive

1. 在 Xcode 打开 `duapp.xcworkspace`。
2. 选择 `Any iOS Device (arm64)` 或连接的真机，不要选择模拟器。
3. 选择 `Product > Clean Build Folder`。
4. 确认 Scheme 为 `duapp`，Build Configuration 为 `Release`。
5. 选择 `Product > Archive`。
6. 等待 Organizer 自动打开。
7. 选中 Archive，点击 `Validate App`。
8. 修复所有 Error。Warning 需要逐项判断，不能直接忽略签名、图标、隐私或 SDK 警告。

每次重新上传必须增加 Build，例如从 `1` 改为 `2`。同一版本号可以对应多个不同 Build。

## 13. 上传到 App Store Connect

1. 在 Organizer 选择通过验证的 Archive。
2. 点击 `Distribute App`。
3. 选择 `App Store Connect`。
4. 选择 `Upload`。
5. 保持自动管理签名，除非你明确使用手动证书流程。
6. 完成验证并点击上传。
7. 等待 App Store Connect 处理完成。

上传后不会立即上架。构建版本需要先经过 Apple 处理，随后才会出现在 TestFlight 和版本页面。

Apple 官方上传说明：<https://developer.apple.com/cn/help/app-store-connect/manage-builds/upload-builds>

## 14. 用 TestFlight 验证

1. 在 App Store Connect 打开 `TestFlight`。
2. 等待构建状态变为可测试。
3. 回答出口合规问题。
4. 先添加自己为内部测试员。
5. 从 TestFlight 安装，而不是从 Xcode 安装。
6. 重做第 12 节的关键路径。
7. 至少保留一份 TestFlight 导出的完整备份，并验证可恢复。
8. 若邀请外部测试者，填写 Beta App 描述和审核信息，等待 Beta 审核。

预期结果：从 TestFlight 安装的 Release 构建可完成核心流程，没有依赖 Metro。

## 15. 填写审核信息

当前 App 无需登录，审核说明可使用 `APP_STORE_METADATA.md` 中的草稿。

必须向审核人员说明：

- App 无需注册账号。
- 用户内容默认保存在本机。
- 测试用范例内容可以删除。
- 未来信入口和到达时间设置路径。
- 相机、相册、麦克风、位置、生物识别和通知分别从哪里触发。
- 完整备份和恢复位于“我 > 关于渡 > 数据与隐私”。
- 当前没有账号同步。

不要写入你的 Apple Account 密码、证书密码或其他敏感凭据。

## 16. 提交审核

1. 在 App Store 版本页面选择已上传并通过 TestFlight 验证的 Build。
2. 补齐红色提示的所有字段。
3. 完成年龄分级、App Privacy、出口合规和版权声明。
4. 上传最终截图。
5. 填写审核联系人和审核说明。
6. 发布方式选择“手动发布”。
7. 点击“添加以供审核”。
8. 在提交页面确认所有项目后点击“提交以供审核”。

审核通过后先不要立即发布。再次核对商店文案、截图、价格、地区和隐私 URL，再手动发布。

## 17. 常见失败处理

### Xcode 提示 Signing requires a development team

回到 `Signing & Capabilities` 选择个人 Team，并确认 Apple Developer Program 会员有效。

### Bundle ID 无法注册或上传后找不到 App

核对 Xcode、Developer Portal 和 App Store Connect 中的 Bundle ID，三处必须完全一致。

### AppIcon 缺失

补齐 `AppIcon.appiconset`，确认 1024 × 1024 PNG 无透明通道，再重新 Archive。

### Keychain 报 entitlement 错误

不要用 `CODE_SIGNING_ALLOWED=NO` 生成的模拟器验证包做功能验收。App Store Archive 必须使用正确 Team 和签名。

### 构建上传后不显示

先等待 Apple 处理并检查邮件，然后查看 App Store Connect 的构建状态和上传错误。每次重传增加 Build。

### 隐私问卷不知道怎么选

暂停提交，核对 `LegalDocumentScreen.tsx`、最终依赖和真机网络请求。不能猜测，也不能把未知项全部选“未收集”。

### 审核指出元数据与功能不一致

修改截图、描述或审核说明，使其只描述当前构建真实存在的功能。不要用未来规划解释当前版本。

## 18. 后续加入内购

首版保持免费下载。准备收费版本时：

1. 在 App Store Connect 的 Business 中接受 Paid Apps Agreement。
2. 填写本人银行账户和税务资料。
3. 评估并申请 App Store Small Business Program。
4. 创建非消耗型内购或订阅。
5. 实现购买、恢复购买、权益校验和失败恢复。
6. 在提交内购审核前补充价格、周期、续费和取消说明。

不要在代码中出现尚未完成的付费按钮或虚假价格。

## 19. 本人必须完成的操作

以下操作涉及付款、法定身份、双重认证、协议和发布决定，必须由周颖本人完成：

1. 开通并续费 Apple Developer Program。
2. 在 Developer Portal 注册正式 Bundle ID。
3. 提供 Apple Developer Team ID，并在 Xcode 选择个人 Team。
4. 在 App Store Connect 创建“渡”并接受适用协议。
5. 决定首发国家或地区；备案前不选择中国大陆。
6. 在真机和 TestFlight 上完成最终验收。
7. 确认 App Privacy、年龄分级、出口合规和免费价格。
8. 点击“提交以供审核”，审核通过后确认手动发布。

Apple Account 密码、双重认证验证码、证书私钥和 App Store Connect API 私钥不得写入仓库或发送到普通聊天。

开发侧已完成图标、公开政策 URL、商店文案、审核路径、隐私清单、权限说明和版本配置准备。取得正式 Bundle ID 与 Team ID 后，再完成 Xcode 身份替换、签名 Archive 和上传。
