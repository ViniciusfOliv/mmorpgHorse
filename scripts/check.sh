#!/usr/bin/env bash
# Verificação completa do protótipo, em 8 etapas: build (jogo e wiki), simulação, efeitos, dist em dia,
# moldes, wiki, balanceamento rápido e interface.
#   ./scripts/check.sh
# Não altera as capturas oficiais (prototype/screens/): o teste de UI grava numa pasta temporária.
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

step "2/8 Simulação"
node prototype/tools/sim-test.js > "$SHOTS_DIR/unit.txt" || { cat "$SHOTS_DIR/unit.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/unit.txt"

step "3/8 Efeitos da corrida"
node prototype/tools/fx-test.js > "$SHOTS_DIR/fx.txt" || { cat "$SHOTS_DIR/fx.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/fx.txt"

step "4/8 dist e wiki em dia com o src"
if ! git diff --quiet -- prototype/dist docs/wiki.md || [ -n "$(git ls-files --others --exclude-standard -- prototype/dist docs/wiki.md)" ]; then
  echo "AVISO: o build mudou prototype/dist/ ou docs/wiki.md — lembre de commitar junto com o src."
else
  echo "ok"
fi

step "5/8 Moldes"
node prototype/tools/moldes-test.mjs > "$SHOTS_DIR/moldes.txt" || { cat "$SHOTS_DIR/moldes.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/moldes.txt"

step "6/8 Wiki"
node prototype/tools/wiki-test.mjs > "$SHOTS_DIR/wiki.txt" 2>&1 || { cat "$SHOTS_DIR/wiki.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/wiki.txt"

step "7/8 Balanceamento rápido"
node prototype/tools/balance.js --quick > "$SHOTS_DIR/balance.txt" || { cat "$SHOTS_DIR/balance.txt"; exit 1; }
grep -E 'metas passaram|❌' "$SHOTS_DIR/balance.txt" || true

step "8/8 Interface (Playwright)"
node prototype/tools/ui-test.mjs > "$SHOTS_DIR/ui.txt" 2>&1 || { cat "$SHOTS_DIR/ui.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/ui.txt"

printf '\nVERIFICAÇÃO COMPLETA: OK\n'
