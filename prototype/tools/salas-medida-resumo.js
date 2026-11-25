var fs = require('fs');
var files = process.argv.slice(2);
var acc = {};
files.forEach(function (f) { var o = JSON.parse(fs.readFileSync(f)); if (!acc[o.esq]) acc[o.esq] = o.salas.map(function () { return {}; });
  o.salas.forEach(function (s, i) { for (var k in s) acc[o.esq][i][k] = (acc[o.esq][i][k] || 0) + (s[k] || 0); }); });
var faixas = [[1, 10], [11, 20], [21, 40], [41, 60], [61, 90], [91, 120]];
Object.keys(acc).forEach(function (e) {
  var S = acc[e]; console.log('== ' + e);
  faixas.forEach(function (f) {
    var t = { n: 0, win: 0, pod: 0, net: 0, lv: 0, field: 0, paid: 0, perg: 0, treino: 0, gold: 0 };
    for (var i = f[0] - 1; i < Math.min(f[1], S.length); i++) for (var k in t) t[k] += S[i][k] || 0;
    if (!t.n) return;
    console.log(('salas ' + f[0] + '-' + f[1]).padEnd(13), 'vence', (100 * t.win / t.n).toFixed(1).padStart(5) + '%', ' pódio', (100 * t.pod / t.n).toFixed(1).padStart(5) + '%',
      ' premiado', (100 * t.paid / t.n).toFixed(1).padStart(5) + '%', ' campo', (t.field / t.n).toFixed(2), ' justo', (100 * t.n / t.field).toFixed(1) + '%', ' Ouro/sala', (t.net / t.n).toFixed(1).padStart(6), ' nível', (t.lv / t.n).toFixed(1), ' perg/sala', (t.perg / t.n).toFixed(2), ' treino', (100 * t.treino / t.n).toFixed(0) + '%', ' Ouro médio', (t.gold / t.n).toFixed(0));
  });
});
