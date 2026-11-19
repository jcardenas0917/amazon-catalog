import './style.css';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'holiday-wishbook-v1';

function publicUrl(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, '')}`;
}

const state = {
  catalog: null,
  kids: [],
  activeKidId: null,
  wantsByKid: {},
  view: 'browse', // browse | pages | wishes | parents
  category: 'All',
  ageFilter: 'All',
  query: '',
  pageIndex: 0,
  showAddKid: false,
};

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.kids = data.kids || [];
    state.activeKidId = data.activeKidId || state.kids[0]?.id || null;
    state.wantsByKid = data.wantsByKid || {};
  } catch {
    /* ignore */
  }
}

function saveStore() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      kids: state.kids,
      activeKidId: state.activeKidId,
      wantsByKid: state.wantsByKid,
    }),
  );
}

function uid() {
  return `kid-${Math.random().toString(36).slice(2, 9)}`;
}

function activeWants() {
  if (!state.activeKidId) return new Set();
  return new Set(state.wantsByKid[state.activeKidId] || []);
}

function toast(msg) {
  const el = document.querySelector('.toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1400);
}

function toggleWant(asin) {
  if (!state.activeKidId) {
    toast('Tell Santa your name first');
    state.showAddKid = true;
    render();
    return;
  }
  const list = new Set(state.wantsByKid[state.activeKidId] || []);
  if (list.has(asin)) {
    list.delete(asin);
    toast('Back on the shelf');
  } else {
    list.add(asin);
    toast('In your sack!');
  }
  state.wantsByKid[state.activeKidId] = [...list];
  saveStore();
  render();
}

function filteredItems() {
  const items = state.catalog?.items || [];
  const q = state.query.trim().toLowerCase();
  return items.filter((item) => {
    if (state.category !== 'All' && item.category !== state.category) return false;
    if (state.ageFilter !== 'All' && item.ageCategory !== state.ageFilter) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.age || '').toLowerCase().includes(q) ||
      item.asin.toLowerCase().includes(q)
    );
  });
}

function productPages() {
  const map = new Map();
  for (const item of state.catalog?.items || []) {
    if (!map.has(item.pdfPage)) map.set(item.pdfPage, []);
    map.get(item.pdfPage).push(item);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pdfPage, items]) => ({
      pdfPage,
      bookPage: items[0]?.bookPage ?? pdfPage,
      thumb: items[0]?.pageThumb,
      items,
    }));
}

function allWishRows() {
  const byId = new Map((state.catalog?.items || []).map((i) => [i.asin, i]));
  const rows = [];
  for (const kid of state.kids) {
    for (const asin of state.wantsByKid[kid.id] || []) {
      const item = byId.get(asin);
      if (!item) continue;
      rows.push({
        kid: kid.name,
        item: item.name,
        price: item.price ?? '',
        age: item.age || '',
        category: item.category,
        bookPage: item.bookPage,
        asin: item.asin,
        amazonUrl: item.amazonUrl,
        note: `Toy Book p.${item.bookPage} / PDF p.${item.pdfPage}`,
      });
    }
  }
  return rows;
}

function exportWorkbook(kind) {
  const rows = allWishRows();
  if (!rows.length) {
    toast('No wishes yet');
    return;
  }
  const sheetRows = rows.map((r) => ({
    Kid: r.kid,
    Item: r.item,
    Price: r.price || 'Check Amazon',
    Age: r.age,
    Category: r.category,
    'Book Page': r.bookPage,
    ASIN: r.asin,
    'Amazon Link': r.amazonUrl,
    Note: r.note,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gift List');
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'csv') {
    XLSX.writeFile(wb, `holiday-wishbook-${stamp}.csv`);
  } else {
    XLSX.writeFile(wb, `holiday-wishbook-${stamp}.xlsx`);
  }
  toast(kind === 'csv' ? 'CSV downloaded' : 'Excel downloaded');
}

function makeSnow() {
  const wrap = document.createElement('div');
  wrap.className = 'snow';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 28; i++) {
    const f = document.createElement('span');
    f.className = 'flake';
    f.style.left = `${Math.random() * 100}%`;
    f.style.animationDuration = `${7 + Math.random() * 10}s`;
    f.style.animationDelay = `${-Math.random() * 12}s`;
    f.style.opacity = String(0.35 + Math.random() * 0.5);
    f.style.transform = `scale(${0.6 + Math.random()})`;
    wrap.appendChild(f);
  }
  return wrap;
}

function toyCard(item, wants, delay = 0) {
  const wanted = wants.has(item.asin);
  const el = document.createElement('article');
  el.className = 'toy';
  el.style.animationDelay = `${Math.min(delay, 12) * 0.03}s`;
  el.innerHTML = `
    <button type="button" class="want-badge ${wanted ? 'on' : ''}" aria-label="${wanted ? 'Put back' : 'Grab'} ${escapeHtml(item.name)}">${wanted ? '★' : '☆'}</button>
    <div class="toy-visual">
      <img src="${item.imageUrl}" alt="" loading="lazy" data-asin="${item.asin}" />
    </div>
    <div class="toy-meta">
      <p class="toy-name">${escapeHtml(item.name)}</p>
      <p class="toy-sub">${escapeHtml([item.age, `p.${item.bookPage}`].filter(Boolean).join(' · '))}</p>
    </div>
  `;
  const img = el.querySelector('img');
  img.addEventListener('error', () => {
    const fallback = document.createElement('div');
    fallback.className = 'toy-fallback';
    fallback.textContent = item.name.trim().charAt(0).toUpperCase() || '?';
    img.replaceWith(fallback);
  });
  el.querySelector('.want-badge').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWant(item.asin);
  });
  el.addEventListener('click', () => toggleWant(item.asin));
  return el;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderHero(root) {
  const hero = document.createElement('header');
  hero.className = 'hero';
  const active = state.kids.find((k) => k.id === state.activeKidId);
  hero.innerHTML = `
    <div class="workshop-sign">
      <svg class="santa-hat" viewBox="0 0 88 64" aria-hidden="true">
        <path d="M20 50c6-28 18-40 48-34-12 6-18 18-12 34" fill="#d7263d"/>
        <path d="M22 48c8-22 18-32 42-28" fill="none" stroke="#8e1528" stroke-width="3" stroke-linecap="round"/>
        <circle cx="66" cy="16" r="9" fill="#fff"/>
        <ellipse cx="34" cy="52" rx="28" ry="10" fill="#fff"/>
      </svg>
      <p class="eyebrow">Here is Santa's workshop</p>
      <h1 class="brand">Grab your gifts</h1>
    </div>
    <p class="tagline">Tap a toy and it drops in your sack. Grown-ups can take the list home.</p>
  `;

  const who = document.createElement('div');
  who.className = 'who-panel';
  const row = document.createElement('div');
  row.className = 'kids-row';
  for (const kid of state.kids) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `kid-chip ${kid.id === state.activeKidId ? 'active' : ''}`;
    btn.textContent = kid.name;
    btn.addEventListener('click', () => {
      state.activeKidId = kid.id;
      saveStore();
      render();
    });
    row.appendChild(btn);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'kid-chip add';
  add.textContent = state.kids.length ? '+ Add a kid' : "+ What's your name?";
  add.addEventListener('click', () => {
    state.showAddKid = !state.showAddKid;
    render();
  });
  row.appendChild(add);
  who.appendChild(row);

  if (state.showAddKid || !state.kids.length) {
    const form = document.createElement('form');
    form.className = 'add-kid';
    form.innerHTML = `
      <input name="name" maxlength="24" placeholder="Your name" autocomplete="off" required />
      <button type="submit">Save</button>
    `;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = new FormData(form).get('name').toString().trim();
      if (!name) return;
      const kid = { id: uid(), name };
      state.kids.push(kid);
      state.wantsByKid[kid.id] = state.wantsByKid[kid.id] || [];
      state.activeKidId = kid.id;
      state.showAddKid = false;
      saveStore();
      toast(`Ho ho ho, ${name}!`);
      render();
    });
    who.appendChild(form);
  } else if (active) {
    const hint = document.createElement('p');
    hint.className = 'screen-hint';
    hint.textContent = `${active.name} is grabbing gifts · ${activeWants().size} in the sack`;
    who.appendChild(hint);
  }

  hero.appendChild(who);
  root.appendChild(hero);
}

function renderBrowse(root) {
  const items = filteredItems();
  const wants = activeWants();
  const categories = ['All', ...(state.catalog?.categories || [])];
  const ages = ['All', 'Ages 0–2', 'Ages 3–4', 'Ages 5–7', 'Ages 8–12', 'Teens & up', 'All ages'];

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `<input class="search" type="search" placeholder="Find a gift…" value="${escapeHtml(state.query)}" />`;
  const search = toolbar.querySelector('.search');
  search.addEventListener('input', () => {
    state.query = search.value;
    renderListOnly();
  });

  const ageSeg = document.createElement('div');
  ageSeg.className = 'seg';
  for (const age of ages.slice(0, 5)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = state.ageFilter === age ? 'active' : '';
    b.textContent = age === 'All' ? 'Any age' : age.replace('Ages ', '');
    b.addEventListener('click', () => {
      state.ageFilter = age;
      render();
    });
    ageSeg.appendChild(b);
  }
  toolbar.appendChild(ageSeg);
  root.appendChild(toolbar);

  const cats = document.createElement('div');
  cats.className = 'cat-scroll';
  for (const cat of categories) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cat-btn ${state.category === cat ? 'active' : ''}`;
    b.textContent = cat;
    b.addEventListener('click', () => {
      state.category = cat;
      render();
    });
    cats.appendChild(b);
  }
  root.appendChild(cats);

  const title = document.createElement('h2');
  title.className = 'view-title';
  title.textContent = `${items.length} gifts on the shelves`;
  root.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.id = 'toy-grid';
  items.slice(0, 240).forEach((item, i) => grid.appendChild(toyCard(item, wants, i)));
  if (!items.length) {
    grid.innerHTML = `<p class="empty">No gifts by that name. Try another!</p>`;
  } else if (items.length > 240) {
    const more = document.createElement('p');
    more.className = 'empty';
    more.textContent = `Showing 240 of ${items.length} — refine search to see more.`;
    root.appendChild(grid);
    root.appendChild(more);
    return;
  }
  root.appendChild(grid);

  function renderListOnly() {
    const next = filteredItems();
    title.textContent = `${next.length} gifts on the shelves`;
    grid.innerHTML = '';
    const w = activeWants();
    next.slice(0, 240).forEach((item, i) => grid.appendChild(toyCard(item, w, i)));
    if (!next.length) grid.innerHTML = `<p class="empty">No gifts by that name. Try another!</p>`;
  }
}

function renderPages(root) {
  const pages = productPages();
  if (!pages.length) {
    root.innerHTML = `<p class="empty">No pages available.</p>`;
    return;
  }
  if (state.pageIndex >= pages.length) state.pageIndex = 0;
  const page = pages[state.pageIndex];
  const wants = activeWants();

  const title = document.createElement('h2');
  title.className = 'view-title';
  title.textContent = 'The toy book';
  root.appendChild(title);

  const wrap = document.createElement('div');
  wrap.className = 'page-browse';

  const nav = document.createElement('div');
  nav.className = 'page-nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.textContent = '← Back';
  prev.disabled = state.pageIndex === 0;
  prev.addEventListener('click', () => {
    state.pageIndex -= 1;
    render();
  });
  const label = document.createElement('div');
  label.className = 'page-label';
  label.textContent = `Book page ${page.bookPage} · ${page.items.length} toys`;
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next →';
  next.disabled = state.pageIndex >= pages.length - 1;
  next.addEventListener('click', () => {
    state.pageIndex += 1;
    render();
  });
  nav.append(prev, label, next);
  wrap.appendChild(nav);

  const stage = document.createElement('div');
  stage.className = 'page-stage';
  stage.innerHTML = `<img src="${publicUrl(page.thumb)}" alt="Toy Book page ${page.bookPage}" />`;
  wrap.appendChild(stage);

  const grid = document.createElement('div');
  grid.className = 'page-items';
  page.items.forEach((item, i) => grid.appendChild(toyCard(item, wants, i)));
  wrap.appendChild(grid);
  root.appendChild(wrap);
}

function renderWishes(root) {
  const wants = activeWants();
  const items = (state.catalog?.items || []).filter((i) => wants.has(i.asin));
  const kid = state.kids.find((k) => k.id === state.activeKidId);
  const title = document.createElement('h2');
  title.className = 'view-title';
  title.textContent = kid ? `${kid.name}’s sack` : 'Your sack';
  root.appendChild(title);

  if (!kid) {
    root.innerHTML += `<p class="empty">Tell Santa your name, then grab your gifts.</p>`;
    return;
  }
  if (!items.length) {
    root.innerHTML += `<p class="empty">Your sack is empty. Tap gifts to grab them!</p>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  items.forEach((item, i) => grid.appendChild(toyCard(item, wants, i)));
  root.appendChild(grid);
}

function renderParents(root) {
  const rows = allWishRows();
  const panel = document.createElement('section');
  panel.className = 'parent-panel';
  panel.innerHTML = `
    <h2>Parents’ gift list</h2>
    <p>${rows.length} picks saved on this device · Prices aren’t printed in the Toy Book — confirm on Amazon when ordering. Export includes kid, item, ASIN, book page, and link.</p>
  `;
  const actions = document.createElement('div');
  actions.className = 'export-actions';
  const xlsxBtn = document.createElement('button');
  xlsxBtn.type = 'button';
  xlsxBtn.textContent = 'Download Excel (.xlsx)';
  xlsxBtn.addEventListener('click', () => exportWorkbook('xlsx'));
  const csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'secondary';
  csvBtn.textContent = 'Download CSV';
  csvBtn.addEventListener('click', () => exportWorkbook('csv'));
  actions.append(xlsxBtn, csvBtn);
  panel.appendChild(actions);

  if (!rows.length) {
    panel.innerHTML += `<p class="empty" style="color:var(--muted)">No wishes yet.</p>`;
  } else {
    const table = document.createElement('table');
    table.className = 'wish-table';
    table.innerHTML = `<thead><tr><th>Kid</th><th>Item</th><th>Page</th><th>Shop</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(r.kid)}</td>
        <td>${escapeHtml(r.item)}${r.age ? `<br><small>${escapeHtml(r.age)}</small>` : ''}</td>
        <td>${escapeHtml(String(r.bookPage))}</td>
        <td><a href="${r.amazonUrl}" target="_blank" rel="noopener">Amazon</a></td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
  }
  root.appendChild(panel);
}

function renderNav(root) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  const count = activeWants().size;
  const tabs = [
    { id: 'browse', label: 'Gifts' },
    { id: 'pages', label: 'Book' },
    { id: 'wishes', label: `Sack${count ? `<span class="badge-count">${count}</span>` : ''}` },
    { id: 'parents', label: 'Parents' },
  ];
  for (const tab of tabs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = state.view === tab.id ? 'active' : '';
    b.innerHTML = tab.label;
    b.addEventListener('click', () => {
      state.view = tab.id;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nav.appendChild(b);
  }
  root.appendChild(nav);
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(makeSnow());
  const shell = document.createElement('div');
  shell.className = 'shell';
  renderHero(shell);
  if (state.view === 'browse') renderBrowse(shell);
  else if (state.view === 'pages') renderPages(shell);
  else if (state.view === 'wishes') renderWishes(shell);
  else renderParents(shell);
  app.appendChild(shell);
  renderNav(app);
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  app.appendChild(t);
}

async function boot() {
  loadStore();
  const res = await fetch(publicUrl('catalog.json'));
  state.catalog = await res.json();
  if (!state.kids.length) state.showAddKid = true;
  render();
}

boot();
