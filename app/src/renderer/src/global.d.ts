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
  applyEnabled: () => Promise<{ fileCount: number; skippedMods: string[] }>
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
  getChatTranslationEnabled: () => Promise<boolean>
  setChatTranslationEnabled: (enabled: boolean) => Promise<boolean>
  onChatTranslationMessage: (listener: (message: ChatTranslationMessage) => void) => void
  translateForChatCompose: (englishText: string) => Promise<{ thaiText: string; backTranslation: string }>
  sendComposedChat: (thaiText: string, channelName: string) => Promise<boolean>
  closeChatCompose: () => Promise<boolean>
  getChatComposeMode: () => Promise<string>
  setChatTranslationLanguage: (language: string) => Promise<boolean>
  createDesktopShortcuts: () => Promise<{ vanillaCreated: boolean; moddedCreated: boolean }>
  getTranslationCacheInfo: () => Promise<{ entryCount: number; sizeBytes: number }>
  clearTranslationCache: () => Promise<boolean>
  openLogsFolder: () => Promise<boolean>
  onChatComposeShown: (listener: () => void) => void
}

interface ChatTranslationMessage {
  id: number
  messageType: string
  senderName: string
  originalText: string
  translatedText: string
  receivedAt: number
  displayLimit: number
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
