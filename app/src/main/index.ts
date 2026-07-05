import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import appIconPath from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'
import { join, resolve, basename } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, cpSync, statSync } from 'fs'
import { locateJuvioRoot, baseArchivePath, modsOverlayArchivePath, launchGame } from './juvioLauncher'
import { applyHonmods, readHonmodMetadata, readHonmodIconDataUrl } from './honmodApplier'
import { fetchCatalog, resolveCatalogUrl, installCatalogMod } from './catalogClient'
import type { Catalog } from './catalogClient'

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
const SETTINGS_FILE_NAMES = ['startup.cfg', 'game_settings_local.cfg', 'voice_config.cfg', 'login.cfg']

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
  const realBindings = join(realProfileDirectory, 'bindings')
  const modBindings = join(modProfileDirectory, 'bindings')
  if (existsSync(realBindings) && !existsSync(modBindings)) {
    cpSync(realBindings, modBindings, { recursive: true })
  }
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
    const enabledFileNames = new Set(loadEnabledFileNames())
    if (enabled) {
      enabledFileNames.add(fileName)
    } else {
      enabledFileNames.delete(fileName)
    }
    saveEnabledFileNames([...enabledFileNames])
    return true
  })

  ipcMain.handle('mods:apply', () => {
    const enabledFileNames = loadEnabledFileNames()
    const juvioRoot = locateJuvioRoot()
    const overlayPath = modsOverlayArchivePath(juvioRoot)
    const enabledPaths = listHonmodPaths().filter((honmodPath) =>
      enabledFileNames.includes(basename(honmodPath))
    )
    if (enabledPaths.length === 0) {
      if (existsSync(overlayPath)) {
        rmSync(overlayPath)
      }
      return { fileCount: 0 }
    }
    const result = applyHonmods(enabledPaths, baseArchivePath(juvioRoot), overlayPath)
    return { fileCount: result.fileCount }
  })

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
    synchronizeSettingsProfiles()
    launchGame(locateJuvioRoot(), true)
    return true
  })

  ipcMain.handle('game:launchVanilla', () => {
    launchGame(locateJuvioRoot(), false)
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

    return { mods: rows, catalogError }
  })

  ipcMain.handle('catalog:install', async (_event, fileName: string) => {
    const catalog = await fetchCatalog(catalogBaseUrl())
    const entry = catalog.mods.find((mod) => mod.fileName === fileName)
    if (!entry) {
      throw new Error('The mod was not found in the catalog: ' + fileName)
    }
    await installCatalogMod(catalogBaseUrl(), entry, honmodLibraryDirectory())
    return true
  })

  ipcMain.handle('mods:uninstall', (_event, fileName: string) => {
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
}

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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

app.whenReady().then(() => {
  registerInterProcessHandlers()
  createMainWindow()

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
