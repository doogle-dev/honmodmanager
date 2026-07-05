# Heroes of Newerth Reborn Mod Manager

An open mod manager for Heroes of Newerth Reborn. It installs honmod files, applies them into the game, and launches the game with your mods active. It is an Electron and React desktop app that ships as a self updating Windows program.

## What it does

- Browse a catalog of mods and install them with one click, with checksum verified downloads.
- Add your own honmod files from disk.
- Enable, disable, apply, and uninstall mods.
- Launch the game modded or vanilla from the correct working directory so your in game settings are preserved.

## Develop

The app lives in the `app` folder.

```
cd app
npm install
npm run dev
```

## Build the Windows program

```
cd app
npm run build:win
```
