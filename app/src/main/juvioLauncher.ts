import { join } from 'path'
import { existsSync } from 'fs'
import { spawn, ChildProcess } from 'child_process'

const MODDED_LAUNCH_ARGUMENT = 'heroes of newerth;mods'

export function locateJuvioRoot(): string {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) {
    throw new Error('LOCALAPPDATA is not available')
  }
  const juvioRoot = join(localAppData, 'Juvio')
  if (!existsSync(juvioRoot)) {
    throw new Error('The Juvio install folder was not found')
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
