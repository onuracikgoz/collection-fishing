import { DEFAULT_PREPARE } from '../engine/pipeline'
import type { ProjectState } from '../models/project'

// Çalışma tarayıcıda (IndexedDB) otomatik saklanır; sayfa yenilense de
// kaybolmaz. Yalnızca bu tarayıcıda durur, kalıcı kayıt ZIP / studio.json'dır.
const DB_NAME = 'item-art-studio'
const STORE = 'project'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB açılamadı.'))
  })
}

export async function loadProject(): Promise<ProjectState | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
    request.onsuccess = () => {
      const project = (request.result as ProjectState | undefined) ?? null
      // Eski kayıtta olmayan yeni ayarlar (kontur, ton, 32 sadeleştirme) varsayılanı alır.
      if (project) project.images = project.images.map((i) => ({ ...i, prepare: { ...DEFAULT_PREPARE, ...i.prepare } }))
      resolve(project)
    }
    request.onerror = () => reject(request.error ?? new Error('Kayıt okunamadı.'))
  })
}

export async function saveProject(project: ProjectState): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(project, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Kayıt yazılamadı.'))
  })
}
