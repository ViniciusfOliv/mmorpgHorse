# Plano proposto da Fase 1 — consolidar o núcleo

> **Status: proposta, aguardando aprovação do Vinicius.** Nada daqui começa sem um "sim" para o ticket.

## Princípios

- **Não mexer em regra nem em balanceamento** sem decisão registrada em `docs/memoria/decisoes.md`. Tickets que mudam
  número de regra ficam marcados e pedem também o `balance.js` completo.
- **Um ticket por ramo** (`fix/...`, `feat/...`, `docs/...`), poucos arquivos, `check.sh` antes de terminar, memória
  atualizada no fim (`CLAUDE.md` §3 e §6).
- **Primeiro a verificação, depois o resto:** sem o `check.sh` rodando inteiro, nenhum ticket tem como provar que não
  quebrou nada.

## Ordem e dependências

```text
Decisões D1–D8 (conversa, sem código) ──────────────┐
                                                     │
A. Verificação confiável  T1 → T2 → T3 → (T4)        │
          │                                          │
          ├── B. Save seguro      T5, T6, T7         │
          ├── C. Documentação     T8, T9  ◄──────────┤ (D1, D3, D6)
          ├── D. Corrida          T10, T11, T12 ◄────┤ (D2)
          ├── E. Cavalos          T13                │
          └── F. Domínio p/ servidor  T14 → T15 → T16│
G. Medição no aparelho  T17 (pode correr junto)      │
Volta de trabalho perdido  T18 ◄─────────────────────┘ (D4)
```

## Decisões que precisam do Vinicius (sem código)

| Id | Pergunta | Por quê | Base |
|---|---|---|---|
| D1 | Para que servem as Gemas: só cosméticos e passe, ou também os itens do GDD §8.2? | Vários desses itens mudam o cavalo do PVP de aposta | ECO-1 |
| D2 | Como o jogador escolhe a estratégia antes da corrida: a Preparação do §8.1, trocar a ativa antes de abrir a sala, ou outra forma? | Sem isso, a hipótese do protótipo não é testável | COR-1 |
| D3 | Clima: vale "+3% do status" (multiplicativo) ou "+1,5 ponto fixo" (o código)? | Uma das duas descrições está errada | COR-2 |
| D4 | Ginásios em sequência ("vença o anterior") e a regra "cavalo superior vence": voltam? | Pedidos que ficaram no ramo `nifty-newton` | ECO-4 |
| D5 | Regra das insígnias: "não entra no `simulate`" ou "não dá vantagem no PVP"? | A da Capoeira afeta skills | ECO-2 |
| D6 | Levar à `main` as 4 entradas de `decisoes.md` do ramo `youthful-maxwell`? E apagar os 21 ramos integrados? | Aprovações suas que só existem num ramo | DOC-3 |
| D7 | Como instalar o Playwright aqui: `package.json` só de desenvolvimento, instalação global documentada, ou só no CI? | Dependência nova pede aprovação (`CLAUDE.md` §9) | INF-3 |
| D8 | Papel da Sorte e do Dado Viciado | Quase sem efeito, mas soma Poder | COR-3 |

## Tickets

Cada ticket: objetivo · arquivos prováveis · critério de aceite · risco.

### A. Verificação confiável (crítica)

- **T1 — Build reprodutível no Windows.** Fazer o `build.mjs` gerar os mesmos bytes no Windows e no Linux (normalizar
  `\r\n` ao ler texto, ou `.gitattributes` com `eol=lf`). Arquivos: `.gitattributes` e/ou `prototype/build.mjs`.
  Aceite: build no Windows deixa `git status` limpo. Risco: um `.gitattributes` renormaliza o repositório inteiro num
  commit grande — **mostrar o diff antes**.
- **T2 — `moldes-test` passa no Windows.** Diagnosticar a 2ª falha antes de mexer; tornar as mensagens e comparações
  independentes do separador. Arquivos: `prototype/tools/moldes-test.mjs` e talvez `pixellab-moldes.mjs` (só caminho).
  Aceite: 237/237 aqui e no contêiner. Risco: baixo; nenhuma chamada paga (os testes já bloqueiam a rede).
- **T3 — Playwright local** (depende de D7). Aceite: `check.sh` completo passa nesta máquina, com as 8 etapas.
- **T4 — CI** (opcional, depois de T1–T3). GitHub Actions em Linux rodando `check.sh` e, num job à parte, o
  `balance.js` completo. Aceite: execução verde num PR. **Feito em 2026-11-26** (`.github/workflows/check.yml`, push na main e PR; o verde só se confirma no GitHub).

### B. Save seguro

- **T5 — Cópia antes de migrar e aviso de descarte** (PER-1). Guardar o save original em `galope-elemental:pre-v<N>`
  antes da migração e avisar quando o `sanitize` descartar cavalo ou peça. Arquivos: `game.js`, `ui-test.mjs`.
  Aceite: teste com save v9 e um item inválido mostra o aviso e guarda a cópia. Não muda o formato do save atual.
  **Feito em 2026-11-27** (`docs/superpowers/specs/2026-11-27-t5-copia-save.md`, bloco `copia-save`).
- **T6 — Aviso sem armazenamento** (PER-2). Faixa quando `STORAGE_OK` é falso. Arquivos: `game.js`, `game.css`, teste.
  **Feito em 2026-11-27** (`docs/superpowers/specs/2026-11-27-t6-aviso-armazenamento.md`, bloco `sem-armazenamento`).
- **T7 — Exportar/importar save** (PER-3). Texto no Perfil, passando pelo mesmo `sanitize` e pela checagem de versão.
  Útil para o teste fechado. Risco: importar é uma porta de edição do save; aceitável offline.

### C. Documentação

- **T8 — Alinhar o GDD ao código** (G3, G5–G8 e, depois das decisões, G1/G2). Só texto. Arquivos: `docs/GDD.md`,
  `tools/wiki.mjs` (texto da vitrine).
- **T9 — Memória em dia** (DOC-2; DOC-3 se D6 = sim). Arquivos: `docs/memoria/*`, `docs/exemplos.md`, comentários
  citados.

### D. Corrida (sem mudar resultado)

- **T10 — `skillId` no evento de skill** (COR-5). `sim.js` passa a mandar o id; `fx.js` usa o id em vez do texto.
  Aceite: mesmos `finishOrder`/`finishTimes` nas 25 configurações do §9 do `balance.js`; fx-test verde. Conferir se
  o `tuningHash` muda.
- **T11 — Dicas e HUD coerentes com o que o jogador pode fazer** (COR-1 texto, COR-6; depende de D2).
- **T12 — Hashes de referência do determinismo** (INF-6). Arquivo de resultados esperados conferido em Node e no
  navegador (ui-test). Sem mudança no motor.

### E. Cavalos

- **T13 — Linhagem legível** (CAV-1). Ficha mostra o nome atual e o `#n` do pai/mãe que ainda está no estábulo.
  Arquivos: `game.js`, `ui-test.mjs`. Sem mudança no save.

### F. Domínio pronto para o servidor (depois de A)

Extrair da interface, **sem mudar comportamento**, para um módulo puro (ex.: `prototype/src/conta.js`), um sistema por
ticket, cada um com teste de equivalência (o mesmo save e a mesma ação dão o mesmo save resultante, antes e depois):

- **T14 — Liquidação do PVP e do treino** (`settle`, `applyXp`, `TRAINING_GOLD` → `data.js`).
- **T15 — Abertura da sala e pareamento** (`openLobby`, `buildLobby`, `poderBot`).
- **T16 — Saneamento e migração do save** (`sanitize`).

Risco: médio (mexe no coração do `game.js`); por isso vem depois de A e com o ui-test completo verde.

### G. Medição

- **T17 — Linha de base de desempenho no aparelho** (DES-1): tempo até a primeira tela e FPS da corrida com 8
  corredores, no `jogo.html` publicado, num aparelho médio que você tenha. Sem mudança de código. Só depois disso
  decidir sobre o tamanho do HTML e o `dist/` no git.

### Volta de trabalho perdido

- **T18 — Ginásios em sequência** (depende de D4). Refazer sobre a `main` e o mapa-múndi atual, usando o
  `nifty-newton` como referência, não como merge. **Muda regra e progressão:** spec curta, aprovação e o `balance.js`
  completo.

## Fora da Fase 1 (de propósito)

Captura, expedições, profissões, mercado, servidor, contas e loja de Gemas. Segundo o próprio roadmap (Observação 3),
entram depois que cavalos, corridas e progressão estiverem sólidos, e as decisões D1, D2 e D5 mudam o desenho deles.

## Primeiros passos sugeridos

1. Conversar sobre **D1, D2, D6 e D7** (desbloqueiam mais coisa).
2. **T1 e T2** (verificação confiável), cada um no seu ramo.
3. **T3**, conforme a resposta da D7.
4. Depois disso, **T5** e **T8**.
