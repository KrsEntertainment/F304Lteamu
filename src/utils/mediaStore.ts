const DB_NAME = 'f304lteam_media_db';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

const objectUrlCache = new Map<string, string>();

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен в этом браузере'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isIdbRef(url?: string): boolean {
  return Boolean(url && url.startsWith('idb://'));
}

/**
 * Stores a File/Blob selected directly from device gallery into IndexedDB
 * and returns a persistent `idb://...` key.
 */
export async function saveGalleryFile(file: File): Promise<string> {
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const key = `idb://${id}`;
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const objUrl = URL.createObjectURL(file);
    objectUrlCache.set(key, objUrl);
    return key;
  } catch {
    // Fallback to temporary ObjectURL if IndexedDB is restricted (e.g. private iframe)
    const objUrl = URL.createObjectURL(file);
    objectUrlCache.set(key, objUrl);
    return objUrl;
  }
}

/**
 * Resolves an `idb://...` reference to a playable/displayable ObjectURL.
 * Regular http(s), relative `/images/...`, or data: URLs are returned as-is.
 */
export async function resolveMediaUrl(ref?: string): Promise<string> {
  if (!ref) return '';
  if (!isIdbRef(ref)) return ref;

  const cached = objectUrlCache.get(ref);
  if (cached) return cached;

  const id = ref.replace('idb://', '');
  try {
    const db = await openMediaDB();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(ref, url);
    return url;
  } catch {
    return '';
  }
}

export async function deleteGalleryFile(ref?: string): Promise<void> {
  if (!ref || !isIdbRef(ref)) return;
  const cached = objectUrlCache.get(ref);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(ref);
  }
  const id = ref.replace('idb://', '');
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup failures
  }
}

export async function getMediaStorageStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as Blob[]) || [];
        const totalBytes = items.reduce((acc, b) => acc + (b?.size || 0), 0);
        resolve({ count: items.length, totalBytes });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

export async function clearAllGalleryMedia(): Promise<void> {
  objectUrlCache.forEach((url) => URL.revokeObjectURL(url));
  objectUrlCache.clear();
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generates a lightweight zero-dependency Node.js server.js
 * for self-hosting index + js + data.json in online mode without any database.
 */
export function generateMinimalServerJs(): string {
  return `// F304Lteam — Минимальный онлайн-сервер без базы данных (index + js + json + server)
// Запуск: node server.js (откроется на http://localhost:3000)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ catalog: [], actors: [], news: [] }, null, 2));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Онлайн API чтения/записи JSON-каталога
  if (req.url === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return fs.createReadStream(DATA_FILE).pipe(res);
  }

  if (req.url === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body);
        fs.writeFileSync(DATA_FILE, body, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Раздача статических файлов (index.html, assets, images, uploads)
  const cleanUrl = (req.url || '/').split('?')[0];
  let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log('F304Lteam Online Cinema Server запущен: http://localhost:' + PORT);
});
`;
}
