# Balanço: cavalo superior vence, começo mais leve e skills niveladas (desenho curto)

Data: 2026-11-18. Pedido do Vinicius, em três mensagens: "aparentemente no começo das corridas eu sempre perco, quase
nunca ganho com o cavalo inicial"; "um combo de skill sempre vence outro combo? vamos equilibrar, e diminua a força dos
oponentes iniciais"; e, depois de ver as medições, "pode seguir com as metas (...) logicamente um cavalo superior precisa
ter vantagem sobre outros, e se meu cavalo tem status maiores que todos os outros da corrida e as mesmas skills,
supostamente eu ganharia. Faça uma otimização e prossiga."

É o primeiro de dois projetos. O segundo (mapa da Expedição, ginásios em sequência e a figura do jogador na cena de
desafio) tem desenho próprio; a força dos primeiros oponentes dos ginásios é decidida lá, junto com a sequência.

## O que foi medido (antes)

- **Salas da aba Correr:** o inicial vence 8–10% (o justo com 4 a 8 corredores seria ~18%) e perde ~18 de Ouro por
  corrida com a entrada de 50. Os rivais saem de 91,5% a 111,5% do Poder do jogador: numa sala quase sempre há um ~8%
  mais forte.
- **Cavalo superior:** mesmo cavalo, um com +X% em todos os status de corrida, duelo sem skills: de +1% a +10% vence
  sempre 72–78%; +15% 88%; +20% 98%. A curva é um degrau: +1% já vence demais e +10% vence de menos.
- **A causa do degrau é o sorteio da Garra.** Hoje a Garra sai ou não sai (chance ~60%) e, saindo, vale até +19% no teto
  de velocidade no fim da corrida: mais do que +10% em todos os status. Quando só o mais fraco tira a Garra (24% dos
  duelos), ele vence. Com a Garra sempre saindo, +3% já vence 99%; sem Garra nenhuma, 90%.
- **Combos de skill:** não há imbatível. O melhor trio (Arranque + Drift + a skill de clima do tipo) vence 64–66% contra
  trios sorteados no mesmo cavalo; melhor × pior, 66–72%; no Mítico (5 skills), 77% e 81%. Por skill: Drift, a de clima
  e Arranque 53–56%; Dado Viciado 42% (quase uma vaga vazia); Sprint, Saída Rápida, Nascente e Fôlego 47–48%.

## Metas

1. **Superioridade (nova regra de desenho):** quanto maior a vantagem, mais certo o resultado; cavalos parecidos seguem
   incertos. Mesmo cavalo e mesmas skills, um com +X% em todos os status de corrida:
   - duelo: +1–2% entre 50% e 65%; +5% entre 70% e 88%; +10% ≥ 93%; +15% ≥ 98%;
   - sala de 6 em que você é +X% sobre os cinco (justo 17%): +5% ≥ 45%; +10% ≥ 85%; +15% ≥ 95%.
2. **Começo:** nas 10 primeiras salas do save, vencer perto de 40% (salas de 4 ou 5, rivais mais fracos); da 11ª à 20ª a
   sala volta ao normal aos poucos; no normal, vencer perto do justo (15–18%, hoje 9%).
3. **Skills:** cada skill sozinha entre 47% e 53% (média dos combos que a têm, contra combos sorteados no mesmo cavalo);
   o melhor trio no máximo ~60% (Raro) e o melhor combo de 5 no máximo ~68% (Mítico).

## Abordagens

- **A. Garra sempre sai, com a força sorteada (escolhida).** O mesmo sorteio de hoje (uma chamada da RNG do corredor, no
  mesmo ponto) deixa de decidir "sai ou não sai" e passa a decidir a força: de um piso (que cresce com a Garra) a 100% do
  bônus do cavalo. A sorte continua, visível e da seed, mas do tamanho certo: decide entre cavalos parecidos, não derruba
  um cavalo claramente superior. Mais Garra = arrancada mais forte, mais cedo e mais regular.
- B. Manter o tudo ou nada e diminuir o bônus: a curva continua em degrau (só muda a altura) e a Garra perde a graça.
- C. Ruído pequeno na velocidade de todos: testado em 2026-11-10 e não recomendado (a corrida fica decidida mais cedo).

Para o começo: a faixa de Poder dos rivais passa a depender do número da sala (o contador que já existe no save: nada
novo é gravado, e a sala aberta continua a mesma ao recarregar). Para as skills: só números dos efeitos em `data.js`; o
Dado Viciado ganha um efeito próprio se o dado extra não bastar.

## O que muda

- `prototype/src/sim.js`: Garra v2 (piso e força sorteada; evento `garra` só nas arrancadas fortes, a metade de cima do
  sorteio, para a narração e o efeito continuarem raros); `garraInfo` devolve o piso e a faixa de força; versão da
  simulação sobe. Mesma ordem de chamadas da RNG.
- `prototype/src/data.js`: efeitos das skills; a Arrancada Final passa de "+15% de chance" para "+15% no piso".
- `prototype/src/game.js`: faixa de rivais e tamanho da sala por número da sala (`buildLobby`); textos da aba Skills.
- `prototype/tools/balance.js`: metas novas da superioridade (SUP), das salas e das skills; as metas que mediam a zebra
  antiga (M4, M5, P2 e as que quebrarem) são rebaseadas ao medido, com o motivo; o pareamento sintético passa a usar a
  faixa nova.
- Testes (`sim-test.js`, `ui-test.mjs`), wiki (gerado), `docs/GDD.md`, `docs/exemplos.md` e memória.

## Fora do escopo

Ginásios (sequência, níveis e a força dos primeiros oponentes), mapa e cena de desafio: projeto 2. Equipamento continua
suspenso. Nada muda nas regras de Ouro e Gemas, e todo sorteio continua saindo da seed.

## Notas da execução (2026-11-18)

O que saiu diferente do desenho, e os números finais (medições em `docs/exemplos.md` §0; decisões em
`docs/memoria/decisoes.md`):

- **Superioridade:** medido +2% 57%, +5% 79%, +10% 98%, +15% 100% no duelo; sala de 6: +5% 62%, +10% 97%, +15% 100%.
  Piso da Garra 0,20 + 0,15·n (não o 0,50 de antes: com piso alto, +3% já vencia 84%).
- **Efeitos em cadeia que o desenho não previa:** (1) com menos ruído, o clima de 3% decidia a corrida: caiu para 2%;
  (2) a Maré Alta (Água) rendia pela chance de Garra: as três skills de tipo foram recalibradas pela M9; (3) +10 de Garra
  passou a render 0,8× os outros status: o bônus ficou mais inclinado (meta A1); (4) nos ginásios, a vantagem de elemento
  de 4% dava 85–96%: caiu para 2%, o Remanso perdeu os ★★★ e as faixas do cansaço mudaram de 1/8 m para 3/8 m.
- **Começo:** a meta era "perto de 40%" nas 10 primeiras salas; ficou em 44–47% (faixa 94,5%–101,5%, 4 ou 5
  corredores). A primeira tentativa (80%–98%) dava 84%: com a curva nova, rival 10% mais fraco quase nunca vence. Como
  o catálogo não tem rival mais fraco que o inicial no nível 1, o rival de estreia acima do alvo corre com a genética
  reduzida. Normal: 93,5%–104,5%, 17,0% de vitória (justo 17,6%).
- **Skills:** a meta "cada skill entre 47% e 53% contra combos sorteados" vale contra outro elemento (todas a até 2,2
  pontos da média). Em duelo de mesmo elemento a skill de clima do tipo ainda fica em ~54% (o clima vira o do tipo dos
  dois corredores), e o melhor trio vence 65% (a meta era ~60%). No Mítico (5 skills) o melhor combo fica ~19 pontos
  acima da média (a medição tem ruído alto: 150 duelos por combo). O Dado Viciado ganhou velocidade além do dado extra.
- **Ficou para o projeto 2 (mapa e sequência dos ginásios):** as pistas dos ginásios (a pista de cada um pesa mais com a
  corrida menos ruidosa: G3 em desvantagem vai de 14% a 38% e a G5 só conta na G1) e a força dos primeiros oponentes.
- **Verificação:** `balance.js` completo com 298 metas dentro da faixa; `sim-test.js` 179 testes (hashes de referência
  regerados: as corridas mudaram de propósito); teste novo da estreia no bloco `crescimento-jogo` do `ui-test.mjs`.
