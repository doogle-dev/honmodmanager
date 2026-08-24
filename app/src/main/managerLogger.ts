import { app } from 'electron'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const LOG_MAXIMUM_BYTES = 2 * 1024 * 1024

export const MANAGER_LOG_FILE_NAME = 'manager.log'
export const TRANSLATION_LOG_FILE_NAME = 'translation.log'

const TRANSLATION_LOG_AREAS = ['translation', 'relay', 'compose', 'listener']

let cachedLogsDirectory: string | null = null

export function logsDirectory(): string {
  if (!cachedLogsDirectory) {
    cachedLogsDirectory = join(app.getPath('userData'), 'logs')
    mkdirSync(cachedLogsDirectory, { recursive: true })
  }
  return cachedLogsDirectory
}

export function translationLogPath(): string {
  return join(logsDirectory(), TRANSLATION_LOG_FILE_NAME)
}

export function managerLogPath(): string {
  return join(logsDirectory(), MANAGER_LOG_FILE_NAME)
}

function rotateIfNeeded(currentPath: string): void {
  try {
    if (existsSync(currentPath) && statSync(currentPath).size > LOG_MAXIMUM_BYTES) {
      const archivePath = currentPath.replace(/\.log$/, '.old.log')
      rmSync(archivePath, { force: true })
      renameSync(currentPath, archivePath)
    }
  } catch {}
}

export function logLine(area: string, message: string): void {
  try {
    const fileName = TRANSLATION_LOG_AREAS.includes(area) ? TRANSLATION_LOG_FILE_NAME : MANAGER_LOG_FILE_NAME
    const filePath = join(logsDirectory(), fileName)
    rotateIfNeeded(filePath)
    appendFileSync(filePath, new Date().toISOString() + ' [' + area + '] ' + message + '\n')
  } catch {}
}

export const LOG_TAIL_INITIAL_BYTES = 96 * 1024

export type LogSlice = { text: string; nextOffset: number; startedMidFile: boolean }

export function readLogSlice(filePath: string, fromOffset: number, maximumBytes: number): LogSlice {
  try {
    if (!existsSync(filePath)) {
      return { text: '', nextOffset: 0, startedMidFile: false }
    }
    const currentSize = statSync(filePath).size
    let startOffset = fromOffset
    if (startOffset > currentSize) {
      startOffset = 0
    }
    if (currentSize - startOffset > maximumBytes) {
      startOffset = currentSize - maximumBytes
    }
    const byteCount = currentSize - startOffset
    if (byteCount <= 0) {
      return { text: '', nextOffset: currentSize, startedMidFile: false }
    }
    const buffer = Buffer.alloc(byteCount)
    const fileHandle = openSync(filePath, 'r')
    try {
      readSync(fileHandle, buffer, 0, byteCount, startOffset)
    } finally {
      closeSync(fileHandle)
    }
    return { text: buffer.toString('utf8'), nextOffset: currentSize, startedMidFile: startOffset > 0 && startOffset !== fromOffset }
  } catch {
    return { text: '', nextOffset: fromOffset, startedMidFile: false }
  }
}
