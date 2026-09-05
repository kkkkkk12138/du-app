package com.duapp

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.util.Base64
import java.util.concurrent.Executors

class DuMediaCryptoModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()
  private val cipher =
    DuemCipher(
      privateRoots =
        listOf(
          reactContext.filesDir,
          reactContext.cacheDir,
          reactContext.noBackupFilesDir,
        ),
    )

  override fun getName() = "DuMediaCrypto"

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  @ReactMethod
  fun generateRandomKey(promise: Promise) {
    run(promise) {
      Base64.getEncoder().encodeToString(cipher.generateRandomKey())
    }
  }

  @ReactMethod
  fun keyVerifier(
    uid: String,
    masterKeyBase64: String,
    promise: Promise,
  ) {
    run(promise) {
      DuemCipher.keyVerifier(uid, decodeMasterKey(masterKeyBase64))
    }
  }

  @ReactMethod
  fun encryptMediaFile(
    input: ReadableMap,
    promise: Promise,
  ) {
    run(promise) {
      val result =
        cipher.encrypt(
          source = File(requiredString(input, "sourcePath")),
          destination = File(requiredString(input, "destinationPath")),
          masterKey = decodeMasterKey(requiredString(input, "masterKeyBase64")),
          metadata =
            DuemCipher.Metadata(
              uid = requiredString(input, "uid"),
              entryCommitId = requiredString(input, "entryCommitId"),
              mediaId = requiredString(input, "mediaId"),
              mediaKind = requiredString(input, "mediaKind"),
              chunkSize = requiredPositiveInt(input, "chunkSize"),
            ),
        )
      result.toWritableMap()
    }
  }

  @ReactMethod
  fun inspectEncryptedFile(
    path: String,
    promise: Promise,
  ) {
    run(promise) {
      cipher.inspect(File(path)).toWritableMap()
    }
  }

  @ReactMethod
  fun deleteEncryptedFile(
    path: String,
    promise: Promise,
  ) {
    run(promise) {
      cipher.delete(File(path))
      null
    }
  }

  private fun run(
    promise: Promise,
    operation: () -> Any?,
  ) {
    executor.execute {
      try {
        promise.resolve(operation())
      } catch (error: Exception) {
        val failure = failure(error)
        promise.reject(failure.first, failure.second, error)
      }
    }
  }

  private fun decodeMasterKey(encoded: String): ByteArray {
    val key =
      try {
        Base64.getDecoder().decode(encoded)
      } catch (error: IllegalArgumentException) {
        throw DuemCipher.DuemException(
          DuemCipher.ErrorKind.KEY_INVALID,
          "Master key is not valid base64",
          error,
        )
      }
    if (key.size != 32) {
      throw DuemCipher.DuemException(
        DuemCipher.ErrorKind.KEY_INVALID,
        "Master key length is invalid",
      )
    }
    return key
  }

  private fun requiredString(
    input: ReadableMap,
    key: String,
  ): String {
    val value =
      if (input.hasKey(key) && !input.isNull(key)) {
        input.getString(key)
      } else {
        null
      }
    if (value.isNullOrEmpty()) {
      throw DuemCipher.DuemException(
        DuemCipher.ErrorKind.INVALID_INPUT,
        "Required field is missing",
      )
    }
    return value
  }

  private fun requiredPositiveInt(
    input: ReadableMap,
    key: String,
  ): Int {
    if (!input.hasKey(key) || input.isNull(key)) {
      throw DuemCipher.DuemException(
        DuemCipher.ErrorKind.INVALID_INPUT,
        "Required number is missing",
      )
    }
    val value = input.getDouble(key)
    if (
      !value.isFinite() ||
      value <= 0 ||
      value > Int.MAX_VALUE ||
      value != value.toInt().toDouble()
    ) {
      throw DuemCipher.DuemException(
        DuemCipher.ErrorKind.INVALID_INPUT,
        "Required number is invalid",
      )
    }
    return value.toInt()
  }

  private fun DuemCipher.EncryptionResult.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
      putString("encryptedPath", encryptedPath)
      putDouble("encryptedBytes", encryptedBytes.toDouble())
      putDouble("plaintextBytes", plaintextBytes.toDouble())
      putString("sha256", sha256)
      putInt("formatVersion", formatVersion)
    }

  private fun failure(error: Exception): Pair<String, String> {
    val kind = (error as? DuemCipher.DuemException)?.kind
    return when (kind) {
      DuemCipher.ErrorKind.SOURCE_NOT_FOUND ->
        "SOURCE_NOT_FOUND" to "本地媒体文件不存在"
      DuemCipher.ErrorKind.KEY_INVALID ->
        "KEY_INVALID" to "账号主密钥无效"
      DuemCipher.ErrorKind.PATH_NOT_PRIVATE ->
        "PATH_NOT_PRIVATE" to "媒体路径不在应用私有目录"
      DuemCipher.ErrorKind.INVALID_INPUT,
      DuemCipher.ErrorKind.OUTPUT_INVALID,
      -> "OUTPUT_INVALID" to "媒体密文格式无效"
      DuemCipher.ErrorKind.DELETE_FAILED ->
        "DELETE_FAILED" to "无法删除媒体密文"
      null -> "ENCRYPTION_FAILED" to "媒体加密失败"
    }
  }
}
