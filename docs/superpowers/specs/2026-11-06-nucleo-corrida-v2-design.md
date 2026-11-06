# Núcleo da corrida v2 — Design

Status: **aguardando revisão do Vinicius**. Aprovado em conversa em 2026-11-05/06; este documento é a
versão escrita, com números. Depois de aprovado vira plano de implementação (`docs/superpowers/plans/`)
e, ao final, reescreve as seções 3 e 4 do `docs/GDD.md`.

Subprojeto 1 de 6 (ordem: núcleo → cavalos v2/cruzamento → equipamentos → expedições → montarias →
economia). Branch: `claude/nucleo-corrida-v2`.

## 1. Objetivo

Trocar a base da corrida automática por um modelo em que **status, terreno e sorte** decidem o
resultado, sem tática pré-corrida. Cada trecho do mapa tem um atributo "dono", os elementos agem pelo
clima, e a sorte é ao mesmo tempo um atributo e um evento visível na pista (Dado da Sorte).

**Pergunta que o protótipo precisa responder depois disso:** com mapa aleatório + 7 atributos + Dado da
Sorte, escolher a montaria certa para a corrida continua sendo mais importante do que a sorte?

## 2. O que sai

| Sai | Motivo |
|---|---|
| **Tática** (ponteiro / perseguidor / arrancador) | Decisão do Vinicius: corrida = status + terreno + RNG. Sai da simulação, das telas, do save e dos testes (meta 3 do `balance.js`). |
| **Disposição do dia** (`formaDoDia`, ±10% na vMax) | Era a maior fonte de zebra. A sorte agora é o Dado da Sorte, visível e com atributo próprio. `formaDoDia = 1`. |
| **Afinidade por distância/piso/subida** (`ELEMENTS[*].affinity`) | O triângulo passa a agir só pelo clima (§5). Pista curta favorecer Fogo, longa favorecer Água e subida favorecer Grama já acontece pelos atributos (+Aceleração, +Estamina, +Força). |
| **Subidas como lista `hills`** | Substituídas pelos blocos do mapa (§6). |
| Raridades Incomum e Épico | Substituídas pela escala de 5 níveis da §4. |

Regras invioláveis (`CLAUDE.md` §8) continuam valendo: determinismo por seed, pagar antes de ver o
resultado, Gemas nunca viram Ouro.

## 3. Atributos (7, escala 1–100)

| Chave | Nome | O que faz na pista | Onde entra na simulação |
|---|---|---|---|
| `vel` | **Velocidade** | Velocidade máxima na reta | `vMax = 16.8 + 2.2·n(vel)` m/s (como hoje) |
| `acel` | **Aceleração** | Largada e retomada na saída de curva e de subida | `accel = 0.6 + 2.4·n(acel)` m/s² (como hoje) |
| `man` | **Manobra** | Quanto da velocidade a montaria segura na curva | `fatorCurva = 0.82 + 0.15·n(man)` (0,82–0,97) multiplica a velocidade-alvo dentro de blocos de curva |
| `forca` | **Força** | Velocidade na subida e em piso pesado | `fatorSubida = 0.85 + 0.12·n(forca)` (0,85–0,97); alívio de 70–80% da penalidade de piso (como hoje); pelotão (como hoje) |
| `est` | **Estamina** | Tanque de fôlego | `tanque = 66 + 20·n(est)`; gasto como hoje (`(v/teto)^4 · (1600/D)^0.4 · mods / tanque`); subida gasta +30% (aliviado por Força) |
| `garra` | **Garra** | Arrancada nos últimos 20% | ao cruzar 80%: chance `0.10 + 0.70·n(garra)`; sucesso: teto ×`(1.02 + 0.16·n(garra))` até a chegada |
| `sorte` | **Sorte** | Viés do Dado da Sorte (§7) e bônus na ativação de skills (§8) | só aritmética inteira |

`n(x) = x/100`. Status efetivo = base + potencial·0,1 + (nível−1)·(0,50 + 0,65·pot/31)·crescimento da
raridade, limitado ao teto da raridade, + bônus do elemento (§5) + modificadores de item/equipamento.
**Potencial oculto 0–31 por atributo** continua (base para o cruzamento, subprojeto 2).

Ritmo ("jóquei"), sem táticas: um único perfil para todos — `s = min(0.97, aff)` até 72% da pista,
depois sprint até 1,03 (o antigo perseguidor, que era o perfil estável). Vácuo (−10% de gasto a 0,5–4 m
atrás de alguém) vale para todos. Ritmo mínimo voluntário 0,80. Jitter ±0,3% continua (ruído de
animação, não de resultado).

## 4. Raridades (5)

| Raridade | `id` | Teto de atributo | Crescimento | Vagas de skill | Nasce com | Chance base de ativar skill | Cor |
|---|---|---|---|---|---|---|---|
| Comum | `comum` | 60 | 0,80 | 1 | 1 | 35% | cinza `#9e9e9e` |
| Mágico | `magico` | 70 | 0,90 | 2 | 1 | 45% | verde `#4caf50` |
| Raro | `raro` | 80 | 1,00 | 3 | 2 | 55% | azul `#2196f3` |
| Lendário | `lendario` | 90 | 1,10 | 4 | 2 | 65% | laranja `#ff9800` |
| Mítico | `mitico` | 100 | 1,20 | 5 | 3 | 75% | roxo `#9c27b0` |

Nível máximo 50 para todas. Migração dos dados atuais: Incomum → Mágico, Épico → Lendário, Lendário →
Mítico (os iniciais continuam Raros). Os tetos caem em relação a hoje (Comum 65 → 60, Raro 85 → 80);
o `balance.js` recalibra.

## 5. Elementos e clima

Elementos: **Água, Fogo, Grama**. Bônus de atributo (como hoje): Fogo +8 Aceleração, Água +8 Estamina,
Grama +8 Força. Cada inicial tem uma skill exclusiva do elemento (como hoje).

O triângulo (Fogo > Grama > Água > Fogo) age **só pelo clima**:

| Clima | `id` | Dono | Efeito nos status efetivos | Efeito geral |
|---|---|---|---|---|
| Sol forte | `sol` | Fogo | Fogo ×1,05 · Grama ×0,95 | gasto de estamina +4% (como hoje) |
| Chuva | `chuva` | Água | Água ×1,05 · Fogo ×0,95 | todos −1,5% de velocidade (como hoje) |
| Névoa *(nome provisório)* | `nevoa` | Grama | Grama ×1,05 · Água ×0,95 | — |
| Nublado | `nublado` | ninguém | — | neutro |

Como hoje, 22% do multiplicador vai direto na vMax (×1,05 nos status ⇒ vMax ×1,011), senão o efeito
mal aparece. O clima pode mudar durante a corrida (§7): os multiplicadores são recalculados no instante
da virada; o que já foi gasto de estamina não muda.

## 6. Mapa aleatório ("pista em blocos")

Gerado por `randomConditions(seed)`, inteiramente derivado da seed:

1. **Distância total** `D`: múltiplo de 100 m sorteado uniformemente em 1 000–2 400 m.
2. **Número de blocos** `B`: inteiro uniforme em 5–9.
3. **Comprimentos**: pesos `w_i = 0,5 + rng()` para cada bloco; `len_i = D · w_i / Σw`, arredondado a
   10 m; o último bloco absorve o resto para fechar exatamente em `D`. Nenhum tipo tem cota mínima.
4. **Tipos**: bloco 1 e bloco B são sempre **reta** (largada e arrancada final). Os demais sorteiam
   uniformemente entre `reta`, `curva` e `subida`. Blocos vizinhos do mesmo tipo são permitidos (na
   tela aparecem emendados).
5. **Piso**: um por corrida, uniforme entre `grama`, `terra`, `areia` (efeitos como hoje: −0/−3/−6% de
   velocidade, gasto ×1,00/1,05/1,12, Força alivia).
6. **Clima inicial**: uniforme entre `sol`, `chuva`, `nevoa`, `nublado`.

Formato: `conditions = { distance, surface, weather, blocks: [{ type, from, to }] }` (`from`/`to` em
metros, contíguos, `to` do último = `distance`). O campo `hills` deixa de existir; `TRACK_EXAMPLES` é
removido — os nomes de hipódromo continuam sendo sorteados de `TRACK_NAMES`, só como nome.

Física por tipo de bloco (velocidade-alvo = `s · vMax · piso · pelotão · clima · boosts · jitter`,
mais o fator do bloco):

| Bloco | Fator na velocidade-alvo | Gasto de estamina | Observação |
|---|---|---|---|
| reta | 1,00 | normal | — |
| curva | `fatorCurva` (Manobra) | normal (a velocidade menor já gasta menos) | ao sair, a velocidade sobe com `accel` até o alvo da reta — Aceleração manda na retomada |
| subida | `fatorSubida` (Força) | ×1,30, aliviado por Força (como hoje) | — |

A velocidade continua subindo com `accel` e caindo a 1,2 m/s² (como hoje), então a entrada na curva
também é gradual.

## 7. Dado da Sorte

- **Quando:** no instante em que o **líder** cruza 1/3 e depois 2/3 de `D` (dois eventos por corrida,
  todos rolam juntos). Por distância, não por tempo: fica determinístico e independe do tamanho da pista.
- **Rolagem de cada montaria:** `d1 = 1 + floor(rng()·100)`. Com probabilidade `sorte/100`, rola
  `d2` e fica com `max(d1, d2)`. **Sorte é a chance, em %, de rolar duas vezes e ficar com o melhor.**
  A skill *Dado Viciado* (§8) acrescenta um dado garantido (então até 3 dados).
- **Vencedor:** maior dado. Empate: re-rola só entre os empatados (até decidir).
- **Efeito:** o clima vira o do elemento do vencedor (Fogo → sol, Água → chuva, Grama → névoa). Se já
  for, nada muda ("o clima segura"). Multiplicadores da §5 recalculados na hora.
- **Evento** `'dado'`: `{ t, at (1/3 ou 2/3), rolls: [{ racer, dice: [..], best }], winner, weather,
  changed }`. A narração mostra os dados ("🎲 Brasa tirou 87 — o sol abre!") e o HUD troca o ícone do
  clima.
- Com 8 montarias e todas com Sorte 0, cada uma vence 12,5% das vezes; Sorte 100 contra sete de Sorte 0
  vence ≈ 22% (2 dados entre 9). A sorte vicia o dado; não o decide.
- RNG: fluxo próprio `mulberry32(hash2(seed, 0xD1CE))`, para não perturbar os fluxos por corredor.

## 8. Skills passivas

Cada skill tem um **gatilho**; quando o gatilho acontece, a skill dispara com
`chance = base(raridade) + 0,5·(nível − 1) + 0,1·sorte` pontos percentuais, limitada a 95%, rolada
no fluxo RNG do corredor. Dispara **uma vez por corrida**, exceto *Drift* (uma vez por bloco de curva).
Gera evento `'skill'` (como hoje).

| Gatilho | `trigger` | Skill | Efeito |
|---|---|---|---|
| Largada | `start` | **Arranque** | `accelMult 1.3` nos primeiros 100 m |
| Entrou em reta (≥ 150 m) | `straight` | **Sprint** | `speedMult 1.04` por 150 m; gasto de estamina ×1,15 enquanto durar |
| Entrou em curva | `curve` | **Drift** | `fatorCurva + 0.05` (teto 1,00) naquela curva |
| Saiu de curva | `curveExit` | **Saída Rápida** | `accelMult 1.4` por 4 s |
| Entrou em subida | `hill` | **Casco Firme** | `fatorSubida + 0.06` (teto 1,00) naquela subida |
| Entrou em subida | `hill` | **Fôlego de Montanha** | gasto de estamina em subida ×0,70 naquela subida |
| Tanque < 20% | `lowStamina` | **Segundo Ar** | recupera 15% do tanque |
| Cruzou 80% | `final` | **Arrancada Final** | chance de Garra +0,15 e, se disparar, teto +0,03 |
| Dado da Sorte | `dice` | **Dado Viciado** | um dado a mais em cada rolagem |
| Clima do seu elemento ativo | `weather:<id>` | **Sol a Pino** (Fogo) · **Pé na Chuva** (Água) · **Névoa Amiga** (Grama) | dobra o multiplicador do clima (×1,10 em vez de ×1,05) enquanto ele durar |

As skills exclusivas dos iniciais (Labareda, Maré Alta, Raízes Firmes) continuam e ocupam vaga.
Skills atuais são mapeadas assim: gatilho `midrace` vira `straight` (dispara ao entrar numa reta que
não seja a da largada); `weather:sol`/`weather:chuva` continuam; `hill`, `final`, `lowStamina` e `start`
continuam; qualquer efeito ligado a tática é removido. Sol a Pino passa a ser a skill de clima do Fogo
(tabela acima), e Correnteza vira Pé na Chuva.

**Como se ganha skill (aprovado):** nasce com `nasceCom(raridade)` skills sorteadas entre as
compatíveis (exclusivas só para quem tem direito). A cada nível ganho, **8% de chance** de aprender uma
skill nova sorteada, enquanto houver vaga. No cruzamento (subprojeto 2) as skills dos pais podem ser
herdadas. Sem vaga, sem aprendizado — a raridade limita.

## 9. Modelo de dados

Tudo passa a se chamar **montaria** (`mount`), já prevendo tigres e dragões (subprojeto 5):

```js
{
  id, name, especie: 'cavalo', element: 'fogo'|'agua'|'grama', rarity: 'comum'|'magico'|'raro'|'lendario'|'mitico',
  sex: 'm'|'f',                       // usado pelo cruzamento (subprojeto 2); sorteado ao criar
  level, xp,
  base: { vel, acel, man, forca, est, garra, sorte },   // 1–100
  pot:  { vel, acel, man, forca, est, garra, sorte },   // 0–31, oculto
  skills: ['arranque', ...],          // até RARITIES[rarity].skillSlots
  look, lore                          // como hoje
}
```

`playerHorse()`/`STARTERS`/`WILD_HORSES` ganham `man` e `sorte` (base e potencial) e `sex`; o save
(`sanitize`) valida os novos campos e descarta `tactic`. Iniciais: Brasa (Fogo), Maré (Água), Ipê (Grama),
Raros, com `sorte` base ≈ 50 e `man` coerente com a identidade (Brasa ágil, Maré estável, Ipê firme).

**Rating de Poder** (ligas e pareamento), provisório até o `balance.js` recalibrar:
`2,2·VEL + 1,8·ACE + 1,6·MAN + 1,8·EST + 1,6·FOR + 1,6·GAR + 0,8·SORTE + 20 por skill`
(status efetivos, com item). Faixas das ligas serão reajustadas pelo relatório de balanceamento.

## 10. Telas (protótipo)

- **Estábulo:** 7 atributos; sai o seletor de tática; mostra sexo e raridade com a nova escala.
- **Sala de largada:** desenho do mapa em blocos (reta / curva / subida com cores), distância, piso, clima
  inicial. Continua: campo sorteado uma vez por sala, item escolhido aqui.
- **Corrida:** pista desenhada por blocos; HUD com o clima atual; narração dos Dados da Sorte e das skills.
- **Resultado:** eventos da corrida (dados, viradas de clima, skills, garra, cansou).
- Comparativo e sprites: sem mudança.

## 11. Verificação (metas do `balance.js`, substituem as atuais)

| # | Meta | Faixa |
|---|---|---|
| 1 | Iniciais no mesmo nível (lv1 e lv25), mapas aleatórios, 3 corredores | 28–39% cada |
| 2 | Inicial com o clima do seu elemento fixo durante a corrida (sem Dado) vs os outros dois | 45–65% |
| 3 | Especialistas por trecho (um atributo 90, os outros 60): "de curva" × "de reta" em mapa com ≥ 60% de curva | o de curva vence 55–75% |
| 3b | Idem em mapa com ≥ 60% de reta | o de reta vence 55–75% |
| 3c | "de subida" (Força 90) × "de reta" em mapa com ≥ 60% de subida | o de subida vence 55–75% |
| 4a | Mítico lv1 × Comum lv1 | 75–92% |
| 4b | Comum lv25 × Raro lv1 | 35–65% |
| 5 | Duração: 1 000 m / 2 400 m (iniciais e PVP 8) | 55–70 s / 140–170 s |
| 6 | Pagamentos: soma(prêmios) + taxa == pote, inteiros, prêmios não crescentes | sempre |
| 7 | Dado da Sorte: Sorte 100 contra sete de Sorte 0 vence o dado | 18–28% |
| 8 | Viradas de clima por corrida (PVP 8, elementos sorteados) | média 0,8–1,6 |
| 9 | Determinismo: mesma seed + configuração ⇒ mesmo mapa, mesmos dados, mesmo resultado | sempre |
| 10 | Skills: chance observada de ativação ≈ chance calculada (±3 p.p.) por raridade | sempre |

`ui-test.mjs` continua verificando: sem erro de console, sem rolagem horizontal, sala não re-sorteada
de graça, resultado só depois de pagar; passa a verificar que o mapa em blocos aparece na sala e que a
narração mostra pelo menos um Dado da Sorte.

## 12. Fora de escopo (vai para os outros subprojetos)

Cruzamento e uso do sexo (2) · inventário, slots e sets (3) · expedições, batalha por turnos e moeda de
pacotes (4) · outras espécies de montaria (5) · fontes e sumidouros de Ouro (6) · sprites novos para
curva/subida (PixelLab, só com confirmação).

## 13. Riscos e como medir

- **Loteria demais:** Dado da Sorte + clima pode fazer o elemento valer mais que o cavalo. Medida: metas 2
  e 3 juntas — se o especialista do trecho não bate 55% ou o favorecido pelo clima passa de 65%, ajustar
  `×1,05`/`fatorCurva`/`fatorSubida`.
- **Curva lenta demais:** `fatorCurva` 0,82 em pistas com muita curva pode estourar a meta 5 de duração.
  Medida: meta 5; ajustar faixa 0,82–0,97 ou a duração-alvo.
- **Sorte inútil:** se a meta 7 vier perto de 12,5%, o viés não se nota; aumentar peso (2 dados sempre a
  partir de Sorte 50, por exemplo).
- **Migração do save:** saves antigos com `tactic` e raridades antigas: `sanitize` descarta/mapeia; sem
  perda de Ouro.
