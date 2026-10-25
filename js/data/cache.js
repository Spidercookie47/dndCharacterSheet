/* Client-side cache for downloaded content packs (IndexedDB, with a localStorage fallback). */
const Cache = {
  _db: null,
  async open() {
    if (this._db) return this._db;
    if (!('indexedDB' in window)) return null;
    this._db = await new Promise((res) => {
      try {
        const rq = indexedDB.open('hearthscribe', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('packs', { keyPath: 'id' });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch (e) {
        res(null);
      }
    });
    return this._db;
  },
  async all() {
    const db = await this.open();
    if (!db) {
      try {
        return JSON.parse(localStorage.getItem('hs-packs') || '[]');
      } catch (e) {
        return [];
      }
    }
    return new Promise((res) => {
      const rq = db.transaction('packs').objectStore('packs').getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => res([]);
    });
  },
  async put(pack) {
    const db = await this.open();
    if (!db) {
      const a = (await this.all()).filter((p) => p.id !== pack.id);
      a.push(pack);
      try {
        localStorage.setItem('hs-packs', JSON.stringify(a));
      } catch (e) {}
      return;
    }
    return new Promise((res) => {
      const tx = db.transaction('packs', 'readwrite');
      tx.objectStore('packs').put(pack);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  },
  async del(id) {
    const db = await this.open();
    if (!db) {
      const a = (await this.all()).filter((p) => p.id !== id);
      try {
        localStorage.setItem('hs-packs', JSON.stringify(a));
      } catch (e) {}
      return;
    }
    return new Promise((res) => {
      const tx = db.transaction('packs', 'readwrite');
      tx.objectStore('packs').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  },
};
