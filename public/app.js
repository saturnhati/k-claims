const state = {
  meta: null,
  claims: [],
  filters: {
    search: '',
    category: '',
    group: '',
    comeback: '',
    gom: '',
    store: '',
    status: '',
    member: '',
    due: false,
  },
  sort: { key: 'status', dir: 1 },
  editing: null,
  view: 'table',
  formMode: 'new',
  pendingImage: null,
  dashYear: 'all',
};

const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function isArchivedGroup(items) {
  return items.every((c) => ARCHIVED.has(c.status));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMoney(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '';
  return money.format(Number(n));
}

function fmtDate(d) {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function claimTotal(c) {
  return ['init', 'ems', 'customs', 'doms'].reduce((sum, k) => {
    const a = num(c.payments?.[k]?.amount);
    return a ? sum + a : sum;
  }, 0);
}

function hasDue(c) {
  return ['init', 'ems', 'customs', 'doms'].some((k) => {
    const p = c.payments?.[k];
    return num(p?.amount) && !p?.date;
  });
}

function statusClass(s) {
  if (!s) return 'st-muted';
  if (DONE.has(s)) return 'st-done';
  if (CANCELLED.has(s)) return 'st-bad';
  if (/claimed/i.test(s)) return 'st-claim';
  return 'st-progress';
}

function catClass(c) {
  return 'cat-' + (c || 'merch').toLowerCase();
}

function gomLink(gom) {
  if (!gom) return '';
  if (gom.toLowerCase() === 'missing') return esc(gom);
  const handle = gom.replace(/^@/, '');
  return `<a class="gom-link" href="https://www.instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener">${esc(gom)}</a>`;
}

// ---------------- API ----------------

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

async function loadAll() {
  const [meta, claims] = await Promise.all([api('/api/meta'), api('/api/claims')]);
  state.meta = meta.dbs[0] || null;
  state.claims = claims.claims;
}

// ---------------- Rendering ----------------

function renderSummary() {
  const active = state.claims.filter((c) => !CANCELLED.has(c.status));
  const year = state.dashYear && state.dashYear !== 'all' ? state.dashYear : null;
  const paid = { init: 0, ems: 0, customs: 0, doms: 0 };
  const due = { init: 0, ems: 0, customs: 0, doms: 0 };
  for (const c of active) {
    for (const k of Object.keys(paid)) {
      const p = c.payments?.[k];
      const a = num(p?.amount);
      if (!a) continue;
      if (p.date) {
        if (!year || p.date.slice(0, 4) === year) paid[k] += a;
      } else {
        due[k] += a;
      }
    }
  }
  const paidTotal = Object.values(paid).reduce((a, b) => a + b, 0);
  const dueTotal = Object.values(due).reduce((a, b) => a + b, 0);
  const inHands = state.claims.filter((c) => DONE.has(c.status)).length;
  const toReceive = active.length - state.claims.filter((c) => DONE.has(c.status) || CANCELLED.has(c.status)).length;

  const cards = [
    { cls: 'total', label: year ? `Speso ${year}` : 'Totale speso', value: fmtMoney(paidTotal) || '—', sub: `${active.length} claim attivi` },
    { cls: 'due', label: 'Da pagare', value: fmtMoney(dueTotal) || '—' },
    { label: 'Init', value: fmtMoney(paid.init) || '—' },
    { label: 'EMS', value: fmtMoney(paid.ems) || '—' },
    { label: 'Customs', value: fmtMoney(paid.customs) || '—' },
    { label: 'Doms', value: fmtMoney(paid.doms) || '—' },
    { label: 'In mio possesso', value: `${inHands}`, sub: `${toReceive} da ricevere` },
  ];

  document.getElementById('summary').innerHTML = cards
    .map((c) => `<div class="card ${c.cls || ''}"><div class="label">${esc(c.label)}</div><div class="value">${esc(c.value)}</div>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}</div>`)
    .join('');
}

function renderDashboard() {
  const active = state.claims.filter((c) => !CANCELLED.has(c.status));
  const selectedYear = state.dashYear || 'all';

  const byMonth = {};
  for (const c of active) {
    for (const k of ['init', 'ems', 'customs', 'doms']) {
      const p = c.payments?.[k];
      const a = num(p?.amount);
      if (a && p.date) {
        const month = p.date.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + a;
      }
    }
  }

  const years = [...new Set(Object.keys(byMonth).map((m) => m.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  document.getElementById('year-tabs').innerHTML = ['all', ...years]
    .map((y) => `<button class="year-tab ${y === selectedYear ? 'active' : ''}" data-year="${y}">${y === 'all' ? 'Tutti' : y}</button>`)
    .join('');
  for (const btn of document.getElementById('year-tabs').querySelectorAll('.year-tab')) {
    btn.addEventListener('click', () => {
      state.dashYear = btn.dataset.year;
      renderSummary();
      renderDashboard();
    });
  }

  const months = Object.entries(byMonth)
    .filter(([m]) => selectedYear === 'all' || m.startsWith(selectedYear))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonth = Math.max(0, ...months.map(([, v]) => v));
  document.getElementById('month-list').innerHTML = months.length
    ? months
        .map(([m, v]) => {
          const [y, mm] = m.split('-');
          const label = selectedYear === 'all' ? `${MONTHS[Number(mm) - 1]} ${y}` : MONTHS[Number(mm) - 1];
          const pct = maxMonth ? (v / maxMonth) * 100 : 0;
          return `<div class="month-row"><div class="list-row"><span class="name">${label}</span><span class="amt">${fmtMoney(v)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
        })
        .join('')
    : '<p class="count">Nessun dato</p>';

  const byGom = {};
  for (const c of active) {
    const gom = c.gom || '—';
    let total = 0;
    for (const k of ['init', 'ems', 'customs', 'doms']) {
      const p = c.payments?.[k];
      const a = num(p?.amount);
      if (a && p.date && (selectedYear === 'all' || p.date.slice(0, 4) === selectedYear)) total += a;
    }
    if (total) byGom[gom] = (byGom[gom] || 0) + total;
  }

  const goms = Object.entries(byGom).sort((a, b) => b[1] - a[1]);
  document.getElementById('gom-list').innerHTML = goms.length
    ? goms.map(([g, v]) => `<div class="list-row"><span class="name">${esc(g)}</span><span class="amt">${fmtMoney(v)}</span></div>`).join('')
    : '<p class="count">Nessun dato</p>';

  const byMember = {};
  for (const c of active) {
    for (const m of c.members || []) {
      let total = 0;
      for (const k of ['init', 'ems', 'customs', 'doms']) {
        const p = c.payments?.[k];
        const a = num(p?.amount);
        if (a && p.date && (selectedYear === 'all' || p.date.slice(0, 4) === selectedYear)) total += a;
      }
      if (total) byMember[m] = (byMember[m] || 0) + total;
    }
  }
  const members = Object.entries(byMember).sort((a, b) => b[1] - a[1]);
  document.getElementById('member-list').innerHTML = members.length
    ? members.map(([m, v]) => `<div class="list-row"><span class="name">${esc(m)}</span><span class="amt">${fmtMoney(v)}</span></div>`).join('')
    : '<p class="count">Nessun dato</p>';
}

function distinctValues(key) {
  const set = new Set();
  for (const c of state.claims) {
    const v = c[key];
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'it'));
}

function memberOptions() {
  const g = state.filters.group;
  if (!g) return distinctValues('member');
  return GROUP_MEMBERS[g] || [];
}

function comebackOptions() {
  const g = state.filters.group;
  if (!g) return distinctValues('comeback');
  return GROUP_COMEBACKS[g] || [];
}

function renderFilters() {
  const defs = [
    { key: 'category', label: 'Tipo', vals: ['Album', 'POB', 'Merch', 'Altro'], fmt: (v) => CAT_LABEL[v] || v },
    { key: 'group', label: 'Gruppo' },
    { key: 'comeback', label: 'Comeback', getVals: comebackOptions },
    { key: 'gom', label: 'GOM' },
    { key: 'store', label: 'Shop' },
    { key: 'status', label: 'Status' },
    { key: 'member', label: 'Membro', getVals: memberOptions },
  ];

  document.getElementById('filters').innerHTML = defs
    .map((d) => {
      const vals = d.getVals ? d.getVals() : (d.vals || distinctValues(d.key));
      const cur = state.filters[d.key] || '';
      const opts = ['<option value="">' + d.label + '…</option>']
        .concat(vals.map((v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(d.fmt ? d.fmt(v) : v)}</option>`))
        .join('');
      return `<select class="select" id="filter-${d.key}">${opts}</select>`;
    })
    .join('');

  for (const d of defs) {
    document.getElementById(`filter-${d.key}`).addEventListener('change', (e) => {
      state.filters[d.key] = e.target.value;
      if (d.key === 'group') {
        const g = state.filters.group;
        const mg = GROUP_MEMBERS[g];
        if (mg && state.filters.member && !mg.includes(state.filters.member)) state.filters.member = '';
        const cg = GROUP_COMEBACKS[g];
        if (cg && state.filters.comeback && !cg.includes(state.filters.comeback)) state.filters.comeback = '';
        renderFilters();
      }
      renderTable();
    });
  }
}

const COLUMNS = [
  { key: 'name', label: 'Item' },
  { key: 'category', label: 'Tipo' },
  { key: 'group', label: 'Gruppo' },
  { key: 'comeback', label: 'Comeback' },
  { key: 'gom', label: 'GOM' },
  { key: 'store', label: 'Shop' },
  { key: 'status', label: 'Status' },
  { key: 'members', label: 'Membro' },
  { key: 'total', label: 'Totale', num: true },
];

function filteredClaims() {
  const f = state.filters;
  return state.claims.filter((c) => {
    if (f.category && c.category !== f.category) return false;
    if (f.group && c.group !== f.group) return false;
    if (f.comeback && c.comeback !== f.comeback) return false;
    if (f.gom && c.gom !== f.gom) return false;
    if (f.store && c.store !== f.store) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.member && !(c.members || []).includes(f.member)) return false;
    if (f.due && !hasDue(c)) return false;
    if (f.search) {
      const hay = [c.name, c.group, c.comeback, c.gom, c.store, c.notes, ...(c.members || [])].join(' ').toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });
}

function sortValue(c, key) {
  switch (key) {
    case 'total': return claimTotal(c) || -1;
    case 'init': return num(c.payments?.init?.amount) ?? -1;
    case 'ems': return num(c.payments?.ems?.amount) ?? -1;
    case 'customs': return num(c.payments?.customs?.amount) ?? -1;
    case 'doms': return num(c.payments?.doms?.amount) ?? -1;
    case 'members': return (c.members || []).join(',');
    case 'status': return STATUS_RANK[c.status] ?? 50;
    default: return (c[key] ?? '').toString().toLowerCase();
  }
}

function sortedClaims() {
  return filteredClaims().sort((a, b) => {
    const va = sortValue(a, state.sort.key);
    const vb = sortValue(b, state.sort.key);
    if (va < vb) return -1 * state.sort.dir;
    if (va > vb) return 1 * state.sort.dir;
    return 0;
  });
}

function headerHtml() {
  return '<tr><th class="img-col"></th>' + COLUMNS
    .map((col) => {
      const arrow = state.sort.key === col.key ? (state.sort.dir === 1 ? ' ▲' : ' ▼') : '';
      return `<th data-key="${col.key}" class="${col.num ? 'num' : ''}">${col.label}${arrow}</th>`;
    })
    .join('') + '</tr>';
}

function rowHtml(c) {
  const meta = [c.claimType, c.itemType, c.round ? `R${c.round}` : ''].filter(Boolean).join(' · ');
  const members = (c.members || []).map((m) => `<span class="member-chip">${esc(m)}</span>`).join('');
  const total = claimTotal(c);
  const catLabel = CAT_LABEL[c.category] || c.category || 'altro';
  const img = c.images && c.images[0]
    ? `<img class="thumb" src="${esc(c.images[0])}" alt="${esc(c.name)}" title="Apri immagine" />`
    : '';
  const due = hasDue(c);
  return `<tr class="${ARCHIVED.has(c.status) ? 'row-archived' : ''}" data-id="${esc(c.id)}">
    <td class="img-cell">${img}</td>
    <td class="name-cell">${due ? '<span class="due-dot" title="Da pagare"></span>' : ''}${esc(c.name) || '<em class="count">(senza nome)</em>'}${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</td>
    <td><span class="badge ${catClass(c.category)}">${esc(catLabel)}</span></td>
    <td>${esc(c.group)}</td>
    <td>${esc(c.comeback)}</td>
    <td>${gomLink(c.gom)}</td>
    <td>${esc(c.store)}</td>
    <td>${c.status ? `<span class="badge ${statusClass(c.status)}">${esc(c.status)}</span>` : ''}</td>
    <td>${members}</td>
    <td class="num" style="font-weight:600">${fmtMoney(total) || '—'}</td>
  </tr>`;
}

function attachTableHandlers(root) {
  for (const th of root.querySelectorAll('th[data-key]')) {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.sort.key === key) state.sort.dir *= -1;
      else state.sort = { key, dir: 1 };
      renderTable();
    });
  }
  for (const tr of root.querySelectorAll('tbody tr')) {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.thumb')) return;
      openDetail(tr.dataset.id);
    });
  }
  for (const imgEl of root.querySelectorAll('.thumb')) {
    imgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(imgEl.src);
    });
  }
}

function renderTable() {
  const area = document.getElementById('table-area');
  const list = sortedClaims();
  const btn = document.getElementById('btn-view');

  if (state.view === 'grouped') {
    const groups = {};
    for (const c of list) {
      const k = c.comeback || 'Nessun comeback';
      groups[k] = groups[k] || [];
      groups[k].push(c);
    }
    const keys = Object.keys(groups).sort((a, b) => {
      const aa = isArchivedGroup(groups[a]) ? 1 : 0;
      const ab = isArchivedGroup(groups[b]) ? 1 : 0;
      if (aa !== ab) return aa - ab;
      return a.localeCompare(b, 'it');
    });
    area.innerHTML = keys.map((k) => {
      const items = groups[k];
      const subtotal = items.reduce((s, c) => s + claimTotal(c), 0);
      return `<div class="group-block">
        <h3 class="group-title">${esc(k)} <span class="group-count">${items.length} claim${subtotal ? ' · ' + fmtMoney(subtotal) : ''}</span></h3>
        <table class="group-table"><thead>${headerHtml()}</thead><tbody>${items.map(rowHtml).join('')}</tbody></table>
      </div>`;
    }).join('') || '<p class="count">Nessun claim</p>';
    if (btn) btn.textContent = 'Vista unica';
  } else {
    area.innerHTML = `<table id="claims-table"><thead>${headerHtml()}</thead><tbody>${list.map(rowHtml).join('')}</tbody></table>`;
    if (btn) btn.textContent = 'Per comeback';
  }

  attachTableHandlers(area);
  document.getElementById('count').textContent = `${list.length} claim`;
}

// ---------------- Modal / form ----------------

const FORM_SPECS = [
  { key: 'name', label: 'Item', kind: 'text', required: true, span2: true },
  { key: 'category', label: 'Categoria', kind: 'select', opt: 'category' },
  { key: 'group', label: 'Gruppo', kind: 'select', opt: 'group' },
  { key: 'comeback', label: 'Comeback', kind: 'select', opt: 'comeback' },
  { key: 'store', label: 'Shop', kind: 'select', opt: 'store' },
  { key: 'gom', label: 'GOM', kind: 'select', opt: 'gom' },
  { key: 'status', label: 'Status', kind: 'select', opt: 'status' },
  { key: 'members', label: 'Membro/i', kind: 'multi', opt: 'members' },
  { key: 'round', label: 'Round', kind: 'number', step: 1 },
  { key: 'itemType', label: 'Item type', kind: 'select', opt: 'itemType' },
  { key: 'claimType', label: 'Claim type', kind: 'select', opt: 'claimType' },
  { key: 'init.amount', label: 'Init (€)', kind: 'number' },
  { key: 'init.date', label: 'Init data', kind: 'date' },
  { key: 'ems.amount', label: 'EMS (€)', kind: 'number' },
  { key: 'ems.date', label: 'EMS data', kind: 'date' },
  { key: 'customs.amount', label: 'Customs (€)', kind: 'number' },
  { key: 'customs.date', label: 'Customs data', kind: 'date' },
  { key: 'doms.amount', label: 'Doms (€)', kind: 'number' },
  { key: 'doms.date', label: 'Doms data', kind: 'date' },
  { key: 'paymentMethods', label: 'Metodo di pagamento', kind: 'multi', opt: 'paymentMethods' },
  { key: 'masterlist', label: 'Masterlist (url)', kind: 'url', span2: true },
  { key: 'claimed', label: 'Claimed', kind: 'date' },
  { key: 'batchFilled', label: 'Batch filled?', kind: 'checkbox' },
  { key: 'notes', label: 'Note', kind: 'textarea', span2: true },
];

function optionsFor(opt) {
  return (state.meta?.options?.[opt]) || [];
}

function claimValue(claim, key) {
  if (key.includes('.')) {
    const [p, sub] = key.split('.');
    return claim?.payments?.[p]?.[sub] ?? '';
  }
  return claim?.[key] ?? '';
}

function memberFormOptions(group) {
  if (group && GROUP_MEMBERS[group]) return GROUP_MEMBERS[group];
  if (group) return optionsFor('members');
  return [];
}

function formOptionsFor(spec, group) {
  if (spec.opt === 'members') return memberFormOptions(group);
  if (spec.opt === 'comeback') {
    if (group && GROUP_COMEBACKS[group]) return GROUP_COMEBACKS[group];
    return optionsFor('comeback');
  }
  return optionsFor(spec.opt);
}

function renderField(spec, value, group) {
  const label = `<span>${esc(spec.label)}${spec.required ? ' *' : ''}</span>`;
  const cls = `field ${spec.span2 ? 'span2' : ''}`;
  let inner = '';

  if (spec.kind === 'text' || spec.kind === 'url' || spec.kind === 'number') {
    const type = spec.kind === 'url' ? 'url' : spec.kind === 'number' ? 'number' : 'text';
    const step = spec.kind === 'number' ? (spec.step || '0.01') : undefined;
    inner = `<input type="${type}" ${step ? `step="${step}"` : ''} value="${esc(value)}" />`;
  } else if (spec.kind === 'date') {
    inner = `<input type="date" value="${esc(value)}" />`;
  } else if (spec.kind === 'textarea') {
    inner = `<textarea>${esc(value)}</textarea>`;
  } else if (spec.kind === 'checkbox') {
    inner = `<input type="checkbox" ${value ? 'checked' : ''} />`;
  } else if (spec.kind === 'select') {
    const opts = ['<option value="">—</option>']
      .concat(formOptionsFor(spec, group).map((o) => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`))
      .join('');
    inner = `<select>${opts}</select>`;
  } else if (spec.kind === 'multi') {
    const vals = Array.isArray(value) ? value : [];
    const opts = formOptionsFor(spec, group);
    if (spec.opt === 'members' && !opts.length) {
      inner = `<div class="check-group hint">Seleziona prima il gruppo</div>`;
    } else {
      inner = `<div class="check-group">${opts
        .map((o) => `<label class="${vals.includes(o) ? 'on' : ''}" data-val="${esc(o)}">${esc(o)}</label>`)
        .join('')}</div>`;
    }
  }

  return `<div class="${cls}" data-key="${esc(spec.key)}">${label}${inner}</div>`;
}

function updateFormMembers(group) {
  const container = document.querySelector('.field[data-key="members"] .check-group');
  if (!container) return;
  const opts = memberFormOptions(group);
  if (!opts.length) {
    container.innerHTML = '<span class="hint">Seleziona prima il gruppo</span>';
    return;
  }
  const current = [...container.querySelectorAll('label.on')].map((l) => l.dataset.val);
  const keep = current.filter((v) => opts.includes(v));
  container.innerHTML = opts.map((o) => `<label class="${keep.includes(o) ? 'on' : ''}" data-val="${esc(o)}">${esc(o)}</label>`).join('');
  for (const l of container.querySelectorAll('label')) l.addEventListener('click', () => l.classList.toggle('on'));
}

function updateFormComeback(group) {
  const sel = document.querySelector('.field[data-key="comeback"] select');
  if (!sel) return;
  const cur = sel.value;
  const opts = group && GROUP_COMEBACKS[group] ? GROUP_COMEBACKS[group] : optionsFor('comeback');
  sel.innerHTML = ['<option value="">—</option>']
    .concat(opts.map((o) => `<option value="${esc(o)}" ${o === cur ? 'selected' : ''}>${esc(o)}</option>`))
    .join('');
}

async function uploadImage(file) {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload fallito');
  return data.url;
}

function renderImageField() {
  let existing = '';
  if (state.editing) {
    const c = state.claims.find((x) => x.id === state.editing);
    existing = c && c.images && c.images[0] ? c.images[0] : '';
  }
  const src = state.pendingImage || existing;
  return `<div class="field span2" data-key="image">
    <span>Immagine</span>
    <div class="img-upload">
      ${src ? `<img class="img-preview" src="${esc(src)}" alt="" />` : ''}
      <input type="file" accept="image/*" id="img-file" />
      <span class="img-status" id="img-status">${state.pendingImage ? 'Caricata ✓' : ''}</span>
    </div>
  </div>`;
}

function renderForm(claim) {
  const group = claim ? claim.group : '';
  const html = FORM_SPECS.map((s) => renderField(s, claim ? claimValue(claim, s.key) : '', group)).join('') + renderImageField();
  const ff = document.getElementById('form-fields');
  ff.classList.add('form-grid');
  ff.innerHTML = html;

  for (const label of document.getElementById('form-fields').querySelectorAll('.check-group label')) {
    label.addEventListener('click', () => label.classList.toggle('on'));
  }

  const groupSel = document.querySelector('.field[data-key="group"] select');
  if (groupSel) {
    groupSel.addEventListener('change', (e) => {
      const g = e.target.value;
      updateFormMembers(g);
      updateFormComeback(g);
    });
  }

  const fileInput = document.getElementById('img-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('img-status');
      status.textContent = 'Caricamento…';
      try {
        const url = await uploadImage(file);
        state.pendingImage = url;
        status.textContent = 'Caricata ✓';
        const prev = document.querySelector('.img-preview');
        if (prev) prev.src = url;
        else fileInput.insertAdjacentHTML('beforebegin', `<img class="img-preview" src="${esc(url)}" alt="" />`);
      } catch (err) {
        status.textContent = 'Errore: ' + err.message;
      }
    });
  }
}

function renderDetail(claim) {
  const members = (claim.members || []).join(', ');
  const fields = [
    ['Gruppo', esc(claim.group)],
    ['Comeback', esc(claim.comeback)],
    ['Shop', esc(claim.store)],
    ['GOM', gomLink(claim.gom)],
    ['Membro/i', esc(members)],
    ['Round', claim.round != null ? claim.round : ''],
    ['Item type', esc(claim.itemType)],
    ['Claim type', esc(claim.claimType)],
    ['Claimed', fmtDate(claim.claimed)],
  ]
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<div class="info-row"><span>${k}</span><b>${v}</b></div>`)
    .join('');

  const masterlist = claim.masterlist
    ? `<div class="info-row"><span>Masterlist</span><b><a href="${esc(claim.masterlist)}" target="_blank" rel="noopener">apri</a></b></div>`
    : '';

  const img = claim.images && claim.images[0]
    ? `<img class="detail-img" src="${esc(claim.images[0])}" alt="${esc(claim.name)}" title="Apri immagine" />`
    : '';

  const statusOpts = ['<option value="">—</option>']
    .concat(optionsFor('status').map((o) => `<option value="${esc(o)}" ${o === claim.status ? 'selected' : ''}>${esc(o)}</option>`))
    .join('');

  const p = claim.payments || {};
  const payRow = (label, key) => `
    <div class="quick-row">
      <label>${label}</label>
      <input type="number" step="0.01" data-key="${key}.amount" value="${esc(p[key]?.amount ?? '')}" placeholder="€" />
      <input type="date" data-key="${key}.date" value="${esc(p[key]?.date ?? '')}" />
    </div>`;

  return `
    <div class="detail-head">
      <span class="detail-name">${esc(claim.name) || '(senza nome)'}</span>
      <span class="badge ${catClass(claim.category)}">${esc(CAT_LABEL[claim.category] || claim.category || 'altro')}</span>
      <span class="badge ${statusClass(claim.status)}">${esc(claim.status || '—')}</span>
    </div>
    <div class="detail-body">
      ${img}
      <div class="info">${fields}${masterlist}</div>
    </div>
    <hr class="detail-sep" />
    <h3 class="quick-title">Modifica rapida</h3>
    <div class="quick">
      <div class="quick-row">
        <label>Status</label>
        <select class="status-select" data-key="status">${statusOpts}</select>
        <label class="chk-inline"><input type="checkbox" data-key="batchFilled" ${claim.batchFilled ? 'checked' : ''} /> Batch filled?</label>
      </div>
      <div class="quick-row">
        <label>Note</label>
        <textarea data-key="notes">${esc(claim.notes || '')}</textarea>
      </div>
      ${payRow('Init', 'init')}
      ${payRow('EMS', 'ems')}
      ${payRow('Customs', 'customs')}
      ${payRow('Doms', 'doms')}
    </div>
  `;
}

function collectQuick() {
  const payload = { db: 'unified' };
  const payments = { init: {}, ems: {}, customs: {}, doms: {} };
  const q = (key) => document.querySelector(`[data-key="${key}"]`);
  payload.status = q('status').value;
  payload.batchFilled = q('batchFilled').checked;
  payload.notes = q('notes').value;
  for (const k of ['init', 'ems', 'customs', 'doms']) {
    payments[k].amount = q(`${k}.amount`).value;
    payments[k].date = q(`${k}.date`).value;
  }
  payload.payments = payments;
  return payload;
}

function collectForm() {
  const payload = { db: 'unified' };
  const payments = { init: {}, ems: {}, customs: {}, doms: {} };

  for (const spec of FORM_SPECS) {
    if (spec.kind === 'multi') {
      const vals = [...document.querySelectorAll(`.field[data-key="${spec.key}"] .check-group label.on`)].map((l) => l.dataset.val);
      payload[spec.key] = vals;
    } else if (spec.kind === 'checkbox') {
      payload[spec.key] = document.querySelector(`.field[data-key="${spec.key}"] input`).checked;
    } else {
      const el = document.querySelector(`.field[data-key="${spec.key}"] input, .field[data-key="${spec.key}"] select, .field[data-key="${spec.key}"] textarea`);
      const raw = el ? el.value : '';
      if (spec.key.includes('.')) {
        const [p, sub] = spec.key.split('.');
        payments[p][sub] = raw;
      } else if (spec.kind === 'number') {
        payload[spec.key] = raw === '' ? null : Number(raw);
      } else {
        payload[spec.key] = raw;
      }
    }
  }
  if (state.pendingImage) payload.images = [state.pendingImage];
  payload.payments = payments;
  return payload;
}

function openNew() {
  state.editing = null;
  state.formMode = 'new';
  state.pendingImage = null;
  document.getElementById('form-error').textContent = '';
  document.getElementById('modal-title').textContent = 'Nuovo claim';
  document.getElementById('btn-edit-all').hidden = true;
  document.getElementById('btn-duplicate').hidden = true;
  document.getElementById('btn-delete').hidden = true;
  renderForm(null);
  document.getElementById('modal').hidden = false;
}

function openDetail(id) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim) return;
  state.editing = id;
  state.formMode = 'detail';
  state.pendingImage = null;
  document.getElementById('form-error').textContent = '';
  document.getElementById('modal-title').textContent = 'Dettaglio claim';
  document.getElementById('btn-edit-all').hidden = false;
  document.getElementById('btn-duplicate').hidden = false;
  document.getElementById('btn-delete').hidden = false;
  const ff = document.getElementById('form-fields');
  ff.classList.remove('form-grid');
  ff.innerHTML = renderDetail(claim);
  const img = document.getElementById('form-fields').querySelector('.detail-img');
  if (img) img.addEventListener('click', () => openLightbox(img.src));
  document.getElementById('modal').hidden = false;
}

function openFullEdit(id) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim) return;
  state.editing = id;
  state.formMode = 'full';
  state.pendingImage = null;
  document.getElementById('form-error').textContent = '';
  document.getElementById('modal-title').textContent = 'Modifica claim';
  document.getElementById('btn-edit-all').hidden = true;
  document.getElementById('btn-duplicate').hidden = true;
  document.getElementById('btn-delete').hidden = false;
  renderForm(claim);
  document.getElementById('modal').hidden = false;
}

function closeModal() {
  document.getElementById('modal').hidden = true;
  state.editing = null;
}

function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').hidden = false;
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
}

async function saveForm() {
  const isDetail = state.formMode === 'detail';
  const payload = isDetail ? collectQuick() : collectForm();
  if (!isDetail && (!payload.name || !payload.name.trim())) {
    document.getElementById('form-error').textContent = 'Il nome (Item) è obbligatorio.';
    return;
  }
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  try {
    if (state.editing) {
      await api(`/api/claims/${state.editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    await loadAll();
    renderAll();
  } catch (err) {
    document.getElementById('form-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ---------------- Export / Elimina / Duplica ----------------

function flatClaim(c) {
  return {
    name: c.name, group: c.group, comeback: c.comeback, category: c.category,
    shop: c.store, gom: c.gom, status: c.status,
    members: (c.members || []).join('; '),
    round: c.round ?? '', itemType: c.itemType ?? '', claimType: c.claimType ?? '',
    init: c.payments?.init?.amount ?? '', initDate: c.payments?.init?.date ?? '',
    ems: c.payments?.ems?.amount ?? '', emsDate: c.payments?.ems?.date ?? '',
    customs: c.payments?.customs?.amount ?? '', customsDate: c.payments?.customs?.date ?? '',
    doms: c.payments?.doms?.amount ?? '', domsDate: c.payments?.doms?.date ?? '',
    batchFilled: c.batchFilled ? 'sì' : '',
    paymentMethods: (c.paymentMethods || []).join('; '),
    masterlist: c.masterlist ?? '', claimed: c.claimed ?? '', notes: c.notes ?? '',
  };
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const cols = ['name', 'group', 'comeback', 'category', 'shop', 'gom', 'status', 'members', 'round', 'itemType', 'claimType', 'init', 'initDate', 'ems', 'emsDate', 'customs', 'customsDate', 'doms', 'domsDate', 'batchFilled', 'paymentMethods', 'masterlist', 'claimed', 'notes'];
  const header = cols.join(',');
  const rows = state.claims.map((c) => {
    const f = flatClaim(c);
    return cols.map((k) => csvCell(f[k])).join(',');
  });
  downloadFile('k-claims.csv', [header, ...rows].join('\n'), 'text/csv;charset=utf-8');
}

function exportJSON() {
  downloadFile('k-claims.json', JSON.stringify(state.claims, null, 2), 'application/json;charset=utf-8');
}

async function deleteClaim() {
  if (!state.editing) return;
  const claim = state.claims.find((c) => c.id === state.editing);
  const name = claim?.name || 'questo claim';
  if (!confirm(`Eliminare "${name}"?`)) return;
  try {
    await api(`/api/claims/${state.editing}`, { method: 'DELETE' });
    closeModal();
    await loadAll();
    renderAll();
  } catch (err) {
    document.getElementById('form-error').textContent = err.message;
  }
}

function openDuplicate(id) {
  const claim = state.claims.find((c) => c.id === id);
  if (!claim) return;
  state.editing = null;
  state.formMode = 'new';
  state.pendingImage = null;
  document.getElementById('form-error').textContent = '';
  document.getElementById('modal-title').textContent = 'Duplica claim';
  document.getElementById('btn-edit-all').hidden = true;
  document.getElementById('btn-duplicate').hidden = true;
  document.getElementById('btn-delete').hidden = true;
  renderForm(claim);
  document.getElementById('modal').hidden = false;
}

// ---------------- Init ----------------

function renderAll() {
  renderSummary();
  renderDashboard();
  renderFilters();
  renderTable();
}

async function init() {
  await loadAll();
  renderAll();
  document.getElementById('btn-new').addEventListener('click', openNew);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveForm);
  document.getElementById('btn-edit-all').addEventListener('click', () => {
    if (state.editing) openFullEdit(state.editing);
  });
  document.getElementById('btn-delete').addEventListener('click', deleteClaim);
  document.getElementById('btn-duplicate').addEventListener('click', () => {
    if (state.editing) openDuplicate(state.editing);
  });
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('filter-due').addEventListener('change', (e) => {
    state.filters.due = e.target.checked;
    renderTable();
  });
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
  document.getElementById('search').addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase();
    renderTable();
  });
  document.getElementById('btn-view').addEventListener('click', () => {
    state.view = state.view === 'table' ? 'grouped' : 'table';
    renderTable();
  });
  document.getElementById('btn-theme').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'minsung' ? 'arcade' : 'minsung';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('kc-theme', next); } catch (e) {}
  });
}

init().catch((err) => {
  document.getElementById('summary').innerHTML = `<div class="card total"><div class="label">Errore</div><div class="value" style="font-size:16px">${esc(err.message)}</div></div>`;
});
