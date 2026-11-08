# MMORPG Horse — GDD (rascunho v0.1)

> Fonte da verdade do design. Números concretos do protótipo: `docs/exemplos.md`. Decisões com data e motivo: `docs/memoria/decisoes.md`.

Status: **rascunho em construção**. Seções 1–5 aprovadas; §3–4 reescritas em 2026-11-06 com o Núcleo v2 (`docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`). Seções 6+ ainda serão discutidas.

## 1. Visão

Jogo em pixel art (web + Play Store) de corrida de cavalos com progressão estilo RPG e elementos estilo "monstros de tipo" (Fogo/Água/Grama). Foco em **PVP**: corridas entre jogadores apostando moeda virtual.

## 2. Pilares decididos

| Tema | Decisão |
|---|---|
| Jogabilidade da corrida | **Automática.** Estratégia acontece antes: escolher a montaria e o equipamento para o mapa e o clima da corrida. Servidor simula com *seed*; cliente só anima. |
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
- **Potencial** oculto 0–31 por status (revelação fica para depois).
- **Level** 1–50 (status crescem conforme potencial e raridade, até o teto).

## 4. Elementos, clima e Dado da Sorte

| Elemento | Bônus de status | Clima dono |
|---|---|---|
| 🔥 Fogo | +8 Aceleração | Sol |
| 💧 Água | +8 Estamina | Chuva |
| 🌿 Grama | +8 Força | Névoa |
| ⚪ Neutro | — | — |

O triângulo (Fogo > Grama > Água > Fogo) age **só pelo clima**. O dono do clima tem os status ×1,03 (×1,07 com 4 peças do conjunto do clima; ×1,10 com a skill de clima do elemento); o penalizado, ×0,97.

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

## 6. Estábulo e cruzamento

Spec completa e algoritmo: `docs/superpowers/specs/2026-11-06-cruzamento-design.md` (o código é `prototype/src/breed.js`). Números reais: `docs/exemplos.md` §13.

**Estábulo:** começa com 3 vagas; +1 vaga por 300 Ouro, até 8. Cada montaria tem nome, raridade + grau, elemento, sexo, nível e cruzamentos restantes (♂ 2 / ♀ 1). Uma delas é a ativa (a que corre). Liberar não devolve Ouro; a ativa e a última montaria não podem ser liberadas.

**Grau (★/★★/★★★):** sub-tier dentro da raridade. Define a janela dos 7 status base do potro e o piso do potencial (cada status é sorteado de forma independente na janela):

| Raridade | Faixa | ★ | ★★ | ★★★ | Piso de potencial (★/★★/★★★) |
|---|---|---|---|---|---|
| Comum | 36–52 | 36–44 | 41–47 | 44–52 | 0 / 8 / 16 |
| Mágico | 44–60 | 44–52 | 49–55 | 52–60 | 0 / 8 / 16 |
| Raro | 52–68 | 52–60 | 57–63 | 60–68 | 0 / 8 / 16 |
| Lendário | 60–76 | 60–68 | 65–71 | 68–76 | 0 / 8 / 16 |
| Mítico | 68–84 | 68–76 | 73–79 | 76–84 | 0 / 8 / 16 |

**Haras:** o jogador escolhe uma montaria sua e um parceiro de sexo oposto: outra sua ou um reprodutor de aluguel (selvagens não Míticos). Aluguel = base da raridade (Comum 100 · Mágico 250 · Raro 600 · Lendário 1500) × grau (×1 / ×1,25 / ×1,5), arredondado. Dois seus: 50 Ouro. **Troca:** dois seus de sexos opostos, 50 Ouro, qualquer número de cruzamentos restantes; os dois pais somem e o potro ocupa a vaga de um deles. A calculadora mostra chances de raridade e grau antes de pagar. Resultado instantâneo (gestação com timer fica para depois).

**Chance de raridade do potro** (L = nível efetivo; interpolação linear entre lv1 e lv30; alvo fora de Comum–Lendário soma no limite):

| Pais | 1 abaixo | igual | 1 acima | 2 acima |
|---|---|---|---|---|
| mesma raridade, lv1 → lv30 | 45% → 30% | 54% → 65% | 1% → 4,5% | 0% → 0,5% |
| raridades diferentes, lv1 → lv30 | 35% → 20% | 50% → 50% | 15% → 29% | 0% → 1% |

A base é a menor raridade entre os pais. **Grau do potro:** se a raridade subiu, nasce ★; se desceu, ★★★; se igual, a base é 0,6·grau da égua + 0,4·grau do garanhão (arredondada) e o sorteio é desce/mantém/sobe = 25% → 10% / 55% → 50% / 20% → 40% (lv1 → lv30).

**Chances saturam no nível 30; a égua pesa 60%:** L = (0,6·nível da égua + 0,4·nível do garanhão) / 30, limitado a 1. **Mítico nunca nasce de cruzamento — só por despertar** (Lendário → Mítico, depois das expedições).

**Elemento e sexo:** pais com o mesmo elemento passam o elemento; diferentes, 50/50 (Neutro conta como elemento). Sexo 50/50. Status base do potro são sorteados na janela do grau (não são herdados); o potencial herda de um pai com 50% de chance por status, senão sorteia 0–31, sempre respeitando o piso do grau.

**Skills e Corcel:** o potro herda cada skill não exclusiva e compatível com o seu elemento com 35% de chance, até as vagas da raridade; completa até o mínimo de nascimento com skills sorteadas. Corcel é a montaria com todas as skills "de linha" da sua raridade; garante herança de skill:

| Raridade | Conjunto do Corcel | Skills garantidas |
|---|---|---|
| Comum | Arranque | dois Corcéis: garante até 2 · um só: até 1, com 50% de virar 2 — sempre limitado às candidatas (skills herdáveis dos pais) e às vagas da raridade do potro |
| Mágico | Arranque, Sprint | idem |
| Raro | + Drift | idem |
| Lendário | + Saída Rápida | idem |
| Mítico | + Arrancada Final | idem |

## 7. Equipamentos

Cada montaria usa um **set de 5 peças** (modelo do equipamento de cavalo do Black Desert). As peças ficam num **inventário compartilhado**, são compradas na **Loja** com Ouro e melhoradas de +0 a +10 com **Pedras Negras**. Os **conjuntos** ligados aos climas criam a escolha pré-corrida: turbinar o dia bom ou se proteger do dia ruim. Sem durabilidade e sem limite de vagas (por enquanto).

**Slots e status:**

| Slot | Principal | Secundário |
|---|---|---|
| Ferraduras | Velocidade | Aceleração |
| Sela | Estamina | Garra |
| Estribos | Manobra | Sorte |
| Testeira | Aceleração | Garra |
| Armadura | Força | Estamina |

**Raridade da peça** (Mítico não tem peça; vem do despertar, no futuro). O principal vale o valor da raridade **mais o nível de melhoria**; o secundário é fixo. Comum não tem secundário. O preço de Lendário é só referência de venda: **não está à venda**.

| Raridade | Principal | Secundário | Preço | Venda (25%) |
|---|---|---|---|---|
| Comum | +2 | — | 100 | 25 |
| Mágico | +3 | +2 | 250 | 63 |
| Raro | +4 | +3 | 600 | 150 |
| Lendário | +6 | +4 | 1.500 | 375 |

Peças Comum e Mágica são soltas; Raro e Lendário vêm em **conjuntos** (Sol, Chuva, Névoa), com o mesmo nome nas duas raridades. São 40 peças no catálogo; 25 estão à venda. Os bônus entram na corrida depois do crescimento por nível e do bônus de elemento, e podem passar do limite de status da raridade (como o elemento já passa). Um conjunto Raro completo em +10 soma cerca de +14 nos cinco status de pista: pouco mais de um degrau de raridade.

**Melhoria (+0 a +10).** Cada tentativa gasta Pedras Negras e tem chance de sucesso decrescente. A partir de +6, falhar faz a peça **cair um nível**. A pedra é paga e o resultado sorteado pela seed antes de ser mostrado, e o sorteio não se repete ao recarregar.

| De → para | +0→1 | +1→2 | +2→3 | +3→4 | +4→5 | +5→6 | +6→7 | +7→8 | +8→9 | +9→10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 90% | 80% | 70% | 60% | 50% | 40% | 35% | 30% | 25% |
| Pedras por tentativa | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 |
| Se falhar | nada | nada | nada | nada | nada | nada | cai p/ +5 | cai p/ +6 | cai p/ +7 | cai p/ +8 |

Custo esperado da cadeia completa, contando as quedas (pedra a 40 Ouro): **+5 ≈ 6 pedras (258 Ouro) · +7 ≈ 16 (658) · +8 ≈ 37 (1.481) · +10 ≈ 264 (10.548)**. O +10 é objetivo de longo prazo de propósito. Uma peça equipada na montaria ativa com páreo aberto não pode ser melhorada.

**Conjuntos.** Conta-se, por montaria, o maior número de peças equipadas do **mesmo** conjunto (raridades misturadas valem; empate entre conjuntos não ativa nada). Os bônus **acumulam**:

| Peças | Bônus |
|---|---|
| 3 | +5 p.p. na chance de todas as skills e +5 de Sorte |
| 4 | O bônus do clima do conjunto sobe de 1,03 para 1,07 quando a montaria é do elemento favorecido por ele. Não acumula com a skill de clima (1,10): vale o maior |
| 5 | A montaria ignora a penalidade de clima, em qualquer clima |

Conjuntos: **Sol** (clima do Fogo), **Chuva** (Água), **Névoa** (Grama). Além dos bônus, o conjunto soma pontos ao Rating de Poder (3 peças +10, 4 peças +15, 5 peças +20; não cumulativo).

**Loja e venda.** Tela própria, com uma aba por slot (1 Comum, 1 Mágica e 3 Raras, uma de cada conjunto) e uma aba de Pedras (×1 por 40 Ouro, ×5 por 200). Comprar não equipa. Cada cartão mostra a diferença para a peça que a montaria ativa usa no slot. Peça **não equipada** vende de volta por 25% do preço da raridade (ignora a melhoria), com "Desfazer" até sair da tela.

**Pedra Negra no pódio.** Só em corrida **valendo** (nunca em treino): 1º lugar 60% de chance, 2º 40%, 3º 25%, sorteados pela seed na liquidação do prêmio. É a única fonte de pedra fora da Loja e nunca dá peça.

**Pareamento e trava parcial.** O equipamento entra no Rating de Poder que forma a sala. Com páreo aberto, a montaria ativa só aceita trocar de peça se o rating resultante **não passar do que a sala viu**: dá para trocar Sol por Chuva de mesma força depois de ver a previsão do clima, mas não dá para abrir a sala fraco e equipar forte.

**Bots por liga.** Os bots entram equipados conforme a liga do alvo, com o conjunto do clima do próprio elemento (Neutro sorteia um):

| Liga | Equipamento do bot |
|---|---|
| Bronze | nada |
| Prata | 2 Comuns +0 (ferraduras, sela) |
| Ouro | 5 Comuns +2 |
| Platina | 5 Mágicas +3 (soltas) |
| Diamante | 3 Raras +4 do conjunto + 2 Mágicas +3 |
| Lenda | 5 Raras +7 do conjunto |

**Depois (fora do protótipo):** durabilidade e reparo · limite de vagas no inventário · Lendário na loja (hoje só pelo painel `?dev=1`, até as expedições) · peça Mítica · mercado entre jogadores · cosméticos por Gemas · desmanche · expedições e pacotes como fonte de peças · transferência de peças entre contas.

## 8+. Seções pendentes

Curvas de XP/level · Expedições · Economia (valores de entrada, taxa da casa, sinks de Ouro) · Stack técnica (cliente, servidor, Android) · Anti-cheat · Roadmap MVP.
