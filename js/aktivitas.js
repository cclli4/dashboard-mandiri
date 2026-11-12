// Aktivitas lapangan: kunjungan & akuisisi yang ditandai petugas per kecamatan.
// Disimpan di data/aktivitas.js (folder bersama) supaya semua orang melihat hal yang sama.
// Dipakai index.html (peta) dan aktivitas.html (progress). Butuh: data/mapdata.js, js/common.js.
//
// Cara sinkron: browser Chrome/Edge diberi izin ke folder "data" sekali (tombol Hubungkan folder).
// Setiap simpan -> baca file terbaru, gabungkan per id (versi yang paling baru diubah menang), tulis.
// Tiap 15 detik file dicek; kalau ada perubahan dari orang lain, peta ikut berganti.
// Tanpa izin folder, tanda tetap tersimpan di browser ini dan dikirim saat folder dihubungkan.
window.AKT = (() => {
  const STATUS = ['Dikunjungi', 'Dalam proses', 'Berhasil akuisisi', 'Tidak berminat'];
  const STC = { 'Dikunjungi': 'var(--a-kunjung)', 'Dalam proses': 'var(--a-proses)', 'Berhasil akuisisi': 'var(--a-berhasil)', 'Tidak berminat': 'var(--a-tolak)' };
  const PUNCAK = ['Berhasil akuisisi', 'Dalam proses', 'Dikunjungi', 'Tidak berminat']; // urutan warna peta
  // Tujuan kunjungan: akuisisi nasabah baru, atau mendatangi merchant yang sudah ada (reaktivasi merchant usak / pemeliharaan).
  const TUJUAN = ['Akuisisi baru', 'Merchant existing'];
  const TUJUAN_KET = { 'Akuisisi baru': 'Akuisisi baru', 'Merchant existing': 'Merchant existing (reaktivasi / pemeliharaan)' };
  const tujuan = (r) => (r.tujuan === 'Merchant existing' ? 'Merchant existing' : 'Akuisisi baru'); // data lama = akuisisi baru
  // Target tercapai: akuisisi baru -> berhasil akuisisi; merchant existing -> sudah didatangi (kecuali tidak berminat)
  const tercapai = (r) => (tujuan(r) === 'Merchant existing' ? r.status !== 'Tidak berminat' : r.status === 'Berhasil akuisisi');
  const PRODUK = ["Livin' Merchant", 'KUR', 'KUM', 'Tabungan / Giro', 'Lainnya'];
  const PERIODE = { bulan: 'Bulan ini', '3bulan': '3 bulan terakhir', semua: 'Semua' };
  const LS = 'peta-aktivitas-v1', LS_PET = 'peta-aktivitas-petugas';
  const FILE = 'aktivitas.js';

  const kecBy = new Map(MAPDATA.kec.map((k) => [k.id, k]));
  const recs = new Map();
  let pending = new Set(), dir = null, sync = { st: 'lokal', t: null, msg: '' }, lastMod = 0, busy = false;
  const subs = [];
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

  // ---------- util ----------
  const hariIni = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const gabung = (list) => { let n = 0; for (const r of list || []) { if (!r || !r.id) continue; const o = recs.get(r.id); if (!o || (r.u || '') > (o.u || '')) { recs.set(r.id, r); n++; } } return n; };
  const simpanLokal = () => lsSet(LS, { recs: [...recs.values()], pending: [...pending] });
  const isiFile = () => `window.AKTIVITAS = ${JSON.stringify({ records: [...recs.values()].sort((a, b) => (a.dibuat || '').localeCompare(b.dibuat || '')) })}\n;\n`;
  const bacaIsi = (t) => { const i = t.indexOf('='); const j = t.lastIndexOf('}'); return JSON.parse(t.slice(i + 1, j + 1)).records || []; };
  const fmtTgl = (s) => { if (!s) return '–'; const [y, m, d] = s.split('-'); return `${+d} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1]} ${y}`; };
  const jam = (d) => d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  // ---------- IndexedDB: simpan izin folder supaya tidak perlu pilih ulang ----------
  const idb = (mode, fn) => new Promise((res, rej) => {
    const o = indexedDB.open('peta-potensi', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onerror = () => rej(o.error);
    o.onsuccess = () => { const tx = o.result.transaction('kv', mode); const q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); };
  });
  const idbGet = (k) => idb('readonly', (s) => s.get(k)).catch(() => null);
  const idbSet = (k, v) => idb('readwrite', (s) => s.put(v, k)).catch(() => null);

  // ---------- sinkron ke folder ----------
  const setSync = (st, msg = '') => { sync = { st, t: st === 'ok' ? new Date() : sync.t, msg }; emit(); };
  const ambilFile = async () => { try { return await (await dir.getFileHandle(FILE)).getFile(); } catch { return null; } };

  const sinkron = async () => {
    if (!dir || busy) return;
    busy = true;
    try {
      const f = await ambilFile();
      if (f) { gabung(bacaIsi(await f.text())); lastMod = f.lastModified; }
      if (pending.size || !f) {
        const w = await (await dir.getFileHandle(FILE, { create: true })).createWritable();
        await w.write(isiFile()); await w.close();
        lastMod = (await ambilFile()).lastModified;
        pending = new Set();
      }
      simpanLokal(); setSync('ok');
    } catch (e) { console.error(e); setSync('gagal', e.message); }
    finally { busy = false; }
  };
  const cekPerubahan = async () => {
    if (!dir || busy || sync.st !== 'ok') return;
    const f = await ambilFile();
    if (f && f.lastModified !== lastMod) { lastMod = f.lastModified; if (gabung(bacaIsi(await f.text()))) { simpanLokal(); emit(); } }
  };

  const hubungkan = async () => {
    let h;
    try { h = await window.showDirectoryPicker({ id: 'peta-data', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') setSync('gagal', 'Browser tidak mengizinkan akses folder.'); return; }
    try { await h.getFileHandle('mapdata.js'); }
    catch { setSync('gagal', `Folder "${h.name}" bukan folder data dashboard (tidak ada mapdata.js). Pilih folder "data".`); return; }
    dir = h; await idbSet('dir', h); await sinkron();
  };
  const izinkan = async () => {
    if (!dir) return hubungkan();
    try { if (await dir.requestPermission({ mode: 'readwrite' }) === 'granted') await sinkron(); else setSync('izin'); }
    catch { dir = null; hubungkan(); }
  };

  // ---------- muat awal ----------
  gabung((window.AKTIVITAS && window.AKTIVITAS.records) || []);
  const lok = lsGet(LS, null);
  if (lok) { gabung(lok.recs); pending = new Set((lok.pending || []).filter((id) => recs.has(id))); }
  const bisaFolder = 'showDirectoryPicker' in window;
  (async () => {
    if (!bisaFolder) { setSync('lokal'); return; }
    const h = await idbGet('dir');
    if (!h) { setSync('lokal'); return; }
    dir = h;
    try { (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? await sinkron() : setSync('izin'); }
    catch { setSync('izin'); }
  })();
  setInterval(cekPerubahan, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cekPerubahan(); });
  window.addEventListener('focus', cekPerubahan);

  // ---------- data ----------
  const simpan = async (r) => {
    r.u = new Date().toISOString();
    recs.set(r.id, r); pending.add(r.id); simpanLokal(); emit();
    if (dir && sync.st === 'ok') await sinkron();
  };
  const dalam = (r, per) => {
    if (per === 'semua') return true;
    const t = hariIni();
    if (per === 'bulan') return r.tgl.slice(0, 7) === t.slice(0, 7);
    const d = new Date(); d.setDate(d.getDate() - 90); return r.tgl >= d.toISOString().slice(0, 10);
  };
  const daftar = (per = 'semua') => [...recs.values()].filter((r) => !r.hapus && dalam(r, per)).sort((a, b) => b.tgl.localeCompare(a.tgl) || (b.u || '').localeCompare(a.u || ''));
  const hitung = (rs) => { const o = { total: rs.length }; STATUS.forEach((s) => { o[s] = rs.filter((r) => r.status === s).length; }); return o; };
  const perKec = (per) => {
    const m = new Map();
    for (const r of daftar(per)) { if (!m.has(r.kec)) m.set(r.kec, []); m.get(r.kec).push(r); }
    return new Map([...m].map(([id, rs]) => [id, { ...hitung(rs), rs, puncak: PUNCAK.find((s) => rs.some((r) => r.status === s)) }]));
  };

  // ---------- nomor kontak: cek format & samarkan ----------
  const ADA_NOMOR = /\d[\d\s.-]{7,}\d/; // nomor panjang yang nyasar ke kolom nama / catatan
  const bersih = (s) => String(s || '').replace(/[\s.-]/g, '');
  const cekNik = (s) => /^\d{16}$/.test(s);
  const cekHp = (s) => /^(08|\+628)\d{7,11}$/.test(s);
  const cekRek = (s) => /^\d{6,20}$/.test(s);
  const titik = (n) => '•'.repeat(Math.max(2, n));
  // NIK 3174••••••••1234 · HP 0812••••5678 / +62812••••5678 · Rek ••••••1234
  const samar = {
    nik: (s) => (s ? s.slice(0, 4) + titik(s.length - 8) + s.slice(-4) : ''),
    hp: (s) => { if (!s) return ''; const p = s.startsWith('+') ? 6 : 4; return s.slice(0, p) + titik(s.length - p - 4) + s.slice(-4); },
    rek: (s) => (s ? titik(6) + s.slice(-4) : ''),
  };
  const kontak = (r) => [r.nik && 'NIK ' + samar.nik(r.nik), r.hp && 'HP ' + samar.hp(r.hp)].filter(Boolean).join(' · ');
  // kunjungan sebelumnya untuk nasabah yang sama: NIK sama, atau nama sama di kecamatan yang sama
  const normNama = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cariKontak = ({ nik, nama, kec, kecuali }) => [...recs.values()]
    .filter((r) => !r.hapus && r.id !== kecuali && (r.nik || r.hp || r.rek) && (nik ? r.nik === nik : normNama(r.nama) === normNama(nama) && r.kec === kec))
    .sort((a, b) => (b.u || '').localeCompare(a.u || ''))[0];

  // ---------- formulir ----------
  let dlg;
  const buatForm = () => {
    dlg = document.createElement('dialog'); dlg.className = 'akt-dlg';
    const kotaList = [...new Set(MAPDATA.kec.map((k) => k.kota))].sort();
    const opsKec = kotaList.map((kt) => `<optgroup label="${kt}">${MAPDATA.kec.filter((k) => k.kota === kt).map((k) => k.kec).sort().map((kc) => `<option value="${kt}|${kc}">${kc}</option>`).join('')}</optgroup>`).join('');
    dlg.innerHTML = `
      <form method="dialog" class="akt-form" novalidate>
        <div class="akt-h"><h2 id="akt-judul">Tandai aktivitas</h2><button type="button" class="akt-x" value="batal" aria-label="Tutup">×</button></div>
        <label class="fld"><span>Kecamatan</span><select name="kec" required>${opsKec}</select></label>
        <label class="fld"><span>Nama usaha / nasabah</span><input name="nama" required maxlength="80" placeholder="mis. Warung Bu Sari, Toko Maju"></label>
        <label class="fld"><span>NIK</span><input name="nik" required inputmode="numeric" autocomplete="off" maxlength="20" placeholder="16 angka sesuai KTP"></label>
        <div class="fld2">
          <label class="fld"><span>No. HP</span><input name="hp" required type="tel" inputmode="tel" autocomplete="off" maxlength="18" placeholder="08xx atau +62"></label>
          <label class="fld"><span>No. rekening <small>(opsional)</small></span><input name="rek" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="Hanya angka"></label>
        </div>
        <p class="akt-ok" hidden></p>
        <fieldset class="fld"><legend>Tujuan kunjungan</legend><div class="akt-st">${TUJUAN.map((t) => `<label><input type="radio" name="tujuan" value="${t}"><span style="--sw:var(--blue)">${TUJUAN_KET[t]}</span></label>`).join('')}</div></fieldset>
        <fieldset class="fld"><legend>Status</legend><div class="akt-st">${STATUS.map((s) => `<label><input type="radio" name="status" value="${s}"><span style="--sw:${STC[s]}">${s}</span></label>`).join('')}</div></fieldset>
        <div class="fld2">
          <label class="fld"><span>Produk</span><select name="produk">${PRODUK.map((p) => `<option>${p}</option>`).join('')}</select></label>
          <label class="fld"><span>Tanggal</span><input type="date" name="tgl" required></label>
        </div>
        <label class="fld"><span>Petugas</span><select name="petugas_pil"></select></label>
        <label class="fld" data-pet-lain hidden><span>Nama petugas lain</span><input name="petugas" maxlength="60" placeholder="Ketik nama petugas"></label>
        <label class="fld"><span>Catatan <small>(opsional)</small></span><textarea name="catatan" rows="2" maxlength="300" placeholder="mis. minta dihubungi minggu depan, butuh EDC"></textarea></label>
        <p class="akt-err" hidden></p>
        <p class="akt-note">Data hanya untuk internal cabang.</p>
        <div class="akt-riw" hidden><b>Riwayat</b><ol></ol></div>
        <div class="akt-act"><button type="button" class="btn-t danger" data-a="hapus" hidden>Hapus</button><span></span><button type="button" class="btn-t" value="batal">Batal</button><button type="submit" class="btn-t pri">Simpan</button></div>
      </form>`;
    document.body.append(dlg);
    dlg.querySelectorAll('[value="batal"]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    // kontak otomatis terisi ulang dari kunjungan sebelumnya (hanya mengisi kolom yang masih kosong)
    const f = dlg.querySelector('form'), ok = dlg.querySelector('.akt-ok');
    const lengkapi = (q) => {
      const r = cariKontak({ ...q, kecuali: f.dataset.id });
      if (!r) return;
      const isi = [];
      if (!f.nama.value.trim() && r.nama) { f.nama.value = r.nama; isi.push('nama'); }
      if (!bersih(f.nik.value) && r.nik) { f.nik.value = r.nik; isi.push('NIK'); }
      if (!bersih(f.hp.value) && r.hp) { f.hp.value = r.hp; isi.push('no. HP'); }
      if (!bersih(f.rek.value) && r.rek) { f.rek.value = r.rek; isi.push('no. rekening'); }
      if (!isi.length) return;
      ok.textContent = `${isi.join(', ').replace(/^./, (c) => c.toUpperCase())} diisi dari kunjungan sebelumnya (${fmtTgl(r.tgl)}, ${r.petugas}). Periksa kalau ada yang berubah.`;
      ok.hidden = false;
    };
    f.nik.addEventListener('input', () => { const n = bersih(f.nik.value); if (cekNik(n)) lengkapi({ nik: n }); });
    f.nama.addEventListener('change', () => { if (f.nama.value.trim()) lengkapi({ nama: f.nama.value, kec: f.kec.value }); });
    f.addEventListener('input', (e) => { if (e.target.name) e.target.removeAttribute('aria-invalid'); });
    f.petugas_pil.addEventListener('change', () => {
      const lain = f.petugas_pil.value === PET_LAIN;
      dlg.querySelector('[data-pet-lain]').hidden = !lain;
      f.petugas.value = lain ? '' : f.petugas_pil.value;
      if (lain) f.petugas.focus();
    });
  };

  // dropdown petugas: nama dari data target + nama yang pernah dipakai di aktivitas
  const PET_LAIN = '__lain__';
  const isiPetugas = (f, pilih) => {
    const ps = new Set([...(DASHDATA.targets || []).map((t) => t.petugas), ...[...recs.values()].map((r) => r.petugas)]
      .map((p) => (p || '').trim()).filter((p) => p && p !== '-'));
    if (pilih) ps.add(pilih);
    const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
    f.petugas_pil.replaceChildren(opt('', 'Pilih petugas…'), ...[...ps].sort((a, b) => a.localeCompare(b, 'id')).map((p) => opt(p, p)), opt(PET_LAIN, '+ Nama lain (ketik sendiri)'));
    f.petugas_pil.value = pilih || '';
    f.petugas.value = pilih || '';
    dlg.querySelector('[data-pet-lain]').hidden = true;
  };

  const form = (opsi = {}) => {
    if (!dlg) buatForm();
    const f = dlg.querySelector('form'), err = dlg.querySelector('.akt-err');
    const lama = opsi.id ? recs.get(opsi.id) : null;
    err.hidden = true;
    dlg.querySelector('.akt-ok').hidden = true;
    f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    f.dataset.id = lama ? lama.id : '';
    dlg.querySelector('#akt-judul').textContent = lama ? 'Perbarui progres' : 'Tandai kunjungan / akuisisi';
    f.kec.value = lama ? lama.kec : (opsi.kec || f.kec.value);
    f.nama.value = lama ? lama.nama : '';
    // nomor lengkap hanya tampil di sini, saat kartunya dibuka
    f.nik.value = lama ? lama.nik || '' : '';
    f.hp.value = lama ? lama.hp || '' : '';
    f.rek.value = lama ? lama.rek || '' : '';
    f.produk.value = lama ? lama.produk : PRODUK[0];
    f.tgl.value = hariIni();
    isiPetugas(f, lsGet(LS_PET, '') || (lama ? lama.petugas : ''));
    f.catatan.value = '';
    f.querySelectorAll('[name=tujuan]').forEach((x) => { x.checked = x.value === (lama ? tujuan(lama) : opsi.tujuan || 'Akuisisi baru'); });
    f.querySelectorAll('[name=status]').forEach((x) => { x.checked = x.value === (lama ? lama.status : 'Dikunjungi'); });
    const riw = dlg.querySelector('.akt-riw');
    riw.hidden = !lama;
    if (lama) riw.querySelector('ol').innerHTML = [...(lama.riwayat || [])].reverse().map((h) => `<li><i style="--sw:${STC[h.status]}"></i><span><b>${h.status}</b> · ${fmtTgl(h.tgl)} · ${esc(h.petugas)}${h.catatan ? `<br><small>${esc(h.catatan)}</small>` : ''}</span></li>`).join('');
    const hb = dlg.querySelector('[data-a=hapus]'); hb.hidden = !lama;
    hb.onclick = async () => { if (confirm(`Hapus "${lama.nama}"? Riwayatnya ikut terhapus.`)) { await simpan({ ...lama, hapus: true }); dlg.close(); } };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const nik = bersih(v.nik), hp = bersih(v.hp), rek = bersih(v.rek);
      const cek = [
        [!v.nama.trim(), 'nama', 'Isi nama usaha / nasabah.'],
        [!cekNik(nik), 'nik', nik ? `NIK harus 16 angka tanpa huruf (sekarang ${nik.length} karakter).` : 'Isi NIK (16 angka).'],
        [!cekHp(hp), 'hp', hp ? 'No. HP harus diawali 08 atau +62, lalu angka saja (mis. 081234567890).' : 'Isi no. HP.'],
        [rek && !cekRek(rek), 'rek', 'No. rekening hanya boleh angka (6–20 digit), atau kosongkan.'],
        [!v.petugas.trim(), v.petugas_pil === PET_LAIN ? 'petugas' : 'petugas_pil', v.petugas_pil === PET_LAIN ? 'Ketik nama petugas.' : 'Pilih nama petugas.'],
        [!v.tgl, 'tgl', 'Isi tanggal.'],
        [!v.status, null, 'Pilih status.'],
        [ADA_NOMOR.test(v.nama) || ADA_NOMOR.test(v.catatan), ADA_NOMOR.test(v.nama) ? 'nama' : 'catatan', 'Nomor NIK / HP / rekening ditulis di kolomnya sendiri, bukan di nama atau catatan.'],
      ].find((c) => c[0]);
      if (cek) {
        err.textContent = cek[2]; err.hidden = false;
        if (cek[1]) { f[cek[1]].setAttribute('aria-invalid', 'true'); f[cek[1]].focus(); }
        return;
      }
      lsSet(LS_PET, v.petugas.trim());
      const ent = { tgl: v.tgl, status: v.status, petugas: v.petugas.trim(), catatan: v.catatan.trim() };
      const no = { nik, hp, rek, tujuan: v.tujuan || 'Akuisisi baru' };
      const r = lama
        ? { ...lama, ...no, kec: v.kec, nama: v.nama.trim(), produk: v.produk, status: v.status, tgl: v.tgl > lama.tgl ? v.tgl : lama.tgl, petugas: ent.petugas, riwayat: [...(lama.riwayat || []), ent] }
        : { id: uid(), ...no, kec: v.kec, nama: v.nama.trim(), produk: v.produk, status: v.status, tgl: v.tgl, petugas: ent.petugas, dibuat: new Date().toISOString(), riwayat: [ent] };
      dlg.close();
      await simpan(r);
      if (opsi.onSaved) opsi.onSaved(r);
    };
    dlg.showModal();
    (lama ? f.querySelector('[name=status]:checked') : f.nama).focus();
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- bilah status sinkron ----------
  const bilah = (box) => {
    const render = () => {
      const n = pending.size;
      const teks = {
        ok: `<i class="dot ok"></i><span><b>Tersinkron</b> dengan folder bersama${sync.t ? ' · ' + jam(sync.t) : ''}. Perubahan dari rekan otomatis muncul.</span>`,
        izin: `<i class="dot warn"></i><span><b>Sinkron dijeda.</b> Browser perlu izin ulang ke folder data.${n ? ` ${n} perubahan menunggu.` : ''}</span><button type="button" class="btn-t pri" data-a="izin">Aktifkan sinkron</button>`,
        gagal: `<i class="dot bad"></i><span><b>Gagal sinkron.</b> ${esc(sync.msg)}</span><button type="button" class="btn-t pri" data-a="hub">Hubungkan folder</button>`,
        lokal: bisaFolder
          ? `<i class="dot warn"></i><span><b>Belum terhubung ke folder bersama.</b> Tanda hanya tersimpan di browser ini${n ? ` (${n} perubahan)` : ''}. Hubungkan sekali supaya tim melihatnya.</span><button type="button" class="btn-t pri" data-a="hub">Hubungkan folder data</button>`
          : `<i class="dot warn"></i><span><b>Browser ini tidak bisa menulis ke folder.</b> Buka dashboard di Chrome atau Edge supaya tanda tersimpan bersama.</span>`,
      }[sync.st];
      box.innerHTML = teks;
      const b = box.querySelector('button'); if (b) b.onclick = b.dataset.a === 'izin' ? izinkan : hubungkan;
    };
    subs.push(render); render();
  };

  return {
    STATUS, STC, PRODUK, PERIODE, kecBy, daftar, hitung, perKec, form, bilah, fmtTgl, hariIni, esc, samar, kontak, TUJUAN, tujuan, tercapai,
    on: (f) => subs.push(f),
  };
})();
