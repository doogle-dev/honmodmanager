# Heroes of Newerth Reborn Mod Manager

An open mod manager for Heroes of Newerth Reborn. It installs honmod files without any closed source tool, applies them into the game, and launches the game with your mods active.

## What is here

- `honmod_manager.py` is the dark mode window. Run it to enable mods, apply them, and launch the game.
- `honmod_applier.py` is the engine underneath. It reads a honmod, applies its edits and file additions to the game files, and writes a single overlay archive the game loads.
- `mods` holds the honmod files you want to use. The manager reads this folder.
- `mod_sources` holds the source assets and build scripts for the mods made here.

## How to use

1. Put your honmod files in the `mods` folder.
2. Run `honmod_manager.py`.
3. Tick the mods you want and press Apply Enabled.
4. Press Launch Modded to play with mods, or Launch Vanilla to play without them.

## Requirements

- Python 3
- 7-Zip
- customtkinter (install with `pip install customtkinter`)

## Notes

The manager launches the game from the Juvio root folder, the same working directory the normal shortcut uses, so your in game settings are preserved. Cursor size is adjusted in the game Options with the cursor size slider.
# honmodmanager
