/* ============================================================
   MediaOS — Research Library Storage
   IndexedDB CRUD + dedup + import/export.
   Depends on: js/db.js, modules/library/analysis.js
   ============================================================ */

'use strict';

var STORE = 'library';

async function libGetAll() {
  return DB.getAll(STORE);
}

async function libGetById(id) {
  return DB.get(STORE, id);
}

/* Add a video. Returns {ok, reason, existing?} */
async function libAdd(video) {
  var all  = await DB.getAll(STORE);
  var dupe = all.find(function(v) {
    return v.id === video.id ||
           (v.normalizedUrl && v.normalizedUrl === video.normalizedUrl);
  });
  if (dupe) return { ok: false, reason: 'duplicate', existing: dupe };

  await DB.put(STORE, video);
  return { ok: true };
}

/* Update fields on an existing video */
async function libUpdate(id, updates) {
  var existing = await DB.get(STORE, id);
  if (!existing) return { ok: false, reason: 'not_found' };

  /* Recompute viralScore if stats changed */
  var merged = Object.assign({}, existing, updates, { id: id });
  merged.viralScore = LibraryAnalysis.estimateViralScore(merged);
  /* Re-run auto-tag if title changed */
  if (updates.title !== undefined) {
    merged.contentTags = LibraryAnalysis.autoTag(merged.title + ' ' + (merged.notes || ''));
  }

  await DB.put(STORE, merged);
  return { ok: true };
}

async function libDelete(id) {
  await DB.delete(STORE, id);
  return { ok: true };
}

async function libExportJSON() {
  var all = await DB.getAll(STORE);
  return {
    version:    1,
    exportedAt: new Date().toISOString(),
    count:      all.length,
    data:       all
  };
}

async function libImportJSON(jsonObj) {
  if (!jsonObj || !Array.isArray(jsonObj.data)) {
    return { ok: false, reason: 'invalid_format' };
  }
  var imported = 0, skipped = 0, errors = 0;
  for (var i = 0; i < jsonObj.data.length; i++) {
    var video = jsonObj.data[i];
    if (!video || !video.id) { errors++; continue; }
    try {
      var existing = await DB.get(STORE, video.id);
      if (!existing) { await DB.put(STORE, video); imported++; }
      else           { skipped++; }
    } catch (e) { errors++; }
  }
  return { ok: true, imported: imported, skipped: skipped, errors: errors };
}

async function libExportCSV() {
  var all  = await DB.getAll(STORE);
  var cols = ['id','platform','url','title','creator','region','views','likes','comments','shares','postedAt','addedAt','seen','bookmarked','topics','contentTags','notes','hook','cta','viralScore'];
  var rows = [cols.join(',')];
  all.forEach(function(v) {
    var row = cols.map(function(c) {
      var val = v[c];
      if (Array.isArray(val)) val = val.join(';');
      if (val == null) val = '';
      val = String(val).replace(/"/g, '""');
      return '"' + val + '"';
    });
    rows.push(row.join(','));
  });
  return rows.join('\n');
}

var LibraryStorage = {
  getAll:    libGetAll,
  getById:   libGetById,
  add:       libAdd,
  update:    libUpdate,
  delete:    libDelete,
  exportJSON: libExportJSON,
  importJSON: libImportJSON,
  exportCSV:  libExportCSV
};
