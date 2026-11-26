import { mkdirSync } from 'fs'
import { basename, dirname } from 'path'
import { XMLParser } from 'fast-xml-parser'
import { ZipArchiveReader, writeZip64Archive } from './zipArchive'
import { logLine } from './managerLogger'

export interface HonmodMetadata {
  fileName: string
  name: string
  version: string
  author: string
  description: string
  category: string
  abilityKey: string
  updateCheckUrl: string
  updateDownloadUrl: string
}

interface EditFileOperation {
  kind: 'editfile'
  targetPath: string
  edits: { find: string; replace: string }[]
}

interface CopyFileOperation {
  kind: 'copyfile'
  destinationPath: string
  sourcePath: string
}

type HonmodOperation = EditFileOperation | CopyFileOperation

const manifestParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  cdataPropName: '__cdata',
  trimValues: false,
  isArray: (tagName) => tagName === 'editfile' || tagName === 'copyfile' || tagName === 'find' || tagName === 'replace'
})

function asArray<ItemType>(value: ItemType | ItemType[] | undefined): ItemType[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function readAttribute(element: Record<string, unknown>, attributeName: string, fallback: string): string {
  const value = element[attributeName]
  return typeof value === 'string' ? value : fallback
}

function extractElementText(element: unknown): string {
  if (typeof element === 'string') {
    return element
  }
  if (element && typeof element === 'object') {
    const record = element as Record<string, unknown>
    if (typeof record.__cdata === 'string') {
      return record.__cdata
    }
    if (Array.isArray(record.__cdata)) {
      return record.__cdata.join('')
    }
    if (typeof record['#text'] === 'string') {
      return record['#text']
    }
  }
  return ''
}

function parseManifest(reader: ZipArchiveReader): { modification: Record<string, unknown> } {
  const manifestXml = reader.readEntry('mod.xml').toString('utf8')
  const parsed = manifestParser.parse(manifestXml) as Record<string, unknown>
  const modification = (parsed.modification as Record<string, unknown>) ?? {}
  return { modification }
}

// Only find and replace pairs are supported. Older honmods may also use insert, delete, findall, or conditions, and
// applying just the parts that are understood would leave the game files half edited.
const SUPPORTED_EDIT_FILE_KEYS = new Set(['name', 'find', 'replace', '#text'])

function parseOperations(reader: ZipArchiveReader): HonmodOperation[] {
  const { modification } = parseManifest(reader)
  const operations: HonmodOperation[] = []

  for (const editFile of asArray(modification.editfile as Record<string, unknown> | Record<string, unknown>[])) {
    const targetPath = readAttribute(editFile, 'name', '')
    const unsupportedKeys = Object.keys(editFile).filter((key) => !SUPPORTED_EDIT_FILE_KEYS.has(key))
    if (unsupportedKeys.length > 0) {
      throw new Error('Unsupported honmod operation in ' + targetPath + ': ' + unsupportedKeys.join(', '))
    }
    const findElements = asArray(editFile.find)
    const replaceElements = asArray(editFile.replace)
    if (findElements.length !== replaceElements.length) {
      throw new Error('Every find needs a matching replace in ' + targetPath)
    }
    const edits: { find: string; replace: string }[] = []
    const pairCount = findElements.length
    for (let index = 0; index < pairCount; index++) {
      edits.push({
        find: extractElementText(findElements[index]),
        replace: extractElementText(replaceElements[index])
      })
    }
    operations.push({ kind: 'editfile', targetPath, edits })
  }

  for (const copyFile of asArray(modification.copyfile as Record<string, unknown> | Record<string, unknown>[])) {
    const destinationPath = readAttribute(copyFile, 'name', '')
    const sourcePath = readAttribute(copyFile, 'source', destinationPath)
    operations.push({ kind: 'copyfile', destinationPath, sourcePath })
  }

  return operations
}

export function readHonmodMetadata(honmodPath: string): HonmodMetadata {
  const reader = new ZipArchiveReader(honmodPath)
  try {
    const { modification } = parseManifest(reader)
    const fallbackName = basename(honmodPath)
    return {
      fileName: fallbackName,
      name: readAttribute(modification, 'name', fallbackName),
      version: readAttribute(modification, 'version', ''),
      author: readAttribute(modification, 'author', ''),
      description: readAttribute(modification, 'description', ''),
      category: readAttribute(modification, 'category', 'Other'),
      abilityKey: readAttribute(modification, 'abilitykey', ''),
      updateCheckUrl: readAttribute(modification, 'updatecheckurl', ''),
      updateDownloadUrl: readAttribute(modification, 'updatedownloadurl', '')
    }
  } finally {
    reader.close()
  }
}

export function readHonmodIconDataUrl(honmodPath: string): string | null {
  const reader = new ZipArchiveReader(honmodPath)
  try {
    if (!reader.hasEntry('icon.png')) {
      return null
    }
    const iconBytes = reader.readEntry('icon.png')
    return 'data:image/png;base64,' + iconBytes.toString('base64')
  } catch {
    return null
  } finally {
    reader.close()
  }
}

export interface ApplyResult {
  fileCount: number
  outputPath: string
  skippedMods: string[]
}

export interface ExtraFileEdit {
  targetPath: string
  find: string
  replace: string
}

export interface ExtraFileAddition {
  targetPath: string
  contents: string
}

export function applyHonmods(
  honmodPaths: string[],
  baseArchivePath: string,
  outputPath: string,
  extraEdits: ExtraFileEdit[] = [],
  extraFiles: ExtraFileAddition[] = []
): ApplyResult {
  let modifiedFiles = new Map<string, Buffer>()
  const skippedMods: string[] = []
  const baseReader = new ZipArchiveReader(baseArchivePath)
  try {
    for (const honmodPath of honmodPaths) {
      const stagedFiles = new Map(modifiedFiles)
      const honmodReader = new ZipArchiveReader(honmodPath)
      try {
        for (const operation of parseOperations(honmodReader)) {
          if (operation.kind === 'editfile') {
            const stagedBytes = stagedFiles.get(operation.targetPath) ?? baseReader.readEntry(operation.targetPath)
            let fileText = stagedBytes.toString('utf8')
            for (const edit of operation.edits) {
              if (!fileText.includes(edit.find)) {
                throw new Error('Text to replace was not found in ' + operation.targetPath)
              }
              fileText = fileText.replaceAll(edit.find, () => edit.replace)
            }
            stagedFiles.set(operation.targetPath, Buffer.from(fileText, 'utf8'))
          } else {
            stagedFiles.set(operation.destinationPath, honmodReader.readEntry(operation.sourcePath))
          }
        }
        modifiedFiles = stagedFiles
      } catch (error) {
        skippedMods.push(basename(honmodPath))
        logLine('apply', 'skipped ' + basename(honmodPath) + ': ' + String(error))
      } finally {
        honmodReader.close()
      }
    }
    try {
      const stagedFiles = new Map(modifiedFiles)
      for (const edit of extraEdits) {
        const stagedBytes = stagedFiles.get(edit.targetPath) ?? baseReader.readEntry(edit.targetPath)
        const fileText = stagedBytes.toString('utf8')
        if (!fileText.includes(edit.find)) {
          throw new Error('Text to replace was not found in ' + edit.targetPath)
        }
        stagedFiles.set(edit.targetPath, Buffer.from(fileText.replaceAll(edit.find, () => edit.replace), 'utf8'))
      }
      for (const addition of extraFiles) {
        stagedFiles.set(addition.targetPath, Buffer.from(addition.contents, 'utf8'))
      }
      modifiedFiles = stagedFiles
    } catch {
      if (extraEdits.length > 0 || extraFiles.length > 0) {
        skippedMods.push('Thai Chat Translation')
      }
    }
  } finally {
    baseReader.close()
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeZip64Archive(outputPath, modifiedFiles)
  return { fileCount: modifiedFiles.size, outputPath, skippedMods }
}
