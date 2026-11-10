import { app } from 'electron'
import { join } from 'path'
import { cpSync, existsSync, mkdirSync } from 'fs'

const VANILLA_PROFILE_NAME = 'Heroes of Newerth'

// The game names its profile folder after the last entry of the "-mod" launch argument, so a modded launch reads and writes a different folder from a normal launch.
const MODDED_PROFILE_NAME = 'mods'

// Only the settings, keybindings, saved login, and interface state are copied, so caches, logs, replays, and screenshots stay with the profile that made them.
const PROFILE_SETTINGS_ENTRIES = [
  'startup.cfg',
  'login.cfg',
  'game_settings_local.cfg',
  'voice_config.cfg',
  'persistentselectiongroups.json',
  'bindings',
  'luadata'
]

function findJuvioDocumentsDirectory(): string | null {
  const candidates: string[] = [
    join(app.getPath('documents'), 'Juvio'),
    join(app.getPath('home'), 'Documents', 'Juvio'),
    join(app.getPath('home'), 'OneDrive', 'Documents', 'Juvio')
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, VANILLA_PROFILE_NAME, 'startup.cfg'))) {
      return candidate
    }
  }
  return null
}

export function copyVanillaSettingsToModdedProfile(): string[] | null {
  const juvioDocumentsDirectory = findJuvioDocumentsDirectory()
  if (!juvioDocumentsDirectory) {
    return null
  }
  const vanillaProfileDirectory = join(juvioDocumentsDirectory, VANILLA_PROFILE_NAME)
  const moddedProfileDirectory = join(juvioDocumentsDirectory, MODDED_PROFILE_NAME)
  mkdirSync(moddedProfileDirectory, { recursive: true })
  const copiedEntryNames: string[] = []
  for (const entryName of PROFILE_SETTINGS_ENTRIES) {
    const sourcePath = join(vanillaProfileDirectory, entryName)
    if (existsSync(sourcePath)) {
      cpSync(sourcePath, join(moddedProfileDirectory, entryName), { recursive: true })
      copiedEntryNames.push(entryName)
    }
  }
  return copiedEntryNames
}
