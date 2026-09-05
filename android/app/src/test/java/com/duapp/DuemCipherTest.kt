package com.duapp

import java.io.File
import java.nio.file.Files
import java.util.Base64
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DuemCipherTest {
  private data class Vector(
    val key: ByteArray,
    val uid: String,
    val entryCommitId: String,
    val mediaId: String,
    val mediaKind: String,
    val chunkSize: Int,
    val plaintext: ByteArray,
    val salt: ByteArray,
    val noncePrefix: ByteArray,
    val encrypted: ByteArray,
    val sha256: String,
    val keyVerifier: String,
  )

  @Test
  fun matchesSharedDuemV1Vector() {
    withFixture { vector, cipher, source, destination ->
      source.writeBytes(vector.plaintext)

      val result =
        cipher.encrypt(
          source = source,
          destination = destination,
          masterKey = vector.key,
          metadata = metadata(vector),
        )

      assertArrayEquals(vector.encrypted, destination.readBytes())
      assertEquals(destination.canonicalPath, result.encryptedPath)
      assertEquals(vector.encrypted.size.toLong(), result.encryptedBytes)
      assertEquals(vector.plaintext.size.toLong(), result.plaintextBytes)
      assertEquals(vector.sha256, result.sha256)
      assertEquals(1, result.formatVersion)
    }
  }

  @Test
  fun inspectsAndDecryptsSharedVector() {
    withFixture { vector, cipher, _, destination ->
      destination.writeBytes(vector.encrypted)

      val inspection = cipher.inspect(destination)
      val decrypted =
        cipher.decrypt(
          data = vector.encrypted,
          masterKey = vector.key,
          metadata = metadata(vector),
        )

      assertEquals(vector.encrypted.size.toLong(), inspection.encryptedBytes)
      assertEquals(vector.plaintext.size.toLong(), inspection.plaintextBytes)
      assertEquals(vector.sha256, inspection.sha256)
      assertArrayEquals(vector.plaintext, decrypted)
    }
  }

  @Test
  fun rejectsCiphertextTampering() {
    withFixture { vector, cipher, _, _ ->
      val tampered = vector.encrypted.copyOf()
      tampered[62] = (tampered[62].toInt() xor 1).toByte()

      assertThrows(Exception::class.java) {
        cipher.decrypt(
          data = tampered,
          masterKey = vector.key,
          metadata = metadata(vector),
        )
      }
    }
  }

  @Test
  fun matchesSharedAccountKeyVerifier() {
    val vector = loadVector()
    assertEquals(
      vector.keyVerifier,
      DuemCipher.keyVerifier(vector.uid, vector.key),
    )
  }

  @Test
  fun rejectsPrivateRootAndSymlinkEscapes() {
    val root = Files.createTempDirectory("duem-path-test").toFile()
    val cipher = DuemCipher(privateRoots = listOf(root))
    try {
      assertThrows(DuemCipher.DuemException::class.java) {
        cipher.validatedPrivateFile(root)
      }
      val link = File(root, "escape")
      Files.createSymbolicLink(link.toPath(), File("/etc").toPath())
      assertThrows(DuemCipher.DuemException::class.java) {
        cipher.validatedPrivateFile(File(link, "hosts"))
      }
    } finally {
      root.deleteRecursively()
    }
  }

  @Test
  fun deleteRejectsDirectories() {
    val root = Files.createTempDirectory("duem-delete-test").toFile()
    val directory = File(root, "not-a-file").apply { mkdirs() }
    val cipher = DuemCipher(privateRoots = listOf(root))
    try {
      assertThrows(DuemCipher.DuemException::class.java) {
        cipher.delete(directory)
      }
      assertEquals(true, directory.isDirectory)
    } finally {
      root.deleteRecursively()
    }
  }

  private fun metadata(vector: Vector) =
    DuemCipher.Metadata(
      uid = vector.uid,
      entryCommitId = vector.entryCommitId,
      mediaId = vector.mediaId,
      mediaKind = vector.mediaKind,
      chunkSize = vector.chunkSize,
    )

  private fun withFixture(
    block: (Vector, DuemCipher, File, File) -> Unit,
  ) {
    val vector = loadVector()
    val root = Files.createTempDirectory("duem-test").toFile()
    val source = File(root, "source.bin")
    val destination = File(root, "encrypted.duem")
    var entropyCall = 0
    val cipher =
      DuemCipher(
        privateRoots = listOf(root),
        randomBytes = { count ->
          entropyCall += 1
          when {
            entropyCall == 1 && count == 32 -> vector.salt.copyOf()
            entropyCall == 2 && count == 8 -> vector.noncePrefix.copyOf()
            else -> error("Unexpected entropy request: $count")
          }
        },
      )
    try {
      block(vector, cipher, source, destination)
    } finally {
      root.deleteRecursively()
    }
  }

  private fun loadVector(): Vector {
    val vectorFile =
      generateSequence(
        File(requireNotNull(System.getProperty("user.dir"))).canonicalFile,
      ) {
        it.parentFile
      }.map { File(it, "test-fixtures/duem-v1-vector.json") }
        .first { it.isFile }
    val json = JSONObject(vectorFile.readText())
    return Vector(
      key = Base64.getDecoder().decode(json.getString("keyBase64")),
      uid = json.getString("uid"),
      entryCommitId = json.getString("entryCommitId"),
      mediaId = json.getString("mediaId"),
      mediaKind = json.getString("mediaKind"),
      chunkSize = json.getInt("chunkSize"),
      plaintext =
        Base64.getDecoder().decode(json.getString("plaintextBase64")),
      salt = json.getString("saltHex").hexBytes(),
      noncePrefix = json.getString("noncePrefixHex").hexBytes(),
      encrypted =
        Base64.getDecoder().decode(json.getString("encryptedBase64")),
      sha256 = json.getString("sha256"),
      keyVerifier = json.getString("keyVerifier"),
    )
  }
}

private fun String.hexBytes(): ByteArray {
  require(length % 2 == 0)
  return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
