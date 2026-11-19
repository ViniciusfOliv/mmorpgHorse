# Skills com 100% de ativação e ranks — design

_2026-11-19 · decidido em conversa com o Vinicius no chat de coordenação. Os números marcados como **partida** são para
ajustar jogando ou pelo `balance.js`; o resto é regra._

## 1. Intenção
Hoje uma skill de vaga só dispara se passar num sorteio (35% a 75% de base pela raridade, +0,5 p.p. por nível, +0,1 p.p.
por ponto de Sorte, teto 95%). O jogador monta a estratégia antes da corrida e depois vê a skill falhar sem culpa nenhuma,
o que contraria o pilar "estratégia pré-corrida". O Vinicius quer, no molde das fadas do Black Desert:

- **toda skill de vaga ativa sempre (100%) quando o gatilho acontece;**
- **a skill tem rank (1 a 5), por cavalo**, e fica mais forte a cada rank;
- **o rank sobe com Ouro + um item ganho jogando** (opção B), o que torna o Ouro e a corrida valendo mais importantes.

A qualidade vem primeiro (pedido do Vinicius): subir para o rank máximo tem que ser **sentido na corrida**, não só visto
na tela.

## 2. Metas, não metas e antimetas
**Metas**
- G1. Skill de vaga sem sorteio de ativação; o gatilho continua condicional (largada, reta, curva, subida, estamina baixa,
  reta final, Dado, clima).
- G2. 5 ranks por skill, por cavalo, com efeito crescente e um **marco** próprio no rank 5.
- G3. Um gasto de Ouro profundo e permanente, sem chance de falhar, preso a um item que só se ganha jogando.
- G4. O rank 1 sempre ativo vale, em vitória, o que a skill vale hoje em média (meta S1 continua de 3 a 13 p.p.).

**Não metas (fica para depois)**
- Skills novas, skills que atrapalham rival, mudanças na skill de tipo (já é 100% e continua como está).
- O redesenho da economia e dos afazeres (ponto 3 da conversa, chat próprio). Aqui entram só o custo do rank e a fonte do
  Pergaminho.
- Qualquer coisa por Gemas.

**Antimetas (fracasso mesmo que funcione)**
- Uma skill no rank 5 que decide a corrida sozinha ou vira obrigatória em toda build.
- A corrida ficar previsível: o favorito do Poder vencendo sempre (meta P2, de 35% a 55%, tem que continuar passando).
- Subir rank virar grind obrigatório antes de conseguir competir no nível do cavalo.
- Qualquer caminho de Gema até rank, Pergaminho ou Ouro.

## 3. Restrições (CLAUDE.md §8 e regras já em vigor)
- Corrida determinística: a mesma seed e configuração dão o mesmo resultado. **A subida de rank não tem sorteio nenhum.**
- O Pergaminho que cai no pódio sai da RNG da seed na liquidação do prêmio, como a Pedra Negra (`gear.js`, `podiumStone`),
  e só em corrida valendo.
- Com páreo aberto, nada que suba o Poder do cavalo ativo acima do que a sala viu: **subir rank do cavalo ativo fica
  bloqueado com sala aberta** (como os pontos, o Cupom e o Manual).
- Gema nunca compra rank nem Pergaminho e nunca acelera nada disso. O Pergaminho nunca é vendido na loja de Ouro (senão
  vira a opção A).
- Sem dependências novas; regra nos módulos puros (`sim.js`, `data.js`, `breed.js`, `itens.js`), que vão para o servidor.

## 4. Abordagens consideradas (o Vinicius escolheu a C)
- **A. Escala única para todas:** o rank multiplica só a parte de bônus do efeito. É uma tabela só, fácil de balancear,
  mas o rank vira "só número".
- **B. Tabela à mão por skill:** 75 valores desenhados um a um. É a que tem mais personalidade, mas o custo de balancear é
  alto e o risco de uma skill dominar também.
- **C. Escala única do rank 1 ao 4 e um marco próprio no rank 5 (escolhida):** o rank máximo tem um momento "uau" e o
  custo de balanceamento fica contido em 15 marcos.

Também decididos na conversa: o rank sobe com Ouro e Pergaminho (B, entre A só Ouro e C por uso), o rank é **por cavalo**
(não da conta) e a Sorte sai da chance de skill.

## 5. Regra

### 5.1 Ativação
- `tryFire` deixa de sortear: o gatilho aconteceu, a skill ativa. Continua valendo **uma vez por gatilho** (por corrida;
  por bloco nas `blockScoped`), como hoje.
- A chamada `r.rng()` da tentativa **sai**. Isso muda a sequência da RNG e, portanto, o resultado de toda seed: sobe o
  `simVersion` e os testes de seed fixa são regenerados com conferência (não basta aceitar a saída nova sem olhar).
- Somem da regra: `RARITIES[*].skillChance`, `skillPerLevel`, `skillPerSorte`, `skillChanceMax` e a função `skillChance`
  (e o campo `skillChance` do `racerInfo`). A raridade continua dando as **vagas**; o nível continua no Poder.
- **Sorte:** fica só no Dado da Sorte, em (Sorte − 40)/40. A meta A1 já a isenta.
- O "skills sempre ativam" da gaveta DEV perde o sentido e sai. No lugar entra um seletor de rank por skill na gaveta DEV
  (aba Cavalo).
- O bônus de 3 peças do conjunto (+5 p.p. na chance de todas as skills) não tem mais onde agir. Como o equipamento está
  suspenso, **ele passa a ser "+5% no efeito das skills" (o fator do rank × 1,05)**. Chamada minha, a rever quando o
  equipamento voltar.

### 5.2 Escala do rank
`s(r) = 1 + 0,15 × (r − 1)`, ou seja, 1,00 · 1,15 · 1,30 · 1,45 · 1,60. Ela age **só na parte de bônus**, por formato de
efeito:

| Formato (campo em `SKILLS[*].effect`) | Valor no rank r |
|---|---|
| multiplicador que ajuda (`speedMult`, `accelMult` > 1) | 1 + (m − 1) × s |
| multiplicador que reduz gasto (`drainMult`, `hillDrainMult` < 1) | 1 − (1 − m) × s, com piso 0,05 |
| bônus somado (`curveBonus`, `hillBonus`, `garraChanceBonus`, `garraBoostBonus`) | b × s |
| recuperação (`staminaRestore`) | x × s |
| reforço de clima (`weatherDouble`: hoje ×1,03 → ×1,08) | 1,03 + b × s, com b recalibrado no rank 1 (hoje 0,05), mantendo a regra de não acumular com as 4 peças (vale o maior) |
| dado extra (`extraDice`, Dado Viciado) | o dado extra rola de 1 até um **teto pelo rank** (partida: 60 · 70 · 80 · 90 · 100), recalibrado pela S1 como as outras. É a única skill fora da escala. Ele puxa o número do mesmo fluxo do Dado (`diceRng`), como hoje: a corrida continua determinística. |

**Duração e distância não crescem com o rank** (só no marco do rank 5, quando ele disser).

**Recalibração do rank 1:** os valores base em `SKILLS[*].effect` são **reduzidos** para que, com ativação de 100%, o
ganho pareado de vitória de cada skill no rank 1 fique na faixa de hoje (meta S1: de 3 a 13 p.p.; a referência é a medição
de `docs/exemplos.md`, de 4,0 na Chama Final a 12,7 no Drift). **Vale para todas as 15, inclusive clima e Dado Viciado.** O
ponto de partida é multiplicar a parte de bônus de hoje pela chance média de hoje no campo do S1 (Raro nível 20) e
corrigir pela medição. As descrições (`desc`) do jogo passam a mostrar os números do rank do cavalo.

### 5.3 Marcos do rank 5 (partida; o Vinicius aprova um a um na revisão da spec)
O marco soma ao efeito do rank 5 (que já tem s = 1,60).

| Skill | Marco do rank 5 |
|---|---|
| Arranque | também velocidade ×1,03 nos mesmos 100 m |
| Sprint | dispara também em retas de 100 m ou mais |
| Drift | na curva, também gasta 15% menos estamina |
| Saída Rápida | duração de 6 s → 8 s |
| Fôlego de Montanha | ao sair da subida, recupera 3% do tanque |
| Segundo Ar | o gatilho passa de 30% para 35% da estamina |
| Arrancada Final | também velocidade ×1,02 até a chegada (não mexe no ponto da arrancada, que é o próprio gatilho) |
| Dado Viciado | 2 dados extras, os dois de 1 a 100 (o limite de dados por corredor em `rollDice` sobe de 2 extras para acompanhar; o 2º puxa mais um número do `diceRng`) |
| Sol a Pino · Pé na Chuva · Névoa Amiga | o reforço continua por 15 s depois que o clima muda |
| Chama Final | duração de 9,5 s → 12 s |
| Canto da Iara | também recupera 5% do tanque ao ativar |
| Nascente | também velocidade ×1,03 por 4 s |
| Casco Firme | na subida, também gasta 30% menos estamina extra |

Nenhum marco usa RNG nova; só o Dado Viciado puxa números do fluxo do Dado, como já faz hoje. Na pista, o balão da skill mostra o rank em algarismo romano ("ARRANQUE III"). No rank 5 o
balão fica dourado e o efeito visual da skill ganha um destaque. O desenho exato fica para o construtor, seguindo a
spec da corrida viva.

### 5.4 Subir de rank
- Na ficha do cavalo, aba Skills, cada skill de vaga mostra o rank (5 marcas), o efeito atual → o do próximo rank (ou o
  marco, no 4 → 5) e o custo, com o botão **Subir rank**. A confirmação mostra o antes e o depois, sem volta.
- Botão indisponível diz o motivo no toque: falta Ouro, falta Pergaminho, rank máximo ou sala aberta (cavalo ativo).
- O Ouro guardado para a entrada da sala aberta nunca é gasto aqui (mesma regra da loja de itens).

**Custo (partida):**

| Rank | 1 → 2 | 2 → 3 | 3 → 4 | 4 → 5 | Total |
|---|---:|---:|---:|---:|---:|
| Ouro | 150 | 400 | 900 | 2.000 | 3.450 |
| Pergaminhos | 1 | 2 | 4 | 7 | 14 |

Para comparar: uma sala de 8 com entrada de 100 paga 432 ao 1º. Um Lendário com 4 skills no rank 5 custa 13.800 de Ouro
e 56 Pergaminhos.

### 5.5 Pergaminho de técnica (item novo)
- Na mochila, até 99, ícone novo. A arte segue a regra dos assets: gerar no PixelLab só com a confirmação do Vinicius;
  até lá, um ícone feito por código.
- **Fontes (partida):** a Pedra Negra não cai hoje (`GEAR_ON = false`); reaproveita-se o padrão de RNG de `podiumStone`, com
  semente própria, e a ligação na liquidação é nova.
  - pódio de corrida valendo, pela seed, na liquidação (como a Pedra Negra): 1º 50%, 2º 30%, 3º 15%;
  - ginásios: soldados das etapas 2 e 4 dão 1 a mais no prêmio; o líder dá 3 (na primeira vitória, como a Rédea);
  - o rodízio da revanche **não muda** (mudar desloca o prêmio de quem já tem progresso salvo).
- Nunca em treino, nunca na loja de Ouro, nunca por Gemas. A recompensa diária fica como está.
- Fica em `GameData.ITEMS`, com os números juntos, e a regra de uso não passa pela mochila: ele só é gasto ao subir rank.

### 5.6 Rank no resto do jogo
- **Save:** cada cavalo ganha `skillRanks: { <id>: 1..5 }`, separado de `skills` (a lista continua igual). Sobe o
  `SAVE_VERSION` (8 → 9), com migração: toda skill de vaga existente fica no rank 1. O saneamento corrige rank ausente ou
  inválido para 1 e apaga rank de skill que o cavalo não tem.
- **Poder:** a skill soma `14 × peso do gatilho × s(r)` (o marco não soma à parte). As metas P1 e P2 dizem se o peso
  precisa mudar.
- **Cruzamento (`breed.js`):** o potro que herda uma skill herda o rank do pai que a tem menos 1 (mínimo 1). Se os dois
  têm a skill, vale o maior. A skill sorteada para completar o mínimo nasce no rank 1. **Nenhuma chamada nova de RNG**: a
  sequência do potro não muda.
- **Cupom de troca:** a skill nova entra no rank 1. A confirmação avisa o rank que se perde ("Rank IV de Sprint será
  perdido"). A versão por Gemas, futura, também entra no rank 1.
- **Manual de doma e aprender por nível:** continuam com 35% e 8% (11% com a insígnia), que são chances de **aprender**,
  não de ativar. A skill aprendida entra no rank 1.
- **Bots das salas:** usam, em todas as skills, o **rank médio das skills de vaga do cavalo do jogador** (arredondado; 1 se
  ele não tem skill de vaga), sem sorteio. Assim a sala espelha o investimento do jogador, a conta do Poder não fica
  circular (o rank do bot sai antes do Poder dele) e ninguém é obrigado a subir rank para competir no próprio nível. O
  ganho de subir rank aparece no Poder, que sobe a liga. Nos testes do `balance.js`, o jogador sintético sorteia o rank
  médio de 1 a 5 pela seed da sala.
- **Oponentes dos ginásios:** rank fixo por etapa, sem sorteio: soldados 1 a 3 no rank 1, soldado 4 e líder no rank 2.
  A revanche do líder usa o mesmo rank.
- **Wiki, GDD e explicações "ⓘ":** a chance de ativar some. Entram a escala, os marcos, o custo e o Pergaminho. O wiki
  sai do código, como sempre.

## 6. Balanceamento e verificação
- **S1** (existente): o ganho pareado de cada skill no **rank 1** fica de 3 a 13 p.p.
- **S5 (nova):** o ganho pareado no **rank 5** de cada skill fica de 1,4× a 2,2× o do rank 1 da mesma skill, e nenhuma
  passa de 20 p.p.
- **S6 (nova):** no rank 5, nenhuma skill passa de 2× a mediana das 15.
- **P1, P2 e M8** continuam passando com os ranks dos bots (P2 é a meta anti-previsibilidade).
- **G1 a G9** continuam passando com os oponentes no rank pelo nível.
- O teste de interface cobre: subir rank (Ouro e Pergaminho descontados), o bloqueio com sala aberta, o aviso do Cupom, a
  migração do save v8 → v9 e o balão com rank na corrida.
- Testes de unidade: a escala por formato, os marcos, o rank herdado no potro sem chamada nova de RNG, o Pergaminho do
  pódio determinístico e só em corrida valendo.
- `./scripts/check.sh` e `balance.js` completo passando antes de entregar.

## 7. O que fica com o construtor
- O desenho exato da aba Skills e do balão com rank, seguindo a spec do estábulo no celular e a da corrida viva.
- Os números base do rank 1 de cada skill (pela recalibração do 5.2) e os ajustes de partida, se uma meta pedir. Toda
  mudança de número volta registrada em `docs/exemplos.md` e em `decisoes.md`.
- Como dividir as tarefas no plano.
