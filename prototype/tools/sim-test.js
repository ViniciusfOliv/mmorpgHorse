// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var fails = 0, count = 0, cur = '';
function section(t) { cur = t; console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}
section('pagamentos');
test('soma(prêmios)+taxa == pote', function () {
  var p = S.payouts(100, 8, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(p.prizes.reduce(function (a, x) { return a + x.amount; }, 0) + p.fee, p.pot);
});
console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
