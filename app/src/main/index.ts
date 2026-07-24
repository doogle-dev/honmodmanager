import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import appIconPath from '../../resources/icon.png?asset'
import { autoUpdater, CancellationToken } from 'electron-updater'
import { join, resolve, basename } from 'path'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, cpSync, statSync } from 'fs'
import { locateJuvioRoot, baseArchivePath, modsOverlayArchivePath, launchGame, whenGameFullyExits } from './juvioLauncher'
import { applyHonmods, readHonmodMetadata, readHonmodIconDataUrl } from './honmodApplier'
import {
  chatRelayLuaEdits,
  CHAT_RELAY_CONSOLE_COMMAND,
  registerChatComposeHandlers,
  startThaiChatTranslation,
  stopThaiChatTranslation
} from './thaiChatTranslation'
import { fetchCatalog, resolveCatalogUrl, installCatalogMod } from './catalogClient'
import type { Catalog } from './catalogClient'

const VIRTUAL_TRANSLATION_FILE_NAME = 'ChatTranslation.feature'
const DEVELOPMENT_CATALOG_URL = 'http://localhost:8787'
const PUBLIC_CATALOG_URL = 'https://raw.githubusercontent.com/doogle-dev/honmodmanager/main/server/catalog'

function honmodLibraryDirectory(): string {
  const directory = app.isPackaged
    ? join(app.getPath('userData'), 'honmods')
    : resolve(__dirname, '../../dev-library')
  mkdirSync(directory, { recursive: true })
  return directory
}

function catalogBaseUrl(): string {
  if (process.env.HON_CATALOG_URL) {
    return process.env.HON_CATALOG_URL
  }
  return app.isPackaged ? PUBLIC_CATALOG_URL : DEVELOPMENT_CATALOG_URL
}

const MOD_SETTINGS_PROFILE_NAME = 'mods'
const REAL_SETTINGS_PROFILE_NAME = 'Heroes of Newerth'
const SETTINGS_FILE_NAMES = ['startup.cfg', 'game_settings_local.cfg', 'voice_config.cfg']
const LOGIN_FILE_NAME = 'login.cfg'

function findJuvioDocumentsRoot(): string | null {
  const candidates = [
    join(app.getPath('documents'), 'Juvio'),
    join(app.getPath('home'), 'Documents', 'Juvio'),
    join(app.getPath('home'), 'OneDrive', 'Documents', 'Juvio')
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, REAL_SETTINGS_PROFILE_NAME))) {
      return candidate
    }
  }
  return null
}

const LOGIN_CVAR_PATTERN = /^\s*SetSave\s+"login_/

function readUtf16ConfigLines(filePath: string): string[] {
  return readFileSync(filePath)
    .toString('utf16le')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
}

function writeUtf16ConfigLines(filePath: string, configLines: string[]): void {
  const content = configLines.filter((line) => line !== '').join('\r\n') + '\r\n'
  writeFileSync(filePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')]))
}

function transplantLoginCvars(sourcePath: string, targetPath: string): void {
  if (!existsSync(sourcePath) || !existsSync(targetPath)) {
    return
  }
  const sourceLoginLines = readUtf16ConfigLines(sourcePath).filter((line) => LOGIN_CVAR_PATTERN.test(line))
  const targetLines = readUtf16ConfigLines(targetPath).filter((line) => !LOGIN_CVAR_PATTERN.test(line))
  writeUtf16ConfigLines(targetPath, [...targetLines, ...sourceLoginLines])
}

function synchronizeSettingsFile(realFilePath: string, modFilePath: string): void {
  const realExists = existsSync(realFilePath)
  const modExists = existsSync(modFilePath)
  if (realExists && !modExists) {
    copyFileSync(realFilePath, modFilePath)
  } else if (modExists && !realExists) {
    copyFileSync(modFilePath, realFilePath)
  } else if (realExists && modExists) {
    if (statSync(realFilePath).mtimeMs >= statSync(modFilePath).mtimeMs) {
      copyFileSync(realFilePath, modFilePath)
    } else {
      copyFileSync(modFilePath, realFilePath)
    }
  }
}

function synchronizeSettingsProfiles(): void {
  const documentsRoot = findJuvioDocumentsRoot()
  if (!documentsRoot) {
    return
  }
  const realProfileDirectory = join(documentsRoot, REAL_SETTINGS_PROFILE_NAME)
  const modProfileDirectory = join(documentsRoot, MOD_SETTINGS_PROFILE_NAME)
  if (!existsSync(realProfileDirectory)) {
    return
  }
  mkdirSync(modProfileDirectory, { recursive: true })
  for (const settingsFileName of SETTINGS_FILE_NAMES) {
    synchronizeSettingsFile(join(realProfileDirectory, settingsFileName), join(modProfileDirectory, settingsFileName))
  }
  const realLoginPath = join(realProfileDirectory, LOGIN_FILE_NAME)
  if (existsSync(realLoginPath)) {
    copyFileSync(realLoginPath, join(modProfileDirectory, LOGIN_FILE_NAME))
  }
  transplantLoginCvars(join(realProfileDirectory, 'startup.cfg'), join(modProfileDirectory, 'startup.cfg'))
  const realBindings = join(realProfileDirectory, 'bindings')
  const modBindings = join(modProfileDirectory, 'bindings')
  if (existsSync(realBindings) && !existsSync(modBindings)) {
    cpSync(realBindings, modBindings, { recursive: true })
  }
}

function copyLoginBackToRealProfile(): void {
  const documentsRoot = findJuvioDocumentsRoot()
  if (!documentsRoot) {
    return
  }
  const modLoginPath = join(documentsRoot, MOD_SETTINGS_PROFILE_NAME, LOGIN_FILE_NAME)
  const realLoginPath = join(documentsRoot, REAL_SETTINGS_PROFILE_NAME, LOGIN_FILE_NAME)
  if (existsSync(modLoginPath)) {
    copyFileSync(modLoginPath, realLoginPath)
  }
  transplantLoginCvars(
    join(documentsRoot, MOD_SETTINGS_PROFILE_NAME, 'startup.cfg'),
    join(documentsRoot, REAL_SETTINGS_PROFILE_NAME, 'startup.cfg')
  )
}

function focusGameWindowWhenReady(): void {
  const focusScript =
    '$shell = New-Object -ComObject WScript.Shell; for ($attempt = 0; $attempt -lt 20; $attempt++) { Start-Sleep -Seconds 2; $gameProcess = Get-Process juvio -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1; if ($gameProcess -and $shell.AppActivate($gameProcess.Id)) { Start-Sleep -Seconds 5; $shell.AppActivate($gameProcess.Id) | Out-Null; break } }'
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', focusScript], {
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
}

function parseVersionParts(versionText: string): number[] {
  return versionText.split(/[.,]/).map((part) => {
    const digits = part.replace(/\D/g, '')
    return digits ? parseInt(digits, 10) : 0
  })
}

function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersionParts(candidate)
  const currentParts = parseVersionParts(current)
  const partCount = Math.max(candidateParts.length, currentParts.length)
  for (let index = 0; index < partCount; index++) {
    const candidateValue = candidateParts[index] ?? 0
    const currentValue = currentParts[index] ?? 0
    if (candidateValue !== currentValue) {
      return candidateValue > currentValue
    }
  }
  return false
}

function enabledStateFilePath(): string {
  return join(app.getPath('userData'), 'enabled-mods.json')
}

function chatTranslationSettingsPath(): string {
  return join(app.getPath('userData'), 'chat-translation.json')
}

function loadChatTranslationSettings(): { enabled: boolean; targetLanguage: 'en' | 'th' } {
  try {
    const stored = JSON.parse(readFileSync(chatTranslationSettingsPath(), 'utf8'))
    return {
      enabled: stored.enabled === true,
      targetLanguage: stored.targetLanguage === 'th' ? 'th' : 'en'
    }
  } catch {
    return { enabled: false, targetLanguage: 'en' }
  }
}

function loadChatTranslationEnabled(): boolean {
  return loadChatTranslationSettings().enabled
}

function saveChatTranslationSettings(enabled: boolean, targetLanguage: 'en' | 'th'): void {
  writeFileSync(chatTranslationSettingsPath(), JSON.stringify({ enabled, targetLanguage }, null, 2))
}

function saveChatTranslationEnabled(enabled: boolean): void {
  saveChatTranslationSettings(enabled, loadChatTranslationSettings().targetLanguage)
}

function loadEnabledFileNames(): string[] {
  try {
    const stored = JSON.parse(readFileSync(enabledStateFilePath(), 'utf8'))
    return Array.isArray(stored.enabled) ? stored.enabled : []
  } catch {
    return []
  }
}

function saveEnabledFileNames(enabledFileNames: string[]): void {
  writeFileSync(enabledStateFilePath(), JSON.stringify({ enabled: enabledFileNames }, null, 2))
}

function listHonmodPaths(): string[] {
  const directory = honmodLibraryDirectory()
  return readdirSync(directory)
    .filter((entryName) => entryName.toLowerCase().endsWith('.honmod'))
    .sort()
    .map((entryName) => join(directory, entryName))
}

function performApplyEnabled(): { fileCount: number; skippedMods: string[] } {
  const enabledFileNames = loadEnabledFileNames()
  const juvioRoot = locateJuvioRoot()
  const overlayPath = modsOverlayArchivePath(juvioRoot)
  const enabledPaths = listHonmodPaths().filter((honmodPath) => enabledFileNames.includes(basename(honmodPath)))
  const extraEdits = loadChatTranslationEnabled() ? chatRelayLuaEdits : []
  if (enabledPaths.length === 0 && extraEdits.length === 0) {
    if (existsSync(overlayPath)) {
      rmSync(overlayPath)
    }
    return { fileCount: 0, skippedMods: [] }
  }
  const result = applyHonmods(enabledPaths, baseArchivePath(juvioRoot), overlayPath, extraEdits)
  return { fileCount: result.fileCount, skippedMods: result.skippedMods }
}

function performModdedLaunch(): ReturnType<typeof launchGame> {
  synchronizeSettingsProfiles()
  const translationSettings = loadChatTranslationSettings()
  const gameProcess = launchGame(
    locateJuvioRoot(),
    true,
    translationSettings.enabled ? [CHAT_RELAY_CONSOLE_COMMAND] : []
  )
  if (translationSettings.enabled) {
    startThaiChatTranslation(gameProcess, translationSettings.targetLanguage)
  }
  whenGameFullyExits(gameProcess, () => {
    copyLoginBackToRealProfile()
  })
  focusGameWindowWhenReady()
  return gameProcess
}

function performVanillaLaunch(): ReturnType<typeof launchGame> {
  const gameProcess = launchGame(locateJuvioRoot(), false)
  focusGameWindowWhenReady()
  return gameProcess
}

function registerInterProcessHandlers(): void {
  ipcMain.handle('mods:list', () => {
    const enabledFileNames = loadEnabledFileNames()
    return listHonmodPaths().map((honmodPath) => {
      const metadata = readHonmodMetadata(honmodPath)
      return {
        fileName: metadata.fileName,
        name: metadata.name,
        version: metadata.version,
        author: metadata.author,
        description: metadata.description,
        iconDataUrl: readHonmodIconDataUrl(honmodPath),
        enabled: enabledFileNames.includes(metadata.fileName)
      }
    })
  })

  ipcMain.handle('mods:setEnabled', (_event, fileName: string, enabled: boolean) => {
    if (fileName === VIRTUAL_TRANSLATION_FILE_NAME) {
      saveChatTranslationEnabled(enabled === true)
      if (!enabled) {
        stopThaiChatTranslation()
      }
      return true
    }
    const enabledFileNames = new Set(loadEnabledFileNames())
    if (enabled) {
      enabledFileNames.add(fileName)
    } else {
      enabledFileNames.delete(fileName)
    }
    saveEnabledFileNames([...enabledFileNames])
    return true
  })

  ipcMain.handle('mods:apply', () => performApplyEnabled())

  ipcMain.handle('mods:unapply', () => {
    const juvioRoot = locateJuvioRoot()
    const overlayPath = modsOverlayArchivePath(juvioRoot)
    if (existsSync(overlayPath)) {
      rmSync(overlayPath)
    }
    saveEnabledFileNames([])
    return true
  })

  ipcMain.handle('game:launchModded', () => {
    performModdedLaunch()
    return true
  })

  ipcMain.handle('game:launchVanilla', () => {
    performVanillaLaunch()
    return true
  })

  ipcMain.handle('shortcuts:create', () => {
    const desktopDirectory = app.getPath('desktop')
    const juvioRoot = locateJuvioRoot()
    const iconPath = join(juvioRoot, 'heroes of newerth', 'game.ico')
    const shortcutIcon = existsSync(iconPath) ? iconPath : process.execPath
    const launchArguments = (flag: string): string =>
      app.isPackaged ? flag : '"' + app.getAppPath() + '" ' + flag
    const vanillaCreated = shell.writeShortcutLink(join(desktopDirectory, 'Heroes of Newerth.lnk'), {
      target: process.execPath,
      args: launchArguments('--launch-vanilla'),
      icon: shortcutIcon,
      iconIndex: 0,
      description: 'Launch Heroes of Newerth'
    })
    const moddedCreated = shell.writeShortcutLink(join(desktopDirectory, 'Heroes of Newerth Modded.lnk'), {
      target: process.execPath,
      args: launchArguments('--launch-modded'),
      icon: shortcutIcon,
      iconIndex: 0,
      description: 'Launch Heroes of Newerth with mods'
    })
    return { vanillaCreated, moddedCreated }
  })

  ipcMain.handle('chatTranslation:getEnabled', () => loadChatTranslationEnabled())

  ipcMain.handle('chatTranslation:setLanguage', (_event, language: string) => {
    const settings = loadChatTranslationSettings()
    saveChatTranslationSettings(settings.enabled, language === 'th' ? 'th' : 'en')
    return true
  })

  ipcMain.handle('chatTranslation:setEnabled', (_event, enabled: boolean) => {
    saveChatTranslationEnabled(enabled === true)
    if (!enabled) {
      stopThaiChatTranslation()
    }
    return true
  })

  ipcMain.handle('catalog:list', async () => {
    const enabledFileNames = loadEnabledFileNames()
    const libraryDirectory = honmodLibraryDirectory()
    const installedMetadata = new Map<string, ReturnType<typeof readHonmodMetadata>>()
    for (const honmodPath of listHonmodPaths()) {
      const metadata = readHonmodMetadata(honmodPath)
      installedMetadata.set(metadata.fileName, metadata)
    }

    let catalog: Catalog | null = null
    let catalogError = ''
    try {
      catalog = await fetchCatalog(catalogBaseUrl())
    } catch (error) {
      catalogError = String(error)
    }

    const rows = []
    const seenFileNames = new Set<string>()

    if (catalog) {
      for (const entry of catalog.mods) {
        seenFileNames.add(entry.fileName)
        const installed = installedMetadata.get(entry.fileName)
        rows.push({
          fileName: entry.fileName,
          name: entry.name,
          version: installed ? installed.version : entry.version,
          author: entry.author,
          description: entry.description,
          category: entry.category,
          abilityKey: installed ? installed.abilityKey : (entry.abilityKey ?? ''),
          icon: installed
            ? readHonmodIconDataUrl(join(libraryDirectory, entry.fileName))
            : resolveCatalogUrl(catalogBaseUrl(), entry.icon),
          installed: installed !== undefined,
          enabled: enabledFileNames.includes(entry.fileName),
          updateAvailable: installed !== undefined && isNewerVersion(entry.version, installed.version)
        })
      }
    }

    for (const [fileName, metadata] of installedMetadata) {
      if (seenFileNames.has(fileName)) {
        continue
      }
      rows.push({
        fileName,
        name: metadata.name,
        version: metadata.version,
        author: metadata.author,
        description: metadata.description,
        category: metadata.category,
        abilityKey: metadata.abilityKey,
        icon: readHonmodIconDataUrl(join(libraryDirectory, fileName)),
        installed: true,
        enabled: enabledFileNames.includes(fileName),
        updateAvailable: false
      })
    }

    const translationSettings = loadChatTranslationSettings()
    rows.unshift({
      fileName: VIRTUAL_TRANSLATION_FILE_NAME,
      name: 'Chat Translation',
      version: app.getVersion(),
      author: 'Doogle',
      description:
        'Translates chat between Thai and English inside the game chat while you play, marked with a [T] tag. The direction follows the manager language: with the manager in English, Thai chat becomes English; with the manager in Thai, English chat becomes Thai. Press Ctrl+T during a match to type in your language and send it in the other, with a preview of exactly what will be sent. Works when the game is launched from this manager or the modded desktop shortcut.',
      category: 'Utility',
      abilityKey: '',
      icon: null,
      installed: translationSettings.enabled,
      enabled: translationSettings.enabled,
      updateAvailable: false
    })

    return { mods: rows, catalogError }
  })

  ipcMain.handle('catalog:install', async (_event, fileName: string) => {
    if (fileName === VIRTUAL_TRANSLATION_FILE_NAME) {
      saveChatTranslationEnabled(true)
      return true
    }
    const catalog = await fetchCatalog(catalogBaseUrl())
    const entry = catalog.mods.find((mod) => mod.fileName === fileName)
    if (!entry) {
      throw new Error('The mod was not found in the catalog: ' + fileName)
    }
    await installCatalogMod(catalogBaseUrl(), entry, honmodLibraryDirectory())
    return true
  })

  ipcMain.handle('mods:uninstall', (_event, fileName: string) => {
    if (fileName === VIRTUAL_TRANSLATION_FILE_NAME) {
      saveChatTranslationEnabled(false)
      stopThaiChatTranslation()
      return true
    }
    const honmodPath = join(honmodLibraryDirectory(), fileName)
    if (existsSync(honmodPath)) {
      rmSync(honmodPath)
    }
    saveEnabledFileNames(loadEnabledFileNames().filter((enabledFileName) => enabledFileName !== fileName))
    return true
  })

  ipcMain.handle('mods:addCustom', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Add honmod files',
      filters: [{ name: 'Honmod', extensions: ['honmod'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (selection.canceled) {
      return { added: 0 }
    }
    const libraryDirectory = honmodLibraryDirectory()
    let addedCount = 0
    for (const selectedPath of selection.filePaths) {
      copyFileSync(selectedPath, join(libraryDirectory, basename(selectedPath)))
      addedCount += 1
    }
    return { added: addedCount }
  })

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    catalogUrl: catalogBaseUrl(),
    libraryPath: honmodLibraryDirectory()
  }))

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return { status: 'unavailable' }
    }
    try {
      const checkResult = await autoUpdater.checkForUpdates()
      const latestVersion = checkResult?.updateInfo?.version ?? ''
      if (latestVersion && isNewerVersion(latestVersion, app.getVersion())) {
        activeDownloadCancellationToken = new CancellationToken()
        autoUpdater.downloadUpdate(activeDownloadCancellationToken).catch((error) => {
          if (!activeDownloadCancellationToken?.cancelled) {
            mainWindowReference?.webContents.send('updater:error', String(error))
          }
        })
        return { status: 'downloading', version: latestVersion }
      }
      return { status: 'current', version: app.getVersion() }
    } catch (error) {
      return { status: 'error', message: String(error) }
    }
  })

  ipcMain.handle('updater:cancel', () => {
    activeDownloadCancellationToken?.cancel()
    activeDownloadCancellationToken = null
  })
}

let mainWindowReference: BrowserWindow | null = null
let activeDownloadCancellationToken: CancellationToken | null = null

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#313747',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindowReference = mainWindow

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    if (mainWindowReference === mainWindow) {
      mainWindowReference = null
    }
    stopThaiChatTranslation()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererDevServerUrl) {
    mainWindow.loadURL(rendererDevServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function launchFlagFromArguments(argumentList: string[]): 'modded' | 'vanilla' | null {
  if (argumentList.includes('--launch-modded')) {
    return 'modded'
  }
  if (argumentList.includes('--launch-vanilla')) {
    return 'vanilla'
  }
  return null
}

function runShortcutLaunch(launchFlag: 'modded' | 'vanilla', quitWhenGameExits: boolean): void {
  try {
    if (launchFlag === 'modded') {
      performApplyEnabled()
      const gameProcess = performModdedLaunch()
      if (quitWhenGameExits) {
        whenGameFullyExits(gameProcess, () => {
          setTimeout(() => app.quit(), 3000)
        })
      }
    } else {
      const gameProcess = performVanillaLaunch()
      if (quitWhenGameExits) {
        whenGameFullyExits(gameProcess, () => {
          setTimeout(() => app.quit(), 3000)
        })
      }
    }
  } catch {
    if (quitWhenGameExits) {
      app.quit()
    }
  }
}

const startupLaunchFlag = launchFlagFromArguments(process.argv)

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', (_event, argumentList) => {
  const secondInstanceFlag = launchFlagFromArguments(argumentList)
  if (secondInstanceFlag) {
    runShortcutLaunch(secondInstanceFlag, false)
    return
  }
  if (mainWindowReference) {
    if (mainWindowReference.isMinimized()) {
      mainWindowReference.restore()
    }
    mainWindowReference.focus()
  } else {
    createMainWindow()
  }
})

app.whenReady().then(() => {
  registerInterProcessHandlers()
  registerChatComposeHandlers()
  if (startupLaunchFlag) {
    runShortcutLaunch(startupLaunchFlag, true)
    return
  }
  createMainWindow()

  if (app.isPackaged) {
    autoUpdater.autoDownload = false
    autoUpdater.on('download-progress', (progress) => {
      mainWindowReference?.webContents.send('updater:progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      })
    })
    autoUpdater.on('update-downloaded', (updateInfo) => {
      activeDownloadCancellationToken = null
      mainWindowReference?.webContents.send('updater:downloaded', updateInfo.version)
    })
    autoUpdater.on('update-cancelled', () => {
      activeDownloadCancellationToken = null
      mainWindowReference?.webContents.send('updater:cancelled')
    })
    autoUpdater.on('error', (updateError) => {
      mainWindowReference?.webContents.send('updater:error', String(updateError))
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('will-quit', () => {
  stopThaiChatTranslation()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
