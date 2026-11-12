// Halaman "Progress akuisisi": ringkasan, tabel aktivitas, progres per petugas, prioritas yang belum dikunjungi.
// Butuh: data/mapdata.js, data/aktivitas.js, js/common.js, js/aktivitas.js.
(() => {
  const st = { per: 'bulan', status: '', pet: '', kota: '', q: '', kec: '' };
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('kec') && AKT.kecBy.has(hp.get('kec'))) { st.kec = hp.get('kec'); st.per = 'semua'; }
  const nmKec = (id) => { const k = AKT.kecBy.get(id); return k ? k.kec : id.split('|')[1] || id; };
  const nmKota = (id) => { const k = AKT.kecBy.get(id); return k ? k.kota : id.split('|')[0]; };
  const pill = (s) => { const p = el('span', 'st', s); p.style.setProperty('--sw', AKT.STC[s]); return p; };
  const lastNote = (r) => { const h = [...(r.riwayat || [])].reverse().find((x) => x.catatan); return h ? h.catatan : ''; };

  // isi pilihan filter
  AKT.STATUS.forEach((s) => $('f-st').append(new Option(s, s)));
  [...new Set(MAPDATA.kec.map((k) => k.kota))].sort().forEach((k) => $('f-kota').append(new Option(k, k)));
  const isiPetugas = () => {
    const sel = $('f-pet'), v = sel.value;
    const ps = [...new Set(AKT.daftar('semua').map((r) => r.petugas))].sort();
    sel.replaceChildren(new Option('Semua petugas', ''), ...ps.map((p) => new Option(p, p)));
    sel.value = ps.includes(v) ? v : '';
  };

  const saring = () => AKT.daftar(st.per).filter((r) =>
    (!st.status || r.status === st.status) && (!st.pet || r.petugas === st.pet) && (!st.kota || nmKota(r.kec) === st.kota) && (!st.kec || r.kec === st.kec)
    && (!st.q || `${r.nama} ${nmKec(r.kec)} ${r.produk} ${lastNote(r)}`.toLowerCase().includes(st.q)));

  const tiles = (rs) => {
    const c = AKT.hitung(rs), box = $('tiles');
    const items = [
      ['Usaha ditandai', fI.format(c.total), AKT.PERIODE[st.per], 'var(--blue)'],
      ...AKT.STATUS.map((s) => [s, fI.format(c[s]), c.total ? fP.format(c[s] / c.total) + ' dari yang ditandai' : '–', AKT.STC[s]]),
    ];
    box.replaceChildren(...items.map(([l, n, sub, sw]) => {
      const d = el('div', 'ptile'); d.style.setProperty('--sw', sw);
      d.append(el('span', 'lbl', l), el('b', null, n), el('small', null, sub));
      return d;
    }));
  };

  const tabel = (rs) => {
    $('n').textContent = fI.format(rs.length);
    fill($('rows'), rs, (r) => {
      const a = el('a', null, nmKec(r.kec)); a.href = 'index.html#m=akt&kec=' + encodeURIComponent(r.kec); a.title = 'Buka di peta';
      a.addEventListener('click', (e) => e.stopPropagation());
      const kc = el('span'); kc.append(a, el('small', 'sub', ' · ' + nmKota(r.kec).replace('Kab. ', '').replace('Kota ', '')));
      const nm = el('span', null, r.nama); if (AKT.kontak(r)) nm.append(el('small', 'sub-no', AKT.kontak(r)));
      return [[AKT.fmtTgl(r.tgl)], [nm], [kc], [(() => { const p = el('span', null, r.produk); if (AKT.tujuan(r) === 'Merchant existing') p.append(el('small', 'sub-no', 'Merchant existing')); return p; })()], [pill(r.status)], [r.petugas], [lastNote(r) || '–', 'wrap']];
    }, 7);
    [...$('rows').children].forEach((tr, i) => { if (!rs[i]) return; tr.classList.add('click'); tr.tabIndex = 0; const go = () => AKT.form({ id: rs[i].id }); tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); });
  };

  const perPetugas = (rs) => {
    const m = new Map(); rs.forEach((r) => { const o = m.get(r.petugas) || { tot: 0, ok: 0 }; o.tot++; if (AKT.tercapai(r)) o.ok++; m.set(r.petugas, o); });
    const rows = [...m].map(([n, o]) => ({ n, v: o.ok, back: o.tot, t: `${fI.format(o.ok)} tercapai dari ${fI.format(o.tot)}`, sw: 'var(--a-berhasil)' })).sort((a, b) => b.v - a.v || b.back - a.back);
    const mx = Math.max(1, ...rows.map((r) => r.back));
    rows.forEach((r) => { r.max = mx; });
    if (rows.length) rankList($('r-pet'), rows); else $('r-pet').replaceChildren(el('li', 'note', 'Belum ada aktivitas pada periode ini.'));
  };

  const prioritas = () => {
    const ada = new Set(AKT.daftar(st.per).map((r) => r.kec));
    const ks = MAPDATA.kec.filter((k) => (k.kat === 'Prioritas garap' || k.kat === 'Belum tersentuh') && !ada.has(k.id) && (!st.kota || k.kota === st.kota)).sort((a, b) => b.pend - a.pend).slice(0, 10);
    const ul = $('r-pri'); ul.replaceChildren();
    if (!ks.length) { ul.append(el('li', 'note', 'Semua kecamatan prioritas sudah dikunjungi pada periode ini.')); return; }
    const mx = ks[0].pend;
    ks.forEach((k) => {
      const li = el('li'), a = el('a', 'rowx'); a.href = 'index.html#m=akt&kec=' + encodeURIComponent(k.id);
      const bar = el('span', 'bar'), i = el('i'); i.style.width = (k.pend / mx * 100) + '%'; i.style.setProperty('--sw', k.kat === 'Prioritas garap' ? 'var(--k-prior)' : 'var(--k-belum)'); bar.append(i);
      a.append(el('span', 'nm', `${k.kec} · ${k.kota.replace('Kab. ', '').replace('Kota ', '')}`), el('span', 'v', fK.format(k.pend) + ' jiwa'), bar);
      li.append(a); ul.append(li);
    });
  };

  const draw = () => {
    isiPetugas();
    const fk = $('f-kec'); fk.hidden = !st.kec; if (st.kec) fk.textContent = `Kec. ${nmKec(st.kec)} ×`;
    document.querySelectorAll('#per button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === st.per)));
    const rs = saring();
    tiles(rs); tabel(rs); perPetugas(rs); prioritas();
  };

  // ---------- kontrol ----------
  document.querySelectorAll('#per button').forEach((b) => b.addEventListener('click', () => { st.per = b.dataset.k; draw(); }));
  $('f-st').addEventListener('change', (e) => { st.status = e.target.value; draw(); });
  $('f-pet').addEventListener('change', (e) => { st.pet = e.target.value; draw(); });
  $('f-kota').addEventListener('change', (e) => { st.kota = e.target.value; draw(); });
  $('f-q').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); draw(); });
  $('f-kec').addEventListener('click', () => { st.kec = ''; history.replaceState(null, '', location.pathname); draw(); });
  $('b-add').addEventListener('click', () => AKT.form({ kec: st.kec || undefined }));

  // Ekspor: SheetJS dimuat saat dibutuhkan saja (file-nya besar).
  const muatXLSX = () => new Promise((res, rej) => { if (window.XLSX) return res(); const s = document.createElement('script'); s.src = 'js/vendor/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
  $('b-xls').addEventListener('click', async () => {
    await muatXLSX();
    const rs = saring();
    const ws1 = XLSX.utils.json_to_sheet(rs.map((r) => ({ Tanggal: r.tgl, 'Usaha / nasabah': r.nama, NIK: AKT.samar.nik(r.nik), 'No. HP': AKT.samar.hp(r.hp), 'No. rekening': AKT.samar.rek(r.rek), Kecamatan: nmKec(r.kec), 'Kab/kota': nmKota(r.kec), Tujuan: AKT.tujuan(r), Produk: r.produk, Status: r.status, 'Target tercapai': AKT.tercapai(r) ? 'Ya' : 'Belum', Petugas: r.petugas, 'Catatan terakhir': lastNote(r) })));
    const ws2 = XLSX.utils.json_to_sheet(rs.flatMap((r) => (r.riwayat || []).map((h) => ({ 'Usaha / nasabah': r.nama, Kecamatan: nmKec(r.kec), Tanggal: h.tgl, Status: h.status, Petugas: h.petugas, Catatan: h.catatan }))));
    ws1['!cols'] = [12, 28, 18, 16, 16, 18, 16, 18, 16, 18, 14, 22, 40].map((w) => ({ wch: w }));
    ws2['!cols'] = [28, 18, 12, 18, 22, 40].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Aktivitas');
    XLSX.utils.book_append_sheet(wb, ws2, 'Riwayat');
    XLSX.writeFile(wb, `progress-akuisisi-${AKT.hariIni()}.xlsx`);
  });

  AKT.bilah($('sync'));
  AKT.on(draw);
  draw();
})();
