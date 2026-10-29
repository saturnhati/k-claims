import { getDbId } from './notion.js';

const FIELDS = {
  group: { key: 'Group', type: 'select' },
  comeback: { key: 'Comeback', type: 'select' },
  category: { key: 'Category', type: 'select' },
  store: { key: 'Shop', type: 'select' },
  gom: { key: 'GOM', type: 'select' },
  status: { key: 'Status', type: 'select' },
  members: { key: 'Member(s)', type: 'multi_select' },
  round: { key: 'Round', type: 'number' },
  itemType: { key: 'Item type', type: 'select' },
  claimType: { key: 'Claim type', type: 'select' },
  init: { key: 'Init', type: 'number' },
  initDate: { key: 'Init date', type: 'date' },
  ems: { key: 'EMS', type: 'number' },
  emsDate: { key: 'EMS date', type: 'date' },
  customs: { key: 'Customs', type: 'number' },
  customsDate: { key: 'Customs date', type: 'date' },
  doms: { key: 'Doms', type: 'number' },
  domsDate: { key: 'Doms date', type: 'date' },
  paymentMethods: { key: 'Payment method', type: 'multi_select' },
  masterlist: { key: 'Masterlist', type: 'url' },
  claimed: { key: 'Claimed', type: 'date' },
  batchFilled: { key: 'Batch filled?', type: 'checkbox' },
  notes: { key: 'Notes', type: 'rich_text' },
  images: { key: 'IMG', type: 'files' },
};

function resolveDbId() {
  const id = getDbId();
  if (!id) {
    throw new Error('NOTION_DB_ID non trovato. Aggiungilo a ~/.zshenv o nell\'ambiente (es. export NOTION_DB_ID="...")');
  }
  return id;
}

export const DBS = {
  unified: {
    id: resolveDbId(),
    label: 'K-Claims',
    title: 'Item',
    archived: false,
    fields: FIELDS,
  },
};

function getTitle(p) {
  if (!p) return '';
  return (p.title || []).map((t) => t.plain_text || t.text?.content || '').join('');
}

function getText(p, field) {
  if (!field || !p?.[field.key]) return '';
  const v = p[field.key];
  if (field.type === 'rich_text') return (v.rich_text || []).map((t) => t.plain_text).join('');
  return '';
}

function getSelectName(p, field) {
  if (!field || !p?.[field.key]) return null;
  const v = p[field.key];
  if (field.type === 'status') return v.status?.name ?? null;
  if (field.type === 'select') return v.select?.name ?? null;
  return null;
}

function getMulti(p, field) {
  if (!field || !p?.[field.key]) return [];
  const v = p[field.key];
  if (field.type === 'multi_select') return (v.multi_select || []).map((o) => o.name);
  return [];
}

function getNumber(p, field) {
  if (!field || !p?.[field.key]) return null;
  return p[field.key].number;
}

function getDate(p, field) {
  if (!field || !p?.[field.key]) return null;
  const d = p[field.key].date;
  return d?.start ?? null;
}

function getUrl(p, field) {
  if (!field || !p?.[field.key]) return null;
  return p[field.key].url ?? null;
}

function getCheckbox(p, field) {
  if (!field || !p?.[field.key]) return false;
  return !!p[field.key].checkbox;
}

function getFiles(p, field) {
  if (!field || !p?.[field.key]) return [];
  return (p[field.key].files || [])
    .map((f) => (f.type === 'file' ? f.file?.url : f.type === 'external' ? f.external?.url : f.name || ''))
    .filter(Boolean);
}

function mkPayment(amount, date) {
  return { amount, date };
}

export function normalizeRow(dbKey, page) {
  const cfg = DBS[dbKey];
  const p = page.properties || {};
  const f = cfg.fields;

  return {
    id: page.id,
    db: dbKey,
    dbLabel: cfg.label,
    archived: cfg.archived,
    url: page.url,
    lastEdited: page.last_edited_time,
    name: getTitle(p[cfg.title]),
    group: getSelectName(p, f.group) || '',
    comeback: getSelectName(p, f.comeback) || '',
    category: getSelectName(p, f.category) || '',
    store: getSelectName(p, f.store) || '',
    gom: getSelectName(p, f.gom) || '',
    status: getSelectName(p, f.status),
    members: getMulti(p, f.members),
    round: getNumber(p, f.round),
    itemType: getSelectName(p, f.itemType),
    claimType: getSelectName(p, f.claimType),
    paymentMethods: getMulti(p, f.paymentMethods),
    masterlist: getUrl(p, f.masterlist),
    claimed: getDate(p, f.claimed),
    batchFilled: getCheckbox(p, f.batchFilled),
    notes: getText(p, f.notes),
    images: getFiles(p, f.images),
    payments: {
      init: mkPayment(getNumber(p, f.init), getDate(p, f.initDate)),
      ems: mkPayment(getNumber(p, f.ems), getDate(p, f.emsDate)),
      customs: mkPayment(getNumber(p, f.customs), getDate(p, f.customsDate)),
      doms: mkPayment(getNumber(p, f.doms), getDate(p, f.domsDate)),
    },
  };
}

// ---- builders per la scrittura ----

function titleValue(s) {
  return { title: [{ type: 'text', text: { content: s ?? '' } }] };
}

const selectValue = (field, s) => {
  const key = field.type === 'status' ? 'status' : 'select';
  return { [key]: s ? { name: String(s) } : null };
};

const multiValue = (field, arr) => ({ [field.type]: (arr || []).map((n) => ({ name: String(n) })) });

const numberValue = (_f, n) => {
  if (n === null || n === undefined || n === '') return { number: null };
  const num = Number(n);
  return { number: Number.isFinite(num) ? num : null };
};

const dateValue = (_f, d) => ({ date: d ? { start: String(d) } : null });
const urlValue = (_f, u) => ({ url: u || null });
const richTextValue = (_f, s) => ({ rich_text: s ? [{ type: 'text', text: { content: String(s) } }] : [] });
const checkboxValue = (_f, v) => ({ checkbox: !!v });

// Costruisce l'oggetto properties Notion a partire da un claim (parziale o completo).
export function claimToProperties(dbKey, claim) {
  const cfg = DBS[dbKey];
  const f = cfg.fields;
  const props = {};

  if (claim.name !== undefined && claim.name !== null) {
    props[cfg.title] = titleValue(claim.name);
  }

  const set = (field, value, builder) => {
    if (!field || value === undefined) return;
    props[field.key] = builder(field, value);
  };

  set(f.group, claim.group, selectValue);
  set(f.comeback, claim.comeback, selectValue);
  set(f.category, claim.category, selectValue);
  set(f.store, claim.store, selectValue);
  set(f.gom, claim.gom, selectValue);
  set(f.status, claim.status, selectValue);
  set(f.members, claim.members, multiValue);
  set(f.round, claim.round, numberValue);
  set(f.itemType, claim.itemType, selectValue);
  set(f.claimType, claim.claimType, selectValue);
  set(f.init, claim.payments?.init?.amount, numberValue);
  set(f.initDate, claim.payments?.init?.date, dateValue);
  set(f.ems, claim.payments?.ems?.amount, numberValue);
  set(f.emsDate, claim.payments?.ems?.date, dateValue);
  set(f.customs, claim.payments?.customs?.amount, numberValue);
  set(f.customsDate, claim.payments?.customs?.date, dateValue);
  set(f.doms, claim.payments?.doms?.amount, numberValue);
  set(f.domsDate, claim.payments?.doms?.date, dateValue);
  set(f.paymentMethods, claim.paymentMethods, multiValue);
  set(f.masterlist, claim.masterlist, urlValue);
  set(f.claimed, claim.claimed, dateValue);
  set(f.batchFilled, claim.batchFilled, checkboxValue);
  set(f.notes, claim.notes, richTextValue);

  if (Array.isArray(claim.images) && claim.images.length) {
    props[f.images.key] = {
      files: claim.images.map((u) => {
        const clean = String(u).split('?')[0];
        const name = clean.split('/').pop() || 'image';
        return { type: 'external', name, external: { url: String(u) } };
      }),
    };
  }

  return props;
}

// Restituisce la lista dei DB con le opzioni select/status/multi_select per i dropdown del form.
export function buildMeta(schemas) {
  const result = [];
  for (const [dbKey, cfg] of Object.entries(DBS)) {
    const schema = schemas[dbKey];
    const options = {};
    if (schema) {
      for (const [fieldKey, field] of Object.entries(cfg.fields)) {
        if (!field) continue;
        const prop = schema.properties?.[field.key];
        if (!prop) continue;
        if (prop.type === 'select' || prop.type === 'status') {
          options[fieldKey] = (prop[prop.type]?.options || []).map((o) => o.name);
        } else if (prop.type === 'multi_select') {
          options[fieldKey] = (prop.multi_select?.options || []).map((o) => o.name);
        }
      }
    }
    result.push({
      key: dbKey,
      id: cfg.id,
      label: cfg.label,
      title: cfg.title,
      category: null,
      archived: cfg.archived,
      options,
    });
  }
  return result;
}
