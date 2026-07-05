interface CatalogMod {
  fileName: string
  name: string
  version: string
  author: string
  description: string
  category: string
  abilityKey: string
  icon: string | null
  installed: boolean
  enabled: boolean
  updateAvailable: boolean
}

interface CatalogListResult {
  mods: CatalogMod[]
  catalogError: string
}

interface AppInfo {
  version: string
  catalogUrl: string
  libraryPath: string
}

interface ModManagerApi {
  getAppInfo: () => Promise<AppInfo>
  listCatalog: () => Promise<CatalogListResult>
  installMod: (fileName: string) => Promise<boolean>
  uninstallMod: (fileName: string) => Promise<boolean>
  addCustomMod: () => Promise<{ added: number }>
  setModEnabled: (fileName: string, enabled: boolean) => Promise<boolean>
  applyEnabled: () => Promise<{ fileCount: number }>
  unapplyAll: () => Promise<boolean>
  launchModded: () => Promise<boolean>
  launchVanilla: () => Promise<boolean>
  installUpdate: () => Promise<void>
  checkForUpdates: () => Promise<UpdateCheckResult>
  cancelUpdate: () => Promise<void>
  onUpdateDownloaded: (listener: (version: string) => void) => void
  onUpdateProgress: (listener: (progress: UpdateProgress) => void) => void
  onUpdateCancelled: (listener: () => void) => void
  onUpdateError: (listener: (message: string) => void) => void
}

interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

interface UpdateCheckResult {
  status: 'current' | 'downloading' | 'unavailable' | 'error'
  version?: string
  message?: string
}

interface Window {
  modManager: ModManagerApi
}
