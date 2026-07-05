# Catalog server

Serves the public mod catalog for the Heroes of Newerth Reborn Mod Manager. No accounts and no user data. Everything is static files over https through your Cloudflare tunnel.

## Build the catalog content

Run this whenever a mod changes. It reads the honmod files in the mods folder and writes catalog.json, the honmod files, and the icons into a catalog folder.

```
python build_catalog.py
```

## Run locally for development

```
python -m http.server 8787 --directory catalog
```

The manager reads its catalog from http://localhost:8787 in development.

## Deploy with Docker

Build the catalog first, then bring up the container. Point your Cloudflare tunnel at port 8787.

```
python build_catalog.py
docker compose up -d --build
```

The manager reads its catalog from the HON_CATALOG_URL value when it is set, otherwise from the development url.
