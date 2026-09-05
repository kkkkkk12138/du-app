import Foundation
import React

@objc(DuMediaCrypto)
final class DuMediaCrypto: NSObject {
  @objc(generateRandomKey:rejecter:)
  func generateRandomKey(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) {
      try DuemCipher.randomKey().base64EncodedString()
    }
  }

  @objc(keyVerifier:masterKeyBase64:resolver:rejecter:)
  func keyVerifier(
    _ uid: String,
    masterKeyBase64: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) {
      let key = try self.masterKey(masterKeyBase64)
      return try DuemCipher.keyVerifier(uid: uid, masterKey: key)
    }
  }

  @objc(encryptMediaFile:resolver:rejecter:)
  func encryptMediaFile(
    _ input: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) {
      let sourcePath = try self.string(input, "sourcePath")
      let destinationPath = try self.string(input, "destinationPath")
      let key = try self.masterKey(
        try self.string(input, "masterKeyBase64")
      )
      let metadata = try self.metadata(input)
      return try DuemCipher.encrypt(
        sourceURL: URL(fileURLWithPath: sourcePath),
        destinationURL: URL(fileURLWithPath: destinationPath),
        masterKey: key,
        metadata: metadata
      ).dictionary
    }
  }

  @objc(inspectEncryptedFile:resolver:rejecter:)
  func inspectEncryptedFile(
    _ path: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) {
      try DuemCipher.inspect(
        url: URL(fileURLWithPath: path)
      ).dictionary
    }
  }

  @objc(deleteEncryptedFile:resolver:rejecter:)
  func deleteEncryptedFile(
    _ path: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) {
      try DuemCipher.delete(url: URL(fileURLWithPath: path))
      return nil
    }
  }

  private func run(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
    operation: @escaping () throws -> Any?
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        resolve(try operation())
      } catch {
        let failure = self.failure(error)
        reject(failure.code, failure.message, error)
      }
    }
  }

  private func masterKey(_ encoded: String) throws -> Data {
    guard
      let key = Data(base64Encoded: encoded),
      key.count == 32
    else {
      throw DuemCipherError.invalidKey
    }
    return key
  }

  private func metadata(_ input: NSDictionary) throws -> DuemMetadata {
    let kind = try string(input, "mediaKind")
    guard
      let chunkNumber = input["chunkSize"] as? NSNumber,
      chunkNumber.intValue > 0
    else {
      throw DuemCipherError.invalidInput
    }
    return DuemMetadata(
      uid: try string(input, "uid"),
      entryCommitId: try string(input, "entryCommitId"),
      mediaId: try string(input, "mediaId"),
      mediaKind: kind,
      chunkSize: chunkNumber.intValue
    )
  }

  private func string(
    _ input: NSDictionary,
    _ key: String
  ) throws -> String {
    guard let value = input[key] as? String, !value.isEmpty else {
      throw DuemCipherError.invalidInput
    }
    return value
  }

  private func failure(_ error: Error) -> (code: String, message: String) {
    guard let error = error as? DuemCipherError else {
      return ("ENCRYPTION_FAILED", "媒体加密失败")
    }
    switch error {
    case .sourceNotFound:
      return ("SOURCE_NOT_FOUND", "本地媒体文件不存在")
    case .invalidKey:
      return ("KEY_INVALID", "账号主密钥无效")
    case .pathNotPrivate:
      return ("PATH_NOT_PRIVATE", "媒体路径不在应用私有目录")
    case .invalidInput, .outputInvalid:
      return ("OUTPUT_INVALID", "媒体密文格式无效")
    case .deleteFailed:
      return ("DELETE_FAILED", "无法删除媒体密文")
    }
  }
}
