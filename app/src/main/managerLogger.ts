import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const LOG_MAXIMUM_BYTES = 2 * 1024 * 1024

let cachedLogsDirectory: string | null = null

export function logsDirectory(): string {
  if (!cachedLogsDirectory) {
    cachedLogsDirectory = join(app.getPath('userData'), 'logs')
    mkdirSync(cachedLogsDirectory, { recursive: true })
  }
  return cachedLogsDirectory
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
    const filePath = join(logsDirectory(), 'manager.log')
    rotateIfNeeded(filePath)
    appendFileSync(filePath, new Date().toISOString() + ' [' + area + '] ' + message + '\n')
  } catch {}
}
