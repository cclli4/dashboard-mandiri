// Tab "Potensi debitur": sebaran debitur per area, komposisi produk, peringkat unit mikro.
// Butuh: data/dashdata.js, js/common.js, d3.
(() => {
  const D = DASHDATA;

  // ---------- kartu atas ----------
  const drawPotensi = () => {
    rankList($('c-area'), D.area.map((a) => ({ n: a.area.replace('Jakarta – ', 'Jakarta · '), v: a.deb, t: fI.format(a.deb), sw: a.area.includes('Tebet') ? 'var(--gold)' : 'var(--blue)' })));
    const kur = D.kpi.kur, kum = D.kpi.debitur - kur;
    const parts = [{ n: 'KUR', v: kur, c: 'var(--blue)' }, { n: 'KUM', v: kum, c: 'var(--gold)' }];
    donut($('c-prod'), parts, fP.format(kur / D.kpi.debitur), 'debitur KUR');
    legendList($('c-prod-lg'), parts, D.kpi.debitur);
    // baris tambahan di bawah legenda: total baki debet
    const extra = el('li'); const x = el('div', 'li');
    x.append(el('i'), el('span', null, 'Total baki debet'), el('b', null, 'Rp ' + f1.format(D.kpi.baki_m) + ' M'), el('small', null, ''));
    extra.append(x); $('c-prod-lg').append(extra);
    rankList($('c-prod-area'), D.area.map((a) => ({ n: a.area.replace('Jakarta – ', 'Jakarta · '), v: a.kur, back: a.deb, max: Math.max(...D.area.map((z) => z.deb)), t: fP.format(a.kur / a.deb) + ' KUR' })));
  };

  // ---------- tabel unit mikro ----------
  let uK = 'Semua', uQ = '';
  const drawUnits = () => {
    const rows = D.unit.filter((u) => (uK === 'Semua' || u.kota === uK) && (!uQ || `${u.unit} ${u.area}`.toLowerCase().includes(uQ)));
    $('u-n').textContent = fI.format(rows.length);
    fill($('u-rows'), rows, (u) => [[u.unit], [u.area], [fI.format(u.deb), 'n'], [fI.format(u.kur), 'n'], [fI.format(u.kum), 'n'], [f1.format(u.baki), 'n'], [fI.format(u.baru), 'n'], [fI.format(u.agen), 'n']], 8);
  };
  segBtns($('unit-card'), (k) => { uK = k; drawUnits(); });
  $('u-q').addEventListener('input', (e) => { uQ = e.target.value.trim().toLowerCase(); drawUnits(); });

  drawPotensi();
  drawUnits();
})();
