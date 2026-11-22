import { app, Menu, nativeImage, Tray } from 'electron'

export type TrayLanguage = 'en' | 'th'

export interface SystemTrayActions {
  showWindow: () => void
  launchModded: () => void
  launchVanilla: () => void
  quit: () => void
}

interface TrayLabels {
  openManager: string
  launchModded: string
  launchVanilla: string
  quit: string
  hiddenTitle: string
  hiddenBody: string
}

const TRAY_LABELS: Record<TrayLanguage, TrayLabels> = {
  en: {
    openManager: 'Open Mod Manager',
    launchModded: 'Launch With Mods',
    launchVanilla: 'Launch Without Mods',
    quit: 'Quit',
    hiddenTitle: 'Mod Manager is still running',
    hiddenBody: 'It is in the system tray next to the clock. Open it again from there, or quit from its menu.'
  },
  th: {
    openManager: 'เปิดตัวจัดการม็อด',
    launchModded: 'เปิดเกมพร้อมม็อด',
    launchVanilla: 'เปิดเกมแบบไม่มีม็อด',
    quit: 'ออกจากโปรแกรม',
    hiddenTitle: 'ตัวจัดการม็อดยังทำงานอยู่',
    hiddenBody: 'โปรแกรมอยู่ในถาดระบบข้างนาฬิกา เปิดกลับมาหรือออกจากโปรแกรมได้จากเมนูของไอคอน'
  }
}

let trayIcon: Tray | null = null
let trayActions: SystemTrayActions | null = null
let trayLanguage: TrayLanguage = 'en'
let trayIconImagePath: string = ''
let hiddenMessageShown: boolean = false

function applyTrayMenu(): void {
  const tray = trayIcon
  const actions = trayActions
  if (!tray || !actions) {
    return
  }
  const labels = TRAY_LABELS[trayLanguage]
  tray.setToolTip('Heroes of Newerth Reborn Mod Manager v' + app.getVersion())
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.openManager, click: () => actions.showWindow() },
      { type: 'separator' },
      { label: labels.launchModded, click: () => actions.launchModded() },
      { label: labels.launchVanilla, click: () => actions.launchVanilla() },
      { type: 'separator' },
      { label: labels.quit, click: () => actions.quit() }
    ])
  )
}

export function createSystemTray(iconPath: string, language: TrayLanguage, actions: SystemTrayActions): void {
  if (trayIcon) {
    return
  }
  trayIconImagePath = iconPath
  trayActions = actions
  trayLanguage = language
  // The window icon is a large square, so the tray gets a small copy rather than a scaled down blur.
  const smallIcon = nativeImage.createFromPath(trayIconImagePath).resize({ width: 16, height: 16 })
  trayIcon = new Tray(smallIcon)
  trayIcon.on('click', () => actions.showWindow())
  trayIcon.on('double-click', () => actions.showWindow())
  applyTrayMenu()
}

export function setSystemTrayLanguage(language: TrayLanguage): void {
  if (language === trayLanguage) {
    return
  }
  trayLanguage = language
  applyTrayMenu()
}

// Hiding a window with no sign of where it went looks like a crash, so the first hide of a session explains itself.
export function announceWindowHiddenToTray(): void {
  if (!trayIcon || hiddenMessageShown || process.platform !== 'win32') {
    return
  }
  hiddenMessageShown = true
  const labels = TRAY_LABELS[trayLanguage]
  trayIcon.displayBalloon({
    iconType: 'info',
    title: labels.hiddenTitle,
    content: labels.hiddenBody
  })
}

export function destroySystemTray(): void {
  if (!trayIcon) {
    return
  }
  trayIcon.destroy()
  trayIcon = null
  trayActions = null
}
