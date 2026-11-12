// Lima kartu KPI yang ditampilkan konsisten di semua halaman.
(() => {
  const D = MAPDATA;
  const kec = D.kec;
  const bps = kec.filter((k) => k.kat);
  const pri = bps.filter((k) => k.kat === 'Prioritas garap');
  const bel = bps.filter((k) => k.kat === 'Belum tersentuh');
  const covered = D.kota.filter((k) => k.deb != null);
  const sum = (arr, f) => arr.reduce((a, b) => a + (f(b) || 0), 0);

  $('k-deb').textContent = fI.format(DASHDATA.kpi.debitur); // termasuk unit yang belum dipetakan ke kecamatan
  $('k-deb-s').textContent = `di ${covered.length} kab/kota · ${fI.format(kec.filter((k) => k.deb > 0).length)} kecamatan`;

  $('k-mer').textContent = fI.format(D.mer_total);
  $('k-mer-s').textContent = `${fI.format(D.mer_aktif)} aktif (${pct(D.mer_aktif, D.mer_total)})`;

  const usak = MER.filter((r) => r.seg === 'Usak').length;
  $('k-usak').textContent = fI.format(usak);
  $('k-usak-s').textContent = `${fP.format(usak / MER.length)} dari total merchant`;

  $('k-pri').textContent = fI.format(pri.length);
  $('k-pri-s').textContent = `${fK.format(sum(pri, (k) => k.pend))} penduduk · ${new Set(pri.map((k) => k.kota)).size} kab/kota`;

  $('k-bel').textContent = fI.format(bel.length);
  $('k-bel-s').textContent = `${fK.format(sum(bel, (k) => k.pend))} penduduk tanpa debitur`;

})();
