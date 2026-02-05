// indexeddb.js - IndexedDB implementation for Pocket Closet

class ClosetDB {
    constructor() {
        this.dbName = 'PocketCloset';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create items store for metadata
                if (!db.objectStoreNames.contains('items')) {
                    const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                    itemStore.createIndex('name', 'name', { unique: false });
                    itemStore.createIndex('type', 'type', { unique: false });
                    itemStore.createIndex('brand', 'brand', { unique: false });
                    itemStore.createIndex('category', 'category', { unique: false });
                }

                // Create photos store for image blobs
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'itemId' });
                }
            };
        });
    }

    // Save item with photo
    async saveItem(itemData, photoBlob = null) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'photos'], 'readwrite');

            // Store item metadata
            const itemStore = transaction.objectStore('items');
            itemStore.put(itemData);

            // Store photo separately if provided
            if (photoBlob) {
                const photoStore = transaction.objectStore('photos');
                photoStore.put({
                    itemId: itemData.id,
                    blob: photoBlob,
                    timestamp: Date.now()
                });
            }

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Get all items with hasPhoto flag
    async getAllItems() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'photos'], 'readonly');
            const itemStore = transaction.objectStore('items');
            const photoStore = transaction.objectStore('photos');

            const itemRequest = itemStore.getAll();
            const photoKeysRequest = photoStore.getAllKeys();

            let items = null;
            let photoKeys = null;

            const checkDone = () => {
                if (items !== null && photoKeys !== null) {
                    const photoKeysSet = new Set(photoKeys);
                    const results = items.map(item => ({
                        ...item,
                        hasPhoto: photoKeysSet.has(item.id)
                    }));
                    resolve(results);
                }
            };

            itemRequest.onsuccess = () => {
                items = itemRequest.result;
                checkDone();
            };

            photoKeysRequest.onsuccess = () => {
                photoKeys = photoKeysRequest.result;
                checkDone();
            };

            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Get item by ID
    async getItem(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'photos'], 'readonly');
            const itemStore = transaction.objectStore('items');
            const photoStore = transaction.objectStore('photos');

            // Get metadata
            const itemRequest = itemStore.get(id);
            itemRequest.onsuccess = () => {
                const item = itemRequest.result;
                if (!item) return resolve(null);

                // Get photo
                const photoRequest = photoStore.get(id);
                photoRequest.onsuccess = () => {
                    const photoRecord = photoRequest.result;
                    resolve({
                        ...item,
                        hasPhoto: !!photoRecord
                    });
                };
                photoRequest.onerror = () => resolve({ ...item, hasPhoto: false });
            };
            itemRequest.onerror = () => reject(itemRequest.error);
        });
    }

    // Get photo blob by item ID
    async getPhotoBlob(itemId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const request = store.get(itemId);

            request.onsuccess = () => {
                const record = request.result;
                resolve(record ? record.blob : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Delete item and its photo
    async deleteItem(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items', 'photos'], 'readwrite');
            const itemStore = transaction.objectStore('items');
            const photoStore = transaction.objectStore('photos');

            itemStore.delete(id);
            photoStore.delete(id);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Update item metadata
    async updateItem(itemData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.put(itemData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Save photo for existing item
    async savePhoto(itemId, photoBlob) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.put({
                itemId: itemId,
                blob: photoBlob,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
const closetDB = new ClosetDB();
export default closetDB;
