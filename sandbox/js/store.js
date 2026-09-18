// store.js — persistence. Board state in localStorage; uploaded art in IndexedDB.

const KEY = "tt:state:v1";
const PREF = "tt:prefs:v1";

export function loadState() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
let timer = null;
export function saveState(state, immediate = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };
  if (immediate) { clearTimeout(timer); timer = null; write(); return; }
  clearTimeout(timer);
  timer = setTimeout(write, 100);
}
export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF) || "{}"); } catch { return {}; }
}
export function savePrefs(p) { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* ignore */ } }

// ---- IndexedDB for uploaded images ----
const DB = "token-table";
const STORE = "art";
function db() {
  return new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function tx(mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
  }));
}
export const putBlob = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getBlob = (key) => tx("readonly", (s) => s.get(key));
export const deleteBlob = (key) => tx("readwrite", (s) => s.delete(key));

const urls = new Map();
export async function blobUrl(key) {
  if (urls.has(key)) return urls.get(key);
  try {
    const b = await getBlob(key);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urls.set(key, u);
    return u;
  } catch { return null; }
}

// Downscale a picked image so a phone's storage is not filled by 12 MB photos.
export function shrinkImage(file, max = 640) {
  return new Promise((res, rej) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(src); rej(new Error("not an image")); };
    img.src = src;
  });
}
