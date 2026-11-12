// Pengolah data bulanan: dua file Excel dari pusat -> MAPDATA + DASHDATA.
// Dipakai oleh perbarui.html (di browser) dan bisa dijalankan di Node untuk pengujian.
// Semua aturan di sini direkonstruksi dari data September 2026 dan sudah dicek
// menghasilkan angka yang sama dengan dashboard versi awal.
(function (root) {
  'use strict';

  // ---------- aturan yang mungkin perlu disesuaikan ----------

  // Nama area untuk cluster Jakarta (selain itu otomatis: "Jakarta – <Nama Cluster>").
  const LABEL_CLUSTER = {
    'JAKARTA MENARA CYBER 2': 'Jakarta – Tebet Supomo',
    'JAKARTA WISMA DANANTARA INDONESIA': 'Jakarta – Plaza Mandiri',
  };
  const AREA_TEBET = 'Jakarta – Tebet Supomo'; // area cabang, untuk KPI "tebet"

  // Wilayah merchant dari alamat: dicek berurutan, kata kunci pertama yang cocok menang.
  const WIL_ATURAN = [
    ['Tebet', ['tebet']],
    ['Manggarai', ['manggarai']],
    ['Pancoran', ['pancoran']],
    ['Kalibata', ['kalibata']],
    ['Cawang', ['cawang']],
    ['Pasar Minggu', ['pasar minggu']],
    ['Mampang', ['mampang']],
    ['Jakarta Selatan lain', ['jakarta selatan']],
    ['Jakarta Timur', ['jakarta timur', 'cililitan']],
    ['Bekasi', ['bekasi']],
    ['Depok', ['depok']],
    ['Bogor', ['bogor', 'cibinong']],
    ['Tangerang', ['tangerang', 'ciputat']],
  ];
  const WIL_LAIN = 'Belum terpetakan';
  // Wilayah merchant -> kecamatan di peta (yang tidak ada di sini hanya dihitung per kab/kota).
  const WIL_KEC = {
    Tebet: 'Jakarta Selatan|Tebet', Manggarai: 'Jakarta Selatan|Tebet',
    Pancoran: 'Jakarta Selatan|Pancoran', Kalibata: 'Jakarta Selatan|Pancoran',
    'Pasar Minggu': 'Jakarta Selatan|Pasar Minggu', Mampang: 'Jakarta Selatan|Mampang Prapatan',
  };
  // Wilayah merchant -> kelompok kab/kota di peta (kolom "grp" di MAPDATA.kota).
  const WIL_GRP = {
    Tebet: 'Jakarta Selatan', Manggarai: 'Jakarta Selatan', Pancoran: 'Jakarta Selatan', Kalibata: 'Jakarta Selatan',
    'Pasar Minggu': 'Jakarta Selatan', Mampang: 'Jakarta Selatan', 'Jakarta Selatan lain': 'Jakarta Selatan',
    'Jakarta Timur': 'Jakarta Timur', Cawang: 'Jakarta Timur',
    Bekasi: 'Bekasi', Depok: 'Kota Depok', Bogor: 'Bogor', Tangerang: 'Tangerang',
  };

  // Skor target kunjungan (sama dengan keterangan di kunjungan.html).
  const POIN_SUMBER = { 'Baru Cair': 40, 'MM Booking': 30, Existing: 0 };
  const POIN_AGEN = 20, BAKI_PENUH = 200; // baki (Rp juta) yang memberi poin penuh 40
  const TARGET_PER_KOTA = 120;

  // Penurunan transaksi 30 hari yang dianggap "Aktif, turun".
  const BATAS_TURUN = 0.5;

  const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // ---------- helper ----------
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const low = (s) => norm(s).toLowerCase();
  const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
  const kosong = (v) => v == null || norm(v) === '' || norm(v).toUpperCase() === 'NULL';
  // Huruf besar di awal tiap kata (huruf setelah karakter non-huruf), seperti str.title() Python.
  const judul = (s) => norm(s).toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  // Pembulatan seperti round() Python: tepat setengah dibulatkan ke genap.
  // toFixed() menghitung dari nilai biner yang eksak, jadi "setengah" hanya terdeteksi bila memang tepat .5.
  const bulat = (v, d = 0) => {
    const s = Math.abs(v).toFixed(d + 30), p = s.indexOf('.');
    if (s.slice(p + d + 1).replace(/0+$/, '') !== '5') return +v.toFixed(d) || 0;
    const head = s.slice(0, d ? p + d + 1 : p);
    let r = +head; if (+head[head.length - 1] % 2) r += 10 ** -d;
    r = +r.toFixed(d); return v < 0 ? -r : r;
  };
  const median = (a) => { a = [...a].sort((x, y) => x - y); const n = a.length; if (!n) return 0; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  const hitung = (arr, f) => arr.reduce((o, r) => { const k = f(r); o[k] = (o[k] || 0) + 1; return o; }, {});

  // Baris judul tabel: cari baris pertama (dari 15 teratas) yang memuat semua kolom wajib.
  function bacaTabel(XLSX, ws, wajib) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const h = (aoa[i] || []).map((x) => low(x));
      if (wajib.every((w) => h.includes(w.toLowerCase()))) return { head: aoa[i].map((x) => norm(x)), rows: aoa.slice(i + 1), headLow: h };
    }
    return null;
  }
  function cariSheet(XLSX, wb, wajib) {
    for (const n of wb.SheetNames) { const t = bacaTabel(XLSX, wb.Sheets[n], wajib); if (t) return { nama: n, ...t }; }
    return null;
  }

  // ---------- 1. pipeline debitur ----------
  const KOLOM_PIPE = ['cluster', 'nama_unit', 'nama_debitur', 'baki debet', 'produk', 'Sumber', 'Flagging Agen', 'nama_sgp'];

  function bacaPipeline(XLSX, wb) {
    const t = cariSheet(XLSX, wb, KOLOM_PIPE);
    if (!t) throw new Error(`File pipeline tidak dikenali. Pastikan ada sheet detail dengan kolom: ${KOLOM_PIPE.join(', ')}.`);
    const ix = Object.fromEntries(KOLOM_PIPE.map((k) => [k, t.headLow.indexOf(k.toLowerCase())]));
    const rows = [];
    t.rows.forEach((r, i) => {
      if (!r || kosong(r[ix.nama_unit])) return;
      rows.push({
        no: i + 1,
        cluster: norm(r[ix.cluster]).toUpperCase(),
        unit: norm(r[ix.nama_unit]),
        nama: norm(r[ix.nama_debitur]),
        baki: num(r[ix['baki debet']]),
        produk: norm(r[ix.produk]).toUpperCase(),
        sumber: norm(r[ix.Sumber]),
        agen: norm(r[ix['Flagging Agen']]),
        sgp: kosong(r[ix.nama_sgp]) ? '' : norm(r[ix.nama_sgp]),
      });
    });
    if (!rows.length) throw new Error(`Sheet "${t.nama}" tidak berisi baris debitur.`);
    return { sheet: t.nama, rows };
  }

  const kotaUnit = (cluster) => (cluster.startsWith('DEPOK') ? 'Depok' : cluster.startsWith('JAKARTA') ? 'Jakarta' : 'Bogor');
  const areaCluster = (cluster) => {
    const k = kotaUnit(cluster);
    if (k !== 'Jakarta') return k;
    return LABEL_CLUSTER[cluster] || 'Jakarta – ' + judul(cluster.replace(/^JAKARTA\s*/, ''));
  };
  const singkatNama = (n) => { const w = judul(n).split(' '); return w.length > 1 ? `${w[0]} ${w[1][0]}.` : w[0]; };
  const isBaru = (r) => r.sumber !== 'Existing';
  const isAgen = (r) => r.agen.toLowerCase() === 'agen';

  // ---------- 2. merchant ----------
  function bacaMerchant(XLSX, wb) {
    const wajib = ['Nama Merchant', 'address', 'lob_lm', 'Create Date', 'status rekening'];
    const t = cariSheet(XLSX, wb, wajib);
    if (!t) throw new Error(`File merchant tidak dikenali. Pastikan ada kolom: ${wajib.join(', ')}, "Trx 30 Days ...", "SV 30 Days ...", "status trx ...".`);
    const at = (k) => t.headLow.indexOf(k.toLowerCase());
    const semua = (awal) => t.headLow.map((h, i) => (h.startsWith(awal) ? i : -1)).filter((i) => i >= 0);
    const trx = semua('trx 30 days'), sv = semua('sv 30 days'), st = semua('status trx');
    if (trx.length < 2 || sv.length < 2 || st.length < 2) throw new Error('File merchant harus punya dua kolom "Trx 30 Days", "SV 30 Days", dan "status trx" (bulan lalu dan bulan ini).');
    const tglKolom = (i) => { const m = t.head[i].match(/(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})\s*$/); return m ? m[1] : t.head[i]; }; // "21 September 26"
    const rows = t.rows.filter((r) => r && !kosong(r[at('nama merchant')])).map((r) => ({
      nama: norm(r[at('nama merchant')]),
      alamat: norm(r[at('address')]),
      jenis: norm(r[at('lob_lm')]),
      buat: r[at('create date')],
      rek: norm(r[at('status rekening')]).toUpperCase(),
      t0: num(r[trx[0]]), t1: num(r[trx[1]]), sv1: num(r[sv[1]]),
      s0: norm(r[st[0]]).toUpperCase(), s1: norm(r[st[1]]).toUpperCase(),
    }));
    return { rows, tglLalu: tglKolom(trx[0]), tglIni: tglKolom(trx[1]) };
  }

  const wilayah = (alamat) => {
    const a = low(alamat);
    for (const [w, ks] of WIL_ATURAN) if (ks.some((k) => a.includes(k))) return w;
    return WIL_LAIN;
  };
  const segmen = (m) => {
    if (m.rek === 'CLOSED') return 'Closed';
    if (m.s1 === 'ACTIVE') return m.s0 === 'ACTIVE' && m.t0 > 0 && m.t1 / m.t0 < BATAS_TURUN ? 'Aktif, turun' : 'Aktif';
    if (m.s0 === 'ACTIVE') return 'Baru berhenti';
    if (m.s0 === 'NEW MERCHANT') return 'Baru, belum transaksi';
    return 'Usak';
  };
  const tahun = (v) => {
    if (v instanceof Date) return String(v.getFullYear());
    if (typeof v === 'number') return String(new Date(Math.round((v - 25569) * 864e5)).getUTCFullYear()); // serial Excel
    const m = String(v ?? '').match(/(19|20)\d\d/);
    return m ? m[0] : '-';
  };
  // "21 September 26" -> {tgl: "21 September 2026", bulan: "September", pendek: "Sep"}
  const bacaTanggal = (s) => {
    const m = low(s).match(/(\d{1,2})\s+([a-z]+)\s+(\d{2,4})/);
    if (!m) return { tgl: norm(s), bulan: norm(s), pendek: norm(s) };
    const b = BULAN.findIndex((x) => x.startsWith(m[2].slice(0, 3)));
    const th = m[3].length === 2 ? '20' + m[3] : m[3];
    const nb = b >= 0 ? judul(BULAN[b]) : judul(m[2]);
    return { tgl: `${+m[1]} ${nb} ${th}`, bulan: nb, pendek: b >= 0 ? BULAN_PENDEK[b] : nb.slice(0, 3) };
  };

  // ---------- 3. data BPS opsional (format peta_peluang_*.xlsx) ----------
  // Satu sheet per kab/kota (nama sheet = nama kab/kota, mis. "Kab Bogor"), kolom
  // "Kecamatan", "Penduduk ..." dan opsional "Minimarket ...".
  function bacaBPS(XLSX, wb, petaLama) {
    const kotaList = petaLama.kota.map((k) => k.kota);
    const key = (s) => low(s).replace(/^kabupaten\b/, 'kab').replace(/[^a-z]/g, '');
    const hasil = {}, catatan = [];
    for (const n of wb.SheetNames) {
      const kota = kotaList.find((k) => key(k) === key(n));
      if (!kota) continue;
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true });
      const h = (aoa[0] || []).map(low);
      const iK = h.indexOf('kecamatan'), iP = h.findIndex((x) => x.startsWith('penduduk')), iM = h.findIndex((x) => x.startsWith('minimarket'));
      if (iK < 0 || iP < 0) { catatan.push(`Sheet "${n}" dilewati: tidak ada kolom Kecamatan / Penduduk.`); continue; }
      const kecPeta = petaLama.kec.filter((k) => k.kota === kota);
      for (const r of aoa.slice(1)) {
        if (!r || kosong(r[iK]) || low(r[iK]) === 'total') continue;
        const kk = kecPeta.find((k) => key(k.kec) === key(r[iK]));
        if (!kk) { catatan.push(`${kota}: kecamatan "${norm(r[iK])}" tidak ada di peta, dilewati.`); continue; }
        const pend = num(r[iP]);
        hasil[kk.id] = { pend: pend || null, mini: iM >= 0 && !kosong(r[iM]) ? num(r[iM]) : null };
      }
    }
    if (!Object.keys(hasil).length) throw new Error('File BPS tidak berisi sheet yang namanya sama dengan kab/kota di peta (contoh: "Kab Bogor", "Kota Depok").');
    return { hasil, catatan };
  }

  // ---------- 4. bangun data ----------
  // opts: { XLSX, wbPipe, wbMer, wbBps?, petaLama (MAPDATA sekarang), unitmap (tambahan dari pengguna) }
  function olah(opts) {
    const { XLSX, petaLama } = opts;
    const pipe = bacaPipeline(XLSX, opts.wbPipe);
    const mer = bacaMerchant(XLSX, opts.wbMer);
    const P = pipe.rows, laporan = { peringatan: [], info: [] };

    // --- pemetaan unit -> kab/kota|kecamatan ---
    const unitmap = { ...(petaLama.unitmap || {}), ...(opts.unitmap || {}) };
    const unitBaru = [...new Set(P.map((r) => r.unit))].filter((u) => !(u in unitmap));
    const unitTanpaPeta = unitBaru.map((u) => ({ unit: u, cluster: P.find((r) => r.unit === u).cluster, deb: P.filter((r) => r.unit === u).length }));

    // --- data BPS ---
    let bps = null;
    if (opts.wbBps) { bps = bacaBPS(XLSX, opts.wbBps, petaLama); laporan.info.push(...bps.catatan); }

    // ===== DASHDATA =====
    const agg = (rs) => ({ deb: rs.length, kur: rs.filter((r) => r.produk === 'KUR').length, kum: rs.filter((r) => r.produk !== 'KUR').length, bakiJt: rs.reduce((a, r) => a + r.baki, 0), baru: rs.filter(isBaru).length, agen: rs.filter(isAgen).length });
    const grupBy = (rs, f) => { const m = new Map(); rs.forEach((r) => { const k = f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };

    const total = agg(P);
    const area = [...grupBy(P, (r) => areaCluster(r.cluster))].map(([a, rs]) => { const g = agg(rs); return { area: a, kota: kotaUnit(rs[0].cluster), deb: g.deb, kur: g.kur, kum: g.kum, baki: bulat(g.bakiJt / 1000, 1), baru: g.baru }; })
      .sort((a, b) => b.deb - a.deb);
    const unit = [...grupBy(P, (r) => r.unit)].map(([u, rs]) => { const g = agg(rs); return { unit: u, area: areaCluster(rs[0].cluster), kota: kotaUnit(rs[0].cluster), deb: g.deb, kur: g.kur, kum: g.kum, baki: bulat(g.bakiJt / 1000, 2), baru: g.baru, agen: g.agen }; })
      .sort((a, b) => b.deb - a.deb); // seri: urutan kemunculan di file

    const sumber = hitung(P, (r) => r.sumber);
    Object.keys(sumber).forEach((s) => { if (!(s in POIN_SUMBER)) laporan.peringatan.push(`Sumber debitur "${s}" belum dikenal, diberi 0 poin di skor kunjungan.`); });

    const kandidat = P.map((r) => {
      const bk = bulat(r.baki, 2);
      return {
        id: 'P' + String(r.no).padStart(5, '0'),
        skor: bulat((POIN_SUMBER[r.sumber] || 0) + (isAgen(r) ? POIN_AGEN : 0) + Math.min(bk, BAKI_PENUH) / 5),
        deb: singkatNama(r.nama), unit: r.unit, kota: kotaUnit(r.cluster), produk: r.produk,
        baki: bulat(bk, 1), sumber: r.sumber, agen: r.agen, petugas: r.sgp ? judul(r.sgp) : '-',
      };
    });
    const urut = (a, b) => b.skor - a.skor || b.baki - a.baki; // sort stabil: seri tetap urut baris
    const targets = ['Jakarta', 'Depok', 'Bogor'].flatMap((k) => kandidat.filter((t) => t.kota === k).sort(urut).slice(0, TARGET_PER_KOTA)).sort(urut);

    const MERR = mer.rows.map((m) => ({ ...m, wil: wilayah(m.alamat), seg: segmen(m), th: tahun(m.buat) }));
    const aktif = (m) => m.seg === 'Aktif' || m.seg === 'Aktif, turun';
    const merOut = MERR.map((m) => [judul(m.nama), m.jenis, m.wil, m.seg, m.t0, m.t1, m.sv1, m.rek, m.th]);
    const tLalu = bacaTanggal(mer.tglLalu), tIni = bacaTanggal(mer.tglIni);

    const DASHDATA = {
      meta: { tgl: tIni.tgl, bulan_ini: tIni.bulan, bulan_lalu: tLalu.bulan, pendek_ini: tIni.pendek, pendek_lalu: tLalu.pendek, dibuat: new Date().toISOString().slice(0, 10) },
      kpi: { debitur: total.deb, tebet: (area.find((a) => a.area === AREA_TEBET) || { deb: 0 }).deb, kur: total.kur, baki_m: bulat(total.bakiJt / 1000, 1), baru: total.baru, agen: total.agen },
      area, unit, sumber, targets, mer: merOut,
      mer_year: hitung(MERR, (m) => m.th),
    };

    // ===== MAPDATA =====
    const kec = petaLama.kec.map((k) => ({ ...k }));
    const byId = Object.fromEntries(kec.map((k) => [k.id, k]));
    if (bps) for (const [id, v] of Object.entries(bps.hasil)) Object.assign(byId[id], v);

    // debitur per kecamatan & kab/kota
    const debKec = {}, baruKec = {}, debKota = {};
    for (const r of P) {
      const tujuan = unitmap[r.unit];
      if (!tujuan) continue;
      const [kota, kc] = tujuan.split('|');
      debKota[kota] = (debKota[kota] || 0) + 1;
      if (kc) { const id = kota + '|' + kc; debKec[id] = (debKec[id] || 0) + 1; if (isBaru(r)) baruKec[id] = (baruKec[id] || 0) + 1; }
    }
    for (const id of Object.keys(debKec)) if (!byId[id]) laporan.peringatan.push(`Pemetaan unit menunjuk kecamatan "${id}" yang tidak ada di peta.`);

    // merchant per kecamatan & kelompok kab/kota
    const merKec = {}, merKecA = {}, merGrp = {}, merGrpA = {};
    for (const m of MERR) {
      const id = WIL_KEC[m.wil], g = WIL_GRP[m.wil];
      if (id) { merKec[id] = (merKec[id] || 0) + 1; if (aktif(m)) merKecA[id] = (merKecA[id] || 0) + 1; }
      if (g) { merGrp[g] = (merGrp[g] || 0) + 1; if (aktif(m)) merGrpA[g] = (merGrpA[g] || 0) + 1; }
    }

    for (const k of kec) {
      const tercakup = k.kota in debKota;
      k.deb = tercakup ? debKec[k.id] || 0 : null;
      k.baru = baruKec[k.id] || 0;
      k.mer = merKec[k.id] || 0;
      k.mer_a = merKecA[k.id] || 0;
      k.pen = k.pend && k.deb != null ? bulat(k.deb / k.pend * 1e4, 1) : null;
      k.kat = null; k.skor = null;
    }

    // kategori & skor peluang, relatif di dalam tiap kab/kota yang punya data penduduk
    for (const kota of new Set(kec.map((k) => k.kota))) {
      const K = kec.filter((k) => k.kota === kota && k.pend && k.deb != null);
      if (!K.length) continue;
      const T = K.filter((k) => k.deb > 0);
      const mP = median(K.map((k) => k.pend)), mN = median(T.map((k) => k.pen));
      const pakaiMini = K.some((k) => k.mini != null);
      const xP = Math.max(...K.map((k) => k.pend)), xM = Math.max(1, ...K.map((k) => k.mini || 0)), xN = Math.max(...K.map((k) => k.pen)) || 1;
      for (const k of K) {
        k.kat = !k.deb ? 'Belum tersentuh'
          : k.pend >= mP ? (k.pen < mN ? 'Prioritas garap' : 'Pertahankan & cross-sell')
          : (k.pen >= mN ? 'Sudah tergarap' : 'Pantau');
        const s = pakaiMini ? 0.4 * k.pend / xP + 0.3 * (k.mini || 0) / xM + 0.3 * (1 - k.pen / xN)
          : 0.6 * k.pend / xP + 0.4 * (1 - k.pen / xN);
        k.skor = bulat(s * 100);
      }
    }

    const kota = petaLama.kota.map((k) => ({ ...k, deb: k.kota in debKota ? debKota[k.kota] : null, mer: merGrp[k.grp] || 0, mer_a: merGrpA[k.grp] || 0 }));
    const unmapped = MERR.filter((m) => m.wil === WIL_LAIN);
    // unitmap disimpan utuh (termasuk unit yang bulan ini kosong) supaya tidak perlu dipetakan ulang.
    const MAPDATA = {
      kec, kota,
      mer_unmapped: unmapped.length, mer_unmapped_aktif: unmapped.filter(aktif).length,
      mer_total: MERR.length, mer_aktif: MERR.filter(aktif).length,
      unitmap,
    };

    const tanpaKota = P.filter((r) => !unitmap[r.unit]).length;
    if (tanpaKota) laporan.peringatan.push(`${tanpaKota} debitur dari ${unitTanpaPeta.length} unit baru belum masuk peta karena unitnya belum dipetakan ke kecamatan.`);
    laporan.info.unshift(`Pipeline: ${P.length} debitur dari sheet "${pipe.sheet}". Merchant: ${MERR.length} baris, data ${tLalu.tgl} dan ${tIni.tgl}.`);

    return { MAPDATA, DASHDATA, unitTanpaPeta, laporan };
  }

  // Tulis jadi isi file .js yang dibaca dashboard.
  const keFile = (nama, data) => `window.${nama} = ${JSON.stringify(data)}\n;\n`;

  const OLAH = { olah, keFile, wilayah, segmen, kotaUnit, areaCluster, bacaTanggal };
  if (typeof module !== 'undefined' && module.exports) module.exports = OLAH; else root.OLAH = OLAH;
})(typeof window !== 'undefined' ? window : globalThis);
