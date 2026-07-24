import { mkdirSync } from 'fs'
import { basename, dirname } from 'path'
import { XMLParser } from 'fast-xml-parser'
import { ZipArchiveReader, writeZip64Archive } from './zipArchive'

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

function parseOperations(reader: ZipArchiveReader): HonmodOperation[] {
  const { modification } = parseManifest(reader)
  const operations: HonmodOperation[] = []

  for (const editFile of asArray(modification.editfile as Record<string, unknown> | Record<string, unknown>[])) {
    const targetPath = readAttribute(editFile, 'name', '')
    const findElements = asArray(editFile.find)
    const replaceElements = asArray(editFile.replace)
    const edits: { find: string; replace: string }[] = []
    const pairCount = Math.min(findElements.length, replaceElements.length)
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
}

export interface ExtraFileEdit {
  targetPath: string
  find: string
  replace: string
}

export function applyHonmods(
  honmodPaths: string[],
  baseArchivePath: string,
  outputPath: string,
  extraEdits: ExtraFileEdit[] = []
): ApplyResult {
  const modifiedFiles = new Map<string, Buffer>()
  const baseReader = new ZipArchiveReader(baseArchivePath)
  try {
    for (const honmodPath of honmodPaths) {
      const honmodReader = new ZipArchiveReader(honmodPath)
      try {
        for (const operation of parseOperations(honmodReader)) {
          if (operation.kind === 'editfile') {
            if (!modifiedFiles.has(operation.targetPath)) {
              modifiedFiles.set(operation.targetPath, baseReader.readEntry(operation.targetPath))
            }
            let fileText = modifiedFiles.get(operation.targetPath)!.toString('utf8')
            for (const edit of operation.edits) {
              if (!fileText.includes(edit.find)) {
                throw new Error('Text to replace was not found in ' + operation.targetPath)
              }
              fileText = fileText.replaceAll(edit.find, () => edit.replace)
            }
            modifiedFiles.set(operation.targetPath, Buffer.from(fileText, 'utf8'))
          } else {
            modifiedFiles.set(operation.destinationPath, honmodReader.readEntry(operation.sourcePath))
          }
        }
      } finally {
        honmodReader.close()
      }
    }
    for (const edit of extraEdits) {
      if (!modifiedFiles.has(edit.targetPath)) {
        modifiedFiles.set(edit.targetPath, baseReader.readEntry(edit.targetPath))
      }
      const fileText = modifiedFiles.get(edit.targetPath)!.toString('utf8')
      if (!fileText.includes(edit.find)) {
        throw new Error('Text to replace was not found in ' + edit.targetPath)
      }
      modifiedFiles.set(edit.targetPath, Buffer.from(fileText.replaceAll(edit.find, () => edit.replace), 'utf8'))
    }
  } finally {
    baseReader.close()
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeZip64Archive(outputPath, modifiedFiles)
  return { fileCount: modifiedFiles.size, outputPath }
}
