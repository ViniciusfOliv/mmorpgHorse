# Cavalos v3, bloco 1: status, tipo e pista

Especificação do primeiro bloco do redesenho aprovado em 2026-11-10 (`docs/GDD.md` §8). Depois de
aprovada pelo Vinicius vira plano de implementação. Os números vêm de uma calibração por simulação
feita numa cópia isolada do jogo (duas rodadas; dezenas de milhares de corridas por medida).

## 1. Objetivo e escopo

**Objetivo.** Trocar o modelo de status por um em que o jogador vê por que um cavalo é melhor que
outro, monta a build com pontos livres e sente a progressão de nível, estrelas e raridade; dar a
cada tipo uma skill sempre ativa que deixa o forte dele claro; e tirar do sorteio da pista o poder
de decidir a corrida.

**Entra neste bloco:**
- modelo de status novo (genética visível, crescimento automático, pontos livres, estrelas, tetos);
- saída do bônus fixo de elemento e do tipo Neutro;
- skill de tipo, com a animação na corrida;
- iniciais Comuns equilibrados;
- **pistas sem extremos** (veio do bloco 2: as metas dos iniciais só fecham com a regra nova de pista);
- reajuste dos valores do equipamento, para acompanhar a nova distância entre raridades;
- Poder e bots no modelo novo;
- save v5 com migração;
- telas: build na aba Status, vaga do tipo na aba Skills, selo de nível e barra de XP, escolha do inicial;
- metas novas no `balance.js`, testes, wiki, GDD e capturas.

**Fica para os outros blocos:** relógio de preparação, troca de cavalo na sala e ferradura de tração
(bloco 2); itens de treino, inclusive o que sobe estrela e o que redistribui pontos (bloco 4); cruza
com relógio, circuito, aluguel e a tela de cruza nova (bloco 5); loja de Gemas (bloco 6).

**Consequência de os itens virem depois:** até o bloco 4, as estrelas são só as de nascimento e um
ponto distribuído não volta. Por isso a distribuição pede confirmação (§10).

## 2. Modelo de status

```text
g             genética de 0 a 31 por status, só do nascimento. Nota: C 0–7 · B 8–15 · A 16–23 · S 24–31
natural(k)    = inicioDaFaixa[raridade] + 16·g/31 + (nível − 1)·(0,30 + 0,08·g/31)
pontosLivres  = piso((nível − 1) · multiplicador[estrelas])          multiplicador = 1 / 1,2 / 1,5
limitePorStat = teto(0,34 · pontosLivres)
status(k)     = arredonda(mínimo(natural(k) + pontos(k), tetoDaRaridade) + equipamento)
```

| Raridade | Status nasce entre | Teto por status | Vagas de skill | Chance de skill |
|---|---|---|---|---|
| Comum | 40 e 56 | 80 | 1 + a do tipo | 35% |
| Mágico | 45 e 61 | 85 | 2 + a do tipo | 45% |
| Raro | 50 e 66 | 90 | 3 + a do tipo | 55% |
| Lendário | 55 e 71 | 95 | 4 + a do tipo | 65% |
| Mítico | 60 e 76 | 100 | 5 + a do tipo | 75% |

- **Genética.** É o campo `potential` de hoje, agora à mostra. Define onde o status nasce na faixa e
  acelera o crescimento automático (do pior ao melhor, +27%). No nível 50 o crescimento automático
  soma de 14,7 (g = 0) a 18,6 pontos (g = 31) por status. O status base deixa de ser um campo
  guardado: sai sempre da genética. As montarias do catálogo mantêm a genética que já têm hoje.
- **Pontos livres.** No nível 50: 49, 58 ou 73 pontos (uma, duas ou três estrelas). Cada ponto vale
  +1 num status, até o teto da raridade.
- **Limite por status: no máximo 34% dos pontos livres num mesmo status** (17, 20 ou 25 pontos no
  nível 50). Sem esse limite, "tudo em Velocidade" ou "tudo em Força" vencia até 72% dos duelos.
- **Estrelas.** Só treino: multiplicam os pontos livres. Não mexem na genética (sai o piso de
  genética por estrela que existe hoje no cruzamento).
- **Sai o multiplicador de crescimento por raridade.** A raridade passa a valer pela faixa de
  nascimento, pelo teto, pelas vagas, pela chance de skill e pela força da skill de tipo.
- **Equipamento** continua somando depois do teto, como hoje.

**Exemplo.** Brasa (Comum ★★) nasce com Velocidade 52 (nota S) e Estamina 46 (nota B). No nível 50 a
Velocidade chegou sozinha a 70 e a Estamina a 62; ela tem 58 pontos livres e pode pôr até 20 num
status. Com 10 em Velocidade ela bate o teto de 80; com 18 em Estamina, também. Não dá para encher
tudo: são 58 pontos para cerca de 100 de espaço.

## 3. Tipos e skill de tipo

- **Três tipos:** Fogo, Água e Grama. O Neutro sai do jogo por enquanto. Ventania (Rara) vira Grama;
  Pangaré sai do catálogo. O clima Nublado continua (é o clima sem dono).
- **Sai o bônus fixo de +8 num status.** Os multiplicadores de clima não mudam.
- **As oito skills gerais** (hoje marcadas como "neutro" no código) viram o grupo "Gerais".
- **Labareda, Maré Alta e Raízes Firmes deixam de ser skills de vaga normal** exclusivas dos
  iniciais e viram as skills de tipo.

**Skill de tipo.** Todo cavalo tem a do seu tipo, em vaga própria, sempre ativa, sem sorteio, num
terço proporcional da distância D. A força cresce com nível e raridade:
`P = 1 + 0,4·(nível − 1)/49 + 0,4·ordemDaRaridade/4` (Comum 1 = 1,00 · Raro 30 = 1,44 · Lendário 50 = 1,70 · Mítico 50 = 1,80).

| Skill | Terço | Efeito, multiplicado por P | Comum nível 1 | Lendário nível 50 |
|---|---|---|---|---|
| Labareda (Fogo) | 0 a D/3 | aceleração ×(1 + 0,23·P) | +23% | +39% |
| Raízes Firmes (Grama) | D/3 a 2D/3 | +7·P pontos efetivos de Força e de Manobra (curva, subida, piso pesado, pelotão); gasto de fôlego −1,2%·P | +7 pontos | +12 pontos |
| Maré Alta (Água) | 2D/3 a D | velocidade ×(1 + 0,018·P); recupera 1,2%·P do tanque ao entrar no terço | +1,8% | +3,1% |

- **Na simulação:** um efeito por corredor com posição de início e de fim, montado sem consumir a
  RNG (a ordem dos sorteios da corrida não muda). Chaves novas de efeito: `forcaAdd`, `manAdd`,
  `drainCut`. No início do terço sai um evento de skill, como os de hoje.
- **Na pista:** balão com o nome da skill na entrada do terço e uma animação do elemento durante o
  terço inteiro (rastro de chamas, folhas e raízes sob os cascos, onda atrás do cavalo), feita por
  código, dentro do teto de desempenho que o teste de interface vigia. O minimapa pinta os três
  terços. Em "Animações: reduzidas" fica só o balão e um contorno.
- **As skills que só um tipo aprende** ficam como estão: Fogo 2 (Sol a Pino, Chama Final), Água 3
  (Pé na Chuva, Nascente, Canto da Iara), Grama 2 (Névoa Amiga, Casco Firme). Igualar em três por
  tipo, com uma skill nova para Fogo e uma para Grama, fica para o bloco 4, junto dos itens de skill.

## 4. Iniciais

Os três são Comuns de duas estrelas, nível 1, sem skill de vaga normal, com a mesma soma de
genética (112) e de status base (336).

| Inicial | | VEL | ACE | MAN | FOR | EST | GAR | SOR |
|---|---|---|---|---|---|---|---|---|
| Brasa (Fogo) | genética | **24** | **24** | 14 | 12 | 12 | 14 | 12 |
| | status | 52 | 52 | 47 | 46 | 46 | 47 | 46 |
| Maré (Água) | genética | 14 | 12 | 12 | 14 | **24** | **24** | 12 |
| | status | 47 | 46 | 46 | 47 | 52 | 52 | 46 |
| Ipê (Grama) | genética | 16 | 12 | **24** | **24** | 14 | 12 | 10 |
| | status | 48 | 46 | 52 | 52 | 47 | 46 | 45 |

O Ipê tem 2 pontos de genética movidos de Sorte para Velocidade: na mesma forma dos outros ele
vencia 29,7%, abaixo do piso da meta.

## 5. Pista

1. Distância = 1.400 + 50 × um inteiro sorteado de 0 a 12 (de 1.400 a 2.000 m). Hoje: 1.000 a 2.400.
2. O sorteio de blocos de hoje (5 a 9 blocos, primeiro e último em reta) se repete, no mesmo fluxo
   da RNG, até a pista ter **pelo menos uma curva e uma subida e nenhum tipo de bloco acima de
   metade da distância**. Em média são 2,9 tentativas; depois de 60 entra um molde fixo
   (reta, curva, reta, subida, reta).
3. Piso, clima, vento e Dado da Sorte não mudam.

Composição média medida: 40% de reta, 30% de curva e 30% de subida. Duração com os iniciais:
cerca de 96 s nas curtas e 127 s nas longas.

## 6. Equipamento

A distância entre raridades cai de 8 para 5 pontos por status. Para o conjunto Raro em +10 continuar
valendo "pouco mais de um degrau de raridade", os valores das peças mudam:

| | Comum | Mágico | Raro | Lendário |
|---|---|---|---|---|
| Status principal, hoje → novo | 2 → 2 | 3 → 2 | 4 → 3 | 6 → 4 |
| Status secundário, hoje → novo | 0 → 0 | 2 → 1 | 3 → 2 | 4 → 3 |

Cada nível de melhoria passa a valer +0,5 no principal (hoje +1; uma peça +10 soma +5). Chances de
melhoria, Pedra Negra, conjuntos, preços e catálogo não mudam. As peças que o jogador já tem
continuam as mesmas, com os números novos.

## 7. Poder e bots

```text
Poder = soma(peso × status) + 18 × peso do gatilho, por skill + 80 × P (skill de tipo) + pontos de conjunto
pesos: Velocidade 3,1 · Aceleração 1,4 · Manobra 1,45 · Força 3,3 · Estamina 2,4 · Garra 1,3 · Sorte 0,2
```

Os limites das seis ligas são redefinidos dividindo em faixas iguais o intervalo de Poder entre um
Comum de nível 1 e um Lendário de nível 50 com a build dos bots. O inicial de nível 1 começa na Bronze
(hoje, sendo Raro, ele começa na Prata).

**Build dos bots** (fixa, sem sorteio): o limite de 34% vai para o status mais valioso do tipo
(Velocidade para Fogo e Água, Força para Grama); o resto vai de um em um para Aceleração, Manobra,
Força, Estamina, Garra e Velocidade, pulando o que já está no teto; a sobra vai para Sorte. A
genética do bot é sorteada de 0 a 31 pela seed da sala. É a build mais forte que a calibração achou:
nenhuma outra a vence em mais de 51,5%, então o jogador não ganha do bot só por distribuir melhor.

## 8. Cruzamento

- **Genética do potro:** por status, 50% de chance de herdar a de um dos pais (escolhido por
  sorteio); senão, sorteada de 0 a 31. Não há mais piso por estrela nem sorteio separado de status base.
- **Estrelas do potro:** a regra de hoje (sobe, mantém ou desce conforme os pais), valendo agora como
  ponto de partida do treino.
- **Tipo do potro:** o dos pais se for igual; senão 50% de cada. Sem Neutro.
- **Skills:** herança como hoje, sem as três que viraram skill de tipo. A do tipo vem sempre.
- Preço de aluguel, número de cruzas, Troca, Corcel e a regra do Mítico não mudam.
- A ordem dos sorteios do potro muda, então os três potros de referência do teste e de
  `docs/exemplos.md` §4 são regravados.

## 9. Save v5 e migração

Campos de cada cavalo: sai `base`; entra `pontos` (quantos pontos livres em cada status);
`potential` continua guardando a genética; `grau` continua guardando as estrelas.

Migração do v4, uma vez, sem perder Ouro, peças nem cavalos:
- o status base guardado é descartado e passa a sair da genética;
- os pontos livres dos níveis já ganhos são entregues para distribuir (nenhum vem distribuído);
- cavalo Neutro vira Fogo, Água ou Grama, por sorteio da seed do save e do identificador do cavalo;
- Labareda, Maré Alta e Raízes Firmes saem da lista de skills de quem as tinha;
- raridade, nível, XP, estrelas, cruzas, paleta e nome ficam como estão;
- uma sala aberta sobrevive com a mesma seed e os mesmos rivais; o Poder dela é recalculado.
  *Emenda de 2026-11-11:* a sala sobrevive com a mesma seed e a entrada reservada; o Poder é
  recalculado, e a pista e os rivais são refeitos uma vez pelas regras novas (o save v4 não guarda a
  pista).

Jogo novo começa com inicial Comum. O save do modo DEV migra pela mesma regra.

## 10. Telas

- **Montaria, aba Status.** Uma linha por status: valor, nota de genética, barra até o teto e botão
  de mais quando há ponto livre e o status ainda aceita. No topo, "pontos livres: N". Os pontos
  ficam em rascunho até o jogador tocar em "Confirmar"; "Desfazer" limpa o rascunho. A confirmação
  avisa que não dá para voltar atrás (o item que redistribui chega no bloco 4).
- **Montaria, aba Skills.** A skill de tipo numa vaga destacada, com o terço em que age e a força
  atual; embaixo, as vagas normais.
- **Selo de nível** no canto do retrato em todas as telas (Estábulo, Montaria, Correr, Haras, sala),
  barra de XP no cartão do Estábulo e um aviso "+N" quando há pontos livres sem distribuir.
- **Escolha do inicial.** Os três como Comuns, com a skill de tipo, o terço e os dois status fortes.
- **Corrida.** O que está no §3.
- **Haras.** Só os textos: a calculadora deixa de falar em janela de status por estrela e passa a
  dizer que a genética é metade herdada. A tela nova, com os dois pais lado a lado, é do bloco 5.
- **Modo DEV.** A gaveta ganha genética por status, estrelas e pontos, e um botão que devolve os pontos.
- O ícone e a cor do Neutro saem da interface.

## 11. Arquivos

- `prototype/src/data.js`: raridades, elementos, catálogo (genética no lugar de base; Ventania;
  Pangaré), iniciais, skills de tipo, valores do equipamento.
- `prototype/src/sim.js`: status, efeito por terço, chaves novas, sorteio de pista, Poder, versão da
  simulação.
- `prototype/src/breed.js`, `prototype/src/gear.js`, `prototype/src/dev.js`.
- `prototype/src/game.js`, `prototype/src/game.css`: save v5, telas, selo de nível.
- `prototype/src/fx.js`, `prototype/src/sprites.js`: animação da skill de tipo e terços no minimapa.
- `prototype/tools/`: `sim-test.js`, `fx-test.js`, `balance.js`, `ui-test.mjs`, `wiki.mjs`, `wiki-test.mjs`.
- `docs/GDD.md` (§3, §4, §6 e §7 reescritas no fim do bloco), `docs/exemplos.md`, `docs/memoria/`.
- Sai `prototype/assets/icons/el-neutro.png`.

## 12. Metas e testes

Metas do `balance.js`, com o valor medido na calibração:

| Meta | Faixa | Medido |
|---|---|---|
| M1 iniciais entre si, nível 1 | 30–37% no geral; 22–45% em cada terço da faixa de distância | 33,0 / 35,3 / 31,7%; por distância, 26,4 a 41,7% |
| M3 mesma raridade e build, 10 níveis a mais | 70% ou mais | 77,9 a 87,5% |
| M4 uma raridade acima, mesmo nível | 72–88% | 81,7 a 86,0% |
| M4 duas raridades acima | 95% ou mais | 96,8 a 98,8% |
| M5 três estrelas contra uma, mesma genética, nível 50 | 65–75% | 71,1 a 72,5% |
| M5 duas estrelas contra uma | 55–63% | 58,6 a 61,0% |
| M6 nenhuma build dominante (6 políticas) | ninguém acima de 60% | máximo 57,0% |
| M7 status cheios no nível 50 | ★ 3 a 4; ★★★ perto de 5 | 3,48 / 4,08 / 4,89 |
| M8 corrida viva | líder em 1/3 vence até 55%; 5% ou mais com menos de 1 m | 43,9% e 7,0% |
| M9 tipos em campo misto de 6 (justo: 16,7%) | 15,3–18,0% por corredor de cada tipo | 15,4 a 17,9% |
| P1 erro do Poder por tipo, raridade e estrelas | até 5 p.p. | 0,9 |
| E1, E2a, E2b, E3, E4 (equipamento) | as faixas de hoje | 63 / 63 / 21 / 72 / 72% |

Metas de hoje: as dos iniciais são trocadas pela M1; a 4b sai (M3 e M4 cobrem); a S1 perde as três
skills que viraram de tipo; a P1 por montaria vira P1 por categoria; as de duração são rebaseadas
(cerca de 96 e 127 s); as demais ficam. A E3b não foi medida na calibração e é medida na implementação.

Testes: status (fórmula, teto, limite por status, pontos acima do permitido recusados); skill de
tipo sem consumo de RNG e com o terço certo; regra de pista (toda pista com curva e subida, nenhum
tipo acima de metade, distância na faixa); potro determinístico e sem Neutro; migração do save v4;
as regras invioláveis de sempre (determinismo, sala sem re-sorteio, resultado só depois de pagar).
Interface: distribuir e confirmar pontos, selo de nível nas cinco telas, vaga do tipo, escolha do
inicial, skill de tipo na corrida, e o teto de chamadas de desenho. Capturas oficiais novas.

## 13. O que a calibração mudou em relação à conversa

Seis pontos saíram diferentes do que foi dito na conversa de desenho. Estão nesta especificação
como a simulação recomendou; o Vinicius pode vetar qualquer um.

1. **A tabela de raridade muda.** Na conversa, "os números de hoje ficam". Com eles, uma raridade
   acima vencia de 89% a 96% e não sobrava espaço para a build. Com a tabela nova, vence cerca de 84%.
2. **O equipamento perde cerca de metade dos valores,** como consequência do item 1.
3. **As estrelas valem 1 / 1,2 / 1,5** (na conversa, 1 / 1,25 / 1,5).
4. **Existe um limite de 34% dos pontos livres por status.** Na conversa era só "com limite".
5. **As três skills de tipo não rendem o mesmo.** A da Grama rende 6 a 7 pontos de vitória e as
   outras 8 a 11, porque Força vale tanto quanto Velocidade. Com rendimentos iguais, a Grama vencia
   20,5% e a Água 14,2% num campo de seis. A meta que vale passa a ser o equilíbrio dos tipos (M9).
6. **As pistas sem extremos entram neste bloco,** não no 2.

## 14. Riscos e pendências

- **"Os pontos nunca enchem tudo" vale para cerca de 99% dos cavalos de três estrelas.** Um potro de
  genética quase perfeita consegue encher os sete status no nível 50. Não proponho regra extra.
- **Com genética média, um cavalo de uma estrela não enche um status sozinho** (faltam 17 a 18
  pontos e o limite é 17). Depende de genética boa ou de mais estrelas.
- **A Grama no Lendário nível 50 fica em 15,4% na M9,** em cima do piso.
- **A Sorte continua sem valor na corrida** (+10 de Sorte rende 0,6 ponto de vitória). A decisão
  sobre o papel dela segue em aberto (`docs/exemplos.md` §5).
- **Ligas:** os limites de Poder precisam ser recalculados.
- **Quem já tem save** verá os números dos cavalos e das peças mudarem na migração.
