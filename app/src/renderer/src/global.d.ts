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
}

interface Window {
  modManager: ModManagerApi
}
