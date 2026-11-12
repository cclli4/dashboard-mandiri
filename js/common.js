// Helper dan data turunan yang dipakai lebih dari satu halaman.
// Dimuat di semua halaman, sebelum js/kpi.js dan script per-halaman.

window.$ = (id) => document.getElementById(id);
window.el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ---------- format angka (id-ID) ----------
window.fI = new Intl.NumberFormat('id-ID');
window.f1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
window.fK = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 0 });
window.fP = new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 });
window.pct = (a, b) => fP.format(b ? a / b : 0);

// ---------- tanggal data (diisi halaman Perbarui data) ----------
// <span data-meta="tgl"> dll. di HTML diganti dengan DASHDATA.meta supaya tanggal ikut berubah tiap update.
if (DASHDATA.meta) document.querySelectorAll('[data-meta]').forEach((e) => { const v = DASHDATA.meta[e.dataset.meta]; if (v) e.textContent = v; });

// ---------- data merchant (dipakai KPI "merchant usak" dan tab merchant) ----------
window.SEG = ['Baru berhenti', 'Aktif, turun', 'Aktif', 'Baru, belum transaksi', 'Usak', 'Closed'];
window.SEGC = {
  'Aktif': 'var(--ok)',
  'Aktif, turun': 'var(--seg-turun)',
  'Baru berhenti': 'var(--bad)',
  'Baru, belum transaksi': 'var(--seg-baru)',
  'Usak': 'var(--seg-usak)',
  'Closed': 'var(--k-pantau)',
};
window.MER = DASHDATA.mer.map((r) => ({ nama: r[0], jenis: r[1], wil: r[2], seg: r[3], agu: r[4], sep: r[5], sv: r[6], rek: r[7], th: r[8] }));
window.isAktif = (r) => r.seg === 'Aktif' || r.seg === 'Aktif, turun';

// ---------- komponen tampilan ----------
// Daftar batang bertingkat. r = {n, v, t, sw, back, max}
window.rankList = (ul, rows) => {
  ul.replaceChildren();
  const mx = Math.max(1, ...rows.map((r) => r.max ?? r.v));
  rows.forEach((r) => {
    const li = el('li'), b = el('div', 'rowx');
    b.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:6px 8px;border-radius:10px';
    const bar = el('span', 'bar' + (r.back != null ? ' two' : ''));
    if (r.back != null) { const bg = el('i'); bg.style.width = (r.back / mx * 100) + '%'; bg.style.setProperty('--sw', 'var(--bar-back)'); bar.append(bg); }
    const i = el('i'); i.style.width = Math.max(r.v > 0 ? 1.2 : 0, r.v / mx * 100) + '%'; i.style.setProperty('--sw', r.sw || 'var(--blue)'); bar.append(i);
    b.append(el('span', 'nm', r.n), el('span', 'v', r.t), bar); li.append(b); ul.append(li);
  });
};

// Donat dengan angka di tengah. parts = [{n, v, c}]
window.donut = (box, parts, c1, c2) => {
  box.replaceChildren();
  const S = 170, R = S / 2, svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${S} ${S}`).attr('role', 'img');
  const pie = d3.pie().sort(null).value((d) => d.v)(parts.filter((p) => p.v > 0));
  const arc = d3.arc().innerRadius(R * 0.64).outerRadius(R - 2).cornerRadius(3).padAngle(0.012);
  svg.append('g').attr('transform', `translate(${R},${R})`).selectAll('path').data(pie).join('path').attr('d', arc).style('fill', (d) => d.data.c).append('title').text((d) => `${d.data.n}: ${fI.format(d.data.v)}`);
  svg.append('text').attr('class', 'c1').attr('x', R).attr('y', R + 4).attr('text-anchor', 'middle').text(c1);
  svg.append('text').attr('class', 'c2').attr('x', R).attr('y', R + 20).attr('text-anchor', 'middle').text(c2);
};

// Legenda donat; kalau onClick diisi, tiap baris jadi tombol saringan.
window.legendList = (ul, parts, total, onClick, active) => {
  ul.replaceChildren();
  parts.forEach((p) => {
    const li = el('li'), b = el(onClick ? 'button' : 'div', onClick ? '' : 'li');
    if (onClick) { b.type = 'button'; b.setAttribute('aria-pressed', String(active === p.n)); b.addEventListener('click', () => onClick(p.n)); }
    const sw = el('i'); sw.style.setProperty('--sw', p.c);
    b.append(sw, el('span', null, p.n), el('b', null, fI.format(p.v)), el('small', null, fP.format(p.v / total))); li.append(b); ul.append(li);
  });
};

// Isi <tbody>. cells(r) mengembalikan [[isi, kelas?], ...]
window.fill = (tb, rows, cells, cols) => {
  tb.replaceChildren();
  if (!rows.length) { const tr = el('tr'), td = el('td', 'empty', 'Tidak ada data yang cocok dengan saringan ini.'); td.colSpan = cols; tr.append(td); tb.append(tr); return; }
  const frag = document.createDocumentFragment();
  rows.forEach((r) => { const tr = el('tr'); cells(r).forEach(([v, cls]) => { const td = el('td', cls || null); if (v instanceof Node) td.append(v); else td.textContent = v; tr.append(td); }); frag.append(tr); });
  tb.append(frag);
};

// Pasang listener pada .seg button di dalam root; cb menerima data-k tombol.
window.segBtns = (root, cb) => root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  root.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.k);
}));
