# MMORPG Horse — GDD (rascunho v0.1)

> Fonte da verdade do design. Números concretos do protótipo: `docs/exemplos.md`. Decisões com data e motivo: `docs/memoria/decisoes.md`.

Status: **rascunho em construção**. Seções 1–5 aprovadas em conversa. Seções 6+ ainda serão discutidas.

## 1. Visão

Jogo em pixel art (web + Play Store) de corrida de cavalos com progressão estilo RPG e elementos estilo "monstros de tipo" (Fogo/Água/Grama). Foco em **PVP**: corridas entre jogadores apostando moeda virtual.

## 2. Pilares decididos

| Tema | Decisão |
|---|---|
| Jogabilidade da corrida | **Automática.** Estratégia acontece antes: cavalo, itens, tática. Servidor simula com *seed*; cliente só anima. |
| "MMO" | **Hub social**: cidade/estábulo compartilhado (chat, ranking, haras/guildas, mercado). Resto por menus. |
| Obter cavalos | **Breeding + Expedições PVE** (núcleo) + **Ovos/gacha** (opcional, monetização). |
| Monetização | **Duas moedas**: 🪙 Ouro (só ganho jogando, é apostável) / 💎 Gemas (compradas; cosméticos, passe, ovos). Gemas **nunca** viram Ouro. Evita classificação como jogo de azar. |
| PVP | Corridas de **4–8 jogadores**, entrada igual, pote dividido 1º/2º/3º (menos taxa da casa). Bots completam vagas. **Espectadores apostam** (fase 2). |
| Matchmaking | **Ligas por Rating de Poder do cavalo** + **MMR do jogador** dentro da liga. Modo opcional **Copa Nivelada** (status normalizados). |

## 3. Status base (1–100)

| Status | Efeito |
|---|---|
| Velocidade | Velocidade máxima |
| Aceleração | Rapidez até a vel. máx (largada/retomadas) |
| Estamina | Quanto tempo mantém o ritmo |
| Força | Subidas, terreno pesado, disputa no pelotão |
| Garra | Chance/força da arrancada final (últimos 20%) |

Cada cavalo também tem:
- **Raridade**: Comum → Incomum → Raro → Épico → Lendário (teto de status e nº de habilidades).
- **Potencial** oculto 0–31 por status (revelado com item).
- **Level** 1–50 (status crescem conforme potencial).
- **Tática** pré-corrida: Ponteiro / Perseguidor / Arrancador.

## 4. Elementos

| Elemento | Bônus de status | Favorece | Penalidade |
|---|---|---|---|
| 🔥 Fogo | +Aceleração | Sol, pista curta | Chuva |
| 💧 Água | +Estamina | Chuva, pista longa | Areia |
| 🌿 Grama | +Força | Terra, subidas | Sol forte |

Triângulo **indireto** (Fogo > Grama > Água > Fogo) via pista e clima sorteados por corrida. Iniciais têm status de Raro e uma habilidade exclusiva do elemento.

## 5. Protótipo

`prototype/` contém um protótipo web descartável para visualizar sprites, simulação e o fluxo de aposta. Não é a base de código final.

## 6+. Seções pendentes

Itens e upgrades · Curvas de XP/level · Regras de breeding · Expedições · Economia (valores de entrada, taxa da casa, sinks de Ouro) · Stack técnica (cliente, servidor, Android) · Anti-cheat · Roadmap MVP.
