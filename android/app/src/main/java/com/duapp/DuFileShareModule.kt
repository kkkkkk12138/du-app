package com.duapp

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.UUID

class DuFileShareModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var pickerPromise: Promise? = null
  private val pickerRequestCode = 7291
  private val activityListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: android.app.Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != pickerRequestCode) {
          return
        }
        val promise = pickerPromise ?: return
        pickerPromise = null
        if (resultCode != android.app.Activity.RESULT_OK || data?.data == null) {
          promise.resolve(null)
          return
        }
        try {
          val destination =
            File(
              reactApplicationContext.cacheDir,
              "du-import-${UUID.randomUUID()}.du-backup.json",
            )
          reactApplicationContext.contentResolver.openInputStream(data.data!!).use { input ->
            requireNotNull(input) { "无法打开所选文件" }
            destination.outputStream().use { output -> input.copyTo(output) }
          }
          promise.resolve(destination.absolutePath)
        } catch (error: Exception) {
          promise.reject("PICK_FAILED", "无法读取所选备份文件", error)
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName() = "DuFileShare"

  @ReactMethod
  fun shareFile(path: String, mimeType: String, title: String, promise: Promise) {
    try {
      val file = File(path.removePrefix("file://"))
      if (!file.exists() || !file.isFile) {
        promise.reject("FILE_NOT_FOUND", "导出文件不存在")
        return
      }
      val uri =
        FileProvider.getUriForFile(
          reactApplicationContext,
          "${reactApplicationContext.packageName}.fileprovider",
          file,
        )
      val intent =
        Intent(Intent.ACTION_SEND).apply {
          type = mimeType
          putExtra(Intent.EXTRA_STREAM, uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      val chooser =
        Intent.createChooser(intent, title).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      reactApplicationContext.startActivity(chooser)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SHARE_FAILED", "无法打开系统分享面板", error)
    }
  }

  @ReactMethod
  fun pickBackupFile(promise: Promise) {
    if (pickerPromise != null) {
      promise.reject("PICKER_BUSY", "文件选择器正在使用中")
      return
    }
    val activity = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      promise.reject("PICKER_UNAVAILABLE", "当前没有可显示文件选择器的窗口")
      return
    }
    pickerPromise = promise
    val intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "application/json"
      }
    try {
      activity.startActivityForResult(intent, pickerRequestCode)
    } catch (error: Exception) {
      pickerPromise = null
      promise.reject("PICK_FAILED", "无法打开系统文件选择器", error)
    }
  }
}
