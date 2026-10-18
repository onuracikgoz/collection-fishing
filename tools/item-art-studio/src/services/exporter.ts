import { strToU8, zipSync } from 'fflate'
import { downloadBlob } from './imageIO'

export interface ExportFile {
  // ZIP içindeki yol, ör. `png/crystal_shard_gold.png`.
  path: string
  data: Uint8Array
}

export function jsonFile(path: string, value: unknown): ExportFile {
  return { path, data: strToU8(JSON.stringify(value, null, 2) + '\n') }
}

export async function blobFile(path: string, blob: Blob): Promise<ExportFile> {
  return { path, data: new Uint8Array(await blob.arrayBuffer()) }
}

export function downloadZip(files: ExportFile[], zipName: string): void {
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) entries[file.path] = file.data
  // PNG zaten sıkıştırılmış; level 0 hızlıdır ve boyutu pek değiştirmez.
  const zipped = zipSync(entries, { level: 0 })
  downloadBlob(new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }), zipName)
}

export function downloadSingle(file: ExportFile, type: string): void {
  const name = file.path.split('/').pop() ?? file.path
  downloadBlob(new Blob([file.data.buffer as ArrayBuffer], { type }), name)
}
