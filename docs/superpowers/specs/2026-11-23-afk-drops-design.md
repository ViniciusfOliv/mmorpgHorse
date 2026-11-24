# Corrida AFK, drops, forja, bestiário e equipamento de PVE — design

_2026-11-23 · decidido em conversa com o Vinicius no chat de coordenação; **revisado no mesmo dia** (fluxo pelo ginásio,
peças com linhas sorteadas, Pergaminho de reforja e Selo do campeão, a seção 5.9)._

_Original: decidido em conversa com o Vinicius no chat de coordenação. Números marcados **partida** são para ajustar
pela tabela de economia e pelo `balance.js`; o resto é regra. O rancho (fazenda) ficou só como ideia e está fora._

## 1. Intenção
O Vinicius quer mais coisas para fazer no jogo, com o Ouro no centro, nos moldes do Idleon e do Taskbar Hero: os cavalos
correm sozinhos, repetidamente, e rendem um ganho por hora com drops. O jogador **assiste enquanto joga** e também
**coleta offline**. Os drops alimentam itens mais variados (raros, quantidades por ação, bestiário) e trazem de volta o
equipamento, hoje suspenso, **valendo só no PVE**. Quanto mais cavalos e maior a dificuldade, maior o ganho.

O PVP valendo continua sendo o centro: é lá que se ganha e se arrisca Ouro de verdade.

## 2. Metas, não metas e antimetas
**Metas**
- G1. Uma tela de AFK com vagas, em que cada cavalo corre duelos repetidos numa fase escolhida, ao vivo ou offline.
- G2. Ganho por hora que nasce da corrida (status, skills, ranks, elemento e peças), não de uma fórmula do Poder.
- G3. Escolha de verdade: a fase de maior ganho de um cavalo nem sempre é a mais difícil que ele já liberou.
- G4. Drops variados com raridade, uma forja que pede quantidades e Ouro, e um bestiário com marcos.
- G5. O equipamento volta, com status de corrida e atributos de farm que só valem no PVE.

**Não metas**
- Rancho, comidas plantadas, casas e trabalhadores (ficaram só como ideia).
- Expedições novas além das fases dos ginásios, captura de selvagens e mercado entre jogadores.
- Qualquer mudança no PVP valendo, no Poder ou nas ligas.

**Antimetas**
- O AFK render Ouro a ponto de a aposta perder sentido.
- Quem deixa 5 cavalos no AFK passar à frente no PVP de quem aposta.
- Gema comprar drop, acelerar o AFK ou dar vantagem nele.
- O offline render, em média, diferente de assistir.

## 3. Restrições
- Determinismo (CLAUDE.md §8): toda corrida, todo drop e toda forja com chance saem da RNG da seed; nada de `Math.random`.
- **Equipamento nunca entra no PVP:** nem na corrida valendo, nem no Poder, nem na sala. Ele só vale nas corridas AFK.
  Os duelos de ginásio de verdade também ficam **sem** peças (as metas G1 a G9 continuam valendo como estão).
- Gema nunca vira Ouro, nunca compra item sorteado e nunca acelera o que rende Ouro. O AFK não vende vaga por Gemas.
- Bônus do bestiário são da conta e só valem no AFK.
- Regra nos módulos puros (vão ao servidor): `afk.js` (novo), `forja.js` (novo), `gear.js`, `data.js`. A tela só anima e grava.
- Depende de: **skills com ranks integradas na `main`** (as dificuldades usam rank) e do **guia de arte** (telas e ícones novos).

## 4. Abordagens consideradas
- Ganho por fórmula do Poder: descartado, porque ignora a corrida e assistir perderia o sentido.
- **Ganho pela corrida, com chance medida para o offline (escolhido):** ao vivo, as corridas são reais; offline, o jogo
  mede a chance de vitória do cavalo na fase com corridas simuladas e sorteia os resultados das horas fora pela seed.
  O ganho esperado é o mesmo nos dois modos.
- Simular também todas as corridas offline: descartado, porque 8 h × 5 cavalos pesa demais no celular.
- Ganho somado dos cavalos (um "time"): descartado; cada cavalo corre na sua vaga e na sua fase, e tudo cai num **baú único**.
- Status das peças: o Vinicius escolheu **B** (principal de corrida e secundário de farm), entre A (só status de corrida)
  e C (só farm).

## 5. Regra

### 5.1 Fases e dificuldades
- As fases são as 15 etapas dos ginásios (Soldados 1 a 4 e o líder dos três ginásios). **Uma fase só libera no AFK
  depois de vencida no ginásio de verdade.**
- **Caminho na tela:** aba Expedição → o ginásio → a trilha mostra os oponentes já vencidos, cada um com "Treinar (AFK)"
  e a escolha da dificuldade liberada; dali se escolhe a vaga e o cavalo. A tela de AFK (vagas e baú) também fica na
  Expedição, para acompanhar e coletar.
- Cada fase tem 3 dificuldades, liberadas em ordem: a Difícil depois de **50 vitórias** AFK na Normal da mesma fase, a
  Lendária depois de 50 na Difícil (partida).

| Dificuldade | Nível do oponente | Rank das skills do oponente | Multiplicador de prêmio |
|---|---|---|---|
| Normal | o da etapa (4 a 20) | o da etapa (1 ou 2) | ×1 |
| Difícil | etapa + 12 | 3 | ×2 |
| Lendária | etapa + 25 (até 45) | 5 | ×4 |

- **Corrida AFK = um duelo**, nas regras do duelo de ginásio: vantagem de elemento de 3%, largada Nublada, Dado da
  Sorte normal, pista do ginásio. Cada corrida é contra **um** cavalo da etapa, em rodízio fixo (1º, 2º, 3º, 1º…), sem
  cansaço.
- O AFK **nunca** dá insígnia, a Rédea ou os itens da primeira vitória, nem o prêmio da revanche. O líder no AFK é o "treino do líder".

### 5.2 Vagas
- Vagas de AFK: 1ª grátis · 2ª 1.000 · 3ª 3.000 · 4ª 8.000 · 5ª 20.000 de Ouro (partida); máximo de 5. O Ouro guardado
  para a entrada da sala aberta nunca é gasto aqui.
- Qualquer cavalo pode ocupar uma vaga; um cavalo ocupa no máximo uma.
- **O cavalo ativo sai do AFK sozinho enquanto está numa sala PVP** e volta quando a sala fecha (a vaga fica guardada).
- Cavalo que deixa de existir (Troca no Haras, liberar) sai da vaga; o que ele já rendeu fica no baú.
- O AFK substitui o "circuito ocioso" do GDD §8.3.

### 5.3 Ganho por corrida
- **Vitória:** a tabela da fase inteira, × o multiplicador da dificuldade (5.4).
- **Derrota:** só XP (30%) e o material comum (25% da quantidade, arredondado para baixo), sem rolagem de raros.
- **XP:** vai para o cavalo que correu; partida: 40 × (1 + 0,15 × etapa) por vitória, × dificuldade.
- **Ouro:** pequeno, por vitória; partida: 2 · 3 · 4 · 5 · 8 por etapa (Soldado 1 ao líder), × dificuldade. **Meta E1:**
  o Ouro do AFK por hora, na melhor fase de um cavalo e com o máximo de +Ouro das peças, fica **abaixo de 25% do prêmio
  bruto esperado por hora no PVP**. A referência do PVP: 20 corridas por hora, entrada de 100, sala de 8 e cavalo no
  Poder médio da sala (prêmio médio de 90 por corrida, ou seja, 1.800 por hora e teto de 450 de Ouro por hora no AFK).
- Duração: a de um duelo real (55 a 90 s, meta G8), ou seja, de 40 a 65 corridas por hora.

### 5.4 Drops (rolados a cada vitória, pela seed)
| Categoria | Itens | Chance por vitória (Normal) | Escala com a dificuldade |
|---|---|---|---|
| Material do ginásio | Fornalha: Carvão, Ferro bruto · Remanso: Junco, Concha · Capoeira: Fibra, Resina | 100%, 1 a 3 (sorteado), metade de cada tipo | quantidade × multiplicador |
| Material incomum | Brasa viva (Fornalha) · Pérola de rio (Remanso) · Seiva antiga (Capoeira) | 15% | chance × multiplicador, teto 60% |
| Pedra Negra | — | 6% | chance × multiplicador |
| Comida | Feno (XP +200 a um cavalo), Cenoura (XP +500), Maçã (XP +1.200), Aveia dourada (+1 h no limite offline do próximo período) | 8% (Feno 60%, Cenoura 25%, Maçã 12%, Aveia 3% do que cai) | chance × multiplicador |
| Peça | Comum ou Mágica solta (Normal); Rara de conjunto (Difícil e Lendária); Lendária (só Lendária) | 2%; Rara 1% na Difícil e 2% na Lendária; Lendária 0,2% | ver as colunas |
| Pergaminho de reforja | — | 1,5% | chance × multiplicador |
| Troféu do oponente | um por oponente (15), ex.: "Lanterna do Sargento Candeeiro" | 0,5% | Difícil 1%, Lendária 2% |

- Toda peça que cai nasce com as linhas de farm sorteadas (5.7), pela seed da corrida.
- **Os materiais e o incomum de cada ginásio só caem nele**, e a peça Rara do conjunto daquele ginásio só se forja com o
  incomum dele (5.6).
- **O AFK não dá:** Selo do campeão, Torrão, Estrela, Rédea, Manual, Cupom nem Pergaminho de técnica (sobem o poder no PVP e seguem vindo de PVP,
  ginásio, loja e diária).
- Os itens novos ficam na mochila, com teto de 999 para materiais e comidas e de 99 para troféus (partida). Quando um
  item chega ao teto, o excedente se perde e a tela avisa antes.
- Peça que cai vai para o inventário de peças. O conjunto da peça Rara segue o elemento do ginásio (Fornalha → Sol,
  Remanso → Chuva, Capoeira → Névoa).

### 5.5 Baú, assistir e offline
- **Baú único:** tudo o que as vagas rendem (Ouro, XP pendente, itens) cai no baú; "Coletar" passa tudo de uma vez.
  O XP vai para cada cavalo ao coletar.
- **Ao vivo:** com a tela de AFK aberta, as corridas são simuladas de verdade, uma atrás da outra, em cada vaga. A tela
  anima uma vaga em destaque (o jogador troca qual) e mostra as outras como cartões com progresso e o último resultado.
  O resultado sai da seed `hash(seedBase, vaga, contador)` e é gravado antes de ser mostrado.
- **Offline:** ao abrir o jogo, para cada vaga:
  1. `p` = chance de vitória do cavalo naquela fase e dificuldade, medida com **400 duelos simulados** sem gravar quadros
     (seeds próprias da configuração), calculados aos poucos, sem travar a tela, quando a configuração muda, e guardados
     em cache até mudar o cavalo (nível, pontos, skills, ranks, peças) ou a fase. Enquanto a medição não termina, a
     vaga corre ao vivo normalmente; o offline usa o último `p` completo. A duração média sai das mesmas 400 corridas;
  2. corridas = minutos fora ÷ duração média medida (arredondado para baixo);
  3. cada corrida é decidida por um número da seed contra `p`, e cada vitória rola os drops como ao vivo.
- **Limite offline:** 8 h (partida), mais a Aveia dourada e o bônus do bestiário (teto 12 h no total). Ao voltar, a tela "Enquanto você estava fora" resume tudo.
- O dia e a hora vêm do relógio do aparelho, como na recompensa diária; adiantar o relógio rende mais, e isso fica aceito
  até existir servidor (mesma regra já registrada).
- **Meta E3:** com 400 duelos, o `p` medido fica a menos de 3 p.p. do `p` de referência (5.000 duelos) em 95% das
  configurações testadas, e o ganho offline esperado fica a menos de 5% do ao vivo.

### 5.6 Forja (tela nova na aba Expedição)
- Receitas fixas, sem chance; gastam materiais e Ouro (partida):

| Forjar | Custo |
|---|---|
| Peça Comum (qualquer slot) | 10 materiais do ginásio + 100 de Ouro |
| Peça Mágica | 25 materiais + 3 incomuns + 300 de Ouro |
| Peça Rara de conjunto | 60 materiais + 10 incomuns **do ginásio do conjunto** + 1 troféu desse ginásio + 800 de Ouro |
| Peça Lendária de conjunto | 120 materiais + 20 incomuns do ginásio do conjunto + 3 troféus desse ginásio + **2 Selos do campeão** + 3.000 de Ouro |
| Pedra Negra | 8 materiais + 30 de Ouro |
| Pergaminho de reforja | 15 materiais de qualquer ginásio + 1 incomum + 150 de Ouro |

- O jogador escolhe o slot e o ginásio (que define o conjunto); o slot, a raridade e o conjunto saem como escolhidos,
  sem sorteio. **Só as linhas de farm** são sorteadas (5.7), pela seed da forja, depois de confirmar.
- Lendária nunca é vendida: cai na dificuldade Lendária ou se forja com Selos do campeão.
- Melhoria de peça (+0 a +10, com Pedras) volta como no GDD §7, com o sorteio pela seed.

### 5.7 Equipamento de PVE (B)
- Cada peça tem o **principal de corrida** do GDD §7 (Ferraduras: Velocidade, Sela: Estamina, Estribos: Manobra,
  Testeira: Aceleração, Armadura: Força) e **linhas de farm sorteadas**, que **substituem** o secundário de corrida do
  §7 (`GEAR_SLOT_INFO.sub` e `ECONOMY.gear.sub` saem). **Revisão de 2026-11-23: a tabela fixa por slot logo abaixo foi
  substituída pelas linhas sorteadas; fica só como referência dos nomes.**
- **Linhas por raridade:** Comum 0 · Mágico 1 · Raro 2 · Lendário 3. Cada linha sorteia o **tipo** (material, XP, drop
  raro, troféu, Ouro; sem repetir tipo na mesma peça) e o **valor** dentro da faixa da raridade (partida):

  | Tipo | Mágico | Raro | Lendário |
  |---|---|---|---|
  | material | 3–6% | 6–10% | 10–15% |
  | XP | 3–6% | 6–10% | 10–15% |
  | drop raro | 2–5% | 5–8% | 8–12% |
  | troféu | 6–12% | 12–20% | 20–30% |
  | Ouro do AFK | 2–4% | 4–6% | 6–10% |

  (valor em passos de 1 ponto percentual, sorteio uniforme). Melhoria (+0 a +10) sobe só o principal.

  Tabela antiga, por slot (substituída):

| Slot | Secundário de farm | Comum | Mágico | Raro | Lendário |
|---|---|---|---|---|---|
| Ferraduras | + material do ginásio | — | +5% | +10% | +15% |
| Sela | + XP | — | +5% | +10% | +15% |
| Estribos | + chance de drop raro (incomum, Pedra, peça, comida) | — | +4% | +8% | +12% |
| Testeira | + chance de troféu | — | +10% | +20% | +30% |
| Armadura | + Ouro do AFK | — | +3% | +6% | +10% |

- Os percentuais somam entre si e multiplicam a chance base (ex.: troféu 0,5% × 1,30).
- O principal usa o valor da raridade + meio ponto por melhoria (GDD §7), **calibrado de novo para o PVE**: a meta E4
  diz quanto ele precisa valer.
- **Conjuntos (PVE):** 3 peças, +10% em todos os secundários (substitui o +5 de Sorte e o +5 p.p. de skill do §7); 4 peças, o bônus do clima do conjunto sobe para 1,07
  (como no §7); 5 peças, ignora a penalidade de clima. Os bônus valem só no AFK.
- A sub-aba Equipamento da Montaria volta, com o selo "só AFK". O `GEAR_ON` passa a ligar o equipamento só no caminho do AFK.
- A loja de peças volta (Comum e Mágica soltas e as 3 Raras, como no §7), vendendo por Ouro, e a Pedra Negra volta à
  loja a 40 de Ouro. **A Pedra do pódio do PVP continua desligada** (o pódio já dá o Pergaminho).
- **Oponentes do AFK com peças:** Normal sem peças; Difícil com 5 Mágicas +3; Lendária com 5 Raras +5 do conjunto do
  ginásio. Os duelos de ginásio de verdade seguem sem peças.
- O GDD §7 ("o equipamento volta ao Poder") é atualizado: o equipamento nunca entra no Poder.

### 5.8 Bestiário (tela nova na aba Expedição)
- Uma página por ginásio, com: os oponentes da trilha (marcos de 10, 100 e 1.000 vitórias AFK), cada material, cada peça
  e cada troféu (visto e obtido).
- Bônus da conta, só no AFK (partida; teto entre parênteses):
  - cada oponente com 100 vitórias: +1% de drop raro (até +15%);
  - cada oponente com 1.000 vitórias: +2% de XP (até +30%);
  - cada troféu: +2% de chance de troféu (até +30%);
  - página completa (tudo obtido e 1.000 vitórias): +1 h de limite offline (até +3 h).

### 5.9 Reforja e Selo do campeão (revisão de 2026-11-23)
- **Pergaminho de reforja:** rerrola **uma linha escolhida** da peça (tipo e valor, sem repetir um tipo que a peça já
  tem). Cada uso gasta 1 Pergaminho de reforja e Ouro; o Ouro cresce a cada reroll **na mesma peça** e nunca volta a
  zero: `custo = arredonda para 10 (100 × 1,5^n)`, com n = rerolls já feitos naquela peça (100, 150, 230, 340, 510…).
  O sorteio sai da seed (`seedBase` + contador da peça), só depois de confirmar, e não se repete ao recarregar. O Ouro
  reservado para a entrada da sala aberta nunca é gasto.
- **Selo do campeão (só PVP):** cai **só no 1º lugar de corrida valendo**, 10% pela seed na liquidação (sal próprio,
  como o Pergaminho de técnica). Nunca no AFK, no treino, na loja nem por Gemas. Usos:
  - **skills (PVP e PVE):** a subida do rank IV para o V passa a pedir também **1 Selo** (além de 2.000 de Ouro e 7
    Pergaminhos de técnica) — muda o custo da spec das skills com ranks;
  - **reforja garantida (PVE):** gastar 1 Selo junto no reroll faz a linha **manter o tipo** e sortear o valor só na
    **metade de cima** da faixa;
  - **forja da Lendária de conjunto (PVE):** 2 Selos (5.6).
- Mochila: Pergaminho de reforja até 99; Selo do campeão até 99.

## 6. Save
- `SAVE_VERSION` sobe para o número seguinte ao das skills com ranks. Entram `afk` (vagas: cavalo, fase, dificuldade,
  contador e momento de início; cache de `p`; o baú), as vitórias por oponente e o bestiário, e os itens novos na mochila.
- Cada peça ganha `linhas: [{ tipo, valor }]` e `rerolls` (n). Peças antigas migram com linhas sorteadas pela seed do
  save e a uid da peça (determinístico) e `rerolls: 0`. Selo do campeão e Pergaminho de reforja entram na mochila.
- O saneamento corrige vaga com cavalo inexistente, fase não liberada, dificuldade não liberada e números fora da faixa.
- Peças e Pedras que já estavam no save continuam como estão.

## 7. Balanceamento e verificação (metas novas no `balance.js`)
- **E1:** Ouro do AFK por hora na melhor fase < 25% do Ouro por hora do PVP valendo, nos níveis 10, 20, 35 e 50.
- **E2:** para um cavalo típico (build de bot, ranks pelo nível: `1 + floor((nível − 1) / 12)`, teto 5) nos níveis 10,
  20, 35 e 50, a fase de **maior ganho** não é sempre a mais difícil liberada; em pelo menos metade dos casos fica 1 ou 2
  degraus abaixo. Valor de referência em Ouro (só para a meta): material do ginásio 10, incomum 60, Pedra 40, Feno 20,
  Cenoura 50, Maçã 120, Aveia 150, troféu 400, peça pelo preço da loja (Lendária 1.500), XP 0,1 por ponto.
- **E3:** offline a menos de 3% de ao vivo (5.5).
- **E4:** um cavalo de nível 45 com 5 peças Raras +7 do conjunto certo vence o líder na Lendária de 40% a 60%; sem
  peças, de 15% a 35%.
- **E6:** em 10.000 reforjas, cada tipo sai na proporção esperada (±1 p.p.) e o valor fica dentro da faixa; com Selo,
  sempre na metade de cima e com o mesmo tipo.
- **E5:** determinismo: a mesma seed, o mesmo cavalo e a mesma fase dão as mesmas corridas e os mesmos drops; nada chama
  `Math.random`, `Date.now` nem `new Date` no caminho das regras.
- G1 a G9, P1, P2 e M8 continuam passando (o PVP não muda).
- Teste de interface: ocupar e esvaziar vaga, coletar o baú, a volta offline, a vaga do ativo com sala aberta, a forja, a
  aba Equipamento "só AFK" e o bestiário.

## 8. O que fica com o construtor
- O desenho das telas (AFK, baú, "enquanto você estava fora", forja, bestiário), seguindo `docs/arte/guia.md`.
- Os nomes e as descrições finais dos materiais, comidas e troféus (respeitando os ginásios e os oponentes).
- Os números de partida que as metas E1 a E5 pedirem para mudar, registrados em `docs/exemplos.md` e em `decisoes.md`.
- A divisão em planos: provavelmente dois blocos (1: AFK, drops, baú, offline e bestiário; 2: forja, equipamento de PVE e
  loja de peças).
