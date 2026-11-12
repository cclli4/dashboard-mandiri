// Tab "Daftar kunjungan": tabel target petugas dan ringkasan sumber debitur.
// Butuh: data/dashdata.js, js/common.js.
(() => {
  const D = DASHDATA;

  // ---------- tabel target ----------
  let tK = 'Semua', tQ = '';
  const drawTargets = () => {
    const rows = D.targets.filter((t) => (tK === 'Semua' || t.kota === tK) && (!tQ || `${t.unit} ${t.petugas}`.toLowerCase().includes(tQ))).slice(0, 100);
    $('t-n').textContent = fI.format(rows.length);
    fill($('t-rows'), rows, (t) => {
      const s = el('span', 'score'); const i = el('i'); i.style.setProperty('--w', t.skor + '%');
      s.append(el('span', null, fI.format(t.skor)), i);
      return [[s], [t.deb], [t.unit], [t.produk], [f1.format(t.baki), 'n'], [t.sumber], [t.agen], [t.petugas]];
    }, 8);
  };
  segBtns($('target-card'), (k) => { tK = k; drawTargets(); });
  $('t-q').addEventListener('input', (e) => { tQ = e.target.value.trim().toLowerCase(); drawTargets(); });

  // ---------- sumber debitur ----------
  const src = Object.entries(D.sumber).sort((a, b) => b[1] - a[1]);
  rankList($('t-src'), [
    ...src.map(([n, v]) => ({ n, v, t: fI.format(v), sw: n === 'Existing' ? 'var(--k-pantau)' : 'var(--ok)' })),
    { n: 'Berstatus agen', v: D.kpi.agen, t: fI.format(D.kpi.agen), sw: 'var(--gold)' },
  ]);

  drawTargets();
})();
