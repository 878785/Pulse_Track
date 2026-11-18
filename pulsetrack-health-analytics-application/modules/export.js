/**
 * export.js
 * ---------------------------------------------------------------------------
 * CSV / JSON export, backup creation and safe import validation.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate one record coming from a file, a textarea or the form. */
export function validateRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['Record is not an object.'];

  const date = String(record.date ?? '').trim();
  if (!DATE_RE.test(date)) {
    errors.push('date must use the YYYY-MM-DD format.');
  } else {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) errors.push('date is not a real calendar date.');
  }

  const steps = Number(record.steps);
  if (!Number.isFinite(steps) || steps < 0) errors.push('steps must be a positive number.');
  else if (steps > 200000) errors.push('steps cannot exceed 200,000.');

  const calories = Number(record.calories);
  if (!Number.isFinite(calories) || calories < 0) errors.push('calories must be a positive number.');
  else if (calories > 20000) errors.push('calories cannot exceed 20,000.');

  const sleep = Number(record.sleep);
  if (!Number.isFinite(sleep) || sleep < 0) errors.push('sleep must be a positive number.');
  else if (sleep > 24) errors.push('sleep cannot exceed 24 hours.');

  return errors;
}

/** Normalise a raw record into the shape used by the linked list. */
export function normaliseRecord(record) {
  return {
    date: String(record.date).trim(),
    steps: Math.round(Number(record.steps)),
    calories: Math.round(Number(record.calories)),
    sleep: Math.round(Number(record.sleep) * 10) / 10,
  };
}

/* --------------------------------------------------------------- export */
export function toCSV(records) {
  const header = 'Date,Steps,Calories,Sleep (hours)';
  const rows = records.map((r) => `${r.date},${r.steps},${r.calories},${r.sleep}`);
  return [header, ...rows].join('\n');
}

export function buildBackup(records) {
  return {
    app: 'PulseTrack',
    type: 'health-records-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    dataStructure: 'Circular Singly Linked List',
    count: records.length,
    records,
  };
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function exportCSV(records) {
  if (!records.length) throw new Error('There are no records to export.');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`pulsetrack-records-${stamp}.csv`, toCSV(records), 'text/csv;charset=utf-8');
  return records.length;
}

export function exportJSON(records) {
  if (!records.length) throw new Error('There are no records to export.');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`pulsetrack-records-${stamp}.json`, JSON.stringify(buildBackup(records), null, 2), 'application/json');
  return records.length;
}

export function downloadBackup(records) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadFile(`pulsetrack-backup-${stamp}.json`, JSON.stringify(buildBackup(records), null, 2), 'application/json');
  return records.length;
}

/* --------------------------------------------------------------- import */
/**
 * Parse and validate an imported payload.
 * @returns {{ok:boolean,error?:string,records:Array,invalid:Array,duplicates:Array}}
 */
export function parseBackupPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: 'The file is not valid JSON.', records: [], invalid: [], duplicates: [] };
  }

  let list = null;
  if (Array.isArray(payload)) list = payload;
  else if (payload && Array.isArray(payload.records)) list = payload.records;
  else if (payload && Array.isArray(payload.data)) list = payload.data;

  if (!list) {
    return { ok: false, error: 'No records array found. Expected a top level array or a "records" property.', records: [], invalid: [], duplicates: [] };
  }

  const records = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();

  list.forEach((raw, index) => {
    const errors = validateRecord(raw);
    if (errors.length) {
      invalid.push({ index, date: raw?.date ?? '—', errors });
      return;
    }
    const clean = normaliseRecord(raw);
    if (seen.has(clean.date)) {
      duplicates.push({ index, date: clean.date });
      return;
    }
    seen.add(clean.date);
    records.push(clean);
  });

  return { ok: true, records, invalid, duplicates, total: list.length };
}

export default {
  validateRecord,
  normaliseRecord,
  toCSV,
  buildBackup,
  downloadFile,
  exportCSV,
  exportJSON,
  downloadBackup,
  parseBackupPayload,
};
