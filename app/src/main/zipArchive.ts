import { openSync, readSync, fstatSync, closeSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs'
import { inflateRawSync, crc32 } from 'zlib'
import { decompress as decompressZstandard } from 'fzstd'

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50

const COMPRESSION_STORED = 0
const COMPRESSION_DEFLATE = 8
const COMPRESSION_ZSTANDARD = 93

export interface ZipEntry {
  fileName: string
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

function readFileRange(fileDescriptor: number, position: number, length: number): Buffer {
  const buffer = Buffer.allocUnsafe(length)
  let totalRead = 0
  while (totalRead < length) {
    const bytesRead = readSync(fileDescriptor, buffer, totalRead, length - totalRead, position + totalRead)
    if (bytesRead === 0) {
      break
    }
    totalRead += bytesRead
  }
  if (totalRead !== length) {
    throw new Error('Unexpected end of file while reading archive')
  }
  return buffer
}

export class ZipArchiveReader {
  private readonly fileDescriptor: number
  private readonly fileSize: number
  readonly entries: Map<string, ZipEntry> = new Map()

  constructor(filePath: string) {
    this.fileDescriptor = openSync(filePath, 'r')
    this.fileSize = fstatSync(this.fileDescriptor).size
    this.readCentralDirectory()
  }

  private locateEndOfCentralDirectory(): number {
    const maximumTailLength = Math.min(this.fileSize, 65557)
    const tail = readFileRange(this.fileDescriptor, this.fileSize - maximumTailLength, maximumTailLength)
    for (let index = tail.length - 22; index >= 0; index--) {
      if (tail.readUInt32LE(index) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
        return this.fileSize - maximumTailLength + index
      }
    }
    throw new Error('End of central directory record was not found')
  }

  private readCentralDirectory(): void {
    const endOfCentralDirectoryPosition = this.locateEndOfCentralDirectory()
    const endOfCentralDirectory = readFileRange(this.fileDescriptor, endOfCentralDirectoryPosition, 22)
    let centralDirectoryOffset = endOfCentralDirectory.readUInt32LE(16)
    let centralDirectorySize = endOfCentralDirectory.readUInt32LE(12)
    let entryCount = endOfCentralDirectory.readUInt16LE(10)

    if (centralDirectoryOffset === 0xffffffff || entryCount === 0xffff) {
      const locator = readFileRange(this.fileDescriptor, endOfCentralDirectoryPosition - 20, 20)
      if (locator.readUInt32LE(0) !== ZIP64_LOCATOR_SIGNATURE) {
        throw new Error('Zip64 locator was not found')
      }
      const zip64EndOffset = Number(locator.readBigUInt64LE(8))
      const zip64End = readFileRange(this.fileDescriptor, zip64EndOffset, 56)
      if (zip64End.readUInt32LE(0) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
        throw new Error('Zip64 end of central directory was not found')
      }
      entryCount = Number(zip64End.readBigUInt64LE(32))
      centralDirectorySize = Number(zip64End.readBigUInt64LE(40))
      centralDirectoryOffset = Number(zip64End.readBigUInt64LE(48))
    }

    const centralDirectory = readFileRange(this.fileDescriptor, centralDirectoryOffset, centralDirectorySize)
    let cursor = 0
    for (let index = 0; index < entryCount; index++) {
      if (centralDirectory.readUInt32LE(cursor) !== CENTRAL_FILE_HEADER_SIGNATURE) {
        throw new Error('Corrupt central directory entry')
      }
      const compressionMethod = centralDirectory.readUInt16LE(cursor + 10)
      let compressedSize = centralDirectory.readUInt32LE(cursor + 20)
      let uncompressedSize = centralDirectory.readUInt32LE(cursor + 24)
      const fileNameLength = centralDirectory.readUInt16LE(cursor + 28)
      const extraFieldLength = centralDirectory.readUInt16LE(cursor + 30)
      const commentLength = centralDirectory.readUInt16LE(cursor + 32)
      let localHeaderOffset = centralDirectory.readUInt32LE(cursor + 42)
      const fileName = centralDirectory.toString('utf8', cursor + 46, cursor + 46 + fileNameLength)
      const extraFieldStart = cursor + 46 + fileNameLength

      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
        let extraCursor = extraFieldStart
        const extraFieldEnd = extraFieldStart + extraFieldLength
        while (extraCursor + 4 <= extraFieldEnd) {
          const headerId = centralDirectory.readUInt16LE(extraCursor)
          const blockSize = centralDirectory.readUInt16LE(extraCursor + 2)
          if (headerId === 0x0001) {
            let valueCursor = extraCursor + 4
            if (uncompressedSize === 0xffffffff) {
              uncompressedSize = Number(centralDirectory.readBigUInt64LE(valueCursor))
              valueCursor += 8
            }
            if (compressedSize === 0xffffffff) {
              compressedSize = Number(centralDirectory.readBigUInt64LE(valueCursor))
              valueCursor += 8
            }
            if (localHeaderOffset === 0xffffffff) {
              localHeaderOffset = Number(centralDirectory.readBigUInt64LE(valueCursor))
              valueCursor += 8
            }
            break
          }
          extraCursor += 4 + blockSize
        }
      }

      this.entries.set(fileName, {
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset
      })
      cursor = extraFieldStart + extraFieldLength + commentLength
    }
  }

  hasEntry(fileName: string): boolean {
    return this.entries.has(fileName)
  }

  readEntry(fileName: string): Buffer {
    const entry = this.entries.get(fileName)
    if (!entry) {
      throw new Error('Entry was not found in archive: ' + fileName)
    }
    const localHeader = readFileRange(this.fileDescriptor, entry.localHeaderOffset, 30)
    if (localHeader.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error('Corrupt local file header for ' + fileName)
    }
    const localFileNameLength = localHeader.readUInt16LE(26)
    const localExtraFieldLength = localHeader.readUInt16LE(28)
    const dataOffset = entry.localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength
    const compressedData = readFileRange(this.fileDescriptor, dataOffset, entry.compressedSize)
    if (entry.compressionMethod === COMPRESSION_STORED) {
      return compressedData
    }
    if (entry.compressionMethod === COMPRESSION_DEFLATE) {
      return inflateRawSync(compressedData)
    }
    if (entry.compressionMethod === COMPRESSION_ZSTANDARD) {
      return Buffer.from(decompressZstandard(compressedData))
    }
    throw new Error('Unsupported compression method ' + entry.compressionMethod + ' for ' + fileName)
  }

  close(): void {
    closeSync(this.fileDescriptor)
  }
}

export function writeZip64Archive(outputPath: string, filesByName: Map<string, Buffer>): void {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let outputOffset = 0

  for (const [fileName, payload] of filesByName) {
    const fileNameBuffer = Buffer.from(fileName, 'utf8')
    const checksum = crc32(payload) >>> 0
    const localHeaderOffset = outputOffset

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(payload.length, 18)
    localHeader.writeUInt32LE(payload.length, 22)
    localHeader.writeUInt16LE(fileNameBuffer.length, 26)
    localParts.push(localHeader, fileNameBuffer, payload)
    outputOffset += 30 + fileNameBuffer.length + payload.length

    const zip64Extra = Buffer.alloc(12)
    zip64Extra.writeUInt16LE(0x0001, 0)
    zip64Extra.writeUInt16LE(8, 2)
    zip64Extra.writeBigUInt64LE(BigInt(localHeaderOffset), 4)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_FILE_HEADER_SIGNATURE, 0)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(payload.length, 20)
    centralHeader.writeUInt32LE(payload.length, 24)
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28)
    centralHeader.writeUInt16LE(zip64Extra.length, 30)
    centralHeader.writeUInt32LE(0xffffffff, 42)
    centralParts.push(centralHeader, fileNameBuffer, zip64Extra)
  }

  const centralDirectory = Buffer.concat(centralParts)
  const centralDirectoryOffset = outputOffset
  const centralDirectorySize = centralDirectory.length
  const entryCount = filesByName.size
  const zip64EndOffset = centralDirectoryOffset + centralDirectorySize

  const zip64End = Buffer.alloc(56)
  zip64End.writeUInt32LE(ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  zip64End.writeBigUInt64LE(BigInt(44), 4)
  zip64End.writeUInt16LE(0x031e, 12)
  zip64End.writeUInt16LE(45, 14)
  zip64End.writeBigUInt64LE(BigInt(entryCount), 24)
  zip64End.writeBigUInt64LE(BigInt(entryCount), 32)
  zip64End.writeBigUInt64LE(BigInt(centralDirectorySize), 40)
  zip64End.writeBigUInt64LE(BigInt(centralDirectoryOffset), 48)

  const locator = Buffer.alloc(20)
  locator.writeUInt32LE(ZIP64_LOCATOR_SIGNATURE, 0)
  locator.writeBigUInt64LE(BigInt(zip64EndOffset), 8)
  locator.writeUInt32LE(1, 16)

  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  endOfCentralDirectory.writeUInt16LE(entryCount, 8)
  endOfCentralDirectory.writeUInt16LE(entryCount, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12)
  endOfCentralDirectory.writeUInt32LE(0xffffffff, 16)

  const temporaryPath = outputPath + '.writing'
  writeFileSync(temporaryPath, Buffer.concat([...localParts, centralDirectory, zip64End, locator, endOfCentralDirectory]))
  try {
    renameSync(temporaryPath, outputPath)
  } catch {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath)
    }
    throw new Error('Could not replace ' + outputPath + '. Close the game and apply again.')
  }
}
