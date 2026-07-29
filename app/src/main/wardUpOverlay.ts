import { app, BrowserWindow, screen } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { startDebugOutputListener, stopDebugOutputListener } from './gameDebugOutputListener'
import { logLine } from './managerLogger'

const RELAY_LINE_PATTERN = /WARDUPRELAY\|(\d+)\|([a-z]+)\|([A-Za-z0-9%._-]*)/
const PLAYER_PAGE_BASE_URL = 'https://ward-up.com/player/'

let overlayActive = false
let overlayWindow: BrowserWindow | null = null
let lastRelayCounter = 0
let lastLoadedUrl = ''

const OVERLAY_ZOOM_FACTOR = 0.9

let allowRealClose = false
let saveBoundsTimer: NodeJS.Timeout | null = null

function overlayBoundsFilePath(): string {
  return join(app.getPath('userData'), 'wardUpOverlayBounds.json')
}

function loadSavedOverlayBounds(): Electron.Rectangle | null {
  try {
    const savedBounds = JSON.parse(readFileSync(overlayBoundsFilePath(), 'utf8'))
    if (
      typeof savedBounds.x === 'number' &&
      typeof savedBounds.y === 'number' &&
      typeof savedBounds.width === 'number' &&
      typeof savedBounds.height === 'number' &&
      savedBounds.width >= 400 &&
      savedBounds.height >= 300
    ) {
      const workArea = screen.getPrimaryDisplay().workArea
      const fitsOnScreen =
        savedBounds.x < workArea.x + workArea.width - 100 &&
        savedBounds.y < workArea.y + workArea.height - 100 &&
        savedBounds.x + savedBounds.width > workArea.x + 100 &&
        savedBounds.y + savedBounds.height > workArea.y + 40
      if (fitsOnScreen) {
        return savedBounds
      }
    }
  } catch {
    return null
  }
  return null
}

function scheduleSaveOverlayBounds(window: BrowserWindow): void {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer)
  }
  saveBoundsTimer = setTimeout(() => {
    saveBoundsTimer = null
    if (window.isDestroyed()) {
      return
    }
    try {
      writeFileSync(overlayBoundsFilePath(), JSON.stringify(window.getBounds()))
    } catch {
      return
    }
  }, 800)
}

function createOverlayWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workArea
  const savedBounds = loadSavedOverlayBounds()
  const overlayWidth = savedBounds ? savedBounds.width : Math.min(1495, workArea.width - 40)
  const overlayHeight = savedBounds ? savedBounds.height : workArea.height - 80
  const window = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: savedBounds ? savedBounds.x : workArea.x + Math.round((workArea.width - overlayWidth) / 2),
    y: savedBounds ? savedBounds.y : workArea.y + Math.round((workArea.height - overlayHeight) / 2),
    title: 'WardUp',
    frame: true,
    resizable: true,
    movable: true,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#0F1016'
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setMenuBarVisibility(false)
  window.on('resize', () => scheduleSaveOverlayBounds(window))
  window.on('move', () => scheduleSaveOverlayBounds(window))
  window.webContents.on('did-finish-load', () => {
    window.webContents.setZoomFactor(OVERLAY_ZOOM_FACTOR)
  })
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle('WardUp')
  })
  window.on('close', (event) => {
    if (!allowRealClose) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    if (overlayWindow === window) {
      overlayWindow = null
      lastLoadedUrl = ''
    }
  })
  return window
}

function showPlayerPage(encodedPlayerName: string): void {
  if (!encodedPlayerName) {
    return
  }
  const playerUrl = PLAYER_PAGE_BASE_URL + encodedPlayerName
  if (!overlayWindow) {
    overlayWindow = createOverlayWindow()
  }
  if (lastLoadedUrl !== playerUrl) {
    lastLoadedUrl = playerUrl
    overlayWindow.loadURL(playerUrl)
  }
  if (!overlayWindow.isVisible()) {
    overlayWindow.showInactive()
  }
  logLine('wardup', 'overlay showing ' + playerUrl)
}

function hideOverlay(): void {
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.hide()
    logLine('wardup', 'overlay hidden')
  }
}

function handleDebugOutputLine(_processId: number, line: string): void {
  const match = RELAY_LINE_PATTERN.exec(line)
  if (!match) {
    return
  }
  const relayCounter = parseInt(match[1], 10)
  if (relayCounter <= lastRelayCounter) {
    return
  }
  lastRelayCounter = relayCounter
  const eventName = match[2]
  const encodedPlayerName = match[3]
  if (eventName === 'show') {
    showPlayerPage(encodedPlayerName)
  } else if (eventName === 'hide') {
    hideOverlay()
  }
}

export function startWardUpOverlay(): void {
  if (overlayActive) {
    return
  }
  overlayActive = true
  lastRelayCounter = 0
  startDebugOutputListener(handleDebugOutputLine)
  logLine('wardup', 'overlay relay listener started')
}

export function stopWardUpOverlay(): void {
  if (!overlayActive) {
    return
  }
  overlayActive = false
  stopDebugOutputListener(handleDebugOutputLine)
  if (overlayWindow) {
    allowRealClose = true
    overlayWindow.close()
    allowRealClose = false
    overlayWindow = null
  }
  lastLoadedUrl = ''
  logLine('wardup', 'overlay stopped')
}
