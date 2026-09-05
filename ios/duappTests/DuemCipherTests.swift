import Foundation
import XCTest
@testable import duapp

final class DuemCipherTests: XCTestCase {
  private struct Vector: Decodable {
    let keyBase64: String
    let uid: String
    let entryCommitId: String
    let mediaId: String
    let mediaKind: String
    let chunkSize: Int
    let plaintextBase64: String
    let saltHex: String
    let noncePrefixHex: String
    let encryptedBase64: String
    let sha256: String
    let keyVerifier: String
  }

  private var projectRoot: URL {
    URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
  }

  private func loadVector() throws -> Vector {
    let url = projectRoot
      .appendingPathComponent("test-fixtures")
      .appendingPathComponent("duem-v1-vector.json")
    return try JSONDecoder().decode(
      Vector.self,
      from: Data(contentsOf: url)
    )
  }

  private func metadata(_ vector: Vector) -> DuemMetadata {
    DuemMetadata(
      uid: vector.uid,
      entryCommitId: vector.entryCommitId,
      mediaId: vector.mediaId,
      mediaKind: vector.mediaKind,
      chunkSize: vector.chunkSize
    )
  }

  func testMatchesTheSharedDuemV1Vector() throws {
    let vector = try loadVector()
    let plaintext = try XCTUnwrap(Data(base64Encoded: vector.plaintextBase64))
    let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64))
    let salt = try XCTUnwrap(Data(hex: vector.saltHex))
    let noncePrefix = try XCTUnwrap(Data(hex: vector.noncePrefixHex))
    let expected = try XCTUnwrap(Data(base64Encoded: vector.encryptedBase64))
    let source = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
    let destination = FileManager.default.temporaryDirectory
      .appendingPathComponent("\(UUID().uuidString).enc")
    try plaintext.write(to: source)
    defer {
      try? FileManager.default.removeItem(at: source)
      try? FileManager.default.removeItem(at: destination)
    }

    let result = try DuemCipher.encrypt(
      sourceURL: source,
      destinationURL: destination,
      masterKey: key,
      metadata: metadata(vector),
      salt: salt,
      noncePrefix: noncePrefix
    )

    XCTAssertEqual(try Data(contentsOf: destination), expected)
    XCTAssertEqual(result.encryptedPath, destination.path)
    XCTAssertEqual(result.encryptedBytes, expected.count)
    XCTAssertEqual(result.plaintextBytes, plaintext.count)
    XCTAssertEqual(result.sha256, vector.sha256)
    XCTAssertEqual(result.formatVersion, 1)
  }

  func testInspectsAndDecryptsTheSharedVector() throws {
    let vector = try loadVector()
    let encrypted = try XCTUnwrap(Data(base64Encoded: vector.encryptedBase64))
    let plaintext = try XCTUnwrap(Data(base64Encoded: vector.plaintextBase64))
    let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64))
    let destination = FileManager.default.temporaryDirectory
      .appendingPathComponent("\(UUID().uuidString).enc")
    try encrypted.write(to: destination)
    defer { try? FileManager.default.removeItem(at: destination) }

    let inspection = try DuemCipher.inspect(url: destination)
    let decrypted = try DuemCipher.decrypt(
      data: encrypted,
      masterKey: key,
      metadata: metadata(vector)
    )

    XCTAssertEqual(inspection.encryptedBytes, encrypted.count)
    XCTAssertEqual(inspection.plaintextBytes, plaintext.count)
    XCTAssertEqual(inspection.sha256, vector.sha256)
    XCTAssertEqual(decrypted, plaintext)
  }

  func testRejectsCiphertextTampering() throws {
    let vector = try loadVector()
    var encrypted = try XCTUnwrap(Data(base64Encoded: vector.encryptedBase64))
    let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64))
    encrypted[62] ^= 0x01

    XCTAssertThrowsError(
      try DuemCipher.decrypt(
        data: encrypted,
        masterKey: key,
        metadata: metadata(vector)
      )
    )
  }

  func testMatchesTheSharedAccountKeyVerifier() throws {
    let vector = try loadVector()
    let key = try XCTUnwrap(Data(base64Encoded: vector.keyBase64))

    XCTAssertEqual(
      try DuemCipher.keyVerifier(uid: vector.uid, masterKey: key),
      vector.keyVerifier
    )
  }

  func testInspectDoesNotAccumulateTheWholeCiphertext() throws {
    let sourceURL = projectRoot
      .appendingPathComponent("ios/duapp/DuemCipher.swift")
    let source = try String(contentsOf: sourceURL, encoding: .utf8)
    let inspectStart = try XCTUnwrap(
      source.range(of: "static func inspect(url:")
    )
    let decryptStart = try XCTUnwrap(
      source.range(
        of: "static func decrypt(",
        range: inspectStart.upperBound..<source.endIndex
      )
    )
    let implementation = source[
      inspectStart.lowerBound..<decryptStart.lowerBound
    ]

    XCTAssertFalse(implementation.contains("var data = Data()"))
    XCTAssertFalse(implementation.contains("data.append(chunk)"))
  }

  func testRejectsContainerRootAndSymlinkEscapes() throws {
    XCTAssertThrowsError(
      try DuemCipher.validatedPrivateURL(
        URL(fileURLWithPath: NSHomeDirectory())
      )
    )

    let link = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
    try FileManager.default.createSymbolicLink(
      at: link,
      withDestinationURL: URL(fileURLWithPath: "/etc")
    )
    defer { try? FileManager.default.removeItem(at: link) }

    XCTAssertThrowsError(
      try DuemCipher.validatedPrivateURL(
        link.appendingPathComponent("hosts")
      )
    )
  }
}

private extension Data {
  init?(hex: String) {
    guard hex.count.isMultiple(of: 2) else {
      return nil
    }
    var bytes = [UInt8]()
    bytes.reserveCapacity(hex.count / 2)
    var index = hex.startIndex
    while index < hex.endIndex {
      let next = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<next], radix: 16) else {
        return nil
      }
      bytes.append(byte)
      index = next
    }
    self.init(bytes)
  }
}
