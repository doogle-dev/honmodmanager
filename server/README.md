# Catalog

The public mod catalog for the Heroes of Newerth Reborn Mod Manager. No accounts and no user data. It is just static files, and it is served straight from this GitHub repository through raw content, so there is no server to run.

## How serving works

The `catalog` folder in this repository is the catalog. The manager reads it from the raw content of the `main` branch:

```
https://raw.githubusercontent.com/doogle-dev/honmodmanager/main/server/catalog
```

Pushing an updated `catalog` folder to `main` updates the mods for every user right away. No release and no deploy step are needed for mod changes.

## Build the catalog content

Run this whenever a mod changes. It reads the honmod files in the mods folder and writes catalog.json, the honmod files, and the icons into the catalog folder. Then commit the catalog folder and push to main.

```
python build_catalog.py
```

## Run locally for development

The manager reads from http://localhost:8787 in development, or from the HON_CATALOG_URL value when it is set. To serve the catalog locally:

```
python -m http.server 8787 --directory catalog
```
