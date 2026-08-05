#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface DuFileShare : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@property(nonatomic, copy) RCTPromiseResolveBlock pickerResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock pickerReject;
@end

@implementation DuFileShare

RCT_EXPORT_MODULE();

- (UIViewController *)activePresenter
{
  UIWindow *activeWindow = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (scene.activationState != UISceneActivationStateForegroundActive ||
        ![scene isKindOfClass:UIWindowScene.class]) {
      continue;
    }
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      if (window.isKeyWindow) {
        activeWindow = window;
        break;
      }
      if (!activeWindow && !window.hidden) {
        activeWindow = window;
      }
    }
    if (activeWindow.isKeyWindow) {
      break;
    }
  }

  UIViewController *presenter = activeWindow.rootViewController;
  while (presenter) {
    if (presenter.presentedViewController) {
      presenter = presenter.presentedViewController;
    } else if ([presenter isKindOfClass:UINavigationController.class]) {
      presenter = ((UINavigationController *)presenter).visibleViewController;
    } else if ([presenter isKindOfClass:UITabBarController.class]) {
      presenter = ((UITabBarController *)presenter).selectedViewController;
    } else {
      break;
    }
  }
  return presenter;
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_REMAP_METHOD(
  shareFile,
  shareFile:(NSString *)path
  mimeType:(NSString *)mimeType
  title:(NSString *)title
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *normalizedPath = [path stringByReplacingOccurrencesOfString:@"file://" withString:@""];
  NSURL *fileURL = [NSURL fileURLWithPath:normalizedPath];
  if (![[NSFileManager defaultManager] fileExistsAtPath:normalizedPath]) {
    reject(@"FILE_NOT_FOUND", @"导出文件不存在", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    UIActivityViewController *controller =
      [[UIActivityViewController alloc] initWithActivityItems:@[fileURL]
                                        applicationActivities:nil];
    controller.title = title;
    controller.completionWithItemsHandler =
      ^(UIActivityType activityType, BOOL completed, NSArray *items, NSError *error) {
        if (error) {
          reject(@"SHARE_FAILED", @"无法打开系统分享面板", error);
        } else {
          resolve(nil);
        }
      };

    UIViewController *presenter = [self activePresenter];
    if (!presenter) {
      reject(@"SHARE_UNAVAILABLE", @"当前没有可显示分享面板的窗口", nil);
      return;
    }
    if (controller.popoverPresentationController) {
      controller.popoverPresentationController.sourceView = presenter.view;
      controller.popoverPresentationController.sourceRect =
        CGRectMake(CGRectGetMidX(presenter.view.bounds),
                   CGRectGetMidY(presenter.view.bounds),
                   1,
                   1);
    }
    [presenter presentViewController:controller animated:YES completion:nil];
  });
}

RCT_REMAP_METHOD(
  pickBackupFile,
  pickBackupFileWithResolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.pickerResolve) {
      reject(@"PICKER_BUSY", @"文件选择器正在使用中", nil);
      return;
    }

    UIViewController *presenter = [self activePresenter];
    if (!presenter) {
      reject(@"PICKER_UNAVAILABLE", @"当前没有可显示文件选择器的窗口", nil);
      return;
    }

    self.pickerResolve = resolve;
    self.pickerReject = reject;
    UIDocumentPickerViewController *picker =
      [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[
        [UTType typeWithIdentifier:@"public.json"]
      ]];
    picker.delegate = self;
    picker.allowsMultipleSelection = NO;
    [presenter presentViewController:picker animated:YES completion:nil];
  });
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller
didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  NSURL *sourceURL = urls.firstObject;
  if (!sourceURL || !self.pickerResolve) {
    return;
  }

  BOOL accessed = [sourceURL startAccessingSecurityScopedResource];
  NSString *cacheDirectory = NSSearchPathForDirectoriesInDomains(
    NSCachesDirectory, NSUserDomainMask, YES).firstObject;
  NSString *filename = [NSString stringWithFormat:
    @"du-import-%@.du-backup.json", NSUUID.UUID.UUIDString];
  NSString *destinationPath = [cacheDirectory stringByAppendingPathComponent:filename];
  NSError *error = nil;
  [[NSFileManager defaultManager] removeItemAtPath:destinationPath error:nil];
  [[NSFileManager defaultManager] copyItemAtPath:sourceURL.path
                                          toPath:destinationPath
                                           error:&error];
  if (accessed) {
    [sourceURL stopAccessingSecurityScopedResource];
  }

  RCTPromiseResolveBlock resolve = self.pickerResolve;
  RCTPromiseRejectBlock reject = self.pickerReject;
  self.pickerResolve = nil;
  self.pickerReject = nil;
  if (error) {
    reject(@"PICK_FAILED", @"无法读取所选备份文件", error);
  } else {
    resolve(destinationPath);
  }
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  RCTPromiseResolveBlock resolve = self.pickerResolve;
  self.pickerResolve = nil;
  self.pickerReject = nil;
  if (resolve) {
    resolve([NSNull null]);
  }
}

@end
