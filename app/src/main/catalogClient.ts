import { createHash } from 'crypto'
import { writeFileSync } from 'fs'
import { basename, join } from 'path'
import { logLine } from './managerLogger'

export interface CatalogModEntry {
  id: string
  fileName: string
  name: string
  version: string
  author: string
  description: string
  category: string
  abilityKey: string
  icon: string
  screenshot?: string
  download: string
  sha256: string
}

export interface Catalog {
  manager: { version: string }
  mods: CatalogModEntry[]
}

function withoutTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function resolveCatalogUrl(baseUrl: string, relativePath: string): string {
  return withoutTrailingSlash(baseUrl) + '/' + relativePath.replace(/^\/+/, '')
}

export interface FetchedCatalog {
  catalog: Catalog
  baseUrl: string
}

const CATALOG_HOST_TIMEOUT_MILLISECONDS = 12000

function hostNameOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function describeFetchFailure(error: unknown): string {
  const errorObject = error as { name?: string; message?: string; cause?: { code?: string; message?: string } }
  if (errorObject && errorObject.name === 'TimeoutError') {
    return 'no response after ' + Math.round(CATALOG_HOST_TIMEOUT_MILLISECONDS / 1000) + ' seconds'
  }
  if (errorObject && errorObject.cause && (errorObject.cause.code || errorObject.cause.message)) {
    return String(errorObject.cause.code || errorObject.cause.message)
  }
  return errorObject && errorObject.message ? errorObject.message : String(error)
}

async function fetchCatalogFromBase(baseUrl: string): Promise<Catalog> {
  const catalogUrl = withoutTrailingSlash(baseUrl) + '/catalog.json'
  const response = await fetch(catalogUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(CATALOG_HOST_TIMEOUT_MILLISECONDS)
  })
  if (!response.ok) {
    throw new Error('HTTP ' + response.status)
  }
  const bodyText = await response.text()
  let catalog: Catalog
  try {
    catalog = JSON.parse(bodyText) as Catalog
  } catch {
    throw new Error('HTTP ' + response.status + ' but the body was not JSON, it started with ' + JSON.stringify(bodyText.slice(0, 40)))
  }
  if (!catalog || !Array.isArray(catalog.mods)) {
    throw new Error('HTTP ' + response.status + ' but the JSON had no mods list')
  }
  return catalog
}

export async function fetchCatalog(baseUrls: string[]): Promise<FetchedCatalog> {
  const failures: string[] = []
  for (const baseUrl of baseUrls) {
    const startedAt = Date.now()
    try {
      const catalog = await fetchCatalogFromBase(baseUrl)
      logLine('app', 'catalog loaded from ' + baseUrl + ' with ' + catalog.mods.length + ' mods in ' + (Date.now() - startedAt) + 'ms')
      return { catalog, baseUrl }
    } catch (error) {
      const reason = describeFetchFailure(error)
      logLine('error', 'catalog host failed: ' + baseUrl + '/catalog.json, ' + reason + ', after ' + (Date.now() - startedAt) + 'ms')
      failures.push(hostNameOf(baseUrl) + ': ' + reason)
    }
  }
  throw new Error(failures.join(', '))
}

export async function downloadAndVerify(url: string, expectedSha256: string): Promise<Buffer> {
  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  } catch (error) {
    const reason = describeFetchFailure(error)
    logLine('error', 'download failed: ' + url + ', ' + reason + ', after ' + (Date.now() - startedAt) + 'ms')
    throw new Error(hostNameOf(url) + ': ' + reason + ' while downloading ' + basename(url))
  }
  if (!response.ok) {
    logLine('error', 'download failed: ' + url + ', HTTP ' + response.status + ', after ' + (Date.now() - startedAt) + 'ms')
    throw new Error(hostNameOf(url) + ': HTTP ' + response.status + ' while downloading ' + basename(url))
  }
  const downloadedBytes = Buffer.from(await response.arrayBuffer())
  const actualSha256 = createHash('sha256').update(downloadedBytes).digest('hex')
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    logLine('error', 'download checksum mismatch: ' + url + ', expected ' + expectedSha256 + ', got ' + actualSha256 + ', ' + downloadedBytes.length + ' bytes')
    throw new Error('Checksum did not match for ' + basename(url) + ', the file on the server differs from the catalog entry')
  }
  logLine('app', 'downloaded ' + url + ', ' + downloadedBytes.length + ' bytes in ' + (Date.now() - startedAt) + 'ms')
  return downloadedBytes
}

export async function installCatalogMod(
  baseUrl: string,
  entry: CatalogModEntry,
  libraryDirectory: string
): Promise<void> {
  if (!entry.sha256) {
    throw new Error('The catalog entry has no checksum: ' + entry.fileName)
  }
  const honmodBytes = await downloadAndVerify(resolveCatalogUrl(baseUrl, entry.download), entry.sha256)
  writeFileSync(join(libraryDirectory, basename(entry.fileName)), honmodBytes)
}
