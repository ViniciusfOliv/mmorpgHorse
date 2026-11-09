#!/usr/bin/env bash
# Verificação completa do protótipo: build + testes unitários (simulação e efeitos) + moldes +
# balanceamento rápido + teste de interface.
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

step "1/5 Build (prototype/dist)"
node prototype/build.mjs

step "2/5 Testes unitários"
node prototype/tools/sim-test.js > "$SHOTS_DIR/unit.txt" || { cat "$SHOTS_DIR/unit.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/unit.txt"

step "2b/5 Efeitos"
node prototype/tools/fx-test.js > "$SHOTS_DIR/fx.txt" || { cat "$SHOTS_DIR/fx.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/fx.txt"

step "3/5 dist atualizado em relação ao src"
if ! git diff --quiet -- prototype/dist; then
  echo "AVISO: o build mudou prototype/dist/ — lembre de commitar junto com o src."
else
  echo "ok"
fi

step "3b/5 Moldes"
if compgen -G "prototype/assets/pixellab/molde-*.json" > /dev/null; then
  node prototype/tools/moldes-test.mjs > "$SHOTS_DIR/moldes.txt" || { cat "$SHOTS_DIR/moldes.txt"; exit 1; }
  tail -n 1 "$SHOTS_DIR/moldes.txt"
else
  echo "sem moldes — pulado"
fi

step "4/5 Balanceamento rápido"
node prototype/tools/balance.js --quick > "$SHOTS_DIR/balance.txt" || { cat "$SHOTS_DIR/balance.txt"; exit 1; }
grep -E 'metas passaram|❌' "$SHOTS_DIR/balance.txt" || true

step "5/5 Teste de interface (Playwright)"
node prototype/tools/ui-test.mjs > "$SHOTS_DIR/ui.txt" 2>&1 || { cat "$SHOTS_DIR/ui.txt"; exit 1; }
tail -n 1 "$SHOTS_DIR/ui.txt"

printf '\nVERIFICAÇÃO COMPLETA: OK\n'
