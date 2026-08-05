/* ============================================================
   MediaOS — IndexedDB Adapter
   Promise-based wrapper. One database, multiple object stores.
   ============================================================ */

'use strict';

const DB_NAME    = 'mediaos_db';
const DB_VERSION = 1;

let _db = null;

function _open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('library')) {
        const store = db.createObjectStore('library', { keyPath: 'id' });
        store.createIndex('platform',      'platform',      { unique: false });
        store.createIndex('region',        'region',        { unique: false });
        store.createIndex('addedAt',       'addedAt',       { unique: false });
        store.createIndex('seen',          'seen',          { unique: false });
        store.createIndex('normalizedUrl', 'normalizedUrl', { unique: false });
      }
    };

    req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function _tx(storeName, mode, fn) {
  return _open().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx    = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req   = fn(store);
      if (req) {
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror   = function(e) { reject(e.target.error); };
      } else {
        tx.oncomplete = function() { resolve(); };
        tx.onerror    = function(e) { reject(e.target.error); };
      }
    });
  });
}

/* Public API */
var DB = {
  put:    function(store, value)       { return _tx(store, 'readwrite', function(s) { return s.put(value); }); },
  get:    function(store, key)         { return _tx(store, 'readonly',  function(s) { return s.get(key); }); },
  delete: function(store, key)         { return _tx(store, 'readwrite', function(s) { return s.delete(key); }); },
  clear:  function(store)              { return _tx(store, 'readwrite', function(s) { return s.clear(); }); },
  getAll: function(store)              { return _tx(store, 'readonly',  function(s) { return s.getAll(); }); },

  /* Get all items where index === value */
  getByIndex: function(store, indexName, value) {
    return _open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx  = db.transaction(store, 'readonly');
        var req = tx.objectStore(store).index(indexName).getAll(IDBKeyRange.only(value));
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror   = function(e) { reject(e.target.error); };
      });
    });
  }
};
