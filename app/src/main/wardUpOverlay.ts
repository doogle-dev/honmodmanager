import { app, BrowserWindow, screen } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { startDebugOutputListener, stopDebugOutputListener } from './gameDebugOutputListener'
import { logLine } from './managerLogger'

const RELAY_LINE_PATTERN = /WARDUPRELAY\|(\d+)\|([a-z]+)\|([A-Za-z0-9%.,_-]*)/
const PLAYER_PAGE_BASE_URL = 'https://ward-up.com/player/'
const QUICK_LOOKUP_URL = 'https://ward-up.com/api/players/quick-lookup?q='
const LOOKUP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HoNRebornModManager'

let overlayActive = false
let overlayWindow: BrowserWindow | null = null
let lastRelayCounter = 0
let lastLoadedUrl = ''

type WardUpTopHero = {
  name: string
  kda: string
  win_rate: string
}

type WardUpProfile = {
  name: string
  rank_name?: string
  mmr?: number
  foc_mmr?: number
  mw_mmr?: number
  win_rate?: number
  matches?: number
  avg_kda?: number
  gpm?: number
  xpm?: number
  last_played?: string
  top_heroes?: WardUpTopHero[]
}

const profileCache = new Map<string, WardUpProfile | null>()
const pendingLookups = new Map<string, Promise<WardUpProfile | null>>()
let lastRosterPayload = ''
let miniCardWindow: BrowserWindow | null = null
let miniCardHideTimer: NodeJS.Timeout | null = null
let currentHoverName = ''

function fetchProfile(encodedPlayerName: string): Promise<WardUpProfile | null> {
  const pending = pendingLookups.get(encodedPlayerName)
  if (pending) {
    return pending
  }
  const lookupPromise = (async () => {
    try {
      const response = await fetch(QUICK_LOOKUP_URL + encodedPlayerName, {
        headers: { 'User-Agent': LOOKUP_USER_AGENT }
      })
      if (!response.ok) {
        return null
      }
      const payload = (await response.json()) as { profile?: WardUpProfile }
      return payload.profile ?? null
    } catch {
      return null
    }
  })()
  pendingLookups.set(encodedPlayerName, lookupPromise)
  lookupPromise.then((profile) => {
    profileCache.set(encodedPlayerName, profile)
    pendingLookups.delete(encodedPlayerName)
  })
  return lookupPromise
}

function prefetchRoster(rosterPayload: string): void {
  if (rosterPayload === lastRosterPayload) {
    return
  }
  lastRosterPayload = rosterPayload
  profileCache.clear()
  const encodedNames = rosterPayload.split(',').filter((encodedName) => encodedName.length > 0)
  for (const encodedName of encodedNames) {
    fetchProfile(encodedName)
  }
  logLine('wardup', 'prefetching stats for ' + String(encodedNames.length) + ' lobby players')
}

function escapeHtml(rawText: string): string {
  return rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildMiniCardHtml(encodedPlayerName: string, profile: WardUpProfile | null, loading: boolean): string {
  const displayName = escapeHtml(decodeURIComponent(encodedPlayerName))
  const baseStyle =
    '<style>' +
    'html,body{margin:0;padding:0;background:#0F1016;color:#fff;font:13px Roboto,Segoe UI,sans-serif;overflow:hidden;}' +
    '.card{padding:12px 14px;border:1px solid #23252e;border-radius:8px;height:100vh;box-sizing:border-box;}' +
    '.head{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}' +
    '.name{font-size:17px;font-weight:700;}' +
    '.rank{color:#8f93a3;font-size:12px;}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;}' +
    '.cell{background:#161821;border-radius:6px;padding:6px 8px;}' +
    '.label{color:#8f93a3;font-size:10px;text-transform:uppercase;letter-spacing:.4px;}' +
    '.value{font-size:14px;font-weight:700;color:#2dd4bf;}' +
    '.heroes{display:flex;flex-direction:column;gap:3px;}' +
    '.hero{display:flex;justify-content:space-between;color:#c6c9d4;font-size:12px;}' +
    '.hero span:last-child{color:#2dd4bf;font-weight:600;}' +
    '.note{color:#8f93a3;margin-top:16px;text-align:center;}' +
    '</style>'
  if (loading) {
    return baseStyle + '<div class="card"><div class="head"><span class="name">' + displayName + '</span></div><div class="note">Loading WardUp stats</div></div>'
  }
  if (!profile) {
    return baseStyle + '<div class="card"><div class="head"><span class="name">' + displayName + '</span></div><div class="note">No WardUp data found</div></div>'
  }
  const focMmr = profile.foc_mmr != null ? String(profile.foc_mmr) : '?'
  const mwMmr = profile.mw_mmr != null ? String(profile.mw_mmr) : '?'
  const winRate = profile.win_rate != null ? String(profile.win_rate) + '%' : '?'
  const matches = profile.matches != null ? String(profile.matches) : '?'
  const kda = profile.avg_kda != null ? String(profile.avg_kda) : '?'
  const gpm = profile.gpm != null ? String(profile.gpm) : '?'
  const topHeroes = (profile.top_heroes ?? []).slice(0, 3)
  const heroRows = topHeroes
    .map((topHero) => '<div class="hero"><span>' + escapeHtml(topHero.name) + '</span><span>' + escapeHtml(topHero.win_rate) + '</span></div>')
    .join('')
  const rankText = profile.rank_name ? escapeHtml(profile.rank_name) : ''
  return (
    baseStyle +
    '<div class="card">' +
    '<div class="head"><span class="name">' + escapeHtml(profile.name || decodeURIComponent(encodedPlayerName)) + '</span><span class="rank">' + rankText + '</span></div>' +
    '<div class="grid">' +
    '<div class="cell"><div class="label">FOC MMR</div><div class="value">' + focMmr + '</div></div>' +
    '<div class="cell"><div class="label">MW MMR</div><div class="value">' + mwMmr + '</div></div>' +
    '<div class="cell"><div class="label">Win Rate</div><div class="value">' + winRate + '</div></div>' +
    '<div class="cell"><div class="label">Matches</div><div class="value">' + matches + '</div></div>' +
    '<div class="cell"><div class="label">KDA</div><div class="value">' + kda + '</div></div>' +
    '<div class="cell"><div class="label">GPM</div><div class="value">' + gpm + '</div></div>' +
    '</div>' +
    '<div class="heroes">' + heroRows + '</div>' +
    '</div>'
  )
}

function createMiniCardWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workArea
  const cardWidth = 340
  const cardHeight = 230
  const window = new BrowserWindow({
    width: cardWidth,
    height: cardHeight,
    x: workArea.x + Math.round((workArea.width - cardWidth) / 2),
    y: workArea.y + 36,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#0F1016'
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setIgnoreMouseEvents(true)
  window.on('closed', () => {
    if (miniCardWindow === window) {
      miniCardWindow = null
    }
  })
  return window
}

function renderMiniCard(encodedPlayerName: string, profile: WardUpProfile | null, loading: boolean): void {
  if (!miniCardWindow) {
    miniCardWindow = createMiniCardWindow()
  }
  const cardHtml = buildMiniCardHtml(encodedPlayerName, profile, loading)
  miniCardWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(cardHtml))
  if (!miniCardWindow.isVisible()) {
    miniCardWindow.showInactive()
  }
}

function showMiniCard(encodedPlayerName: string): void {
  if (!encodedPlayerName) {
    return
  }
  if (miniCardHideTimer) {
    clearTimeout(miniCardHideTimer)
    miniCardHideTimer = null
  }
  currentHoverName = encodedPlayerName
  if (profileCache.has(encodedPlayerName)) {
    renderMiniCard(encodedPlayerName, profileCache.get(encodedPlayerName) ?? null, false)
    return
  }
  renderMiniCard(encodedPlayerName, null, true)
  fetchProfile(encodedPlayerName).then((profile) => {
    if (currentHoverName === encodedPlayerName && miniCardWindow && miniCardWindow.isVisible()) {
      renderMiniCard(encodedPlayerName, profile, false)
    }
  })
}

function scheduleMiniCardHide(): void {
  if (miniCardHideTimer) {
    clearTimeout(miniCardHideTimer)
  }
  miniCardHideTimer = setTimeout(() => {
    miniCardHideTimer = null
    currentHoverName = ''
    if (miniCardWindow && miniCardWindow.isVisible()) {
      miniCardWindow.hide()
    }
  }, 350)
}

function hideMiniCard(): void {
  if (miniCardHideTimer) {
    clearTimeout(miniCardHideTimer)
    miniCardHideTimer = null
  }
  currentHoverName = ''
  if (miniCardWindow && miniCardWindow.isVisible()) {
    miniCardWindow.hide()
  }
}

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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('https://ward-up.com/')) {
      event.preventDefault()
    }
  })
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
  const eventPayload = match[3]
  if (eventName === 'show') {
    showPlayerPage(eventPayload)
  } else if (eventName === 'hover') {
    showMiniCard(eventPayload)
  } else if (eventName === 'hoverout') {
    scheduleMiniCardHide()
  } else if (eventName === 'roster') {
    prefetchRoster(eventPayload)
  } else if (eventName === 'hide') {
    hideOverlay()
    hideMiniCard()
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
  if (miniCardWindow) {
    miniCardWindow.close()
    miniCardWindow = null
  }
  profileCache.clear()
  lastRosterPayload = ''
  lastLoadedUrl = ''
  logLine('wardup', 'overlay stopped')
}
