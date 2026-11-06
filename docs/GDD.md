# MMORPG Horse — GDD (rascunho v0.1)

> Fonte da verdade do design. Números concretos do protótipo: `docs/exemplos.md`. Decisões com data e motivo: `docs/memoria/decisoes.md`.

Status: **rascunho em construção**. Seções 1–5 aprovadas; §3–4 reescritas em 2026-11-06 com o Núcleo v2 (`docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`). Seções 6+ ainda serão discutidas.

## 1. Visão

Jogo em pixel art (web + Play Store) de corrida de cavalos com progressão estilo RPG e elementos estilo "monstros de tipo" (Fogo/Água/Grama). Foco em **PVP**: corridas entre jogadores apostando moeda virtual.

## 2. Pilares decididos

| Tema | Decisão |
|---|---|
| Jogabilidade da corrida | **Automática.** Estratégia acontece antes: escolher a montaria e o item para o mapa e o clima da corrida. Servidor simula com *seed*; cliente só anima. |
| "MMO" | **Hub social**: cidade/estábulo compartilhado (chat, ranking, haras/guildas, mercado). Resto por menus. |
| Obter cavalos | **Breeding + Expedições PVE** (núcleo) + **Ovos/gacha** (opcional, monetização). |
| Monetização | **Duas moedas**: 🪙 Ouro (só ganho jogando, é apostável) / 💎 Gemas (compradas; cosméticos, passe, ovos). Gemas **nunca** viram Ouro. Evita classificação como jogo de azar. |
| PVP | Corridas de **4–8 jogadores**, entrada igual, pote dividido 1º/2º/3º (menos taxa da casa). Bots completam vagas. **Espectadores apostam** (fase 2). |
| Matchmaking | **Ligas por Rating de Poder do cavalo** + **MMR do jogador** dentro da liga. Modo opcional **Copa Nivelada** (status normalizados). |

## 3. Status base (1–100)

Sete atributos. Sem tática pré-corrida: a corrida é decidida por **status + terreno + sorte**.

| Atributo | O que faz |
|---|---|
| Velocidade (VEL) | Velocidade máxima na reta |
| Aceleração (ACE) | Largada e retomada na saída de curva e de subida |
| Manobra (MAN) | Quanto da velocidade segura nas curvas |
| Força (FOR) | Velocidade na subida, piso pesado (terra/areia) e disputa no pelotão |
| Estamina (EST) | Tamanho do tanque de fôlego |
| Garra (GAR) | Chance e força da arrancada final (últimos 20%) |
| Sorte (SOR) | Chance de rolar um segundo dado no Dado da Sorte e de ativar skills |

Cada montaria também tem:
- **Raridade** (5 níveis): teto de cada status, vagas de skill e chance base de a skill disparar.

  | Raridade | Teto por status | Vagas de skill | Chance base de skill |
  |---|---|---|---|
  | Comum | 60 | 1 | 35% |
  | Mágico | 70 | 2 | 45% |
  | Raro | 80 | 3 | 55% |
  | Lendário | 90 | 4 | 65% |
  | Mítico | 100 | 5 | 75% |

  A chance de uma skill disparar quando o gatilho acontece = base da raridade + 0,5 p.p. por level + 0,1 p.p. por ponto de Sorte (teto 95%). A cada level ganho há 8% de chance de aprender uma skill nova, se houver vaga.
- **Sexo** (macho/fêmea), para o cruzamento.
- **Potencial** oculto 0–31 por status (revelado com item).
- **Level** 1–50 (status crescem conforme potencial e raridade, até o teto).

## 4. Elementos, clima e Dado da Sorte

| Elemento | Bônus de status | Clima dono |
|---|---|---|
| 🔥 Fogo | +8 Aceleração | Sol |
| 💧 Água | +8 Estamina | Chuva |
| 🌿 Grama | +8 Força | Névoa |
| ⚪ Neutro | — | — |

O triângulo (Fogo > Grama > Água > Fogo) age **só pelo clima**. O dono do clima tem os status ×1,03 (×1,10 com a skill de clima do elemento); o penalizado, ×0,97.

| Clima | Favorece | Penaliza | Efeito geral |
|---|---|---|---|
| ☀️ Sol | Fogo | Grama | gasto de estamina +4% |
| 🌧️ Chuva | Água | Fogo | todos −1,5% de velocidade |
| 🌫️ Névoa | Grama | Água | — |
| ☁️ Nublado | — | — | neutro |

**Dado da Sorte:** quando o líder cruza 1/3 e 2/3 da pista, todas as montarias rolam um dado de 1 a 100; a Sorte é a chance (em %) de rolar um segundo dado e ficar com o melhor.
O maior dado vence (empate: só os empatados rolam de novo) e o clima vira o do elemento do vencedor; se já for esse, ou o vencedor for Neutro, o clima segura.
Tudo sai da seed da corrida: a sorte vicia o dado, não o decide.

**Mapa aleatório:** cada corrida sorteia pela seed uma pista de 1 000 a 2 400 m dividida em 5 a 9 blocos de **reta** (Velocidade), **curva** (Manobra) ou **subida** (Força); o primeiro e o último bloco são sempre reta. Também sorteia o piso (grama, terra ou areia) e o clima inicial. Detalhes na spec do Núcleo v2 e no topo de `prototype/src/sim.js`.

Iniciais (Brasa, Maré, Ipê) são Raros e têm uma skill exclusiva do elemento.

## 5. Protótipo

`prototype/` contém um protótipo web descartável para visualizar sprites, simulação e o fluxo de aposta. Não é a base de código final.

## 6+. Seções pendentes

Itens e upgrades · Curvas de XP/level · Regras de breeding · Expedições · Economia (valores de entrada, taxa da casa, sinks de Ouro) · Stack técnica (cliente, servidor, Android) · Anti-cheat · Roadmap MVP.
