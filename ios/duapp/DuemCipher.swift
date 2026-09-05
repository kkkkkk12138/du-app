import CryptoKit
import Foundation
import Security

struct DuemMetadata {
  let uid: String
  let entryCommitId: String
  let mediaId: String
  let mediaKind: String
  let chunkSize: Int
}

struct DuemEncryptionResult {
  let encryptedPath: String
  let encryptedBytes: Int
  let plaintextBytes: Int
  let sha256: String
  let formatVersion: Int

  var dictionary: [String: Any] {
    [
      "encryptedPath": encryptedPath,
      "encryptedBytes": encryptedBytes,
      "plaintextBytes": plaintextBytes,
      "sha256": sha256,
      "formatVersion": formatVersion,
    ]
  }
}

enum DuemCipherError: Error {
  case sourceNotFound
  case invalidKey
  case pathNotPrivate
  case invalidInput
  case outputInvalid
  case deleteFailed
}

enum DuemCipher {
  private static let magic = Data([0x44, 0x55, 0x45, 0x4d])
  private static let version: UInt8 = 1
  private static let algorithm: UInt8 = 1
  private static let headerBytes = 58
  private static let saltBytes = 32
  private static let noncePrefixBytes = 8
  private static let tagBytes = 16
  private static let mediaKinds = Set(["photo", "audio", "ink"])
  private static let keyDomain = "du-media-v1"
  private static let verifierDomain = "du-account-key-verifier-v1"

  static func randomKey() throws -> Data {
    try randomBytes(count: 32)
  }

  static func keyVerifier(uid: String, masterKey: Data) throws -> String {
    guard masterKey.count == 32 else {
      throw DuemCipherError.invalidKey
    }
    var payload = Data()
    payload.append(try lengthPrefixed(verifierDomain))
    payload.append(try lengthPrefixed(uid))
    payload.append(masterKey)
    return Data(SHA256.hash(data: payload)).hexString
  }

  static func encrypt(
    sourceURL: URL,
    destinationURL: URL,
    masterKey: Data,
    metadata: DuemMetadata,
    salt suppliedSalt: Data? = nil,
    noncePrefix suppliedNoncePrefix: Data? = nil
  ) throws -> DuemEncryptionResult {
    let source = try validatedPrivateURL(sourceURL)
    let destination = try validatedPrivateURL(destinationURL)
    guard FileManager.default.fileExists(atPath: source.path) else {
      throw DuemCipherError.sourceNotFound
    }
    guard masterKey.count == 32 else {
      throw DuemCipherError.invalidKey
    }
    try validate(metadata)

    let attributes = try FileManager.default.attributesOfItem(
      atPath: source.path
    )
    guard
      let sourceSize = attributes[.size] as? NSNumber,
      sourceSize.uint64Value > 0,
      sourceSize.uint64Value <= UInt64(Int.max)
    else {
      throw DuemCipherError.invalidInput
    }
    let plaintextBytes = Int(sourceSize.uint64Value)
    let salt = try suppliedSalt ?? randomBytes(count: saltBytes)
    let noncePrefix =
      try suppliedNoncePrefix ?? randomBytes(count: noncePrefixBytes)
    guard
      salt.count == saltBytes,
      noncePrefix.count == noncePrefixBytes
    else {
      throw DuemCipherError.invalidInput
    }

    let header = try buildHeader(
      chunkSize: metadata.chunkSize,
      plaintextBytes: plaintextBytes,
      salt: salt,
      noncePrefix: noncePrefix
    )
    let fileKey = try deriveFileKey(
      masterKey: masterKey,
      salt: salt,
      metadata: metadata
    )
    let partial = URL(fileURLWithPath: "\(destination.path).partial")
    let fileManager = FileManager.default
    try fileManager.createDirectory(
      at: destination.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    try? fileManager.removeItem(at: partial)
    guard fileManager.createFile(atPath: partial.path, contents: nil) else {
      throw DuemCipherError.outputInvalid
    }

    do {
      let input = try FileHandle(forReadingFrom: source)
      let output = try FileHandle(forWritingTo: partial)
      defer {
        try? input.close()
        try? output.close()
      }
      var hasher = SHA256()
      try write(header, to: output, hasher: &hasher)
      var totalRead = 0
      var chunkIndex: UInt32 = 0

      while
        let chunk = try input.read(upToCount: metadata.chunkSize),
        !chunk.isEmpty
      {
        guard chunkIndex < UInt32.max else {
          throw DuemCipherError.invalidInput
        }
        let nonce = try AES.GCM.Nonce(
          data: nonceData(prefix: noncePrefix, index: chunkIndex)
        )
        let aad = try chunkAAD(
          header: header,
          metadata: metadata,
          index: chunkIndex,
          plaintextLength: chunk.count
        )
        let sealed = try AES.GCM.seal(
          chunk,
          using: fileKey,
          nonce: nonce,
          authenticating: aad
        )
        var record = Data()
        record.append(uint32Data(UInt32(chunk.count)))
        record.append(sealed.ciphertext)
        record.append(sealed.tag)
        try write(record, to: output, hasher: &hasher)
        totalRead += chunk.count
        chunkIndex += 1
      }

      guard totalRead == plaintextBytes else {
        throw DuemCipherError.outputInvalid
      }
      try output.synchronize()
      try output.close()
      try input.close()

      if fileManager.fileExists(atPath: destination.path) {
        try fileManager.removeItem(at: destination)
      }
      try fileManager.moveItem(at: partial, to: destination)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      var mutableDestination = destination
      try mutableDestination.setResourceValues(values)

      let encryptedBytes = try fileSize(destination)
      return DuemEncryptionResult(
        encryptedPath: destination.path,
        encryptedBytes: encryptedBytes,
        plaintextBytes: plaintextBytes,
        sha256: Data(hasher.finalize()).hexString,
        formatVersion: Int(version)
      )
    } catch {
      try? fileManager.removeItem(at: partial)
      throw error
    }
  }

  static func inspect(url: URL) throws -> DuemEncryptionResult {
    let fileURL = try validatedPrivateURL(url)
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      throw DuemCipherError.sourceNotFound
    }
    let encryptedBytes = try fileSize(fileURL)
    guard encryptedBytes >= headerBytes else {
      throw DuemCipherError.outputInvalid
    }
    let input = try FileHandle(forReadingFrom: fileURL)
    defer { try? input.close() }
    var hasher = SHA256()
    let header = try readExactly(
      count: headerBytes,
      from: input,
      hasher: &hasher
    )
    let parsedHeader = try parseHeader(header)
    var remainingBytes = encryptedBytes - headerBytes
    var totalPlaintext = 0
    var recordCount = 0

    while remainingBytes > 0 {
      guard remainingBytes >= 4 else {
        throw DuemCipherError.outputInvalid
      }
      let lengthData = try readExactly(
        count: 4,
        from: input,
        hasher: &hasher
      )
      remainingBytes -= 4
      let plaintextLength = Int(try readUInt32(lengthData, offset: 0))
      let recordBytes = plaintextLength + tagBytes
      guard
        plaintextLength > 0,
        plaintextLength <= parsedHeader.chunkSize,
        recordBytes <= remainingBytes,
        totalPlaintext <= parsedHeader.plaintextBytes - plaintextLength
      else {
        throw DuemCipherError.outputInvalid
      }
      try hashExactly(
        count: recordBytes,
        from: input,
        hasher: &hasher
      )
      remainingBytes -= recordBytes
      totalPlaintext += plaintextLength
      recordCount += 1
    }
    guard
      recordCount > 0,
      totalPlaintext == parsedHeader.plaintextBytes,
      try input.read(upToCount: 1)?.isEmpty != false
    else {
      throw DuemCipherError.outputInvalid
    }
    return DuemEncryptionResult(
      encryptedPath: fileURL.path,
      encryptedBytes: encryptedBytes,
      plaintextBytes: parsedHeader.plaintextBytes,
      sha256: Data(hasher.finalize()).hexString,
      formatVersion: Int(parsedHeader.version)
    )
  }

  static func decrypt(
    data: Data,
    masterKey: Data,
    metadata: DuemMetadata
  ) throws -> Data {
    guard masterKey.count == 32 else {
      throw DuemCipherError.invalidKey
    }
    try validate(metadata)
    let parsed = try parse(data)
    guard parsed.chunkSize == metadata.chunkSize else {
      throw DuemCipherError.outputInvalid
    }
    let fileKey = try deriveFileKey(
      masterKey: masterKey,
      salt: parsed.salt,
      metadata: metadata
    )
    var plaintext = Data()

    for record in parsed.records {
      let nonce = try AES.GCM.Nonce(
        data: nonceData(
          prefix: parsed.noncePrefix,
          index: record.index
        )
      )
      let sealed = try AES.GCM.SealedBox(
        nonce: nonce,
        ciphertext: record.ciphertext,
        tag: record.tag
      )
      plaintext.append(
        try AES.GCM.open(
          sealed,
          using: fileKey,
          authenticating: chunkAAD(
            header: parsed.header,
            metadata: metadata,
            index: record.index,
            plaintextLength: record.plaintextLength
          )
        )
      )
    }
    guard plaintext.count == parsed.plaintextBytes else {
      throw DuemCipherError.outputInvalid
    }
    return plaintext
  }

  static func delete(url: URL) throws {
    let fileURL = try validatedPrivateURL(url)
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      return
    }
    do {
      try FileManager.default.removeItem(at: fileURL)
    } catch {
      throw DuemCipherError.deleteFailed
    }
  }

  private struct ParsedRecord {
    let index: UInt32
    let plaintextLength: Int
    let ciphertext: Data
    let tag: Data
  }

  private struct ParsedFile {
    let version: UInt8
    let chunkSize: Int
    let plaintextBytes: Int
    let salt: Data
    let noncePrefix: Data
    let header: Data
    let records: [ParsedRecord]
  }

  private struct ParsedHeader {
    let version: UInt8
    let chunkSize: Int
    let plaintextBytes: Int
    let salt: Data
    let noncePrefix: Data
    let data: Data
  }

  private static func parseHeader(_ data: Data) throws -> ParsedHeader {
    guard
      data.count == headerBytes,
      data.subdata(in: 0..<4) == magic,
      data[4] == version,
      data[5] == algorithm
    else {
      throw DuemCipherError.outputInvalid
    }
    let chunkSize = Int(try readUInt32(data, offset: 6))
    let plaintextValue = try readUInt64(data, offset: 10)
    guard
      chunkSize > 0,
      plaintextValue > 0,
      plaintextValue <= UInt64(Int.max)
    else {
      throw DuemCipherError.outputInvalid
    }
    let plaintextBytes = Int(plaintextValue)
    let salt = data.subdata(in: 18..<50)
    let noncePrefix = data.subdata(in: 50..<58)
    return ParsedHeader(
      version: version,
      chunkSize: chunkSize,
      plaintextBytes: plaintextBytes,
      salt: salt,
      noncePrefix: noncePrefix,
      data: data
    )
  }

  private static func parse(_ data: Data) throws -> ParsedFile {
    guard data.count >= headerBytes else {
      throw DuemCipherError.outputInvalid
    }
    let parsedHeader = try parseHeader(data.subdata(in: 0..<headerBytes))
    var records: [ParsedRecord] = []
    var cursor = headerBytes
    var totalPlaintext = 0
    var index: UInt32 = 0

    while cursor < data.count {
      let length = Int(try readUInt32(data, offset: cursor))
      cursor += 4
      let end = cursor + length + tagBytes
      guard
        length > 0,
        length <= parsedHeader.chunkSize,
        end <= data.count
      else {
        throw DuemCipherError.outputInvalid
      }
      records.append(
        ParsedRecord(
          index: index,
          plaintextLength: length,
          ciphertext: data.subdata(in: cursor..<(cursor + length)),
          tag: data.subdata(in: (cursor + length)..<end)
        )
      )
      totalPlaintext += length
      cursor = end
      guard index < UInt32.max else {
        throw DuemCipherError.outputInvalid
      }
      index += 1
    }
    guard
      !records.isEmpty,
      totalPlaintext == parsedHeader.plaintextBytes
    else {
      throw DuemCipherError.outputInvalid
    }
    return ParsedFile(
      version: parsedHeader.version,
      chunkSize: parsedHeader.chunkSize,
      plaintextBytes: parsedHeader.plaintextBytes,
      salt: parsedHeader.salt,
      noncePrefix: parsedHeader.noncePrefix,
      header: parsedHeader.data,
      records: records
    )
  }

  private static func validate(_ metadata: DuemMetadata) throws {
    guard
      metadata.chunkSize > 0,
      metadata.chunkSize <= Int(UInt32.max),
      mediaKinds.contains(metadata.mediaKind)
    else {
      throw DuemCipherError.invalidInput
    }
    _ = try lengthPrefixed(metadata.uid)
    _ = try lengthPrefixed(metadata.entryCommitId)
    _ = try lengthPrefixed(metadata.mediaId)
    _ = try lengthPrefixed(metadata.mediaKind)
  }

  private static func buildHeader(
    chunkSize: Int,
    plaintextBytes: Int,
    salt: Data,
    noncePrefix: Data
  ) throws -> Data {
    guard
      chunkSize > 0,
      chunkSize <= Int(UInt32.max),
      plaintextBytes > 0
    else {
      throw DuemCipherError.invalidInput
    }
    var header = Data()
    header.append(magic)
    header.append(version)
    header.append(algorithm)
    header.append(uint32Data(UInt32(chunkSize)))
    header.append(uint64Data(UInt64(plaintextBytes)))
    header.append(salt)
    header.append(noncePrefix)
    guard header.count == headerBytes else {
      throw DuemCipherError.outputInvalid
    }
    return header
  }

  private static func deriveFileKey(
    masterKey: Data,
    salt: Data,
    metadata: DuemMetadata
  ) throws -> SymmetricKey {
    var info = Data()
    info.append(try lengthPrefixed(keyDomain))
    info.append(try lengthPrefixed(metadata.uid))
    info.append(try lengthPrefixed(metadata.mediaId))
    info.append(try lengthPrefixed(metadata.mediaKind))
    return HKDF<SHA256>.deriveKey(
      inputKeyMaterial: SymmetricKey(data: masterKey),
      salt: salt,
      info: info,
      outputByteCount: 32
    )
  }

  private static func chunkAAD(
    header: Data,
    metadata: DuemMetadata,
    index: UInt32,
    plaintextLength: Int
  ) throws -> Data {
    var aad = Data()
    aad.append(header)
    aad.append(try lengthPrefixed(metadata.entryCommitId))
    aad.append(try lengthPrefixed(metadata.mediaId))
    aad.append(try lengthPrefixed(metadata.mediaKind))
    aad.append(uint32Data(index))
    aad.append(uint32Data(UInt32(plaintextLength)))
    return aad
  }

  private static func nonceData(prefix: Data, index: UInt32) -> Data {
    var nonce = Data()
    nonce.append(prefix)
    nonce.append(uint32Data(index))
    return nonce
  }

  private static func lengthPrefixed(_ value: String) throws -> Data {
    let encoded = Data(value.utf8)
    guard !encoded.isEmpty, encoded.count <= Int(UInt16.max) else {
      throw DuemCipherError.invalidInput
    }
    var result = Data()
    result.append(uint16Data(UInt16(encoded.count)))
    result.append(encoded)
    return result
  }

  private static func randomBytes(count: Int) throws -> Data {
    var bytes = [UInt8](repeating: 0, count: count)
    guard
      SecRandomCopyBytes(kSecRandomDefault, count, &bytes) == errSecSuccess
    else {
      throw DuemCipherError.outputInvalid
    }
    return Data(bytes)
  }

  static func validatedPrivateURL(_ url: URL) throws -> URL {
    guard url.isFileURL else {
      throw DuemCipherError.pathNotPrivate
    }
    let normalized = url.standardizedFileURL.resolvingSymlinksInPath()
    let home = URL(fileURLWithPath: NSHomeDirectory())
      .standardizedFileURL
      .resolvingSymlinksInPath()
      .path
    let temporary = FileManager.default.temporaryDirectory
      .standardizedFileURL
      .resolvingSymlinksInPath()
      .path
    let path = normalized.path
    let isPrivate =
      path.hasPrefix("\(home)/") ||
      path.hasPrefix("\(temporary)/")
    guard isPrivate else {
      throw DuemCipherError.pathNotPrivate
    }
    return normalized
  }

  private static func fileSize(_ url: URL) throws -> Int {
    let attributes = try FileManager.default.attributesOfItem(
      atPath: url.path
    )
    guard
      let size = attributes[.size] as? NSNumber,
      size.uint64Value <= UInt64(Int.max)
    else {
      throw DuemCipherError.outputInvalid
    }
    return Int(size.uint64Value)
  }

  private static func write(
    _ data: Data,
    to output: FileHandle,
    hasher: inout SHA256
  ) throws {
    try output.write(contentsOf: data)
    hasher.update(data: data)
  }

  private static func readExactly(
    count: Int,
    from input: FileHandle,
    hasher: inout SHA256
  ) throws -> Data {
    var result = Data()
    result.reserveCapacity(count)
    while result.count < count {
      guard
        let chunk = try input.read(upToCount: count - result.count),
        !chunk.isEmpty
      else {
        throw DuemCipherError.outputInvalid
      }
      result.append(chunk)
      hasher.update(data: chunk)
    }
    return result
  }

  private static func hashExactly(
    count: Int,
    from input: FileHandle,
    hasher: inout SHA256
  ) throws {
    var remaining = count
    while remaining > 0 {
      guard
        let chunk = try input.read(upToCount: min(remaining, 1024 * 1024)),
        !chunk.isEmpty
      else {
        throw DuemCipherError.outputInvalid
      }
      hasher.update(data: chunk)
      remaining -= chunk.count
    }
  }

  private static func uint16Data(_ value: UInt16) -> Data {
    Data([
      UInt8((value >> 8) & 0xff),
      UInt8(value & 0xff),
    ])
  }

  private static func uint32Data(_ value: UInt32) -> Data {
    Data([
      UInt8((value >> 24) & 0xff),
      UInt8((value >> 16) & 0xff),
      UInt8((value >> 8) & 0xff),
      UInt8(value & 0xff),
    ])
  }

  private static func uint64Data(_ value: UInt64) -> Data {
    Data([
      UInt8((value >> 56) & 0xff),
      UInt8((value >> 48) & 0xff),
      UInt8((value >> 40) & 0xff),
      UInt8((value >> 32) & 0xff),
      UInt8((value >> 24) & 0xff),
      UInt8((value >> 16) & 0xff),
      UInt8((value >> 8) & 0xff),
      UInt8(value & 0xff),
    ])
  }

  private static func readUInt32(_ data: Data, offset: Int) throws -> UInt32 {
    guard offset >= 0, offset + 4 <= data.count else {
      throw DuemCipherError.outputInvalid
    }
    return data[offset..<(offset + 4)].reduce(UInt32(0)) {
      ($0 << 8) | UInt32($1)
    }
  }

  private static func readUInt64(_ data: Data, offset: Int) throws -> UInt64 {
    guard offset >= 0, offset + 8 <= data.count else {
      throw DuemCipherError.outputInvalid
    }
    return data[offset..<(offset + 8)].reduce(UInt64(0)) {
      ($0 << 8) | UInt64($1)
    }
  }
}

private extension Data {
  var hexString: String {
    map { String(format: "%02x", $0) }.joined()
  }
}
