import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { spawn, exec, execFileSync, ChildProcess } from 'child_process'

const MODDED_LAUNCH_ARGUMENT = 'heroes of newerth;mods'

const UNINSTALL_REGISTRY_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Juvio',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Heroes of Newerth: Reborn',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Juvio',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Juvio'
]

export function isJuvioRoot(candidate: string): boolean {
  return existsSync(join(candidate, 'bin', 'juvio.exe'))
}

// People tend to pick the folder they recognise, which may be bin or the game folder
// inside the install rather than the install itself, so the parent is accepted too.
export function normalizeChosenJuvioRoot(chosenFolder: string): string | null {
  for (const candidate of [chosenFolder, dirname(chosenFolder)]) {
    if (isJuvioRoot(candidate)) {
      return candidate
    }
  }
  return null
}

function readRegistryInstallLocation(registryKey: string): string | null {
  try {
    const output = execFileSync('reg', ['query', registryKey, '/v', 'InstallLocation'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const match = output.match(/InstallLocation\s+REG_(?:EXPAND_)?SZ\s+(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

// The fast installer always uses LOCALAPPDATA, but a custom install can live anywhere,
// so the location Juvio registers for its uninstaller is checked first.
function juvioRootCandidates(): string[] {
  const candidates: string[] = []
  for (const registryKey of UNINSTALL_REGISTRY_KEYS) {
    const installLocation = readRegistryInstallLocation(registryKey)
    if (installLocation) {
      candidates.push(installLocation)
    }
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Juvio'))
  }
  return candidates
}

let cachedJuvioRoot: string | null = null
let juvioRootOverride: string | null = null

export function setJuvioRootOverride(chosenRoot: string | null): void {
  juvioRootOverride = chosenRoot
  cachedJuvioRoot = null
}

export function detectJuvioRoot(): string | null {
  if (juvioRootOverride && isJuvioRoot(juvioRootOverride)) {
    return juvioRootOverride
  }
  if (cachedJuvioRoot && isJuvioRoot(cachedJuvioRoot)) {
    return cachedJuvioRoot
  }
  cachedJuvioRoot = juvioRootCandidates().find(isJuvioRoot) ?? null
  return cachedJuvioRoot
}

export function locateJuvioRoot(): string {
  const juvioRoot = detectJuvioRoot()
  if (!juvioRoot) {
    throw new Error('The Juvio install folder was not found. Choose the game folder in Settings.')
  }
  return juvioRoot
}

export function baseArchivePath(juvioRoot: string): string {
  return join(juvioRoot, 'heroes of newerth', 'resources0.jz')
}

export function modsOverlayArchivePath(juvioRoot: string): string {
  return join(juvioRoot, 'mods', 'resources0.jz')
}

export function launchGame(juvioRoot: string, withMods: boolean, extraConsoleCommands: string[] = []): ChildProcess {
  const executablePath = join(juvioRoot, 'bin', 'juvio.exe')
  const launchArguments = withMods ? ['-mod', MODDED_LAUNCH_ARGUMENT] : []
  launchArguments.push(...extraConsoleCommands)
  const child = spawn(executablePath, launchArguments, {
    cwd: juvioRoot,
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  return child
}

export function isGameProcessRunning(callback: (running: boolean) => void): void {
  exec('tasklist /FI "IMAGENAME eq juvio.exe" /FO CSV /NH', (error, stdout) => {
    callback(!error && /juvio\.exe/i.test(stdout ?? ''))
  })
}

export function whenGameFullyExits(gameProcess: ChildProcess, callback: () => void): void {
  gameProcess.once('exit', () => {
    const pollTimer = setInterval(() => {
      isGameProcessRunning((running) => {
        if (!running) {
          clearInterval(pollTimer)
          callback()
        }
      })
    }, 4000)
  })
}
