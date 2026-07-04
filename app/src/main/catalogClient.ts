import { createHash } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'

export interface CatalogModEntry {
  id: string
  fileName: string
  name: string
  version: string
  author: string
  description: string
  category: string
  icon: string
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

export async function fetchCatalog(baseUrl: string): Promise<Catalog> {
  const response = await fetch(withoutTrailingSlash(baseUrl) + '/catalog.json')
  if (!response.ok) {
    throw new Error('Catalog request failed with status ' + response.status)
  }
  return (await response.json()) as Catalog
}

export async function downloadAndVerify(url: string, expectedSha256: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Download failed with status ' + response.status)
  }
  const downloadedBytes = Buffer.from(await response.arrayBuffer())
  const actualSha256 = createHash('sha256').update(downloadedBytes).digest('hex')
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new Error('Checksum did not match for ' + url)
  }
  return downloadedBytes
}

export async function installCatalogMod(
  baseUrl: string,
  entry: CatalogModEntry,
  libraryDirectory: string
): Promise<void> {
  const honmodBytes = await downloadAndVerify(resolveCatalogUrl(baseUrl, entry.download), entry.sha256)
  writeFileSync(join(libraryDirectory, entry.fileName), honmodBytes)
}
