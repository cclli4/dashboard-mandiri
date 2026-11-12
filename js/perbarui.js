// Halaman "Perbarui data": baca Excel dari pusat -> OLAH.olah() -> simpan mapdata.js & dashdata.js.
// Butuh: js/vendor/xlsx.full.min.js, data/*.js (data sekarang), js/common.js, js/olah.js.
(() => {
  const LAMA = { map: MAPDATA, dash: DASHDATA };
  const wb = { pipe: null, mer: null, bps: null };
  const pilihanUnit = {}; // unit baru -> "Kota|Kecamatan" dari dropdown
  let hasil = null;

  // ---------- pesan ----------
  const pesan = (ul, items) => {
    ul.replaceChildren(...items.map(([cls, html]) => { const li = el('li', cls); li.innerHTML = html; return li; }));
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- pilih file ----------
  const slot = (key, label) => {
    const inp = $('f-' + key), box = $('d-' + key), nm = $('n-' + key);
    const kosong = nm.textContent;
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      wb[key] = null; hasil = null; $('c-hasil').hidden = true; $('c-simpan').hidden = true;
      if (!f) { box.classList.remove('has'); nm.textContent = kosong; cek(); return; }
      nm.textContent = 'Membaca ' + f.name + '…'; $('b-proses').disabled = true;
      try {
        wb[key] = XLSX.read(await f.arrayBuffer(), { cellDates: true });
        box.classList.add('has'); nm.textContent = f.name;
      } catch (e) {
        box.classList.remove('has'); nm.textContent = `Gagal membaca ${f.name}: bukan file Excel yang valid.`;
      }
      cek();
    });
    ['dragenter', 'dragover'].forEach((t) => box.addEventListener(t, () => box.classList.add('over')));
    ['dragleave', 'drop'].forEach((t) => box.addEventListener(t, () => box.classList.remove('over')));
  };
  const cek = () => { $('b-proses').disabled = !(wb.pipe && wb.mer); };
  slot('pipe'); slot('mer'); slot('bps');

  // ---------- proses ----------
  const proses = () => {
    $('busy').hidden = false; $('b-proses').disabled = true;
    // beri kesempatan browser menggambar indikator sebelum hitungan berjalan
    setTimeout(() => {
      try {
        hasil = OLAH.olah({ XLSX, petaLama: LAMA.map, wbPipe: wb.pipe, wbMer: wb.mer, wbBps: wb.bps, unitmap: pilihanUnit });
        tampilkan();
      } catch (e) {
        hasil = null;
        $('c-hasil').hidden = false; $('c-simpan').hidden = true; $('unit-box').hidden = true; $('diff-rows').replaceChildren();
        pesan($('msgs'), [['err', '<b>Tidak bisa diproses.</b> ' + esc(e.message)]]);
        console.error(e);
      } finally { $('busy').hidden = true; cek(); }
    }, 30);
  };
  $('b-proses').addEventListener('click', proses);

  // ---------- tampilkan hasil ----------
  const hitungKat = (m, kat) => m.kec.filter((k) => k.kat === kat).length;
  const merSeg = (d, s) => d.mer.filter((r) => s.includes(r[3])).length;
  const angka = (m, d) => ({
    'Tanggal data': (d.meta && d.meta.tgl) || '–',
    'Debitur pipeline': d.kpi.debitur,
    'Debitur KUR': d.kpi.kur,
    'Baki debet (Rp miliar)': d.kpi.baki_m,
    'Debitur baru cair + booking': d.kpi.baru,
    'Debitur berstatus agen': d.kpi.agen,
    'Unit mikro': d.unit.length,
    'Merchant terdaftar': d.mer.length,
    'Merchant aktif': merSeg(d, ['Aktif', 'Aktif, turun']),
    'Merchant usak (target reaktivasi)': merSeg(d, ['Usak']),
    'Merchant alamat belum terbaca': m.mer_unmapped,
    'Kecamatan prioritas garap': hitungKat(m, 'Prioritas garap'),
    'Kecamatan belum tersentuh': hitungKat(m, 'Belum tersentuh'),
  });
  const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? fI.format(v) : f1.format(v)) : v);

  const tampilkan = () => {
    const { laporan, unitTanpaPeta, MAPDATA: M, DASHDATA: D } = hasil;
    const items = [];
    items.push(laporan.peringatan.length || unitTanpaPeta.length
      ? ['warn', '<b>Data berhasil dibaca, tapi ada yang perlu dicek</b> (lihat di bawah). Data tetap bisa disimpan.']
      : ['ok', '<b>Data berhasil dibaca.</b> Cek tabel angka utama, lalu simpan di langkah 3.']);
    laporan.peringatan.forEach((p) => items.push(['warn', esc(p)]));
    laporan.info.forEach((p) => items.push(['', esc(p)]));
    pesan($('msgs'), items);

    // unit baru
    $('unit-box').hidden = !unitTanpaPeta.length;
    if (unitTanpaPeta.length) {
      const kotaList = [...new Set(LAMA.map.kec.map((k) => k.kota))].sort();
      fill($('unit-rows'), unitTanpaPeta, (u) => {
        const s = el('select', 'map-sel'); s.dataset.unit = u.unit; s.setAttribute('aria-label', 'Lokasi ' + u.unit);
        s.append(new Option('— belum dipilih (tidak tampil di peta) —', ''));
        kotaList.forEach((kota) => {
          const g = document.createElement('optgroup'); g.label = kota;
          g.append(new Option(`${kota} (kecamatan tidak diketahui)`, kota + '|'));
          LAMA.map.kec.filter((k) => k.kota === kota).map((k) => k.kec).sort().forEach((kc) => g.append(new Option(kc, kota + '|' + kc)));
          s.append(g);
        });
        s.value = pilihanUnit[u.unit] || '';
        return [[u.unit], [u.cluster], [fI.format(u.deb), 'n'], [s]];
      }, 4);
    }

    // angka utama
    const a = angka(LAMA.map, LAMA.dash), b = angka(M, D);
    fill($('diff-rows'), Object.keys(a), (k) => {
      const x = a[k], y = b[k];
      let sel = '';
      if (typeof x === 'number' && typeof y === 'number') { const d = Math.round((y - x) * 10) / 10; sel = d === 0 ? '0' : (d > 0 ? '+' : '−') + fmt(Math.abs(d)); }
      else sel = x === y ? 'sama' : 'berubah';
      return [[k], [fmt(x), 'n'], [fmt(y), 'n'], [sel, 'n']];
    }, 4);

    $('c-hasil').hidden = false; $('c-simpan').hidden = false;
    pesan($('msgs-simpan'), []);
    $('c-hasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('b-unit').addEventListener('click', () => {
    document.querySelectorAll('#unit-rows select').forEach((s) => { if (s.value) pilihanUnit[s.dataset.unit] = s.value; else delete pilihanUnit[s.dataset.unit]; });
    proses();
  });

  // ---------- simpan ----------
  const isiFile = () => ({ 'mapdata.js': OLAH.keFile('MAPDATA', hasil.MAPDATA), 'dashdata.js': OLAH.keFile('DASHDATA', hasil.DASHDATA) });
  const cap = () => ((LAMA.dash.meta && LAMA.dash.meta.tgl) || 'sebelumnya').replace(/\s+/g, '-');
  const selesai = (html) => pesan($('msgs-simpan'), [['ok', html + ' Buka <a href="index.html">dashboard</a> lalu tekan F5 (muat ulang) kalau masih terbuka di tab lain.']]);

  $('b-unduh').addEventListener('click', () => {
    Object.entries(isiFile()).forEach(([nama, isi], i) => setTimeout(() => {
      const a = el('a'); a.href = URL.createObjectURL(new Blob([isi], { type: 'text/javascript' })); a.download = nama;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, i * 400));
    pesan($('msgs-simpan'), [['warn', '<b>Dua file sedang diunduh</b> (<code>mapdata.js</code> dan <code>dashdata.js</code>). Kalau browser bertanya "unduh beberapa file?", pilih Izinkan. Lalu pindahkan keduanya ke folder <code>data</code> di folder dashboard dan pilih <b>Ganti</b>. Sebelum menimpa, salin file lama ke tempat lain sebagai cadangan.']]);
  });

  if ('showDirectoryPicker' in window) {
    $('b-folder').hidden = false;
    $('simpan-note').innerHTML = 'Dashboard membaca dua file di folder <code>data</code>: <code>mapdata.js</code> dan <code>dashdata.js</code>. Klik <b>Simpan langsung</b>, lalu pilih folder <code>data</code> di folder dashboard. File lama otomatis dicadangkan ke <code>data/cadangan</code>.';
  }
  $('b-folder').addEventListener('click', async () => {
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'peta-data', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') pesan($('msgs-simpan'), [['err', 'Browser tidak mengizinkan menyimpan ke folder. Pakai tombol <b>Unduh dua file</b>.']]); return; }
    try {
      const ada = async (n) => { try { return await (await dir.getFileHandle(n)).getFile(); } catch { return null; } };
      const lamaMap = await ada('mapdata.js'), lamaDash = await ada('dashdata.js');
      if (!lamaMap || !lamaDash) {
        pesan($('msgs-simpan'), [['err', `Folder "<b>${esc(dir.name)}</b>" tidak berisi <code>mapdata.js</code> dan <code>dashdata.js</code>. Pilih folder <code>data</code> yang ada di dalam folder dashboard.`]]);
        return;
      }
      const cad = await dir.getDirectoryHandle('cadangan', { create: true });
      for (const [f, nama] of [[lamaMap, 'mapdata'], [lamaDash, 'dashdata']]) {
        const w = await (await cad.getFileHandle(`${nama}-${cap()}.js`, { create: true })).createWritable();
        await w.write(await f.text()); await w.close();
      }
      for (const [nama, isi] of Object.entries(isiFile())) {
        const w = await (await dir.getFileHandle(nama, { create: true })).createWritable();
        await w.write(isi); await w.close();
      }
      selesai(`<b>Tersimpan.</b> Data ${esc(hasil.DASHDATA.meta.tgl)} sudah masuk folder <code>${esc(dir.name)}</code>; file lama dicadangkan di <code>${esc(dir.name)}/cadangan</code>.`);
    } catch (e) {
      console.error(e);
      pesan($('msgs-simpan'), [['err', 'Gagal menyimpan: ' + esc(e.message) + '. Pakai tombol <b>Unduh dua file</b>.']]);
    }
  });
})();
