package com.duapp

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

internal class DuemCipher(
  privateRoots: List<File>,
  private val randomBytes: (Int) -> ByteArray = ::secureRandomBytes,
) {
  data class Metadata(
    val uid: String,
    val entryCommitId: String,
    val mediaId: String,
    val mediaKind: String,
    val chunkSize: Int,
  )

  data class EncryptionResult(
    val encryptedPath: String,
    val encryptedBytes: Long,
    val plaintextBytes: Long,
    val sha256: String,
    val formatVersion: Int,
  )

  enum class ErrorKind {
    SOURCE_NOT_FOUND,
    KEY_INVALID,
    PATH_NOT_PRIVATE,
    INVALID_INPUT,
    OUTPUT_INVALID,
    DELETE_FAILED,
  }

  class DuemException(
    val kind: ErrorKind,
    message: String,
    cause: Throwable? = null,
  ) : Exception(message, cause)

  private data class ParsedHeader(
    val version: Int,
    val chunkSize: Int,
    val plaintextBytes: Long,
    val salt: ByteArray,
    val noncePrefix: ByteArray,
    val bytes: ByteArray,
  )

  private val roots =
    privateRoots.map { it.canonicalFile }.also {
      require(it.isNotEmpty()) { "At least one private root is required" }
    }

  fun generateRandomKey(): ByteArray = randomBytes(KEY_BYTES).also {
    if (it.size != KEY_BYTES) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Random key length is invalid")
    }
  }

  fun encrypt(
    source: File,
    destination: File,
    masterKey: ByteArray,
    metadata: Metadata,
  ): EncryptionResult {
    val safeSource = validatedPrivateFile(source)
    val safeDestination = validatedPrivateFile(destination)
    if (!safeSource.isFile) {
      throw DuemException(ErrorKind.SOURCE_NOT_FOUND, "Source file does not exist")
    }
    validateKey(masterKey)
    validateMetadata(metadata)
    if (safeSource == safeDestination) {
      throw DuemException(ErrorKind.INVALID_INPUT, "Source and destination must differ")
    }
    val plaintextBytes = safeSource.length()
    if (plaintextBytes <= 0) {
      throw DuemException(ErrorKind.INVALID_INPUT, "Source file is empty")
    }

    val salt = randomBytes(SALT_BYTES)
    val noncePrefix = randomBytes(NONCE_PREFIX_BYTES)
    if (salt.size != SALT_BYTES || noncePrefix.size != NONCE_PREFIX_BYTES) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Entropy length is invalid")
    }
    val header =
      buildHeader(
        chunkSize = metadata.chunkSize,
        plaintextBytes = plaintextBytes,
        salt = salt,
        noncePrefix = noncePrefix,
      )
    val fileKey = deriveFileKey(masterKey, salt, metadata)
    val partial = File("${safeDestination.path}.partial")
    safeDestination.parentFile?.mkdirs()
    partial.delete()

    try {
      val digest = MessageDigest.getInstance("SHA-256")
      var totalRead = 0L
      var chunkIndex = 0L
      FileInputStream(safeSource).use { input ->
        FileOutputStream(partial).use { output ->
          writeAndHash(output, digest, header)
          val buffer = ByteArray(metadata.chunkSize)
          while (true) {
            val count = readChunk(input, buffer)
            if (count == 0) {
              break
            }
            if (chunkIndex > UINT32_MAX) {
              throw DuemException(ErrorKind.INVALID_INPUT, "Too many chunks")
            }
            val plaintext = buffer.copyOf(count)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
              Cipher.ENCRYPT_MODE,
              SecretKeySpec(fileKey, "AES"),
              GCMParameterSpec(TAG_BYTES * 8, nonce(noncePrefix, chunkIndex)),
            )
            cipher.updateAAD(
              chunkAad(
                header = header,
                metadata = metadata,
                index = chunkIndex,
                plaintextLength = count,
              ),
            )
            val sealed = cipher.doFinal(plaintext)
            writeAndHash(output, digest, uint32(count.toLong()))
            writeAndHash(output, digest, sealed)
            totalRead += count
            chunkIndex += 1
          }
          if (totalRead != plaintextBytes) {
            throw DuemException(ErrorKind.OUTPUT_INVALID, "Source size changed")
          }
          output.fd.sync()
        }
      }
      Files.move(
        partial.toPath(),
        safeDestination.toPath(),
        StandardCopyOption.ATOMIC_MOVE,
        StandardCopyOption.REPLACE_EXISTING,
      )
      return EncryptionResult(
        encryptedPath = safeDestination.canonicalPath,
        encryptedBytes = safeDestination.length(),
        plaintextBytes = plaintextBytes,
        sha256 = digestHex(digest),
        formatVersion = VERSION,
      )
    } catch (error: DuemException) {
      partial.delete()
      throw error
    } catch (error: Exception) {
      partial.delete()
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Encryption failed", error)
    } finally {
      fileKey.fill(0)
    }
  }

  fun inspect(file: File): EncryptionResult {
    val safeFile = validatedPrivateFile(file)
    if (!safeFile.isFile) {
      throw DuemException(ErrorKind.SOURCE_NOT_FOUND, "Encrypted file does not exist")
    }
    val encryptedBytes = safeFile.length()
    if (encryptedBytes < HEADER_BYTES) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Encrypted file is truncated")
    }

    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(safeFile).use { input ->
      val headerBytes = readExactly(input, HEADER_BYTES, digest)
      val header = parseHeader(headerBytes)
      var remaining = encryptedBytes - HEADER_BYTES
      var totalPlaintext = 0L
      var records = 0

      while (remaining > 0) {
        if (remaining < UINT32_BYTES) {
          throw DuemException(ErrorKind.OUTPUT_INVALID, "Chunk length is truncated")
        }
        val lengthBytes = readExactly(input, UINT32_BYTES, digest)
        remaining -= UINT32_BYTES
        val plaintextLength = readUInt32(lengthBytes, 0)
        val recordBytes = plaintextLength + TAG_BYTES
        if (
          plaintextLength <= 0 ||
          plaintextLength > header.chunkSize ||
          recordBytes > remaining ||
          totalPlaintext > header.plaintextBytes - plaintextLength
        ) {
          throw DuemException(ErrorKind.OUTPUT_INVALID, "Chunk record is invalid")
        }
        hashExactly(input, recordBytes, digest)
        remaining -= recordBytes
        totalPlaintext += plaintextLength
        records += 1
      }
      if (
        records == 0 ||
        totalPlaintext != header.plaintextBytes ||
        input.read() != -1
      ) {
        throw DuemException(ErrorKind.OUTPUT_INVALID, "Encrypted size is invalid")
      }
      return EncryptionResult(
        encryptedPath = safeFile.canonicalPath,
        encryptedBytes = encryptedBytes,
        plaintextBytes = header.plaintextBytes,
        sha256 = digestHex(digest),
        formatVersion = header.version,
      )
    }
  }

  fun decrypt(
    data: ByteArray,
    masterKey: ByteArray,
    metadata: Metadata,
  ): ByteArray {
    validateKey(masterKey)
    validateMetadata(metadata)
    if (data.size < HEADER_BYTES) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Encrypted file is truncated")
    }
    val headerBytes = data.copyOfRange(0, HEADER_BYTES)
    val header = parseHeader(headerBytes)
    if (header.chunkSize != metadata.chunkSize) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Chunk size does not match")
    }
    val fileKey = deriveFileKey(masterKey, header.salt, metadata)
    val plaintext = ByteArrayOutputStream()
    var cursor = HEADER_BYTES
    var chunkIndex = 0L

    try {
      while (cursor < data.size) {
        if (cursor + UINT32_BYTES > data.size) {
          throw DuemException(ErrorKind.OUTPUT_INVALID, "Chunk length is truncated")
        }
        val plaintextLength = readUInt32(data, cursor)
        cursor += UINT32_BYTES
        val recordEnd = cursor.toLong() + plaintextLength + TAG_BYTES
        if (
          plaintextLength <= 0 ||
          plaintextLength > header.chunkSize ||
          recordEnd > data.size
        ) {
          throw DuemException(ErrorKind.OUTPUT_INVALID, "Chunk record is invalid")
        }
        val sealed = data.copyOfRange(cursor, recordEnd.toInt())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
          Cipher.DECRYPT_MODE,
          SecretKeySpec(fileKey, "AES"),
          GCMParameterSpec(TAG_BYTES * 8, nonce(header.noncePrefix, chunkIndex)),
        )
        cipher.updateAAD(
          chunkAad(
            header = header.bytes,
            metadata = metadata,
            index = chunkIndex,
            plaintextLength = plaintextLength.toInt(),
          ),
        )
        plaintext.write(cipher.doFinal(sealed))
        cursor = recordEnd.toInt()
        chunkIndex += 1
      }
      val result = plaintext.toByteArray()
      if (result.size.toLong() != header.plaintextBytes) {
        throw DuemException(ErrorKind.OUTPUT_INVALID, "Plaintext size is invalid")
      }
      return result
    } finally {
      fileKey.fill(0)
    }
  }

  fun delete(file: File) {
    val safeFile = validatedPrivateFile(file)
    if (!safeFile.exists()) {
      return
    }
    if (!safeFile.isFile || !safeFile.delete()) {
      throw DuemException(ErrorKind.DELETE_FAILED, "Encrypted file could not be deleted")
    }
  }

  internal fun validatedPrivateFile(file: File): File {
    val canonical = file.canonicalFile
    val isPrivate =
      roots.any { root ->
        canonical.path.startsWith("${root.path}${File.separator}")
      }
    if (!isPrivate) {
      throw DuemException(ErrorKind.PATH_NOT_PRIVATE, "Path is outside private storage")
    }
    return canonical
  }

  private fun validateMetadata(metadata: Metadata) {
    if (
      metadata.chunkSize <= 0 ||
      metadata.mediaKind !in MEDIA_KINDS
    ) {
      throw DuemException(ErrorKind.INVALID_INPUT, "Metadata is invalid")
    }
    lengthPrefixed(metadata.uid)
    lengthPrefixed(metadata.entryCommitId)
    lengthPrefixed(metadata.mediaId)
    lengthPrefixed(metadata.mediaKind)
  }

  private fun buildHeader(
    chunkSize: Int,
    plaintextBytes: Long,
    salt: ByteArray,
    noncePrefix: ByteArray,
  ): ByteArray {
    if (
      chunkSize <= 0 ||
      plaintextBytes <= 0 ||
      salt.size != SALT_BYTES ||
      noncePrefix.size != NONCE_PREFIX_BYTES
    ) {
      throw DuemException(ErrorKind.INVALID_INPUT, "Header values are invalid")
    }
    return ByteBuffer.allocate(HEADER_BYTES)
      .order(ByteOrder.BIG_ENDIAN)
      .put(MAGIC)
      .put(VERSION.toByte())
      .put(ALGORITHM.toByte())
      .putInt(chunkSize)
      .putLong(plaintextBytes)
      .put(salt)
      .put(noncePrefix)
      .array()
  }

  private fun parseHeader(data: ByteArray): ParsedHeader {
    if (data.size != HEADER_BYTES) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Header length is invalid")
    }
    val buffer = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
    val magic = ByteArray(MAGIC.size).also(buffer::get)
    val version = buffer.get().toInt() and 0xff
    val algorithm = buffer.get().toInt() and 0xff
    val chunkSize = buffer.int
    val plaintextBytes = buffer.long
    val salt = ByteArray(SALT_BYTES).also(buffer::get)
    val noncePrefix = ByteArray(NONCE_PREFIX_BYTES).also(buffer::get)
    if (
      !magic.contentEquals(MAGIC) ||
      version != VERSION ||
      algorithm != ALGORITHM ||
      chunkSize <= 0 ||
      plaintextBytes <= 0
    ) {
      throw DuemException(ErrorKind.OUTPUT_INVALID, "Header is invalid")
    }
    return ParsedHeader(
      version = version,
      chunkSize = chunkSize,
      plaintextBytes = plaintextBytes,
      salt = salt,
      noncePrefix = noncePrefix,
      bytes = data,
    )
  }

  private fun readChunk(
    input: FileInputStream,
    buffer: ByteArray,
  ): Int {
    var offset = 0
    while (offset < buffer.size) {
      val count = input.read(buffer, offset, buffer.size - offset)
      if (count == -1) {
        break
      }
      offset += count
    }
    return offset
  }

  private fun readExactly(
    input: FileInputStream,
    count: Int,
    digest: MessageDigest,
  ): ByteArray {
    val result = ByteArray(count)
    var offset = 0
    while (offset < count) {
      val read = input.read(result, offset, count - offset)
      if (read == -1) {
        throw EOFException("Unexpected end of DUEM file")
      }
      digest.update(result, offset, read)
      offset += read
    }
    return result
  }

  private fun hashExactly(
    input: FileInputStream,
    count: Long,
    digest: MessageDigest,
  ) {
    val buffer = ByteArray(minOf(STREAM_BUFFER_BYTES.toLong(), count).toInt())
    var remaining = count
    while (remaining > 0) {
      val expected = minOf(buffer.size.toLong(), remaining).toInt()
      val read = input.read(buffer, 0, expected)
      if (read == -1) {
        throw EOFException("Unexpected end of DUEM file")
      }
      digest.update(buffer, 0, read)
      remaining -= read
    }
  }

  private fun writeAndHash(
    output: FileOutputStream,
    digest: MessageDigest,
    bytes: ByteArray,
  ) {
    output.write(bytes)
    digest.update(bytes)
  }

  companion object {
    private val MAGIC = byteArrayOf(0x44, 0x55, 0x45, 0x4d)
    private const val VERSION = 1
    private const val ALGORITHM = 1
    private const val KEY_BYTES = 32
    private const val SALT_BYTES = 32
    private const val NONCE_PREFIX_BYTES = 8
    private const val TAG_BYTES = 16
    private const val UINT32_BYTES = 4
    private const val HEADER_BYTES = 58
    private const val STREAM_BUFFER_BYTES = 1024 * 1024
    private const val UINT32_MAX = 0xffff_ffffL
    private const val KEY_DOMAIN = "du-media-v1"
    private const val VERIFIER_DOMAIN = "du-account-key-verifier-v1"
    private val MEDIA_KINDS = setOf("photo", "audio", "ink")
    private val SECURE_RANDOM = SecureRandom()

    fun keyVerifier(
      uid: String,
      masterKey: ByteArray,
    ): String {
      validateKey(masterKey)
      val digest = MessageDigest.getInstance("SHA-256")
      digest.update(lengthPrefixed(VERIFIER_DOMAIN))
      digest.update(lengthPrefixed(uid))
      digest.update(masterKey)
      return digest.digest().hex()
    }

    private fun deriveFileKey(
      masterKey: ByteArray,
      salt: ByteArray,
      metadata: Metadata,
    ): ByteArray {
      validateKey(masterKey)
      val info =
        join(
          lengthPrefixed(KEY_DOMAIN),
          lengthPrefixed(metadata.uid),
          lengthPrefixed(metadata.mediaId),
          lengthPrefixed(metadata.mediaKind),
        )
      val extract = Mac.getInstance("HmacSHA256")
      extract.init(SecretKeySpec(salt, "HmacSHA256"))
      val pseudoRandomKey = extract.doFinal(masterKey)
      return try {
        val expand = Mac.getInstance("HmacSHA256")
        expand.init(SecretKeySpec(pseudoRandomKey, "HmacSHA256"))
        expand.doFinal(info + byteArrayOf(1)).copyOf(KEY_BYTES)
      } finally {
        pseudoRandomKey.fill(0)
      }
    }

    private fun chunkAad(
      header: ByteArray,
      metadata: Metadata,
      index: Long,
      plaintextLength: Int,
    ): ByteArray =
      join(
        header,
        lengthPrefixed(metadata.entryCommitId),
        lengthPrefixed(metadata.mediaId),
        lengthPrefixed(metadata.mediaKind),
        uint32(index),
        uint32(plaintextLength.toLong()),
      )

    private fun nonce(
      prefix: ByteArray,
      index: Long,
    ): ByteArray = join(prefix, uint32(index))

    private fun lengthPrefixed(value: String): ByteArray {
      val encoded = value.toByteArray(Charsets.UTF_8)
      if (encoded.isEmpty() || encoded.size > 0xffff) {
        throw DuemException(ErrorKind.INVALID_INPUT, "Metadata field is invalid")
      }
      return ByteBuffer.allocate(2 + encoded.size)
        .order(ByteOrder.BIG_ENDIAN)
        .putShort(encoded.size.toShort())
        .put(encoded)
        .array()
    }

    private fun uint32(value: Long): ByteArray {
      if (value !in 0..UINT32_MAX) {
        throw DuemException(ErrorKind.INVALID_INPUT, "Unsigned integer is invalid")
      }
      return ByteBuffer.allocate(UINT32_BYTES)
        .order(ByteOrder.BIG_ENDIAN)
        .putInt(value.toInt())
        .array()
    }

    private fun readUInt32(
      data: ByteArray,
      offset: Int,
    ): Long {
      if (offset < 0 || offset + UINT32_BYTES > data.size) {
        throw DuemException(ErrorKind.OUTPUT_INVALID, "Unsigned integer is truncated")
      }
      return ByteBuffer.wrap(data, offset, UINT32_BYTES)
        .order(ByteOrder.BIG_ENDIAN)
        .int
        .toLong() and UINT32_MAX
    }

    private fun validateKey(masterKey: ByteArray) {
      if (masterKey.size != KEY_BYTES) {
        throw DuemException(ErrorKind.KEY_INVALID, "Master key length is invalid")
      }
    }

    private fun join(vararg values: ByteArray): ByteArray {
      val output = ByteArrayOutputStream()
      values.forEach(output::write)
      return output.toByteArray()
    }

    private fun secureRandomBytes(count: Int): ByteArray =
      ByteArray(count).also(SECURE_RANDOM::nextBytes)

    private fun digestHex(digest: MessageDigest): String = digest.digest().hex()

    private fun ByteArray.hex(): String =
      joinToString(separator = "") { "%02x".format(it.toInt() and 0xff) }
  }
}
