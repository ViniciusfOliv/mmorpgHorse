#!/usr/bin/env bash
# Verificação completa do protótipo, em 8 etapas: build (jogo e wiki), simulação, efeitos, dist em dia,
# moldes e arte (docs/arte/guia.md), wiki, balanceamento rápido e interface.
#   ./scripts/check.sh
# Não altera as capturas oficiais (prototype/screens/): o teste de UI grava numa pasta temporária.
# A interface roda em paralelo (prototype/tools/ui-test-paralelo.mjs: um processo por bloco, UI_JOBS=4, e os blocos
# sensíveis a tempo depois, um por vez). Para regravar as capturas oficiais: node prototype/tools/ui-test.mjs (sem UI_SO).
# Sai com código diferente de zero se qualquer etapa falhar.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHOTS_DIR="$(mktemp -d)"
export SHOTS_DIR
trap 'rm -rf "$SHOTS_DIR"' EXIT

step() { printf '\n== %s ==\n' "$1"; }

step "1/8 Build (prototype/dist e docs/wiki.md)"
node prototype/build.mjs

step "2/8 Simulação, AFK e sala"
node prototype/tools/sim-test.js > "$SHOTS_DIR/unit.txt" || { cat "$SHOTS_DIR/unit.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/unit.txt"
node prototype/tools/afk-test.js > "$SHOTS_DIR/afk.txt" || { cat "$SHOTS_DIR/afk.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/afk.txt"
node prototype/tools/sala-test.mjs > "$SHOTS_DIR/sala.txt" || { cat "$SHOTS_DIR/sala.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/sala.txt"

step "3/8 Efeitos da corrida e desenho do mapa"
node prototype/tools/fx-test.js > "$SHOTS_DIR/fx.txt" || { cat "$SHOTS_DIR/fx.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/fx.txt"
node prototype/tools/mapa-test.js > "$SHOTS_DIR/mapa.txt" || { cat "$SHOTS_DIR/mapa.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/mapa.txt"

step "4/8 dist e wiki em dia com o src"
if ! git diff --quiet -- prototype/dist docs/wiki.md || [ -n "$(git ls-files --others --exclude-standard -- prototype/dist docs/wiki.md)" ]; then
  echo "AVISO: o build mudou prototype/dist/ ou docs/wiki.md — lembre de commitar junto com o src."
else
  echo "ok"
fi

step "5/8 Moldes e arte"
node prototype/tools/moldes-test.mjs > "$SHOTS_DIR/moldes.txt" || { cat "$SHOTS_DIR/moldes.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/moldes.txt"
node prototype/tools/arte-check.mjs > "$SHOTS_DIR/arte.txt" || { cat "$SHOTS_DIR/arte.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/arte.txt"

step "6/8 Wiki"
# wiki-test e ui-test usam o Playwright das ferramentas (prototype/tools/package.json) ou o do ambiente (nuvem).
node -e "require('module').createRequire(process.cwd() + '/prototype/tools/ui-test.mjs').resolve('playwright')" 2>/dev/null || {
  echo "Falta o Playwright dos testes: rode  npm ci --prefix prototype/tools  (o Chromium: npx --prefix prototype/tools playwright install chromium)"; exit 1; }
node prototype/tools/wiki-test.mjs > "$SHOTS_DIR/wiki.txt" 2>&1 || { cat "$SHOTS_DIR/wiki.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/wiki.txt"
# a sala montada pelo jogo no navegador igual à referência (sala-referencia.json; regravar só de propósito)
node prototype/tools/sala-referencia.mjs --check
# as corridas e os desafios de ginásio iguais no Node, no navegador e à referência (corrida-referencia.json, T12;
# regravar só de propósito, quando o motor ou um número de regra muda)
node prototype/tools/corrida-referencia.mjs --check
# a liquidação do fim da corrida (conta.js, T14) igual à referência gravada antes, no jogo e no Node (conta-referencia.json)
node prototype/tools/conta-referencia.mjs --check
# o saneamento e a migração do save (save.js, T16) iguais à referência gravada antes, no jogo e no Node (save-referencia.json)
node prototype/tools/save-referencia.mjs --check

step "7/8 Balanceamento rápido"
node prototype/tools/balance.js --quick > "$SHOTS_DIR/balance.txt" || { cat "$SHOTS_DIR/balance.txt"; exit 1; }
grep -E 'metas passaram|❌' "$SHOTS_DIR/balance.txt" || true

step "8/8 Interface (Playwright, em paralelo)"
node prototype/tools/ui-test-paralelo.mjs > "$SHOTS_DIR/ui.txt" 2>&1 || { cat "$SHOTS_DIR/ui.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/ui.txt"

printf '\nVERIFICAÇÃO COMPLETA: OK\n'
