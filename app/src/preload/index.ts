import { contextBridge, ipcRenderer } from 'electron'

interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

const modManagerApi = {
  listCatalog: () => ipcRenderer.invoke('catalog:list'),
  installMod: (fileName: string) => ipcRenderer.invoke('catalog:install', fileName),
  uninstallMod: (fileName: string) => ipcRenderer.invoke('mods:uninstall', fileName),
  addCustomMod: () => ipcRenderer.invoke('mods:addCustom'),
  setModEnabled: (fileName: string, enabled: boolean) => ipcRenderer.invoke('mods:setEnabled', fileName, enabled),
  applyEnabled: () => ipcRenderer.invoke('mods:apply'),
  unapplyAll: () => ipcRenderer.invoke('mods:unapply'),
  launchModded: () => ipcRenderer.invoke('game:launchModded'),
  launchVanilla: () => ipcRenderer.invoke('game:launchVanilla'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  cancelUpdate: () => ipcRenderer.invoke('updater:cancel'),
  onUpdateDownloaded: (listener: (version: string) => void) => {
    ipcRenderer.on('updater:downloaded', (_event, version: string) => listener(version))
  },
  onUpdateProgress: (listener: (progress: UpdateProgress) => void) => {
    ipcRenderer.on('updater:progress', (_event, progress: UpdateProgress) => listener(progress))
  },
  onUpdateCancelled: (listener: () => void) => {
    ipcRenderer.on('updater:cancelled', () => listener())
  },
  onUpdateError: (listener: (message: string) => void) => {
    ipcRenderer.on('updater:error', (_event, message: string) => listener(message))
  }
}

contextBridge.exposeInMainWorld('modManager', modManagerApi)
