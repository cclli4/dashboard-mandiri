// Tab "Peta & peluang": peta kecamatan, panel detail, peringkat, insight, tabel skor.
// Butuh: data/mapdata.js, data/aktivitas.js, js/common.js, js/aktivitas.js, d3.
(() => {
  const D = MAPDATA;
  const HQ = [106.8552, -6.2428]; // perkiraan lokasi KC Tebet MT Haryono
  const KC = { 'Prioritas garap': '--k-prior', 'Belum tersentuh': '--k-belum', 'Pertahankan & cross-sell': '--k-pert', 'Sudah tergarap': '--k-ter', 'Pantau': '--k-pantau' };
  const RECO = {
    'Belum tersentuh': "Belum ada debitur pipeline. Mulai kunjungan perdana ke pasar dan sentra usaha lewat unit terdekat, bawa paket KUR + Livin' Merchant.",
    'Prioritas garap': "Penduduk besar tapi debitur masih sedikit. Jadwalkan kunjungan massal ke pasar dan pertokoan dengan paket KUR + Livin' Merchant.",
    'Pertahankan & cross-sell': "Basis debitur sudah besar. Fokus onboarding Livin' Merchant untuk debitur yang ada dan jaga kualitas kredit.",
    'Sudah tergarap': 'Penetrasi sudah tinggi. Prioritaskan retensi, reaktivasi merchant usak, dan cross-sell.',
    'Pantau': 'Wilayah kecil dengan penetrasi rendah. Garap lewat kegiatan rutin unit terdekat.',
  };
  const kotaBy = new Map(D.kota.map((k) => [k.kota, k]));
  const kec = D.kec;
  const grpMer = (k) => kotaBy.get(k.kota);
  const grpName = (k) => ({ Bogor: 'Kab. + Kota Bogor', Bekasi: 'Kab. + Kota Bekasi', Tangerang: 'Kab. + Kota Tangerang' }[k.grp] || k.kota);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ---------- kelompok wilayah yang dipakai peringkat & insight ----------
  // (angka KPI di atas halaman diisi js/kpi.js)
  const covered = D.kota.filter((k) => k.deb != null);
  const bps = kec.filter((k) => k.kat);
  const pri = bps.filter((k) => k.kat === 'Prioritas garap'), bel = bps.filter((k) => k.kat === 'Belum tersentuh');

  // ---------- map ----------
  const svg = d3.select('#map'), wrap = $('mapwrap'), tip = $('tip');
  const all = { type: 'FeatureCollection', features: D.kota.map((k) => ({ type: 'Feature', geometry: k.g })) };
  let W = 0, H = 0, proj, path, zoom, state = { m: 'deb', sel: 'Jakarta Selatan|Tebet', rings: true, k: 1, per: 'bulan' };
  // index.html#kec=<id>&m=akt (dipakai tautan dari halaman Progress akuisisi)
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('kec') && kec.some((k) => k.id === hp.get('kec'))) state.sel = hp.get('kec');
  if (['deb', 'pel', 'mer', 'akt'].includes(hp.get('m'))) state.m = hp.get('m');
  const stc = (s) => css(AKT.STC[s].slice(4, -1));
  let AK = new Map(); // ringkasan aktivitas per kecamatan untuk periode terpilih
  const gRoot = svg.append('g');
  const gKec = gRoot.append('g'), gKota = gRoot.append('g'), gRing = gRoot.append('g'), gBub = gRoot.append('g'), gLab = gRoot.append('g'), gAkt = gRoot.append('g'), gHQ = gRoot.append('g');

  const fillFor = () => {
    const r0 = css('--ramp-0'), r1 = css('--ramp-1'), nd = css('--nodata');
    const ramp = (t) => d3.interpolateLab(r0, r1)(t);
    if (state.m === 'deb') {
      const mx = d3.max(kec, (k) => k.deb || 0);
      const s = d3.scaleSqrt([0, mx], [0.04, 1]);
      $('lg-max').textContent = fI.format(mx);
      return (k) => (k.deb == null ? nd : ramp(s(k.deb)));
    }
    if (state.m === 'pel') return (k) => (k.kat ? css(KC[k.kat]) : nd);
    if (state.m === 'akt') return (k) => { const a = AK.get(k.id); return a ? stc(a.puncak) : nd; };
    const mx = d3.max(D.kota, (k) => k.mer);
    const s = d3.scaleSqrt([0, mx], [0.04, 1]);
    $('lg-max').textContent = fI.format(mx);
    return (k) => { const g = grpMer(k); return g.mer ? ramp(s(g.mer)) : nd; };
  };

  const size = () => {
    W = Math.max(300, wrap.clientWidth || 800);
    H = Math.round(Math.min(Math.max(W * 0.78, 440), 760));
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    // Di layar lebar peta digeser ke kanan: legenda di kiri bawah dan tombol zoom di kanan atas tidak menutupi wilayah.
    const padL = W > 640 ? Math.min(W * 0.2, 190) : 16, padR = W > 640 ? 56 : 16;
    proj = d3.geoMercator().fitExtent([[padL, 16], [W - padR, H - 16]], all);
    path = d3.geoPath(proj);
  };

  const draw = () => {
    AK = AKT.perKec(state.per);
    size();
    const fill = fillFor();
    gKec.selectAll('path').data(kec, (k) => k.id).join('path').attr('class', (k) => 'kec' + (k.id === state.sel ? ' sel' : ''))
      .attr('d', (k) => path(k.g)).attr('fill', fill)
      .on('mousemove', (ev, k) => showTip(ev, k)).on('mouseleave', () => { tip.hidden = true; })
      .on('click', (ev, k) => { state.sel = k.id; gKec.selectAll('path').classed('sel', (d) => d.id === state.sel); gKec.selectAll('path.sel').raise(); detail(); });
    gKec.selectAll('path.sel').raise();
    gKota.selectAll('path').data(D.kota, (k) => k.kota).join('path').attr('class', 'kota-o').attr('d', (k) => path(k.g));
    // rings
    const ringData = state.rings ? [5, 10, 20] : [];
    gRing.selectAll('path').data(ringData).join('path').attr('class', 'ring').attr('d', (km) => path(d3.geoCircle().center(HQ).radius(km / 111.32)()));
    gRing.selectAll('text').data(ringData).join('text').attr('class', 'ring-l').attr('text-anchor', 'middle')
      .attr('x', (km) => proj([HQ[0], HQ[1] + km / 111.32])[0]).attr('y', (km) => proj([HQ[0], HQ[1] + km / 111.32])[1] - 3).text((km) => km + ' km');
    // merchant bubbles (kecamatan with readable addresses)
    const bub = state.m === 'mer' ? kec.filter((k) => k.mer > 0) : [];
    const rs = d3.scaleSqrt([0, d3.max(kec, (k) => k.mer) || 1], [0, Math.max(14, W / 40)]);
    gBub.selectAll('circle').data(bub, (k) => k.id).join('circle').attr('class', 'bubble')
      .attr('cx', (k) => path.centroid(k.g)[0]).attr('cy', (k) => path.centroid(k.g)[1]).attr('r', (k) => rs(k.mer));
    // lencana jumlah aktivitas per kecamatan
    const bdg = state.m === 'akt' ? kec.filter((k) => AK.has(k.id)) : [];
    gAkt.selectAll('g.bdg').data(bdg, (k) => k.id).join((en) => { const g = en.append('g').attr('class', 'bdg'); g.append('circle'); g.append('text').attr('text-anchor', 'middle'); return g; })
      .attr('data-x', (k) => path.centroid(k.g)[0]).attr('data-y', (k) => path.centroid(k.g)[1])
      .each(function (k) { const a = AK.get(k.id); d3.select(this).select('circle').attr('fill', stc(a.puncak)); d3.select(this).select('text').text(a.total); });
    // HQ
    const [hx, hy] = proj(HQ);
    gHQ.selectAll('*').remove();
    const hq = gHQ.append('g').attr('class', 'hq').attr('transform', `translate(${hx},${hy})`);
    hq.append('circle').attr('class', 'pulse').attr('r', 9);
    hq.append('path').attr('class', 'pin').attr('d', 'M0 0 C-7 -9 -9 -12 -9 -16 A9 9 0 0 1 9 -16 C9 -12 7 -9 0 0Z');
    hq.append('circle').attr('cy', -16).attr('r', 3.2).attr('fill', css('--navy'));
    hq.append('text').attr('class', 'hq-l').attr('x', 12).attr('y', -14).attr('font-size', 12).text('KC Tebet MT Haryono');
    labels();
    legend();
    ranking();
    detail();
  };

  const labels = () => {
    const k = state.k, fs = 12 / k;
    gHQ.select('.hq').attr('transform', () => { const [hx, hy] = proj(HQ); return `translate(${hx},${hy}) scale(${1 / k})`; });
    const ANCHOR = { 'Kab. Bogor': [106.6, -6.53], 'Kab. Tangerang': [106.47, -6.2], 'Kab. Bekasi': [107.12, -6.2] };
    const kl = D.kota.map((d) => ({ d, c: ANCHOR[d.kota] ? proj(ANCHOR[d.kota]) : path.centroid(d.g), a: d3.geoArea(d.g) })).sort((a, b) => b.a - a.a);
    gLab.selectAll('text.kota-l').data(kl, (x) => x.d.kota).join('text').attr('class', 'kota-l').attr('text-anchor', 'middle')
      .attr('x', (x) => x.c[0]).attr('y', (x) => x.c[1]).attr('font-size', fs).style('stroke-width', 3 / k + 'px').text((x) => x.d.kota)
      .attr('opacity', k >= 2.6 ? 0 : 1);
    // hide kota labels that collide with the cabang label or a larger kota's label
    const placed = [];
    const hqT = gHQ.select('.hq-l').node(); if (hqT) placed.push(hqT.getBoundingClientRect());
    gLab.selectAll('text.kota-l').each(function () { if (k >= 2.6) return; const r = this.getBoundingClientRect(); const hit = placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom && r.bottom > p.top); this.setAttribute('opacity', hit ? 0 : 1); if (!hit) placed.push(r); });
    // kecamatan labels appear once zoomed in, only where they fit
    const show = k >= 2.6 ? kec.filter((d) => { const b = path.bounds(d.g); return (b[1][0] - b[0][0]) * k > d.kec.length * 6.2 && (b[1][1] - b[0][1]) * k > 14; }) : [];
    gLab.selectAll('text.kec-l').data(show, (d) => d.id).join('text').attr('class', 'kec-l').attr('text-anchor', 'middle')
      .attr('x', (d) => path.centroid(d.g)[0]).attr('y', (d) => path.centroid(d.g)[1] + 4 / k).attr('font-size', 10.5 / k).style('stroke-width', 2.5 / k + 'px').text((d) => d.kec);
    gRing.selectAll('text').attr('font-size', 10 / k).style('stroke-width', 3 / k + 'px');
    gAkt.selectAll('g.bdg').attr('transform', function () { return `translate(${this.dataset.x},${this.dataset.y}) scale(${1 / k})`; })
      // saat nama kecamatan tampil (zoom dekat), lencana naik ke atas nama supaya tidak menutupinya
      .each(function () { const t = d3.select(this).select('text'), dy = k >= 2.6 ? -16 : 0; d3.select(this).select('circle').attr('cy', dy).attr('r', t.text().length > 1 ? 10 : 8.5); t.attr('y', dy + 4); });
  };

  const legend = () => {
    const t = { deb: 'Debitur pipeline per kecamatan', pel: 'Kategori peluang (data BPS)', mer: "Merchant Livin' per kab/kota", akt: `Aktivitas lapangan · ${AKT.PERIODE[state.per].toLowerCase()}` }[state.m];
    $('lg-t').textContent = t;
    $('lg-ramp').hidden = state.m === 'pel' || state.m === 'akt';
    $('lg-kat').hidden = state.m !== 'pel';
    $('lg-akt').hidden = state.m !== 'akt';
    $('per-box').hidden = state.m !== 'akt';
    $('lg-bub').hidden = state.m !== 'mer';
    $('lg-nd').textContent = state.m === 'pel' ? 'Data BPS menyusul' : state.m === 'akt' ? 'Belum ada aktivitas' : 'Belum ada data';
    $('map-note').textContent = {
      deb: 'Debitur dipetakan dari lokasi unit mikro yang melayaninya, bukan dari alamat debitur.',
      pel: 'Kategori dibanding median kabupaten/kota: penduduk besar + penetrasi rendah = prioritas garap.',
      akt: 'Warna = status terjauh di kecamatan itu, angka = jumlah usaha yang ditandai. Klik kecamatan lalu "+ Tandai" untuk menambah.',
      mer: `${fI.format(D.mer_unmapped)} merchant (${pct(D.mer_unmapped, D.mer_total)}) alamatnya belum terbaca sehingga tidak tampil di peta. Bogor, Bekasi, Tangerang digabung kab + kota.`,
    }[state.m];
  };

  const row = (dl, a, b) => { const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b; dl.append(dt, dd); };
  const showTip = (ev, k) => {
    const g = grpMer(k);
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = k.kec;
    const s = document.createElement('small'); s.textContent = k.kota + (k.kat ? ' · ' + k.kat : '');
    const dl = document.createElement('dl');
    row(dl, 'Debitur pipeline', k.deb == null ? 'belum ada data' : fI.format(k.deb));
    if (k.pend) row(dl, 'Penduduk', fI.format(k.pend));
    if (k.pen != null) row(dl, 'Per 10 rb penduduk', f1.format(k.pen));
    if (state.m === 'mer') row(dl, "Merchant " + grpName(g), fI.format(g.mer));
    if (k.mer) row(dl, 'Merchant di kecamatan', `${fI.format(k.mer)} (${fI.format(k.mer_a)} aktif)`);
    const a = AK.get(k.id);
    if (state.m === 'akt') { if (a) AKT.STATUS.forEach((st) => { if (a[st]) row(dl, st, fI.format(a[st])); }); else row(dl, 'Aktivitas', 'belum ada'); }
    tip.append(b, s, dl); tip.hidden = false;
    const [mx, my] = d3.pointer(ev, wrap);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(mx + 14, wrap.clientWidth - tw - 6)) + 'px';
    tip.style.top = (my + th + 20 > wrap.clientHeight ? my - th - 12 : my + 14) + 'px';
  };

  const detail = () => {
    const k = kec.find((d) => d.id === state.sel) || kec[0];
    const g = grpMer(k);
    $('d-kota').textContent = k.kota;
    $('d-name').textContent = 'Kec. ' + k.kec;
    const pill = $('d-pill'); pill.replaceChildren();
    const p = document.createElement('span'); p.className = 'pill';
    p.style.setProperty('--sw', k.kat ? `var(${KC[k.kat]})` : 'var(--muted)'); p.textContent = k.kat || 'Data BPS menyusul'; pill.append(p);
    $('d-deb').textContent = k.deb == null ? '–' : fI.format(k.deb);
    $('d-pend').textContent = k.pend ? fI.format(k.pend) : '–';
    $('d-pen').textContent = k.pen != null ? f1.format(k.pen) : '–';
    if (k.mer) { $('d-mer-l').textContent = "Merchant (aktif)"; $('d-mer').textContent = `${fI.format(k.mer)} (${fI.format(k.mer_a)})`; }
    else { $('d-mer-l').textContent = 'Merchant ' + grpName(g); $('d-mer').textContent = fI.format(g.mer); }
    $('d-reco').textContent = k.kat ? RECO[k.kat]
      : k.deb == null ? 'Belum ada debitur pipeline maupun data BPS di sini. Masuk peta Fase 2 setelah data wilayah lengkap.'
      : k.mer ? `Dekat cabang dengan ${fI.format(k.mer)} merchant terdaftar, baru ${fI.format(k.mer_a)} yang aktif. Prioritaskan reaktivasi merchant usak dan onboarding debitur ke Livin' Merchant.`
      : "Data penduduk BPS menyusul. Sementara itu, tawarkan Livin' Merchant ke debitur pipeline yang sudah ada.";
    aktivitas(k);
  };

  // ---------- aktivitas lapangan di panel detail ----------
  const keModeAkt = () => { state.m = 'akt'; document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === 'akt'))); };
  const aktivitas = (k) => {
    const box = $('d-akt'), a = AK.get(k.id), per = AKT.PERIODE[state.per].toLowerCase();
    box.replaceChildren();
    const hd = el('div', 'hd'); hd.append(el('b', null, 'Aktivitas lapangan'));
    const add = el('button', 'btn-t pri', '+ Tandai'); add.type = 'button';
    add.addEventListener('click', () => AKT.form({ kec: k.id, onSaved: (r) => {
      if (state.per !== 'semua' && r.tgl.slice(0, 7) !== AKT.hariIni().slice(0, 7)) state.per = 'semua';
      $('akt-per').value = state.per; keModeAkt(); state.sel = r.kec; draw();
    } }));
    hd.append(add); box.append(hd);
    if (!a) { box.append(el('p', 'note', `Belum ada kunjungan atau akuisisi yang ditandai di sini (${per}).`)); return; }
    const prog = el('div', 'prog'); prog.setAttribute('role', 'img');
    prog.setAttribute('aria-label', AKT.STATUS.map((s) => `${s} ${a[s]}`).join(', '));
    ['Berhasil akuisisi', 'Dalam proses', 'Dikunjungi', 'Tidak berminat'].forEach((s) => { if (a[s]) { const i = el('i'); i.style.width = (a[s] / a.total * 100) + '%'; i.style.setProperty('--sw', AKT.STC[s]); prog.append(i); } });
    const chips = el('div', 'akt-chips');
    AKT.STATUS.forEach((s) => { const c = el('div'); const n = el('span', 'st', s); n.style.setProperty('--sw', AKT.STC[s]); c.append(n, el('b', null, fI.format(a[s]))); chips.append(c); });
    const nMer = a.rs.filter((r) => AKT.tujuan(r) === 'Merchant existing').length;
    box.append(el('p', 'note', `${fI.format(a['Berhasil akuisisi'])} dari ${fI.format(a.total - nMer)} usaha baru berhasil diakuisisi${nMer ? `, ${fI.format(nMer)} kunjungan ke merchant existing` : ''} (${per}).`), prog, chips);
    const ul = el('ul', 'akt-list');
    a.rs.slice(0, 5).forEach((r) => {
      const li = el('li'), b = el('button'); b.type = 'button';
      const st = el('span', 'st', r.status); st.style.setProperty('--sw', AKT.STC[r.status]);
      b.append(el('span', 'nm', r.nama), st, el('small', null, [AKT.kontak(r), r.produk, AKT.fmtTgl(r.tgl), r.petugas].filter(Boolean).join(' · ')));
      b.addEventListener('click', () => AKT.form({ id: r.id }));
      li.append(b); ul.append(li);
    });
    box.append(ul);
    if (a.total > 5) { const l = el('a', 'note', `Lihat semua ${fI.format(a.total)} di Progress akuisisi →`); l.href = 'aktivitas.html#kec=' + encodeURIComponent(k.id); box.append(l); }
  };

  const zoomTo = (geom, pad = 0.12) => {
    const b = path.bounds(geom), dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1];
    const s = Math.min(10, (1 - pad) / Math.max(dx / W, dy / H));
    const x = (b[0][0] + b[1][0]) / 2, y = (b[0][1] + b[1][1]) / 2;
    svg.transition().duration(650).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-x, -y));
  };

  const ranking = () => {
    const ul = $('rank'); ul.replaceChildren();
    let rows, title, note, sw = 'var(--blue)';
    if (state.m === 'deb') { rows = covered.map((k) => ({ n: k.kota, v: k.deb, go: () => zoomTo(k.g) })).sort((a, b) => b.v - a.v); title = 'Debitur per kab/kota'; note = 'Klik baris untuk zoom ke wilayahnya.'; }
    else if (state.m === 'pel') { rows = [...bps].sort((a, b) => b.skor - a.skor).slice(0, 8).map((k) => ({ n: `${k.kec} · ${k.kota.replace('Kab. ', '').replace('Kota ', '')}`, v: k.skor, sw: `var(${KC[k.kat]})`, go: () => { state.sel = k.id; draw(); zoomTo(k.g, 0.55); } })); title = 'Skor peluang tertinggi'; note = 'Skor 0–100. Klik untuk melihat kecamatannya.'; }
    else if (state.m === 'akt') {
      rows = [...AK].map(([id, a]) => { const k = kec.find((d) => d.id === id); return k && { n: `${k.kec} · ${k.kota.replace('Kab. ', '').replace('Kota ', '')}`, v: a['Berhasil akuisisi'], sub: a.total, sw: 'var(--a-berhasil)', go: () => { state.sel = k.id; draw(); zoomTo(k.g, 0.55); } }; })
        .filter(Boolean).sort((a, b) => b.v - a.v || b.sub - a.sub).slice(0, 10);
      title = 'Akuisisi per kecamatan';
      note = rows.length ? `Berhasil akuisisi (dalam kurung: semua usaha yang ditandai), ${AKT.PERIODE[state.per].toLowerCase()}.` : 'Belum ada aktivitas di periode ini. Klik kecamatan di peta lalu "+ Tandai".';
    }
    else {
      const seen = new Set(); rows = [];
      D.kota.forEach((k) => { if (k.mer && !seen.has(k.grp)) { seen.add(k.grp); const geoms = D.kota.filter((x) => x.grp === k.grp).map((x) => ({ type: 'Feature', geometry: x.g })); rows.push({ n: grpName(k), v: k.mer, sub: k.mer_a, go: () => zoomTo({ type: 'FeatureCollection', features: geoms }) }); } });
      rows.sort((a, b) => b.v - a.v); rows.push({ n: 'Alamat belum terbaca', v: D.mer_unmapped, sub: D.mer_unmapped_aktif, sw: 'var(--muted)' });
      title = "Merchant Livin' per wilayah"; note = 'Angka dalam kurung = merchant aktif September 2026.'; sw = 'var(--gold)';
    }
    $('r-title').textContent = title; $('r-note').textContent = note;
    const mx = d3.max(rows, (r) => r.v) || 1;
    rows.forEach((r) => {
      const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
      const n = document.createElement('span'); n.className = 'nm'; n.textContent = r.n;
      const v = document.createElement('span'); v.className = 'v'; v.textContent = fI.format(r.v) + (r.sub != null ? ` (${fI.format(r.sub)})` : '');
      const bar = document.createElement('span'); bar.className = 'bar'; const i = document.createElement('i'); i.style.width = (r.v / mx * 100) + '%'; i.style.setProperty('--sw', r.sw || sw); bar.append(i);
      b.append(n, v, bar); if (r.go) b.addEventListener('click', r.go); else b.disabled = true;
      li.append(b); ul.append(li);
    });
  };

  // ---------- zoom ----------
  zoom = d3.zoom().scaleExtent([1, 12])
    .filter((ev) => (ev.type === 'wheel' ? ev.ctrlKey || ev.metaKey : !ev.button))
    .on('zoom', (ev) => { gRoot.attr('transform', ev.transform); if (state.k !== ev.transform.k) { state.k = ev.transform.k; labels(); } });
  svg.call(zoom);
  $('z-in').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.6));
  $('z-out').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6));
  $('z-all').addEventListener('click', () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));
  const home = () => zoomTo(d3.geoCircle().center(HQ).radius(22 / 111.32)(), 0.05);
  $('z-home').addEventListener('click', home);
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    state.m = b.dataset.m; document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  $('rings').addEventListener('change', (e) => { state.rings = e.target.checked; draw(); });
  $('akt-per').addEventListener('change', (e) => { state.per = e.target.value; draw(); });
  AKT.bilah($('sync'));
  AKT.on(() => draw());
  window.addEventListener('hashchange', () => {
    const h = new URLSearchParams(location.hash.slice(1)), k = kec.find((d) => d.id === h.get('kec'));
    if (['deb', 'pel', 'mer', 'akt'].includes(h.get('m'))) { state.m = h.get('m'); document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === state.m))); }
    if (k) { state.sel = k.id; draw(); zoomTo(k.g, 0.55); } else draw();
  });

  // ---------- insights & table ----------
  // Setiap insight punya syarat. Insight hanya tampil kalau datanya memenuhi syarat itu,
  // jadi isi kotak ini menyesuaikan sendiri tiap kali data bulanan diperbarui.
  const ins = [];
  // jarak titik tengah kecamatan (rata-rata titik batasnya) ke cabang, dalam km
  const jarak = (k) => {
    let x = 0, y = 0, n = 0;
    const jalan = (c) => { if (typeof c[0] === 'number') { x += c[0]; y += c[1]; n++; } else c.forEach(jalan); };
    try { jalan(k.g.coordinates); } catch (e) { return Infinity; }
    return n ? d3.geoDistance(HQ, [x / n, y / n]) * 6371 : Infinity;
  };
  const nm = (k) => `${k.kec} (${k.kota})`;
  const daftar = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1]);
  const ok = (k) => k.pend > 0 && k.pen != null;
  const priOk = pri.filter(ok);

  // 1. Prioritas garap dengan penduduk terbesar (lintas kab/kota)
  const priBesar = [...priOk].sort((a, b) => b.pend - a.pend).slice(0, 2);
  if (priBesar.length) ins.push([daftar(priBesar.map(nm)),
    ` adalah prioritas garap dengan penduduk terbesar: ${priBesar.map((k) => fK.format(k.pend)).join(' dan ')} penduduk, penetrasi baru ${priBesar.map((k) => f1.format(k.pen)).join(' dan ')} debitur per 10 rb. Jadikan target kunjungan massal.`]);

  // 2. Prioritas garap yang dekat cabang (≤ 10 km), selain yang sudah disebut di atas
  const sudah = new Set(priBesar.map((k) => k.id));
  const priDekat = priOk.filter((k) => !sudah.has(k.id)).map((k) => ({ k, j: jarak(k) })).filter((x) => x.j <= 10).sort((a, b) => a.j - b.j).slice(0, 3);
  if (priDekat.length) ins.push([daftar(priDekat.map((x) => x.k.kec)),
    ` masih prioritas garap padahal hanya ${priDekat.map((x) => '±' + f1.format(x.j)).join(' / ')} km dari cabang: total ${fK.format(priDekat.reduce((a, x) => a + x.k.pend, 0))} penduduk, penetrasi ${priDekat.map((x) => f1.format(x.k.pen)).join(' / ')} debitur per 10 rb.`]);

  // 3. Penetrasi paling tertinggal dibanding rata-rata kab/kotanya (di bawah separuh median)
  const medKota = new Map();
  for (const kota of new Set(bps.map((k) => k.kota))) {
    const p = bps.filter((k) => k.kota === kota && k.deb > 0 && k.pen != null).map((k) => k.pen).sort((a, b) => a - b);
    if (p.length >= 3) medKota.set(kota, p.length % 2 ? p[(p.length - 1) / 2] : (p[p.length / 2 - 1] + p[p.length / 2]) / 2);
  }
  const telat = priOk.filter((k) => !sudah.has(k.id) && !priDekat.some((x) => x.k.id === k.id) && medKota.get(k.kota) > 0)
    .map((k) => ({ k, r: k.pen / medKota.get(k.kota) })).filter((x) => x.r < 0.5).sort((a, b) => a.r - b.r)[0];
  if (telat) { const k = telat.k; ins.push([`Kec. ${nm(k)}`,
    ` baru ${fI.format(k.deb)} debitur untuk ${fK.format(k.pend)} penduduk (${f1.format(k.pen)} per 10 rb), kurang dari separuh median ${k.kota} (${f1.format(medKota.get(k.kota))}).`]); }

  // 4. Kecamatan belum tersentuh
  const belTop = bel.filter((k) => k.pend > 0).sort((a, b) => b.pend - a.pend).slice(0, 3);
  if (belTop.length) ins.push([`${fI.format(bel.length)} kecamatan belum tersentuh`,
    `, terbesar ${belTop.map((k) => `${k.kec} (${fK.format(k.pend)})`).join(', ')}. Perlu unit atau agen terdekat sebagai pintu masuk.`]);

  // 5. Merchant terdaftar banyak tapi aktifnya rendah (min. 20 merchant, aktif < 40%)
  const merLow = kec.filter((k) => k.mer >= 20 && k.mer_a / k.mer < 0.4).sort((a, b) => (b.mer - b.mer_a) - (a.mer - a.mer_a))[0];
  if (merLow) { const j = jarak(merLow); ins.push([merLow.kec,
    ` sudah punya ${fI.format(merLow.mer)} merchant terdaftar, tapi hanya ${fI.format(merLow.mer_a)} yang aktif (${Math.round(merLow.mer_a / merLow.mer * 100)}%). Reaktivasi lebih murah daripada akuisisi baru${j <= 10 ? ', apalagi lokasinya dekat cabang' : ''}.`]); }

  // 6. Momentum debitur baru (min. 3 debitur baru di satu kecamatan)
  const momen = [...kec].filter((k) => k.baru >= 3).sort((a, b) => b.baru - a.baru)[0];
  if (momen && ins.length < 5) ins.push([nm(momen),
    ` mencatat ${fI.format(momen.baru)} debitur baru, terbanyak di antara semua kecamatan. Pertahankan ritme kunjungan dan tawarkan Livin' Merchant ke debitur baru.`]);

  if (!ins.length) ins.push(['Belum ada pola menonjol', ' pada data saat ini. Insight akan muncul otomatis setelah data debitur, penduduk, atau merchant diperbarui.']);
  const ul = $('ins');
  ins.slice(0, 5).forEach(([b, t], i) => { const li = document.createElement('li'); const n = document.createElement('i'); n.textContent = String(i + 1); const d = document.createElement('div'); const bb = document.createElement('b'); bb.textContent = b; d.append(bb, document.createTextNode(t)); li.append(n, d); ul.append(li); });
  const tb = $('top');
  [...bps].sort((a, b) => b.skor - a.skor).slice(0, 10).forEach((k) => {
    const tr = document.createElement('tr');
    [k.kec, k.kota, fI.format(k.pend), fI.format(k.deb), f1.format(k.pen), fI.format(k.skor)].forEach((v, i) => { const td = document.createElement('td'); td.textContent = v; if (i > 1) td.className = 'n'; tr.append(td); });
    tr.addEventListener('click', () => { state.sel = k.id; state.m = 'pel'; document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === 'pel'))); draw(); $('peta-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); zoomTo(k.g, 0.55); });
    tb.append(tr);
  });

  // ---------- boot ----------
  document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === state.m)));
  draw();
  svg.call(zoom.transform, d3.zoomIdentity);
  if (hp.get('kec')) { const k0 = kec.find((d) => d.id === state.sel); if (k0) setTimeout(() => zoomTo(k0.g, 0.55), 50); }
  let lastW = wrap.clientWidth;
  new ResizeObserver(() => { if (Math.abs(wrap.clientWidth - lastW) > 4) { lastW = wrap.clientWidth; svg.call(zoom.transform, d3.zoomIdentity); state.k = 1; draw(); } }).observe(wrap);
  const redraw = () => draw();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw); } catch (e) {}
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
