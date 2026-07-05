import { useEffect, useState } from 'react'
import {
  ChevronDown,
  HardDrive,
  Library,
  Info,
  Download,
  Trash2,
  FileText,
  Search,
  Settings,
  Plus
} from 'lucide-react'

type PageKey = 'browse' | 'installed' | 'settings' | 'credits'

const ACCENT = '#7287d9'
const APP_BACKGROUND = '#313747'
const SIDEBAR_BACKGROUND = '#1b1c21'

function ModIcon({ mod, size }: { mod: CatalogMod; size: string }): JSX.Element {
  if (mod.icon) {
    return <img src={mod.icon} alt="" className={size + ' object-contain'} />
  }
  return <div className={size + ' rounded bg-black/30'} />
}

function formatMegabytes(byteCount: number): string {
  return (byteCount / (1024 * 1024)).toFixed(1) + ' MB'
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
  const [detailMod, setDetailMod] = useState<CatalogMod | null>(null)
  const [launchingGame, setLaunchingGame] = useState(false)
  const [updateReadyVersion, setUpdateReadyVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [updateCheckMessage, setUpdateCheckMessage] = useState('')
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)

  async function loadCatalog(): Promise<void> {
    try {
      const result = await window.modManager.listCatalog()
      setMods(result.mods)
      if (result.catalogError) {
        setStatus('Catalog offline. Showing installed mods only.')
      }
    } catch (error) {
      setStatus('Failed to load mods: ' + String(error))
    }
  }

  useEffect(() => {
    loadCatalog()
    window.modManager.onUpdateProgress((progress) => setDownloadProgress(progress))
    window.modManager.onUpdateDownloaded((version) => {
      setDownloadProgress(null)
      setUpdateReadyVersion(version)
    })
    window.modManager.onUpdateCancelled(() => {
      setDownloadProgress(null)
      setUpdateCheckMessage('Download cancelled.')
    })
    window.modManager.onUpdateError((message) => {
      setDownloadProgress(null)
      setUpdateCheckMessage('Update download failed: ' + message)
    })
    window.modManager.getAppInfo().then((appInfo) => setAppVersion(appInfo.version))
  }, [])

  async function checkForUpdates(): Promise<void> {
    setCheckingForUpdates(true)
    setUpdateCheckMessage('Checking for updates...')
    try {
      const result = await window.modManager.checkForUpdates()
      if (result.status === 'current') {
        setUpdateCheckMessage('You are on the latest version.')
      } else if (result.status === 'downloading') {
        setUpdateReadyVersion('')
        setDownloadProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
        setUpdateCheckMessage('Update ' + result.version + ' found. Downloading now, the restart button will appear when it is ready.')
      } else if (result.status === 'unavailable') {
        setUpdateCheckMessage('Updates only work in the installed app.')
      } else {
        setUpdateCheckMessage('Update check failed: ' + (result.message ?? 'unknown error'))
      }
    } finally {
      setCheckingForUpdates(false)
    }
  }

  async function toggleMod(fileName: string, enabled: boolean): Promise<void> {
    await window.modManager.setModEnabled(fileName, enabled)
    setMods((current) => current.map((mod) => (mod.fileName === fileName ? { ...mod, enabled } : mod)))
  }

  async function installMod(fileName: string): Promise<void> {
    setStatus('Installing ' + fileName + ' ...')
    try {
      await window.modManager.installMod(fileName)
      setDetailMod(null)
      await loadCatalog()
      setStatus('Installed ' + fileName + '.')
    } catch (error) {
      setStatus('Install failed: ' + String(error))
    }
  }

  async function uninstallMod(fileName: string): Promise<void> {
    try {
      await window.modManager.uninstallMod(fileName)
      setDetailMod(null)
      await loadCatalog()
      setStatus('Uninstalled ' + fileName + '.')
    } catch (error) {
      setStatus('Uninstall failed: ' + String(error))
    }
  }

  async function addCustomMod(): Promise<void> {
    try {
      const result = await window.modManager.addCustomMod()
      if (result.added > 0) {
        await loadCatalog()
        setStatus('Added ' + result.added + ' custom mod(s).')
      }
    } catch (error) {
      setStatus('Add failed: ' + String(error))
    }
  }

  async function applyEnabled(): Promise<void> {
    setStatus('Applying...')
    try {
      const result = await window.modManager.applyEnabled()
      setStatus(result.fileCount === 0 ? 'No mods enabled. The overlay was cleared.' : 'Applied. Press Launch Modded to play.')
    } catch (error) {
      setStatus('Apply failed: ' + String(error))
    }
  }

  async function unapplyAll(): Promise<void> {
    await window.modManager.unapplyAll()
    setMods((current) => current.map((mod) => ({ ...mod, enabled: false })))
    setStatus('All mods unapplied.')
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

  function renderModCard(mod: CatalogMod): JSX.Element {
    return (
      <div
        key={mod.fileName}
        className="flex flex-col rounded-lg border border-white/20 p-4"
        style={{ backgroundColor: SIDEBAR_BACKGROUND }}
      >
        <div className="flex items-start gap-3">
          <ModIcon mod={mod} size="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-white">{mod.name}</span>
              {mod.abilityKey && (
                <span className="flex shrink-0 gap-1">
                  {mod.abilityKey.split('').map((abilityLetter) => (
                    <span key={abilityLetter} className="rounded bg-black px-1.5 py-0.5 text-xs font-bold text-white">
                      {abilityLetter}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">by {mod.author || 'unknown'}</span>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">{mod.description}</p>
        <div className="mt-3 flex items-center gap-1 border-t border-white/20 pt-3">
          {!mod.installed && (
            <button
              onClick={() => installMod(mod.fileName)}
              title="Install"
              className="rounded p-1.5 text-slate-300 hover:bg-black/20 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {mod.installed && (
            <button
              onClick={() => toggleMod(mod.fileName, !mod.enabled)}
              className={'rounded px-2.5 py-1 text-xs font-semibold ' + (mod.enabled ? 'text-white hover:brightness-110' : 'bg-black/30 text-slate-400 hover:text-slate-200')}
              style={mod.enabled ? { backgroundColor: ACCENT } : undefined}
            >
              {mod.enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
          {mod.installed && (
            <button
              onClick={() => uninstallMod(mod.fileName)}
              title="Uninstall"
              className="rounded p-1.5 text-slate-300 hover:bg-black/20 hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {mod.installed && mod.updateAvailable && (
            <button
              onClick={() => installMod(mod.fileName)}
              title="Update available"
              className="rounded p-1.5 text-amber-400 hover:bg-black/20"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setDetailMod(mod)}
            title="Details"
            className="ml-auto rounded p-1.5 text-slate-300 hover:bg-black/20 hover:text-white"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  function renderNavItem(key: PageKey, label: string, icon: JSX.Element): JSX.Element {
    const isActive = page === key
    return (
      <button
        onClick={() => setPage(key)}
        className={'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ' + (isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-black/20')}
      >
        {icon}
        {label}
      </button>
    )
  }

  const pageTitles: Record<PageKey, string> = {
    browse: 'Browse Mods',
    installed: 'Installed Mods',
    settings: 'Settings',
    credits: 'Credits'
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
      <aside className="flex w-56 flex-col border-r border-white/20 p-3" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
        <div className="mb-5 flex items-center gap-2 px-2 pt-2">
          <Settings className="h-7 w-7" style={{ color: ACCENT }} />
          <div className="text-sm font-bold text-white">MOD MANAGER</div>
        </div>

        <nav className="flex flex-col gap-1">
          {renderNavItem('browse', 'Browse mods', <Library className="h-5 w-5" />)}
          {renderNavItem('installed', 'Installed mods', <HardDrive className="h-5 w-5" />)}
          {renderNavItem('settings', 'Settings', <Settings className="h-5 w-5" />)}
          {renderNavItem('credits', 'Credits', <Info className="h-5 w-5" />)}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={launchModded}
            disabled={launchingGame}
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-70"
            style={{ backgroundColor: ACCENT }}
          >
            {launchingGame ? 'Launching...' : 'Launch'}
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-white/20 px-8 py-5" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
          <div className="flex items-center gap-3" style={{ color: ACCENT }}>
            {pageIcons[page]}
            <h1 className="text-xl font-bold text-white">{pageTitles[page]}</h1>
          </div>
          {page === 'browse' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="appearance-none rounded-md border border-white/20 py-2 pl-3 pr-9 text-sm text-slate-200 outline-none"
                  style={{ backgroundColor: SIDEBAR_BACKGROUND }}
                >
                  {availableCategories.map((categoryName) => (
                    <option key={categoryName}>{categoryName}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search mods"
                  className="w-full rounded-md border border-white/20 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  style={{ backgroundColor: SIDEBAR_BACKGROUND }}
                />
              </div>
            </div>
          )}
          {page === 'installed' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={applyEnabled}
                className="rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110"
                style={{ backgroundColor: ACCENT }}
              >
                Apply Enabled
              </button>
              <button
                onClick={unapplyAll}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-black/20"
                style={{ backgroundColor: APP_BACKGROUND }}
              >
                Unapply All
              </button>
              <button
                onClick={addCustomMod}
                className="ml-auto flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-black/20"
                style={{ backgroundColor: SIDEBAR_BACKGROUND }}
              >
                <Plus className="h-4 w-4" />
                Custom Mod
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-5">
          {page === 'browse' && (
            <>
              {filteredBrowseMods.length === 0 ? (
                <p className="text-sm text-slate-500">No mods match your search.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBrowseMods.map(renderModCard)}
                </div>
              )}
            </>
          )}

          {page === 'installed' && (
            <>
              {installedMods.length === 0 ? (
                <p className="text-sm text-slate-500">No mods installed yet. Open Browse mods to install some.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {installedMods.map(renderModCard)}
                </div>
              )}
            </>
          )}

          {page === 'settings' && (
            <div className="max-w-xl space-y-4 text-sm">
              <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                <h2 className="mb-2 font-semibold text-white">Updates</h2>
                <p className="text-slate-400">Current version {appVersion || 'unknown'}</p>
                <button
                  onClick={checkForUpdates}
                  disabled={checkingForUpdates}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
                  style={{ backgroundColor: ACCENT }}
                >
                  {checkingForUpdates ? 'Checking...' : 'Check for Updates'}
                </button>
                {updateCheckMessage && <p className="mt-3 text-slate-400">{updateCheckMessage}</p>}
                {downloadProgress && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Downloading update</span>
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
                          ? formatMegabytes(downloadProgress.transferred) + ' / ' + formatMegabytes(downloadProgress.total)
                          : 'Starting...'}
                        {downloadProgress.bytesPerSecond > 0 && ' at ' + formatSpeed(downloadProgress.bytesPerSecond)}
                      </span>
                      <button
                        onClick={() => window.modManager.cancelUpdate()}
                        className="rounded px-2.5 py-1 font-medium text-white hover:brightness-110"
                        style={{ backgroundColor: '#5b6070' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'credits' && (
            <div className="max-w-xl space-y-4 text-sm">
              <div className="rounded-lg border border-white/20 p-4" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
                <h2 className="mb-2 font-semibold text-white">Credits</h2>
                <p className="text-slate-400">
                  Mods and manager by Doogle, creator of{' '}
                  <a href="https://ward-up.com" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: ACCENT }}>
                    WardUp
                  </a>
                  .
                </p>
                <p className="mt-1 text-slate-400">Built on the classic honmod format for Heroes of Newerth Reborn.</p>
              </div>
            </div>
          )}
        </div>

      </main>
      </div>

      <footer className="flex items-center justify-between gap-4 px-8 py-2" style={{ backgroundColor: SIDEBAR_BACKGROUND }}>
        <span className="block h-4 min-w-0 truncate text-xs text-white">{status}</span>
        {updateReadyVersion && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-400">Update {updateReadyVersion} ready</span>
            <button
              onClick={() => window.modManager.installUpdate()}
              className="rounded px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110"
              style={{ backgroundColor: ACCENT }}
            >
              Restart Now
            </button>
          </div>
        )}
      </footer>

      {detailMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setDetailMod(null)}>
          <div
            className="w-full max-w-lg rounded-lg border border-white/20 p-5"
            style={{ backgroundColor: SIDEBAR_BACKGROUND }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <ModIcon mod={detailMod} size="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-white">{detailMod.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {detailMod.category} by {detailMod.author || 'unknown'}
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm text-slate-300">{detailMod.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!detailMod.installed && (
                <button
                  onClick={() => installMod(detailMod.fileName)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110"
                  style={{ backgroundColor: ACCENT }}
                >
                  Install
                </button>
              )}
              {detailMod.installed && (
                <button
                  onClick={() => uninstallMod(detailMod.fileName)}
                  className="rounded-md bg-black/20 px-4 py-2 text-sm font-medium text-slate-200 hover:text-rose-400"
                >
                  Uninstall
                </button>
              )}
              <button
                onClick={() => setDetailMod(null)}
                className="ml-auto rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-black/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
