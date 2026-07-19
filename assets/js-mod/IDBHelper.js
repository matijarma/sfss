export class IDBHelper {
    constructor(dbName = 'SFSSDB', storeName = 'sceneImages', version = 3) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    async connect() {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('sceneImages')) {
                    db.createObjectStore('sceneImages');
                }
                if (!db.objectStoreNames.contains('scripts')) {
                    db.createObjectStore('scripts', { keyPath: 'id' });
                }
            };

            request.onblocked = () => {
                reject(new Error(`IndexedDB open blocked: another connection to "${this.dbName}" is holding an older version open (close other tabs).`));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                // Another context (tab, upgrade) bumped the DB version: close
                // this connection so the upgrade can proceed. Nulling the
                // handle makes the next call reconnect automatically.
                this.db.onversionchange = () => {
                    this.db.close();
                    this.db = null;
                };
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.error);
            };
        });
    }

    async get(key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll() {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllKeys() {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(value, key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            // Explicit check: if key is strictly provided (not undefined), use it.
            const request = (key !== undefined) ? store.put(value, key) : store.put(value);
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
