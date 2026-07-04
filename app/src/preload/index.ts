import { contextBridge, ipcRenderer } from 'electron'

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
  getAppInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('modManager', modManagerApi)
