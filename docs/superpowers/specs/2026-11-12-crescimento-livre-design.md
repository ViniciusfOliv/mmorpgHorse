# Cavalos v3, bloco 1b: crescimento livre

Especificação do bloco 1b, desenho aprovado em 2026-11-12 (`docs/GDD.md` §8.5). Depois de aprovada pelo
Vinicius vira plano de implementação, executado na branch `claude/cavalos-v3`, em cima do bloco 1 e antes
de integrar na `main`. Os números vêm de uma calibração por simulação numa cópia isolada do jogo (cerca de
20 configurações; dezenas de milhares de corridas por medida). Relatório completo, código de referência e
saída do balanço em `docs/superpowers/specs/anexos/2026-11-12-crescimento-livre-*` (os arquivos de
exploração citados no relatório não foram guardados).

## 1. Objetivo e escopo

**Objetivo.** Dar ao jogador a build inteira: nada cresce sozinho com o nível, cada nível dá pontos e o
jogador decide onde eles vão. O custo crescente num mesmo status impede que "tudo num status só" vença, e
nenhum ponto deixa de render até 150.

**Entra neste bloco:**
- status = base (raridade + genética) + pontos comprados; pontos por nível por raridade e estrelas;
- custo por faixa (+1 a cada 10 pontos no mesmo status), no lugar do limite de 34% e do teto por raridade;
- escala até 150;
- física da corrida linear até 150 (hoje Manobra e Força param de render perto de 110–120);
- força da skill de tipo por tipo;
- build dos bots por pesos, que também é o botão "Distribuir sugerido";
- Poder e ligas sem equipamento;
- equipamento suspenso (sem efeito; telas escondidas; peças guardadas);
- redistribuição (a primeira de cada cavalo é grátis; depois, a Rédea nova);
- botões +1, +5 e +10;
- explicações curtas na tela (mouse no computador, toque no celular);
- save v6 com migração (todos os pontos devolvidos);
- metas novas no `balance.js`, testes, wiki, GDD e capturas.

**Fica de fora:** ginásios (próximo desenho), fonte de Rédea nova jogando (vem com os ginásios),
equipamento como cosmético, loja de Gemas.

## 2. Modelo de status

```text
g ∈ 0..31 por status (genética, como no bloco 1); nada cresce sozinho
base(k)     = baseLo[raridade] + 16·g/31                 baseLo = 40 / 44 / 49 / 54 / 59
pontos(L)   = piso((L − 1) · 4,0 · fatorRaridade · fatorEstrelas)
              fatorRaridade = 1,00 / 1,03 / 1,06 / 1,09 / 1,12     fatorEstrelas = 1 / 1,10 / 1,26
custo       = o i-ésimo ponto num status (i = 0, 1, …) custa 1 + piso(i / 10)
              comprar a = 10q + r pontos custa 5q(q+1) + r(q+1)    (10 → 10, 20 → 30, 30 → 60, 50 → 150)
válida      = soma dos custos ≤ pontos(L) e base + a ≤ 150 em cada status
status(k)   = arredonda(base + a), preso a 1–150
```

- A genética não entra no custo. O Comum mantém a base de hoje, então os iniciais nascem iguais
  (Brasa, Maré e Ipê com 45–52 em cada status).
- Pontos no nível 50 (Comum / Mítico): ★ 196 / 219, ★★ 215 / 241, ★★★ 246 / 276.
- O status cresce mais ou menos com a raiz dos pontos: dez níveis dão +43 de status (1→11), +23 (20→30)
  e +17 (40→50), na build do bot.
- **Ninguém chega a 150:** o pior caso (Mítico ★★★ nível 50, genética 31, tudo num status) dá 144. Uma
  build inclinada típica no nível 50 tem o maior status entre 84 (Comum ★★) e 109 (Mítico ★★★).
- Sem `statCap`, sem `freeCapShare`, sem `gGrowBase/gGrowRange`. O teto único é `statMax` 150.

## 3. A corrida até 150

Princípio: **toda fórmula da corrida é linear até 150**; o único retorno decrescente é o custo por faixa.
Sem isso, o crescimento livre não fecha: com a física de hoje, Manobra e Força acima de ~120 rendem 0,
Estamina rende 2,5 p.p. no topo e +10 de Velocidade decide 53 p.p. a 140. Ganho de +10 num status, em
campos planos de 6 (p.p.):

| Status de todos | Hoje: VEL / ACE / MAN / FOR / EST / GAR | Proposto: VEL / ACE / MAN / FOR / EST / GAR |
|---|---|---|
| 50 | 18,5 / 7,2 / 9,4 / 19,6 / 13,3 / 8,0 | 23,0 / 17,4 / 23,3 / 26,4 / 27,8 / 13,4 |
| 110 | 40,8 / 18,0 / 26,0 / 20,7 / 6,6 / 20,4 | 28,1 / 29,2 / 27,4 / 30,9 / 29,0 / 28,4 |
| 140 | 53,2 / 24,4 / 0,0 / 0,0 / 2,5 / 27,2 | 32,7 / 35,0 / 30,3 / 31,8 / 31,7 / 39,4 |

Mudanças (n = status/100):

| O quê | Hoje | Proposto | Por quê |
|---|---|---|---|
| Faixa da velocidade `vRange` | 1,2 | 1,0 | a Velocidade não decide sozinha no topo |
| Aceleração | 0,6 + 2,4·n | 1 / max(0,05; 1,2 − 0,7·n) | cada ponto encurta a largada igual (hoje rende ∝ 1/a²) |
| Curva | min(1; 0,826 + 0,14·n) | min(1; 0,728 + 0,17·n) | o teto 1 só chega em n = 1,6 |
| Subida | min(1; 0,86 + 0,13·n) | min(1; 0,824 + 0,11·n) | idem |
| Teto de n efetivo de Força e Manobra | 1,2 | 2 | idem |
| Alívio da Força no piso / no pelotão | 0,5 / 0,8 | 0,2 / 0,6, com piso 0 | hoje fica negativo acima de 125 |
| Clima nos status | n·m | n + (m − 1)·0,5 | o clima vale o mesmo em qualquer nível |
| Teto do ritmo (meio / sprint) | 0,97 / 1,03 | + 0,04 / + 0,075 × (n(EST) − 0,5) | a Estamina rende no topo (centrado em 50: o inicial não muda) |
| Erro do jóquei | −2% … +6% | −0,5% … +2,5% | menos ruído; ajuda M3 e M6 |
| Atraso de largada | ×(1 − 0,5·min(n; 1)) | ×(1 − min(n; 1,5)/3) | não trava em 100 |
| Garra: início da arrancada | 80% da pista | 80% − 10%·(n − 0,5) | a Garra rendia metade da Velocidade |
| Garra: chance / força | 0,10 + 0,70·n / 0,02 + 0,16·n | 0,50 + 0,15·n / 0,02 + 0,22·n | menos variância; não trava em 121 |
| Gatilho `final` (Arrancada Final, Chama Final) | fim fixo | o ponto em que a arrancada do cavalo começa | com a Garra adiantada ele chegava depois e rendia 0 |
| Dado: chance do 2º dado | Sorte/100 | Sorte/150 | não trava em 100 |
| Drift (`curveBonus`) | 0,03 | 0,025 | S1 perto do teto com a curva nova |

Sem mudança: `vBase`, `gBand` 16, tanque 66 + 20·n, gasto, piso, chuva, sol, vácuo, pelotão (raio e −3%),
`weatherMult` 1,03 / 1,08, Dado (1/3 e 2/3), as outras skills, chance de skill, vagas e pista. A ordem da
RNG não muda (o sorteio da Garra continua uma vez por corrida). `RaceSim.VERSION` sobe.

**A corrida muda de sensação** (para olhar na animação): largada, curvas e subidas mais lentas; os
iniciais levam cerca de 7% mais tempo (curta 103,5 s, longa 135,8 s; hoje 95,9 / 127,1); o Mítico ★★★
nível 50 é 14% mais rápido que eles; "cansou" quase some (o jóquei erra menos); a Garra dispara em 57%
das corridas (hoje 43%) e mais cedo para quem tem mais Garra.

Resíduo aceito: com a Raízes Firmes e Manobra ou Força acima de ~143, a curva/subida bate o teto 1 no
terço do meio; o ponto continua rendendo nos outros dois terços.

## 4. Skill de tipo

Força P = 1 + nível·(L − 1)/49 + raridade·ordem/4, agora **por tipo**:

| Tipo | por nível | por raridade | efeito |
|---|---|---|---|
| Fogo (Labareda) | 0,70 | 0,55 | +16% de aceleração no 1º terço (era 23%) |
| Água (Maré Alta) | 0,65 | 0,50 | +2,0% de velocidade e 1,2% de estamina no último terço (era 1,8%) |
| Grama (Raízes Firmes) | 0,85 | 0,65 | igual ao bloco 1 |

É o que fecha o M9 (os três tipos entre 15,7% e 17,3%). As descrições das skills mudam junto.

## 5. Build dos bots e "Distribuir sugerido"

`weightedAlloc(cavalo, pesos, de)`: um ponto por vez no status de menor (pontos + 1)/peso entre os que
ainda aceitam (peso > 0, abaixo de 150 e com o próximo ponto cabendo no que sobra); empate na ordem de
`STAT_KEYS`; sem RNG. `botAlloc(cavalo, de)` usa os pesos abaixo (valor medido × 1,3 nos dois status do
tipo):

| Tipo | VEL | ACE | MAN | FOR | EST | GAR | SOR |
|---|---|---|---|---|---|---|---|
| Fogo | 1,17 | 0,975 | 0,9 | 1 | 1 | 0,7 | 0,01 |
| Água | 0,9 | 0,75 | 0,9 | 1 | 1,3 | 0,91 | 0,01 |
| Grama | 0,9 | 0,75 | 1,17 | 1,3 | 1 | 0,7 | 0,01 |

- Sem `de`, parte do zero (bots). Com `de` (os pontos já comprados mais o rascunho), continua dali: é o
  botão **"Distribuir sugerido"**, que põe no rascunho todos os pontos que sobram.
- É a build mais forte medida (M6), então distribuir melhor não basta para vencer o bot da sua liga.
- Sorte só recebe sobra (peso 0,01).

## 6. Poder e ligas

```text
Poder = 2,6·VEL + 1,9·ACE + 2,2·MAN + 2,2·FOR + 2,7·EST + 1,4·GAR + 0·SOR
        + 9 × peso do gatilho, por skill + 19·(nível − 1)/49 + 27·ordemDaRaridade/4
```

- Sem equipamento e sem conjunto. O termo da skill de tipo (80·P) sai: como P agora difere por tipo, nível
  e raridade entram como termos próprios, iguais para os três tipos.
- `powerRating(cavalo)` perde o parâmetro do equipamento; `computeStats(cavalo)` também.
- Ligas: **Bronze 0 · Prata 710 · Ouro 800 · Platina 890 · Diamante 970 · Lenda 1060** (método do bloco
  1: seis faixas iguais entre Comum 1 = 624 e Lendário 50 = 1.149). Iniciais nível 1: 627–632 (Bronze);
  nível 25: 818–823 (Ouro).
- Resíduo do Poder (P1): no máximo 1,0 p.p.

## 7. Equipamento suspenso

- A corrida, o Poder e os status ignoram as peças (`computeStats`, `powerRating` e `simulate` sem gear).
  Bots não ganham mais peças nas salas.
- A sub-aba **Equipamento** da montaria some, e a aba **Loja** some da barra (ela só vende peças e Pedras
  Negras). O código fica, desligado por uma constante (`GEAR_ON = false` no `game.js`), para voltar depois.
- **Guardado no save, sem mudança:** peças, nível de melhoria, o que está equipado e as Pedras Negras. Nada
  é vendido nem convertido.
- **Pedra Negra do pódio:** não cai enquanto o equipamento estiver suspenso (a chamada ao `podiumStone`,
  que tem RNG própria, não é feita; o resto da RNG não muda). O saldo de Pedras sai do cabeçalho e do Perfil.
- Resumo de equipamento na largada e no estábulo: some.
- Volta a ser validado depois (talvez como cosmético).

## 8. Redistribuição e Rédea nova

- Botão **"Redistribuir pontos"** na aba Status, quando o cavalo tem algum ponto comprado. Devolve todos
  os pontos (o alloc volta a zero); o jogador distribui de novo.
- A **primeira de cada cavalo é grátis** (`respecFree: true` no cavalo, nasce verdadeiro, vira falso ao
  usar). As seguintes gastam **1 Rédea nova** (`state.redeas`, inteiro ≥ 0).
- Pede um segundo toque, como o Confirmar dos pontos, com o texto do que vai gastar ("Grátis: a primeira
  deste cavalo" ou "Usa 1 Rédea nova; você tem N"). Grava como um gasto (`gravaGasto`: se a gravação falha,
  nada muda).
- **Com páreo aberto, a montaria ativa não redistribui** (botão desabilitado com a explicação). As outras
  podem.
- **Fonte da Rédea nova neste bloco: nenhuma no jogo normal.** Só a gaveta DEV dá Rédeas. A fonte jogando
  vem com os ginásios. Nunca por Ouro; por Gemas só no bloco 6 (compra direta, sem sorteio).
- Potro nasce com `respecFree: true` e nenhum ponto.

## 9. Save v6 e migração

- `SAVE_VERSION` 5 → 6. Ao abrir um save v5 (ou mais antigo, depois das migrações que já existem), e
  gravado logo ao abrir:
  - todos os cavalos ficam com alloc zerado ("todos os pontos devolvidos") e `respecFree: true`;
  - `state.redeas = 0`;
  - peças, equipamento e Pedras ficam como estão;
  - **sala aberta continua** (não pode ser re-sorteada); o retrato dos pontos (`pending.alloc`) também é
    zerado, e o Poder da sala segue a regra R16 de hoje (o maior entre o dos retratos e o da ativa).
- Na primeira abertura depois da migração, o Estábulo avisa uma vez: "As regras de crescimento mudaram:
  os pontos dos seus cavalos voltaram para distribuir." O aviso não volta (`state.avisoV6` gravado).
- `sanitize` aceita `respecFree` só booleano (padrão verdadeiro) e `redeas` inteiro 0–999 (padrão 0).
- Modo DEV: save separado, como hoje; o save real nunca é lido nem gravado.

## 10. Telas

**Aba Status da montaria** (mantém o rascunho, o Desfazer e o Confirmar em dois toques do bloco 1):
- cada linha: ícone, nome, nota de genética, barra até 150, valor, **"próximo ponto custa C"** e os botões
  **+1, +5 e +10**. Cada botão soma exatamente N pontos ao rascunho; fica desabilitado quando N não cabe
  (pontos, 150 ou a trava do páreo), com o motivo no `title`. O custo de N aparece no `title` e no
  `aria-label` ("+5 em Velocidade: custa 15 pontos");
- topo: "Pontos: **sobram X de Y**" e, com rascunho, "Poder A → B";
- **"Distribuir sugerido"**: preenche o rascunho com `botAlloc(cavalo, pontos + rascunho)`; o jogador
  ainda confirma;
- o aviso do Confirmar muda para: "Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis)."
  ou, se já usou, "(gasta uma Rédea nova)";
- "Redistribuir pontos" (seção 8) embaixo, separado dos botões de compra;
- a nota de rodapé perde o teto da raridade e o equipamento: "A barra vai até 150. O custo do ponto sobe a
  cada 10 pontos no mesmo status."

**Explicações curtas.** Um botão "ⓘ" pequeno ao lado do rótulo: no computador o texto aparece com o mouse
(`title`); no toque, abrir/fechar mostra o texto embaixo (`aria-expanded`, texto com `role="note"`). Os
textos ficam em `GameData.HELP` (para o wiki usar os mesmos). Entram: os 7 status, nota de genética,
estrelas, raridade, skill de tipo, Poder, liga, clima, piso, Dado da Sorte, custo dos pontos e Rédea nova.
Uma frase de até ~140 caracteres, sem número que não venha do código. Os 7 status:

| Status | Texto |
|---|---|
| Velocidade | Velocidade máxima nas retas. É o status que mais pesa numa reta longa. |
| Aceleração | Quão rápido chega à velocidade máxima na largada e depois de perder ritmo. |
| Manobra | Rendimento nas curvas: quem tem mais perde menos velocidade nelas. |
| Força | Rendimento nas subidas, nos pisos pesados e para passar pelo pelotão. |
| Estamina | Fôlego para manter o ritmo até o fim; também deixa correr mais forte no meio e no sprint. |
| Garra | Chance e força da arrancada final; com mais Garra ela começa mais cedo. |
| Sorte | Chance de jogar o Dado da Sorte duas vezes. Rende pouco na corrida. |

**Outras telas:**
- Estábulo: o selo "+N" mostra os pontos que ainda dá para comprar (como hoje, pelo `room` novo).
- Largada e sala: sem o resumo do equipamento; o Poder já sai sem peças.
- Gaveta DEV: campo "Rédeas novas" (como o das Pedras) e uma caixa "redistribuição grátis" por cavalo; os
  modelos de cavalo do DEV usam `validAlloc` novo.
- Barra de abas: 4 abas (Estábulo, Correr, Expedição, Haras).

## 11. Arquivos

| Arquivo | O que muda |
|---|---|
| `prototype/src/data.js` | raridades (`ptsMult`, `baseLo`, sai `statCap`), ligas, skills de tipo e Drift, `HELP` |
| `prototype/src/sim.js` | modelo da seção 2, física da 3, skill de tipo da 4, bot da 5, Poder da 6, sem gear, gancho de teste `entry.statAdd` (como `noTypeSkill`), cabeçalho de fórmulas, `VERSION` |
| `prototype/src/game.js` | save v6, aba Status, redistribuição, explicações, equipamento e loja desligados, sem Pedra do pódio, DEV |
| `prototype/tools/balance.js` | metas da seção 12 (o adaptado da calibração é a referência) |
| `prototype/tools/sim-test.js`, `fx-test.js`, `ui-test.mjs` | testes da seção 12 |
| `prototype/tools/wiki.mjs` | wiki do modelo novo (pontos por nível, custo, base, física, explicações) |
| `docs/GDD.md`, `docs/exemplos.md`, `docs/memoria/*`, `prototype/screens/` | regra nova, medições, memória, capturas |

`prototype/dist/` e `docs/wiki.md` saem do build. `gear.js` e `breed.js` não mudam (o potro ganha `respecFree` no `game.js`, onde já zera os pontos).

## 12. Metas e testes

**`balance.js` (128 metas; todas passaram na calibração):**
- **Saem:** E1, E2a, E2b, E3, E4 e E3b (equipamento); o M6 antigo (seis políticas) e o M7 antigo (status
  cheios).
- **Entram:** M6 novo (rodízio de 12 builds realistas e 6 "tudo num status", Raro ★★ nos níveis 11/30/50:
  nenhuma build realista acima de 60% de média e pelo menos 4 entre 45% e 60%); M7 novo (pior caso no
  nível 50 abaixo de 150); durações das salas de nível 50 (6 checagens).
- **Rebaseadas:** seção 2 (inicial no seu clima) 45–65 → 45–68%; seções 3 e 3c 65–85 / 75–93 → 65–100%;
  seção 7 (Dado) Sorte 100 → Sorte 150.
- **Medido:** M1 32,6 / 34,9 / 32,6% (terços 24,5–42,5%); M3 1→11 88,8–93,7%, 20→30 75,8–79,4%,
  40→50 72,1–72,4% (≥ 70); M4 79,5–86,3% e 97,0–98,7%; M5 70,8–71,3% e 59,8–61,1%; M6 máximo 55,3 /
  56,9 / 58,4% (sempre o bot), 10 builds em 45–60%; M7 144; M8 39,9% e 5,9%; M9 15,7–17,3%; P1 ≤ 1,0 p.p.;
  P2 53,2%; A1 8,6–12,6 p.p. (maior = 1,14× a mediana); S1 4,2–12,3 p.p.

**Testes unitários (`sim-test.js`):**
- `freePoints` nos níveis 1, 2, 11, 50 para as 5 raridades e 3 estrelas (nível 1 dá 0; Comum ★★ 50 dá 215;
  Mítico ★★★ 50 dá 276);
- `costOf(0/1/10/11/20/30/50)` = 0/1/10/12/30/60/150 e `pointCost(0/9/10/19/20)` = 1/1/2/2/3;
- `validAlloc` corta pelo 150 e depois pelo custo, na ordem de `STAT_KEYS`; lixo (negativo, fração,
  texto, chave faltando) vira 0;
- `allocInfo`: `perStat`, `next` e `room` coerentes com `costOf` (comprar `room[k]` cabe; `room[k] + 1` não);
- `weightedAlloc` e `botAlloc`: determinísticos, nunca passam dos pontos nem de 150; `botAlloc(h, de)` mantém
  o que está em `de` e só soma;
- `computeStats` não tem parâmetro de gear e fica em 1–150; `powerRating` igual com e sem peças no cavalo;
- física: com todos os status em X ∈ {50, 80, 110, 140}, +10 em VEL, ACE, MAN, FOR, EST e GAR melhora o
  tempo médio (nenhum ganho zero até 150);
- determinismo: mesma seed e configuração dão o mesmo resultado; `VERSION` mudou.

**Testes de interface (`ui-test.mjs`):**
- +1, +5 e +10 somam ao rascunho e mostram o custo; desabilitam quando não cabe;
- "Distribuir sugerido" preenche o rascunho e não grava sem Confirmar;
- Confirmar em dois toques grava; Desfazer limpa;
- Redistribuir: a primeira é grátis; a segunda sem Rédea fica desabilitada; com Rédea (DEV) gasta 1;
- **com páreo aberto:** +N que subiria o Poder da ativa acima do da sala fica desabilitado, e Redistribuir
  da ativa fica desabilitado (regra §8 do `CLAUDE.md`);
- migração v5 → v6: pontos devolvidos, `respecFree` verdadeiro, peças e Pedras guardadas, sala aberta
  mantida, aviso uma vez;
- sem sub-aba Equipamento, sem aba Loja, sem Pedra do pódio no resultado;
- "ⓘ" dos 7 status: `title` no computador, abrir/fechar no toque;
- o `jogo.html` sai sem modo DEV e sem gancho de teste (o build já confere).

## 13. O que a calibração mudou em relação à conversa

| Na conversa | Na spec | Por quê |
|---|---|---|
| Estrelas 1 / 1,2 / 1,5 | 1 / 1,10 / 1,26 | agora as estrelas multiplicam todo o crescimento (no bloco 1, só os pontos livres, ~30% dele); 1,26 põe o M5 no meio da faixa |
| Pontos por nível: "a raridade define" | taxa 4,0 × 1,00…1,12 | o M4 (um degrau 72–88%) fecha com base e pontos juntos |
| Base 40 / 45 / 50 / 55 / 60 | 40 / 44 / 49 / 54 / 59 | ajuste junto com o fator de raridade nos pontos, para o M4 ficar na faixa (degraus de 4 quebram o "dois degraus" no nível 1: 94,9%) |
| "Custo por faixa resolve" | custo por faixa **e** física linear até 150 | sem a física nova, Manobra e Força acima de 120 rendem 0 e a Estamina morre |
| Estamina era a mais fraca na sonda | Estamina sobe o teto do ritmo | inclinada em Estamina virou a terceira melhor build no nível 50 |
| Skill de tipo igual para os três | força por tipo | fecha o M9 |

## 14. Riscos e pendências

1. **M3 40→50 tem só ~2 p.p. de folga** (72% contra o piso de 70%). É o limite do modelo: no topo, 10
   níveis dão +17 de status. Subir a taxa rende pouco e estoura o M7.
2. **M6 fora do Raro ★★ fica no limite:** bot 60,7% no Comum ★★ 50 e equilibrada 61,0% no Mítico ★★★ 50
   (margem ±1). A meta mede só o Raro. Se precisar de folga, a alavanca é dar mais valor a Aceleração e
   Garra (não medido).
3. **A corrida muda de sensação** (seção 3). Olhar a animação no artefato antes de integrar na `main`.
4. **Durações com pouca folga:** iniciais a 0,5 s do teto da curta; Mítico ★★★ 50 a 1,3 s do piso. Se
   preferir os iniciais em ~96 s, a saída é subir `vBase` e passar as faixas de duração por liga.
5. **Sorte segue sem valor** (A1 0,1 p.p.; peso 0 no Poder). A explicação diz isso; o conserto fica para
   depois.
6. **Sem fonte de Rédea nova no jogo normal** até os ginásios: quem gastar a redistribuição grátis só
   muda a build de novo pelo DEV.
7. **Ouro com menos uso:** a loja de peças some; o Ouro fica para as entradas, a cruza e a troca do Haras.
8. O bloco 2 previa a ferradura de tração e trocar de ferradura na preparação: fica em aberto com o
   equipamento suspenso.
