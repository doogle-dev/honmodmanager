import { useEffect, useState } from 'react'
import {
  ChevronDown,
  HardDrive,
  Library,
  Info,
  Download,
  Trash2,
  Search,
  Settings,
  Plus,
  Puzzle,
  RefreshCw,
  FileText,
  Github
} from 'lucide-react'
import { createTranslator, loadUiLanguage, saveUiLanguage, UiLanguage } from './uiTranslations'

type PageKey = 'browse' | 'installed' | 'settings' | 'credits'

const TRANSLATION_FEATURE_FILE_NAME = 'ChatTranslation.feature'
const CACHE_LIMIT_BYTES = 20 * 1024 * 1024

const ACCENT = '#3b6ea5'
const ACCENT_TEXT = '#ffffff'
const APP_BACKGROUND = '#191a1b'
const SIDEBAR_BACKGROUND = '#191a1b'
const CHROME_BACKGROUND = '#121314'

function ModIcon({ mod, size }: { mod: CatalogMod; size: string }): JSX.Element {
  if (mod.icon) {
    return <img src={mod.icon} alt="" className={size + ' object-contain'} />
  }
  if (mod.fileName === 'ChatTranslation.feature') {
    return (
      <div className={size + ' flex items-center justify-center gap-0.5 rounded bg-black/30 text-white'}>
        <span className="text-sm font-bold leading-none">ก</span>
        <span className="text-[10px] leading-none text-slate-400">→</span>
        <span className="text-sm font-bold leading-none">A</span>
      </div>
    )
  }
  return (
    <div className={size + ' flex items-center justify-center rounded bg-black/30'}>
      <Puzzle className="h-1/2 w-1/2 text-slate-400" />
    </div>
  )
}

function formatByteSize(byteCount: number): string {
  const megabytes = byteCount / (1024 * 1024)
  if (megabytes >= 1) {
    return megabytes.toFixed(1) + ' MB'
  }
  const kilobytes = byteCount / 1024
  if (kilobytes >= 1) {
    return kilobytes.toFixed(0) + ' KB'
  }
  return byteCount + ' bytes'
}

function renderDescriptionText(description: string): JSX.Element {
  const parts = description.split('**')
  return (
    <>
      {parts.map((part, partIndex) =>
        partIndex % 2 === 1 ? (
          <strong key={partIndex} className="font-semibold text-white">
            {part}
          </strong>
        ) : (
          <span key={partIndex}>{part}</span>
        )
      )}
    </>
  )
}

function EnglishFlag(): JSX.Element {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-[2px]">
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0 L20 14 M20 0 L0 14" stroke="#ffffff" strokeWidth="3" />
      <path d="M0 0 L20 14 M20 0 L0 14" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M10 0 V14 M0 7 H20" stroke="#ffffff" strokeWidth="5" />
      <path d="M10 0 V14 M0 7 H20" stroke="#C8102E" strokeWidth="2.8" />
    </svg>
  )
}

function ThaiFlag(): JSX.Element {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-[2px]">
      <rect width="20" height="14" fill="#A51931" />
      <rect y="2.33" width="20" height="9.34" fill="#F4F5F8" />
      <rect y="4.67" width="20" height="4.66" fill="#2D2A4A" />
    </svg>
  )
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s'
  }
  return Math.round(bytesPerSecond / 1024) + ' KB/s'
}

function App(): JSX.Element {
  const [mods, setMods] = useState<CatalogMod[]>([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState<PageKey>('browse')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [selectedModFileName, setSelectedModFileName] = useState<string | null>(null)
  const [launchingGame, setLaunchingGame] = useState(false)
  const [updateReadyVersion, setUpdateReadyVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [isDevBuild, setIsDevBuild] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<{ key: string; params?: Record<string, string | number> } | null>(null)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const [catalogUnavailable, setCatalogUnavailable] = useState(false)
  const [shortcutStatusMessage, setShortcutStatusMessage] = useState('')
  const [cacheInfo, setCacheInfo] = useState<{ entryCount: number; sizeBytes: number } | null>(null)
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(loadUiLanguage())
  const t = createTranslator(uiLanguage)

  function changeUiLanguage(language: UiLanguage): void {
    saveUiLanguage(language)
    setUiLanguage(language)
    window.modManager.setChatTranslationLanguage(language)
  }

  async function loadCatalog(): Promise<void> {
    try {
      const result = await window.modManager.listCatalog()
      setMods(result.mods)
      setCatalogUnavailable(Boolean(result.catalogError))
      if (result.catalogError) {
        setStatus(t('catalogOffline'))
      }
    } catch (error) {
      setStatus(t('loadFailed', { error: String(error) }))
    }
  }

  useEffect(() => {
    loadCatalog()
    const refreshOnFocus = (): void => {
      loadCatalog()
    }
    window.addEventListener('focus', refreshOnFocus)
    window.modManager.onUpdateProgress((progress) => setDownloadProgress(progress))
    window.modManager.onUpdateDownloaded((version) => {
      setDownloadProgress(null)
      setUpdateReadyVersion(version)
      setUpdateMessage({ key: 'updateReadyRestart', params: { version } })
    })
    window.modManager.onUpdateCancelled(() => {
      setDownloadProgress(null)
      setUpdateMessage({ key: 'downloadCancelled' })
    })
    window.modManager.onUpdateError((message) => {
      setDownloadProgress(null)
      setUpdateMessage({ key: 'updateDownloadFailed', params: { error: message } })
    })
    window.modManager.getAppInfo().then((appInfo) => {
      setAppVersion(appInfo.version)
      setIsDevBuild(appInfo.isDevBuild)
      document.title =
        'Heroes of Newerth Reborn Mod Manager' + (appInfo.isDevBuild ? ' Dev' : '') + ' v' + appInfo.version
    })
    window.modManager.getTranslationCacheInfo().then(setCacheInfo)
    window.modManager.setChatTranslationLanguage(loadUiLanguage())
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [])

  async function refreshCacheInfo(): Promise<void> {
    setCacheInfo(await window.modManager.getTranslationCacheInfo())
  }

  async function clearTranslationCache(): Promise<void> {
    await window.modManager.clearTranslationCache()
    await refreshCacheInfo()
    setStatus(t('cacheCleared'))
  }

  async function createDesktopShortcuts(): Promise<void> {
    try {
      const result = await window.modManager.createDesktopShortcuts()
      if (result.vanillaCreated && result.moddedCreated) {
        setShortcutStatusMessage(t('shortcutsCreated'))
      } else {
        setShortcutStatusMessage(t('shortcutsFailed'))
      }
    } catch (error) {
      setShortcutStatusMessage('Shortcut creation failed: ' + String(error))
    }
  }

  async function checkForUpdates(): Promise<void> {
    setCheckingForUpdates(true)
    setUpdateMessage(null)
    try {
      const result = await window.modManager.checkForUpdates()
      if (result.status === 'current') {
        setUpdateMessage({ key: 'onLatestVersion' })
      } else if (result.status === 'downloading') {
        setUpdateReadyVersion('')
        setDownloadProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
        setUpdateMessage({ key: 'updateFound', params: { version: result.version ?? '' } })
      } else if (result.status === 'unavailable') {
        setUpdateMessage({ key: 'updatesUnavailable' })
      } else {
        setUpdateMessage({ key: 'updateCheckFailed', params: { error: result.message ?? t('unknown') } })
      }
    } finally {
      setCheckingForUpdates(false)
    }
  }

  async function toggleMod(fileName: string, enabled: boolean): Promise<void> {
    await window.modManager.setModEnabled(fileName, enabled)
    setMods((current) => current.map((mod) => (mod.fileName === fileName ? { ...mod, enabled } : mod)))
  }

  async function checkForModUpdates(): Promise<void> {
    setStatus(t('checking'))
    try {
      const result = await window.modManager.listCatalog()
      setMods(result.mods)
      if (result.catalogError) {
        setStatus(t('catalogOffline'))
        return
      }
      const updateCount = result.mods.filter((mod) => mod.updateAvailable).length
      setStatus(updateCount > 0 ? t('modUpdatesFound', { count: updateCount }) : t('modUpdatesNone'))
    } catch (error) {
      setStatus(t('loadFailed', { error: String(error) }))
    }
  }

  async function updateAllMods(): Promise<void> {
    const updatableMods = mods.filter((mod) => mod.installed && mod.updateAvailable)
    for (const mod of updatableMods) {
      setStatus(t('installing', { name: mod.fileName }))
      try {
        await window.modManager.installMod(mod.fileName)
      } catch (error) {
        setStatus(t('installFailed', { error: String(error) }))
        return
      }
    }
    await loadCatalog()
    setStatus(t('modsUpdated', { count: updatableMods.length }))
  }

  async function installMod(fileName: string): Promise<void> {
    setStatus(t('installing', { name: fileName }))
    try {
      await window.modManager.installMod(fileName)
      await loadCatalog()
      setStatus(t('installed', { name: fileName }))
    } catch (error) {
      setStatus(t('installFailed', { error: String(error) }))
    }
  }

  async function uninstallMod(fileName: string): Promise<void> {
    try {
      await window.modManager.uninstallMod(fileName)
      await loadCatalog()
      setStatus(t('uninstalled', { name: fileName }))
    } catch (error) {
      setStatus(t('uninstallFailed', { error: String(error) }))
    }
  }

  async function addCustomMod(): Promise<void> {
    try {
      const result = await window.modManager.addCustomMod()
      if (result.added > 0) {
        await loadCatalog()
        setStatus(t('addedCustom', { count: result.added }))
      }
    } catch (error) {
      setStatus(t('addFailed', { error: String(error) }))
    }
  }

  async function applyEnabled(): Promise<void> {
    setStatus(t('applying'))
    try {
      const result = await window.modManager.applyEnabled()
      if (result.skippedMods && result.skippedMods.length > 0) {
        setStatus(t('appliedSkipped', { mods: result.skippedMods.join(', ') }))
      } else {
        setStatus(result.fileCount === 0 ? t('noModsEnabled') : t('applied'))
      }
    } catch (error) {
      setStatus(t('applyFailed', { error: String(error) }))
    }
  }

  async function unapplyAll(): Promise<void> {
    await window.modManager.unapplyAll()
    setMods((current) => current.map((mod) => ({ ...mod, enabled: false })))
    setStatus(t('allUnapplied'))
  }

  async function launchModded(): Promise<void> {
    setLaunchingGame(true)
    try {
      await applyEnabled()
      await window.modManager.launchModded()
    } finally {
      setLaunchingGame(false)
    }
  }

  const installedMods = mods
    .filter((mod) => mod.installed)
    .sort((firstMod, secondMod) => {
      if (firstMod.enabled !== secondMod.enabled) {
        return firstMod.enabled ? -1 : 1
      }
      return firstMod.name.localeCompare(secondMod.name)
    })
  const browseMods = mods.filter((mod) => !mod.installed)
  const availableCategories = ['All categories', ...new Set(browseMods.map((mod) => mod.category || 'Other'))]
  const filteredBrowseMods = browseMods.filter((mod) => {
    const matchesSearch = mod.name.toLowerCase().includes(searchText.toLowerCase())
    const matchesCategory = categoryFilter === 'All categories' || (mod.category || 'Other') === categoryFilter
    return matchesSearch && matchesCategory
  })
  const selectedBrowseMod =
    filteredBrowseMods.find((mod) => mod.fileName === selectedModFileName) ?? filteredBrowseMods[0] ?? null
  const selectedInstalledMod =
    installedMods.find((mod) => mod.fileName === selectedModFileName) ?? installedMods[0] ?? null
  const pendingUpdateCount = mods.filter((mod) => mod.installed && mod.updateAvailable).length

  function renderAbilityKeyChips(mod: CatalogMod): JSX.Element | null {
    if (!mod.abilityKey) {
      return null
    }
    return (
      <span className="flex shrink-0 gap-1">
        {mod.abilityKey.split('').map((abilityLetter) => (
          <span key={abilityLetter} className="rounded bg-black px-1.5 py-0.5 text-xs font-bold text-white">
            {abilityLetter}
          </span>
        ))}
      </span>
    )
  }

  function renderModListRow(mod: CatalogMod, isSelected: boolean): JSX.Element {
    return (
      <div
        key={mod.fileName}
        onClick={() => setSelectedModFileName(mod.fileName)}
        className={'flex cursor-pointer items-center gap-3 px-4 py-2.5 ' + (isSelected ? '' : 'hover:bg-black/20')}
        style={isSelected ? { boxShadow: 'inset 3px 0 0 ' + ACCENT, backgroundColor: 'rgba(59, 110, 165, 0.16)' } : undefined}
      >
        <ModIcon mod={mod} size="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold leading-tight text-white">{mod.name}</span>
            {mod.fileName === 'ChatTranslation.feature' && (
              <span className="flex shrink-0 items-center gap-1 self-center">
                <ThaiFlag />
                <EnglishFlag />
              </span>
            )}
            {renderAbilityKeyChips(mod)}
            <span className="shrink-0 text-[11px] text-white">{t('byAuthor', { author: mod.author || t('unknown') })}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-400">{renderDescriptionText(mod.description)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {!mod.installed && (
            <button
              onClick={() => installMod(mod.fileName)}
              title={t('install')}
              className="rounded p-1.5 text-slate-300 hover:bg-black/20 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {mod.installed && mod.updateAvailable && (
            <button
              onClick={() => installMod(mod.fileName)}
              title={t('updateAvailable')}
              className="rounded p-1.5 text-white hover:bg-black/20"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {mod.installed && (
            <button
              onClick={() => toggleMod(mod.fileName, !mod.enabled)}
              className={'w-[76px] rounded py-1 text-center text-xs font-normal ' + (mod.enabled ? 'text-white' : 'bg-black/30 text-slate-400')}
              style={mod.enabled ? { backgroundColor: ACCENT, color: ACCENT_TEXT } : undefined}
            >
              {mod.enabled ? t('enabled') : t('disabled')}
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderModDetailPanel(mod: CatalogMod | null): JSX.Element {
    if (!mod) {
      return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">{t('selectMod')}</div>
    }
    const infoRows: [string, string][] = [
      [t('infoVersion'), mod.version ? 'v' + mod.version : t('unknown')],
      [t('infoAuthor'), mod.author || t('unknown')],
      [t('infoCategory'), mod.category || 'Other'],
      [t('infoFileName'), mod.fileName]
    ]
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <ModIcon mod={mod} size="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-white">{mod.name}</h3>
              {mod.fileName === 'ChatTranslation.feature' && (
                <span className="flex shrink-0 items-center gap-1">
                  <ThaiFlag />
                  <EnglishFlag />
                </span>
              )}
            </div>
            <p className="text-xs text-white">{t('byAuthor', { author: mod.author || t('unknown') })}</p>
          </div>
          {mod.installed && mod.updateAvailable && (
            <span className="shrink-0 rounded bg-[#35753a] px-3 py-1 text-xs font-normal text-white">
              {t('updateAvailable')}
            </span>
          )}
          {renderAbilityKeyChips(mod)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('modInfoHeading')}</h4>
            <div className="flex flex-col gap-1">
              {infoRows.map(([infoLabel, infoValue]) => (
                <div key={infoLabel} className="flex justify-between gap-3 text-xs">
                  <span className="shrink-0 text-slate-400">{infoLabel}</span>
                  <span className="truncate text-slate-200">{infoValue}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('descriptionHeading')}</h4>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-300">{renderDescriptionText(mod.description)}</p>
            {mod.screenshot && (
              <img src={mod.screenshot} alt="" className="mt-3 w-full rounded border border-white/10" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          {!mod.installed && (
            <button
              onClick={() => installMod(mod.fileName)}
              className="rounded px-5 py-1.5 text-[13px] font-normal hover:brightness-125"
              style={{ backgroundColor: ACCENT, color: ACCENT_TEXT }}
            >
              {t('install')}
            </button>
          )}
          {mod.installed && (
            <button
              onClick={() => toggleMod(mod.fileName, !mod.enabled)}
              className={'w-[92px] rounded py-1.5 text-center text-[13px] font-normal ' + (mod.enabled ? 'hover:brightness-125' : 'bg-black/30 text-slate-300')}
              style={mod.enabled ? { backgroundColor: ACCENT, color: ACCENT_TEXT } : undefined}
            >
              {mod.enabled ? t('enabled') : t('disabled')}
            </button>
          )}
          {mod.installed && mod.fileName === TRANSLATION_FEATURE_FILE_NAME && (
            <button
              onClick={() => window.modManager.openTranslationLog()}
              className="flex items-center gap-1.5 rounded border border-white/25 px-4 py-1.5 text-[13px] font-normal text-slate-300 hover:bg-white/10"
            >
              <FileText className="h-3.5 w-3.5" />
              {t('viewLog')}
            </button>
          )}
          {mod.installed && (
            <button
              onClick={() => uninstallMod(mod.fileName)}
              className="ml-auto flex items-center gap-1.5 rounded border border-[#c96a6a]/50 px-4 py-1.5 text-[13px] font-normal text-[#e08a8a] hover:bg-[#c96a6a]/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('uninstall')}
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderNavItem(key: PageKey, label: string, icon: JSX.Element): JSX.Element {
    const isActive = page === key
    return (
      <button
        onClick={() => setPage(key)}
        className={'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ' + (isActive ? 'text-white' : 'text-slate-400 hover:bg-black/20')}
      >
        {icon}
        {label}
      </button>
    )
  }

  const pageTitles: Record<PageKey, string> = {
    browse: t('browseMods'),
    installed: t('installedMods'),
    settings: t('settings'),
    credits: t('credits')
  }
  const pageIcons: Record<PageKey, JSX.Element> = {
    browse: <Library className="h-6 w-6" />,
    installed: <HardDrive className="h-6 w-6" />,
    settings: <Settings className="h-6 w-6" />,
    credits: <Info className="h-6 w-6" />
  }

  return (
    <div className="flex h-screen flex-col text-slate-200" style={{ backgroundColor: APP_BACKGROUND }}>
      <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 flex-col border-r border-white/20 p-3" style={{ backgroundColor: CHROME_BACKGROUND }}>
        <div className="mb-5 flex items-center gap-2 px-2 pt-2">
          <Settings className="h-7 w-7 text-white" />
          <div className="text-sm font-bold text-white">MOD MANAGER</div>
        </div>

        <nav className="flex flex-col gap-1">
          {renderNavItem('browse', t('browseModsNav'), <Library className="h-5 w-5" />)}
          {renderNavItem('installed', t('installedModsNav'), <HardDrive className="h-5 w-5" />)}
          {renderNavItem('settings', t('settings'), <Settings className="h-5 w-5" />)}
          {renderNavItem('credits', t('credits'), <Info className="h-5 w-5" />)}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={launchModded}
            disabled={launchingGame}
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white hover:brightness-125 disabled:opacity-70"
            style={{ backgroundColor: ACCENT, color: ACCENT_TEXT }}
          >
            {launchingGame ? t('launching') : t('launch')}
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-white/20 px-6 py-3.5" style={{ backgroundColor: CHROME_BACKGROUND }}>
          <div className="flex items-center gap-2.5 text-white">
            {pageIcons[page]}
            <h1 className="text-lg font-bold text-white">{pageTitles[page]}</h1>
            {isDevBuild && (
              <span className="rounded bg-[#8a5a1f] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                Dev
              </span>
            )}
            {page === 'settings' && (
              <div className="ml-auto flex items-center gap-2 text-[13px] font-normal">
                <span className="text-slate-400">
                  {t('version')} {appVersion || t('unknown')}
                </span>
                <span className="text-slate-600">|</span>
                {updateReadyVersion ? (
                  <button onClick={() => window.modManager.installUpdate()} className="text-[#7fb2e5] hover:underline">
                    {t('restartNow')}
                  </button>
                ) : (
                  <button
                    onClick={checkForUpdates}
                    disabled={checkingForUpdates || downloadProgress !== null}
                    className="text-[#7fb2e5] hover:underline disabled:opacity-60"
                  >
                    {checkingForUpdates ? t('checking') : t('checkForUpdates')}
                  </button>
                )}
              </div>
            )}
          </div>
          {page === 'browse' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="appearance-none rounded-md border border-white/20 py-1.5 pl-3 pr-9 text-[13px] text-slate-200 outline-none"
                  style={{ backgroundColor: SIDEBAR_BACKGROUND }}
                >
                  {availableCategories.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>{categoryName === 'All categories' ? t('allCategories') : categoryName}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('searchMods')}
                  className="w-full rounded-md border border-white/20 py-1.5 pl-9 pr-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-500"
                  style={{ backgroundColor: SIDEBAR_BACKGROUND }}
                />
              </div>
            </div>
          )}
          {page === 'installed' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={applyEnabled}
                className="rounded px-3 py-1.5 text-[13px] font-normal hover:brightness-125"
                style={{ backgroundColor: ACCENT, color: ACCENT_TEXT }}
              >
                {t('applyEnabled')}
              </button>
              <button
                onClick={unapplyAll}
                className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-normal text-slate-300 hover:bg-white/10"
              >
                {t('unapplyAll')}
              </button>
              <button
                onClick={pendingUpdateCount > 0 ? updateAllMods : checkForModUpdates}
                className={
                  pendingUpdateCount > 0
                    ? 'flex items-center gap-2 rounded bg-[#35753a] px-3 py-1.5 text-[13px] font-normal text-white hover:brightness-125'
                    : 'flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-normal text-slate-300 hover:bg-white/10'
                }
              >
                <RefreshCw className="h-4 w-4" />
                {pendingUpdateCount > 0 ? t('updateCountMods', { count: pendingUpdateCount }) : t('checkModUpdates')}
              </button>
              <button
                onClick={addCustomMod}
                className="ml-auto flex items-center gap-2 rounded border border-white/20 px-3 py-1.5 text-[13px] font-normal text-slate-200 hover:bg-black/20"
                style={{ backgroundColor: SIDEBAR_BACKGROUND }}
              >
                <Plus className="h-4 w-4" />
                {t('customMod')}
              </button>
            </div>
          )}
        </header>

        <div className={'min-h-0 flex-1 ' + (page === 'browse' || page === 'installed' ? 'overflow-hidden' : 'overflow-y-auto px-8 py-5')}>
          {page === 'browse' && (
            <div className="flex h-full">
              <div className="min-w-0 flex-1 overflow-y-auto">
                {filteredBrowseMods.length === 0 ? (
                  <p className="px-8 py-5 text-sm text-slate-500">
                    {catalogUnavailable ? t('catalogUnavailable') : t('noModsMatch')}
                  </p>
                ) : (
                  filteredBrowseMods.map((mod) => renderModListRow(mod, mod.fileName === selectedBrowseMod?.fileName))
                )}
              </div>
              <div className="w-[420px] shrink-0 border-l border-white/20" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                {renderModDetailPanel(selectedBrowseMod)}
              </div>
            </div>
          )}

          {page === 'installed' && (
            <div className="flex h-full">
              <div className="min-w-0 flex-1 overflow-y-auto">
                {installedMods.length === 0 ? (
                  <p className="px-8 py-5 text-sm text-slate-500">{t('noModsInstalled')}</p>
                ) : (
                  installedMods.map((mod) => renderModListRow(mod, mod.fileName === selectedInstalledMod?.fileName))
                )}
              </div>
              <div className="w-[420px] shrink-0 border-l border-white/20" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                {renderModDetailPanel(selectedInstalledMod)}
              </div>
            </div>
          )}

          {page === 'settings' && (
            <div className="mx-auto max-w-4xl space-y-6 text-sm">
              {(updateMessage || downloadProgress) && (
                <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                  {updateMessage && <p className="text-slate-400">{t(updateMessage.key, updateMessage.params)}</p>}
                  {downloadProgress && (
                    <div className={updateMessage ? 'mt-3' : ''}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                        <span>{t('downloadingUpdate')}</span>
                        <span>{downloadProgress.percent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full transition-[width] duration-200"
                          style={{ width: downloadProgress.percent + '%', backgroundColor: ACCENT }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                        <span>
                          {downloadProgress.total > 0
                            ? formatByteSize(downloadProgress.transferred) + ' / ' + formatByteSize(downloadProgress.total)
                            : t('starting')}
                          {downloadProgress.bytesPerSecond > 0 && ' at ' + formatSpeed(downloadProgress.bytesPerSecond)}
                        </span>
                        <button
                          onClick={() => window.modManager.cancelUpdate()}
                          className="rounded px-2.5 py-1 font-normal text-white hover:brightness-125"
                          style={{ backgroundColor: '#5b6070' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('languageAndChatSection')}</h2>

                <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h3 className="mb-1 font-semibold text-white">{t('language')}</h3>
                      <p className="text-slate-400">{t('languageDescription')}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => changeUiLanguage('en')}
                        className={'flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-normal ' + (uiLanguage === 'en' ? 'text-white' : 'bg-black/30 text-slate-400')}
                        style={uiLanguage === 'en' ? { backgroundColor: ACCENT, color: ACCENT_TEXT } : undefined}
                      >
                        <EnglishFlag />
                        English
                      </button>
                      <button
                        onClick={() => changeUiLanguage('th')}
                        className={'flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-normal ' + (uiLanguage === 'th' ? 'text-white' : 'bg-black/30 text-slate-400')}
                        style={uiLanguage === 'th' ? { backgroundColor: ACCENT, color: ACCENT_TEXT } : undefined}
                      >
                        <ThaiFlag />
                        ไทย
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 font-semibold text-white">{t('translationCache')}</h3>
                      <p className="text-slate-400">{t('translationCacheDescription')}</p>
                      {cacheInfo && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="shrink-0 text-slate-500">
                            {t('savedTranslations', { count: cacheInfo.entryCount, size: formatByteSize(cacheInfo.sizeBytes) })}
                          </span>
                          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-black/40">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: Math.max(1, Math.min(100, (cacheInfo.sizeBytes / CACHE_LIMIT_BYTES) * 100)) + '%',
                                backgroundColor: ACCENT
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex w-[168px] shrink-0 flex-col gap-2">
                      <button
                        onClick={clearTranslationCache}
                        className="rounded-md border border-[#c96a6a]/50 px-3 py-1.5 text-[13px] font-normal text-[#e08a8a] hover:bg-[#c96a6a]/20"
                      >
                        {t('clearCache')}
                      </button>
                      <button
                        onClick={() => window.modManager.openTranslationCacheFolder()}
                        className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-normal text-slate-300 hover:bg-white/10"
                      >
                        {t('openCacheFolder')}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('systemSection')}</h2>

                <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h3 className="mb-1 font-semibold text-white">{t('desktopShortcuts')}</h3>
                      <p className="text-slate-400">{t('desktopShortcutsDescription')}</p>
                      {shortcutStatusMessage && <p className="mt-3 text-slate-400">{shortcutStatusMessage}</p>}
                    </div>
                    <button
                      onClick={createDesktopShortcuts}
                      className="shrink-0 rounded-md bg-[#35753a] px-4 py-1.5 text-[13px] font-normal text-white hover:brightness-125"
                    >
                      {t('createShortcuts')}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h3 className="mb-1 font-semibold text-white">{t('logs')}</h3>
                      <p className="text-slate-400">{t('logsDescription')}</p>
                    </div>
                    <button
                      onClick={() => window.modManager.openLogsFolder()}
                      className="shrink-0 rounded-md border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] font-normal text-slate-300 hover:bg-white/10"
                    >
                      {t('openLogsFolder')}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {page === 'credits' && (
            <div className="max-w-xl space-y-4 text-sm">
              <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                <h2 className="mb-2 font-semibold text-white">Credits</h2>
                <p className="text-slate-400">
                  Mods and manager by Doogle, creator of{' '}
                  <a href="https://ward-up.com" target="_blank" rel="noreferrer" className="text-white hover:underline">
                    WardUp
                  </a>
                  .
                </p>
                <p className="mt-1 text-slate-400">Built on the .honmod format for Heroes of Newerth Reborn.</p>
                <a
                  href="https://github.com/doogle-dev/honmodmanager"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-normal text-slate-200 hover:bg-white/10"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </div>
            </div>
          )}
        </div>

      </main>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-8 py-2" style={{ backgroundColor: CHROME_BACKGROUND }}>
        <span className="block h-4 min-w-0 truncate text-xs text-white">{status}</span>
        {updateReadyVersion && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-400">{t('updateReady', { version: updateReadyVersion })}</span>
            <button
              onClick={() => window.modManager.installUpdate()}
              className="rounded px-2.5 py-1 text-xs font-normal text-white hover:brightness-125"
              style={{ backgroundColor: ACCENT, color: ACCENT_TEXT }}
            >
              {t('restartNow')}
            </button>
          </div>
        )}
      </footer>

    </div>
  )
}

export default App
