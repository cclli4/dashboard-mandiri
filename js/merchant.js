// Tab "Kesehatan merchant": status merchant, aktif per jenis usaha, per tahun daftar, tracker.
// Butuh: data/dashdata.js, js/common.js, d3.
// SEG, SEGC, MER, dan isAktif didefinisikan di js/common.js.
(() => {
  let mS = 'Semua status', mQ = '';
  const segCount = SEG.map((n) => ({ n, v: MER.filter((r) => r.seg === n).length, c: SEGC[n] }));

  // ---------- tiga kartu grafik ----------
  const drawMerchantCharts = () => {
    const ak = MER.filter(isAktif).length;
    donut($('c-seg'), segCount, fP.format(ak / MER.length), 'masih aktif');
    legendList($('c-seg-lg'), segCount, MER.length, (n) => {
      mS = mS === n ? 'Semua status' : n;
      $('m-seg').value = mS;
      drawTracker(); drawMerchantCharts();
    }, mS);

    const lob = Array.from(d3.group(MER, (r) => r.jenis), ([n, rs]) => ({ n, tot: rs.length, ak: rs.filter(isAktif).length })).sort((a, b) => b.tot - a.tot).slice(0, 8);
    rankList($('c-lob'), lob.map((l) => ({ n: l.n, v: l.ak, back: l.tot, max: lob[0].tot, t: `${fI.format(l.ak)} / ${fI.format(l.tot)}`, sw: 'var(--ok)' })));

    const yr = Array.from(d3.group(MER, (r) => r.th), ([n, rs]) => ({ n, tot: rs.length, ak: rs.filter(isAktif).length })).sort((a, b) => a.n.localeCompare(b.n));
    const mxY = Math.max(...yr.map((y) => y.tot));
    rankList($('c-year'), yr.map((y) => ({ n: y.n, v: y.ak, back: y.tot, max: mxY, t: `${fI.format(y.ak)} / ${fI.format(y.tot)}`, sw: 'var(--ok)' })));
    const big = yr.reduce((a, b) => (b.tot > a.tot ? b : a));
    $('c-year-note').textContent = `${fI.format(big.tot)} merchant didaftarkan tahun ${big.n}, tetapi hanya ${fI.format(big.ak)} yang masih aktif (${fP.format(big.ak / big.tot)}). Akuisisi massal tanpa pendampingan cepat berhenti.`;
  };

  // ---------- tabel tracker ----------
  const rank = Object.fromEntries(SEG.map((s, i) => [s, i]));
  const drawTracker = () => {
    const rows = MER.filter((r) => (mS === 'Semua status' || r.seg === mS) && (!mQ || `${r.nama} ${r.jenis} ${r.wil}`.toLowerCase().includes(mQ)))
      .sort((a, b) => rank[a.seg] - rank[b.seg] || b.agu - a.agu);
    $('m-n').textContent = fI.format(rows.length);
    fill($('m-rows'), rows, (r) => {
      const p = el('span', 'spill', r.seg); p.style.setProperty('--sw', SEGC[r.seg]);
      return [[r.nama], [r.jenis], [r.wil], [p], [fI.format(r.agu), 'n'], [fI.format(r.sep), 'n'], [fI.format(r.sv), 'n'], [r.rek]];
    }, 8);
  };
  $('m-seg').addEventListener('change', (e) => { mS = e.target.value; drawTracker(); drawMerchantCharts(); });
  $('m-q').addEventListener('input', (e) => { mQ = e.target.value.trim().toLowerCase(); drawTracker(); });

  drawMerchantCharts();
  drawTracker();
})();
