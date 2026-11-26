# Mapa de sistemas

Legenda em `README.md`. "Funcional" quer dizer implementado e em uso no jogo; "validado" indica que há teste
automatizado ou meta de balanceamento cobrindo. **Ninguém além do Vinicius jogou ainda** (GDD §8.6: "os números saíram
de simulação"), então nenhum sistema está validado por jogadores.

## Visão geral

| Sistema | Estado | Validado por teste | Onde |
|---|---|---|---|
| Estábulo (lista, ficha, vagas 3→8) | Funcional | ui-test | `game.js:2876–2973` |
| Cavalos (modelo, raridade, estrelas, sexo, porte, marcas) | Funcional | sim-test, moldes-test | `data.js:44–50,301–315`, `game.js:679–704` |
| Atributos (7 status, base + pontos) | Funcional | sim-test, metas A1/M6/M7 | `sim.js:199–410` |
| Progressão (XP, nível 50, pontos, Torrão, Rédea) | Funcional | sim-test, ui-test | `data.js:485–489`, `game.js:1198` |
| Skills de vaga (15) e de tipo, ranks I–V | Funcional | metas S1/S5/S6 | `data.js:165–260`, `sim.js:541` |
| Elementos e triângulo | Funcional (só via clima no PVP; vantagem direta nos ginásios) | M9, G3 | `sim.js:877–884` |
| Corrida PVP (simulação) | Funcional, **contra bots locais** | sim-test, balance, ui-test | `sim.js`, `game.js:6001–6331` |
| Clima e Dado da Sorte | Funcional | sim-test, fx-test | `sim.js:1022,1286–1345` |
| Vento | Funcional **só visual** | fx-test | `fx.js:109` |
| Terreno (piso) | Funcional | sim-test | `data.js:91` |
| Pistas | PVP: procedurais pela seed, só o **nome** é fixo; ginásios: 3 pistas fixas | sim-test, G* | `sim.js:709`, `game.js:88–91`, `data.js:648–668` |
| Preparação com relógio (GDD §8.1) | **Documentado, não implementado** | — | GDD §8.1 |
| Ligas e MMR | Parcial: ligas só como rótulo por Poder; sem MMR | — | `data.js:423` |
| Cruzamento (haras, aluguel, troca) | Funcional | sim-test, exemplos §4 | `breed.js`, `game.js:4782–4830` |
| Genética (potencial 0–31, herança) | Funcional | sim-test | `breed.js` |
| Genealogia | Parcial: só pais (um nível), sem geração nem árvore | — | `breed.js:407–408` |
| Gestação com timer, cruza 12–24 h | Documentado, não implementado | — | GDD §6, §8.3 |
| Despertar (Lendário → Mítico) | Documentado, não implementado | — | GDD §6 |
| Equipamento (5 peças, +0 a +10) | Funcional **só no AFK** | sim-test 1391/1406, ui-test 738 | `gear.js`, `game.js:82` |
| Forja e reforja | Funcional | afk-test | `forja.js` |
| Itens de treino e mochila | Funcional | sim-test, ui-test | `itens.js`, `data.js:541–575` |
| Loja por Ouro (itens, peças, Pedras) | Funcional | ui-test | `game.js:7775–7954` |
| Loja de Gemas, passe | **Documentado, não implementado** (Gema não existe no código) | — | GDD §8.2, §8.7 bloco 6 |
| Recompensa diária | Funcional | ui-test | `game.js:7786`, `data.js` DAILY |
| Ginásios (3 × 5 etapas, revanche, insígnias) | Funcional | metas G1–G9, sim-test | `ginasio.js`, `data.js:627–670` |
| Sequência dos ginásios ("vença o anterior") | **Implementado só no ramo `claude/nifty-newton-e8u133`**, fora da `main` | — | `divergencias.md` §4 |
| Mapa-múndi, trilha, cena de desafio | Funcional | mapa-test, ui-test | `mapa.js`, `ambiente.js` |
| Treino AFK (vagas, offline, baú, drops) | Funcional | afk-test, metas E1–E6 | `afk.js`, `game.js:4037–4272` |
| Bestiário | Funcional — **dos oponentes de ginásio e drops do AFK**, não dos selvagens | afk-test | `afk.js:48–51` |
| Cavalos selvagens (dados) | Funcional como bots do PVP e reprodutores de aluguel | — | `data.js:345` |
| Vitrine de selvagens | Parcial: só um bloco desativado "em breve" | — | `game.js:87,3096–3102` |
| Captura / doma de selvagens | **Documentado, não implementado** (o wiki diz "ainda não existe") | — | `tools/wiki.mjs:587` |
| Manual de doma | Funcional — **ensina skill (35%), não é captura** | sim-test | `itens.js` `tentarDoma` |
| Expedições além dos ginásios | Apenas planejado | — | GDD §9+, `cronograma.md:110` |
| Aluguel do haras, circuito, missões | Documentado, não implementado | — | GDD §8.3 |
| Economia de Ouro | Funcional (fontes e gastos abaixo) | metas E1, checagem 6 | — |
| Mercado entre jogadores | Apenas planejado (bloco 7, com servidor) | — | GDD §8.4 |
| Multiplayer, contas, servidor | Apenas planejado | — | `cronograma.md:31–32` |
| Interface (5 abas, celular e desktop) | Funcional | ui-test (83 blocos) | `game.js`, `game.css` |
| Tutorial | **Não encontrado** (planejado para o MVP) | — | `cronograma.md:28` |
| Áudio | **Não encontrado** (planejado para o MVP) | — | `cronograma.md:28` |
| Configurações | Parcial: só "movimento" | — | `game.js:112–130` |
| Salvamento | Funcional | ui-test | `arquitetura.md` §5 |
| Modo DEV | Funcional, só nos builds de teste | build falha se vazar | `dev.js`, `build.mjs:125–133` |

## 1. Corrida e simulação (`sim.js`, versão 4.1.0)

- `simulate({seed, conditions?, racers, recordFrames?})` (l.1036) → `{simVersion, tuningHash, conditions, frames,
  events, finishOrder, finishTimes…}`. Passo fixo de 0,1 s, teto de 900 s [C].
- **Status reais** (`STAT_KEYS`): `vel, acel, man, forca, est, garra, sorte`, de 1 a 150, com n = status/100 [C].
  As siglas VEL/ACE/MAN/FOR/EST/GAR/SOR do roadmap coincidem; MAN é **Manobra**.

| Status | Efeito real (`derive` l.907–919 e laço l.1200–1270) [C] |
|---|---|
| Velocidade | `vMax = (19 + 1,13·n)`, ajustado pelo clima |
| Aceleração | `accel = 1/max(0,044; 1,158 − 0,66·n)` e menos atraso de largada |
| Manobra | fator na curva `min(1; 0,704 + 0,185·n + bônus)` |
| Força | subida `min(1; 0,824 + 0,11·n)`, menos gasto na subida, menos perda no piso e no pelotão |
| Estamina | tanque `66 + 20n`; teto do ritmo `0,97 + 0,035(n−0,5)` e no sprint (≥ 72%) `1,03 + 0,065(n−0,5)` |
| Garra | arrancada sempre; começa em `0,80 − 0,14(n−0,5)`, força `0,19·n` × fator de 0 a 2 pela seed |
| Sorte | só a chance do 2º dado, `(Sorte − 40)/40`; peso 0 no Poder |

- **Poder** = `2,5V + 2,0A + 2,2M + 2,4F + 2,4E + 1,5G + 14·peso do gatilho·rank + 20(L−1)/49 + 28·raridade/4`
  (l.681–690); confere com o GDD §8.5 [C][G]. Equipamento fora.
- **Determinismo** [C]: um fluxo `mulberry32` por corredor, outros para mapa (`0xC0FFEE`), Dado (`0xD1CE`) e
  pareamento (`0xA11CE`); nenhum `Math.random`, `Date` ou `performance` em `sim.js`; sem `pow`/`exp`/`sqrt`
  (raízes por Newton, l.300). O `balance.js` §9 reexecuta 25 configurações — **no mesmo motor JS** [NV entre motores].
- **Apresentação só anima** [C]: `settle()` simula depois de "Largar!", grava tudo e só então `go('corrida')`; a duração
  na tela e as câmeras lentas mudam só a reprodução; o feed, os balões, a faixa do Dado e os "Momentos" vêm de
  `sim.events`; o clima do HUD só muda quando o Dado é revelado. Ponto frágil: o balão descobre a skill **lendo o texto**
  do evento (`fx.js:430–436`) → COR-5.
- **Pistas** [C]: no PVP não há pista com dados próprios. `TRACK_NAMES` (`game.js:88–91`) tem 8 nomes, entre eles
  **"Prado das Palmeiras"**, sorteados só como rótulo e região do cenário; traçado (1.400–2.000 m, 5–9 blocos), piso e
  clima saem da seed. Pistas fixas só nos ginásios.
- **HUD** (`drawHud`, `game.js:6864+`): posição, barra de Estamina, VENTO e CLIMA, relógio e km/h, selo do bloco e
  minimapa; faixa de ordem e feed em HTML. Modos compacto (`artH < 190`) e tela baixa (< 700 px) [C].
- **Sala do PVP** [C]: `openLobby` (l.6001) sorteia uma vez e grava `state.pending` antes de mostrar; sem Ouro para a
  entrada, a mesma sala vira treino. Entradas 50/100/250, casa 10%, prêmio 70/30, 50/30/20 ou 60/25/15. Rivais com
  Poder de 0,915 a 1,115 do jogador. O limite "Poder não sobe acima do que a sala viu" está coberto em pontos, rédea,
  ativa, Cupom, Manual, rank, ginásio, XP do AFK e `sanitize` (lista em `problemas.md` COR-1).

## 2. Cavalos e progressão

- Campos do cavalo [C]: `uid, templateId, name, especie, element, rarity, grau, sex, level, xp, skills, skillRanks,
  potential{7}, alloc{7}, respecFree, torroes, palette, marcas, porte, breedLeft, parents, born, equip` — tudo num objeto
  plano, sem separar jogo, genética, visual e histórico.
- Raridades Comum/Mágico/Raro/Lendário/Mítico; fator de pontos 1,00–1,20; estrelas ×1/×1,09/×1,22; XP
  `50 + 25·L`, nível máximo 50; pontos `floor(((L−1)·2 + 4(L−1)(L−2)/96)·raridade·estrelas) + torrões`; custo
  `1 + floor(i/10)` por ponto; teto 150 [C] — **tudo bate com o GDD §3** [G].

## 3. Cruzamento e genética (`breed.js`)

- Pais de sexos opostos com cruzas restantes; 50 Ouro entre os seus; aluguel `base × estrelas` (Mítico não se aluga);
  troca 50 Ouro [C].
- Chances pela tabela do GDD §6; teto `maxRarityOrder = 3`: **Mítico nunca nasce** [C][G].
- Herança de estrelas, elemento, sexo, genética (50% de um dos pais), skills (35% + Corcel), marcas e porte (10% de
  mutação, sequências próprias) — tudo pela seed, ordem das chamadas documentada (l.31–53) [C].
- Genealogia: só `parents:{f,m}` com `uid` e **nome gravado no nascimento**; reprodutor alugado com `uid: null` [C] →
  CAV-1, CAV-2.

## 4. Economia (Ouro)

- **Fontes** [C]: prêmio do PVP (pote dos bots, menos 10%, mais insígnia de Fogo) · prêmio do **treino** sem entrada
  (`TRAINING_GOLD` 30→10) · prêmio de ginásio · baú do AFK · diária (60–200) · venda de peça da loja (25%).
- **Gastos** [C]: entrada do PVP e do ginásio · forja · reforja · subir rank · loja (itens, peças, Pedras) · vagas do AFK
  (1.000–20.000) · vagas do estábulo · cruza e troca.
- **Gemas: não existem no código** (só um comentário em `data.js:567`) [C]. A regra "Gemas nunca viram Ouro" hoje é
  cumprida por ausência; o risco está no que o GDD planeja → ECO-1.
- **Equipamento só no PVE** [C]: `settle` passa só `{horse, gear, name, isPlayer}` e `sim.js` não lê `gear`;
  `corredorGear()` devolve null com `GEAR_PVP = false`; bots sem peças; `powerRating` ignora peças; no ginásio só o
  `afk.js:163` passa `pecasMeu`. Testes: `sim-test.js` 445, 1391, 1406, 1630, 2619 e `ui-test.mjs:738–768`.
- **Relógio local** [C]: `hojeDia()` (`game.js:1245`) e `agoraMin()` (l.1256) são os únicos leitores; relógio para trás
  não rende (`afk.js:309`, `afk-test.js:610,712–728`); **adiantado rende** diária, limites da loja, revanche e um período
  offline do AFK por adiantamento — aceito no GDD §8.2a até o online [G] → PER-5.

## 5. Ginásios, AFK e captura

- Ginásios da **Fornalha** (Capitã Labareda), do **Remanso** (Mestre Aguaceiro) e da **Capoeira** (Dona Capineira),
  5 etapas cada; entradas 20–100; sorteio depois de pagar, gravação única; revanche 1/dia; insígnias +3% [C][G].
- AFK: 5 vagas, 45 fases, offline pela chance medida em 2.400 duelos, até 8 h (12 h com Aveia e bestiário) [C].
- **Captura** — classificação pedida:

| Peça | Estado |
|---|---|
| 12 selvagens em `WILD_HORSES` | Funcional (como bots e aluguel) |
| Vitrine na Expedição | Parcial (bloco "em breve"; a lista `WILD_SHOWCASE` só alimenta o wiki) |
| Captura e doma | Documentado, não implementado |
| Expedições como fonte de cavalos | Apenas planejado |
| Manual de doma | Funcional, mas é item de skill |
| Bestiário | Funcional, mas de oponentes e drops |
| Opção DEV de captura | Não encontrado |
| Despertar para Mítico | Documentado, não implementado; hoje só se chega a um Mítico pelo DEV [I] |

## 6. Animação dos cavalos e "Galope Animado"

- **Moldes** [C]: 12 (3 portes × 4 crinas), PNG 64×64 em tons de papel, recoloridos por cavalo; cada um com retrato,
  parado e **9 quadros de galope**. **Não há ciclo de trote**: na trilha, o "trote" é o desenho parado com passo de 1 px
  (`ambiente.js:601`).
- **Cadência** [C]: índice `floor((fase mod 6)·9/6)` (`sprites.js:1387`); a fase anda com a velocidade da simulação,
  o x2 e a câmera lenta, no modo "meio" (média entre o natural e o casco casado com o chão), `GALOPE_QPS = 14`
  (`game.js:102,7428–7437`); `dtReal` limitado a 0,1 s.
- **Jóquei** faz parte do molde (papéis 7–9), não é sprite ancorado; a posição na pista usa referências por estado para
  não tremer (`sprites.js:915–922`) [C].
- **Portes** são moldes distintos numa escala inteira única (`sprites.js:906–912`); carga "tudo ou nada" dos 12 [C].
- **Idle** (`IdleMolde`, `sprites.js:1567–1841`): respiração, gestos de código e gestos do PixelLab, com RNG cosmética
  própria (nunca a seed de regra), cache de 96 quadros [C].
- **Defeitos aceitos e registrados** [C][M]: jóquei sem pele em parte dos montados, pendências da "2a" (cara que pulsa
  até 111% no esguio-folhas, estrela de 1 px, listra curta, meias), laranja fora da paleta em dois moldes
  (`moldes-test.mjs:571–670`). O galope de 9 quadros foi julgado "ganho moderado"; mais intensidade pediria um ciclo novo
  de 10–12 quadros (`docs/memoria/sistemas/galope.md`, que está desatualizado quanto à fórmula) → CAV-5, CAV-6, DOC-2.
- **"Galope Animado"** [C]: é o `<title>` de `prototype/arte/animacao.html` e da página gerada `animacao-amostra.html`
  (607 KB; o `<h1>` diz "animação ambiente"). Mostra Litoral, Planalto, Expedição e Cavalos "hoje × animado", com medidor
  de custo e o piloto de idle; **não tem galope**. É **independente do jogo** (o `build.mjs` não a inclui), mas
  **reaproveita `src/ambiente.js`** embutido por `arte-animacao-build.mjs:52–54`; o HTML commitado é anterior a
  mudanças no `ambiente.js` e deve estar defasado [I]. Artefato publicado registrado em `ESTADO.md:117–121` [M].
  Outros candidatos encontrados: `prototype/arte/corrida-amostra.html` ("Corrida no Cerrado", galope próprio a 21 q/s,
  **lógica duplicada** e já diferente da do jogo) e um teste de intensidade do galope que **não está no repositório**
  (`sistemas/galope.md`). Não foi possível confirmar qual deles o roadmap chama de "Prévia"; o vídeo não foi visto e
  nada aqui se apoia nele.
