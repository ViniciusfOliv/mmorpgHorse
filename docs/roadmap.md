# Roadmap — Galope Elemental (proposta)

> **Plano proposto, não oficial.** Não substitui o `CLAUDE.md` (regras e regras invioláveis), o `docs/GDD.md` (fonte
> da verdade do design), o `docs/cronograma.md` (caminho até o Play) nem as decisões em `docs/memoria/decisoes.md`.
> Quando este roadmap discordar deles, valem eles, e a divergência é registrada e levada ao Vinicius.
>
> Origem: "Roadmap mestre — revisão crítica para Claude Code" v1.0 (25/11/2026), escrito sem acesso ao repositório e
> **adaptado em 2026-11-25** à auditoria da Fase 0 (`docs/auditoria/`). O que mudou em relação ao original está no fim.

## 1. Para que serve

Dar uma direção para evoluir o protótipo sem reescrever o que funciona: preservar, provar os problemas com evidência e
mudar em passos pequenos. Funcionalidades daqui só existem depois de implementadas; o roadmap não prova nada.

## 2. Fontes, por ordem

1. **Código** (`prototype/src/`): o que de fato acontece.
2. **`CLAUDE.md` e `docs/GDD.md`**: o que foi decidido. A comparação principal é **GDD × código**.
3. **`docs/memoria/`** (estado, decisões, bugs) e as specs em `docs/superpowers/`: contexto e porquês.
4. **`docs/wiki.md`**: documentação **derivada**, gerada do código pelo build. Serve para ler números, não como fonte
   independente.
5. **Este roadmap**: direção futura.

Material sem acesso garantido (vídeo de gameplay, artefatos publicados fora do repositório) não sustenta conclusões
sozinho.

Classificação nos relatórios: **confirmado no código · documentado no GDD · documentado na memória/spec · inferência ·
proposta · não verificado**. Estado dos sistemas: **funcional · parcial · documentado, não implementado · apenas
planejado · não encontrado**.

## 3. Visão do produto (como o projeto a define hoje)

Corrida de cavalos automática em pixel art, com progressão de RPG e elementos (Fogo, Água, Grama). **Foco em PVP com
aposta de Ouro** (GDD §1). A estratégia acontece antes da corrida; o servidor simula com seed e o cliente só anima.
"MMO" quer dizer **hub social** (cidade, chat, ranking, haras e guildas, mercado), com o resto por menus (GDD §2).
Cavalos vêm de cruzamento, expedições PVE e pacotes comprados só com moeda ganha jogando.

Ciclo principal: **obter cavalos → entender status, elemento, raridade e genética → distribuir pontos e treinar →
correr valendo, ginásios, treino AFK → Ouro, XP, itens, materiais → melhorar, cruzar, colecionar → de novo.**

Pilares, nesta ordem (Observação 3 do original, mantida):
- **A. Cavalos:** identidade visual, dados confiáveis, genética compreensível, linhagem, progressão que se sente.
- **B. Corridas:** simulação coerente e reproduzível, builds diferentes viáveis, feedback que corresponde à simulação,
  ultrapassagens e reta final legíveis.
- **C. Progressão:** objetivos de curto, médio e longo prazo, economia sustentável.

Captura, expedições, profissões e mercado entram **sobre** esses pilares, nunca para compensar problemas neles.

## 4. Regras permanentes para o trabalho

As regras de jogo invioláveis estão no **`CLAUDE.md` §8** e não são copiadas aqui. Valem também:

- **Preservar a arquitetura atual.** Trocar engine, framework ou sistema central só com problema concreto,
  evidência reproduzível, alternativas comparadas, custo estimado e plano incremental. A base web foi escolhida
  (`docs/teste-engine.md`) e reorganizar `prototype/` é um subprojeto próprio (`CLAUDE.md` §9).
- **Não mudar regra sem aprovação:** fórmulas, XP, limites, raridades, estrelas, genética, chances, skills, elementos,
  recompensas, economia, limites do AFK, regras dos ginásios. Ao achar um problema: descrever a regra atual, mostrar onde
  está, dar um caso de falha, medir o impacto, propor alternativas e esperar.
- **Simulação separada da apresentação:** a animação nunca decide quem vence (já é assim; manter).
- **Determinismo:** mesma seed e configuração ⇒ mesmo resultado (já verificado pelo `balance.js`).
- **Passos pequenos:** investigar → explicar → listar arquivos → menor mudança suficiente → `./scripts/check.sh` →
  regressões → memória e docs → limitações. Não juntar refatoração, balanceamento e funcionalidade nova numa entrega.
- **Nada fictício:** sem botão sem ação nem tela que pareça pronta; o que depende do futuro aparece como indisponível
  (como a vitrine "em breve").
- **Documentação:** reaproveitar `docs/memoria/` (decisões, bugs, estado) e o GDD; criar documento novo só com
  necessidade real.

## 5. Fases

As fases deste roadmap se encaixam nos **blocos do GDD §8.7** e nas **etapas do `docs/cronograma.md`**, que continuam
sendo a ordem oficial.

| Fase | Nome | Resultado | Onde já está no projeto |
|---|---|---|---|
| 0 | Auditoria | mapa confiável e plano | **feita em 2026-11-25** (`docs/auditoria/`) |
| 1 | Núcleo confiável | verificação rodando em qualquer máquina, save seguro, docs alinhados, decisões de design em aberto resolvidas | `docs/auditoria/plano-fase-1.md` (proposta) |
| 2 | Qualidade visual e experiência | tutorial, som, estábulo como vitrine, HUD por prioridade, celular, clima legível | direção de arte (GDD §8a) e MVP do cronograma (etapa 1: tutorial e som) |
| 3 | Balanceamento e economia | respostas por dados, fontes e gastos de Ouro quantificados, perfis de jogador | `balance.js` (já existe), metas E1–E6, GDD §8.3 |
| 4 | Conteúdo | captura, expedições, preparação, aluguel, missões, despertar | GDD §8.1, §8.3, §9+; blocos 2 e 5 |
| 5 | Preparação para o online | servidor que simula, seed escondida, hora do servidor, contas, ids e auditoria | `cronograma.md` etapa 4 e "O que o servidor precisa ter" |
| 6 | Online, mercado e lançamento | PVP assíncrono, ranqueada, loja de Gemas, mercado em Ouro, social | blocos 6 e 7; etapa 5 |

O teste fechado no Play (12 testadores por 14 dias) sai **com o jogo offline**, entre as fases 2 e 3 (decisão de
2026-11-10 no cronograma).

### Fase 1 — Núcleo confiável

Detalhe e tickets em `docs/auditoria/plano-fase-1.md`. Em resumo:
- `check.sh` passando inteiro também no Windows (build reprodutível, moldes, Playwright).
- Save: cópia antes de migrar, aviso de descarte e de armazenamento ausente, exportar/importar.
- GDD e memória alinhados ao código.
- Decisões pendentes: uso das Gemas, estratégia antes da corrida (Preparação), regra do clima, sequência dos ginásios,
  sentido da regra das insígnias, papel da Sorte.
- Preparar o domínio para o servidor extraindo, sem mudar comportamento, a regra que hoje está no `game.js`.

### Fase 2 — Qualidade visual e experiência

- **Cavalos:** corrigir os defeitos aceitos dos moldes (pele do jóquei, pendências 2a) num lote aprovado; avaliar trote e
  um galope mais intenso (10–12 quadros) só depois de validar um cavalo-base. Não produzir variações em massa antes.
- **Estábulo:** vitrine do cavalo, linhagem legível (nome atual e `#n` dos pais), abas em vez de tudo de uma vez.
- **Corrida:** HUD em três pesos (essencial: posição, progresso, estamina; estratégico: clima, piso, elemento, skills;
  eventos); o vento só visual não pode parecer regra; feedback sempre tirado de `sim.events`.
- **Clima:** matriz de legibilidade por condição (contraste, partículas, névoa), dentro do orçamento de desempenho do
  `docs/arte/guia.md`.
- **Celular:** já há escala inteira e modos compacto/baixo; seguir as pendências do `bugs.md`.
- **Tutorial curto e jogável** e **som com volume e mudo** (MVP do cronograma).

### Fase 3 — Balanceamento e economia

O simulador já existe (`balance.js`). Falta:
- responder por dados, sem presumir: a build equilibrada domina? a Sorte tem papel? há skill, elemento ou raridade
  obrigatórios? cavalos de raridade baixa continuam úteis?;
- mapear e medir **todas** as fontes e gastos de Ouro (inventário em `docs/auditoria/sistemas.md` §4), incluindo o
  treino sem entrada e o Ouro que os bots "pagam";
- perfis de jogador (casual, frequente, competitivo, criador, AFK) e tempo até os marcos;
- sinks com propósito (o GDD §8.3 já lista as portas de saída).

Equipamento **só entra no balanceamento do AFK**, enquanto essa for a regra.

### Fase 4 — Conteúdo

Prioridade sugerida, a confirmar:
1. **Preparação** (GDD §8.1), se for a resposta da decisão sobre estratégia.
2. **Captura de selvagens**: os dados e a vitrine "em breve" já existem; chances, custos e regras precisam de spec. Deve
   complementar o cruzamento, não substituí-lo, e é o caminho natural para o despertar do Mítico.
3. **Expedições** por bioma (cronograma, roteiro 5), com decisões reais de atributo e elemento.
4. Aluguel, missões, cruza com relógio (blocos 5).
5. Depois: profissões e coleta, cuidados e vínculo (não estão no GDD: seriam propostas novas), campeonatos e temporadas,
   maestria depois do nível 50 (sem progressão infinita de status).

Regiões pequenas e bem feitas, nada de mundo aberto grande.

### Fase 5 — Preparação para o online

Já descrito em `cronograma.md` ("O que o servidor precisa ter"):
- a seed nunca vai ao cliente antes do resultado; cada sorteio com domínio próprio;
- cavalo e equipamento montados no servidor a partir de ids guardados lá;
- resultado guardado com `simVersion` e `tuningHash`;
- hora oficial do servidor para diária, loja, revanche e AFK offline;
- operações econômicas atômicas e idempotentes, com registro;
- determinismo conferido entre o motor do servidor e o do cliente.

Escolha de tecnologia (Supabase ou outra) só depois disso: a simulação precisa rodar num lugar confiável.

### Fase 6 — Online, mercado e lançamento

- **PVP assíncrono** com "fantasmas" e **ranqueada por temporada** (roteiro do cronograma).
- **Mercado só em Ouro, no modelo do GDD §8.4** (anônimo, preço em faixa, taxa da casa, sem troca direta), escolhido
  para limitar lavagem de Ouro e o risco de classificação como jogo de azar. Item anunciado fica bloqueado; compra e
  transferência atômicas; taxa definida por simulação. A spec precisa resolver a tensão com "o Ouro não se transfere
  entre contas" (`cronograma.md:69`).
- **Loja de Gemas** respeitando a regra que for decidida na Fase 1 e o checklist legal do cronograma.
- Social, rankings separados por objetivo, guildas.

## 6. Definição de pronto

Uma entrega só está pronta com: implementação funcional, `./scripts/check.sh` verde (e o `balance.js` completo quando
mudar número de regra), regressões verificadas nos sistemas dependentes, `docs/memoria/` atualizada, limitações
registradas, arquivos alterados listados e o próximo passo sugerido.

Parar e pedir decisão quando: regra documentada contradiz o código e a escolha muda o jogo; a mudança pode invalidar
saves; exige migração estrutural; depende de serviço externo não escolhido; exige rebalancear; ou não há evidência
para saber o comportamento esperado.

## 7. O que mudou em relação ao roadmap original

- A **Wiki** deixou de ser fonte independente: é gerada do código. A comparação principal virou **GDD × código**.
- Os documentos novos propostos (`decisoes-tecnicas.md`, `problemas-conhecidos.md`, `regras-de-gameplay.md` e outros)
  **não foram criados**: já existem `docs/memoria/decisoes.md`, `bugs.md` e o `CLAUDE.md` §8. A auditoria ficou em
  `docs/auditoria/`.
- O **simulador de balanceamento** da Fase 3 já existe (`balance.js`).
- A visão "MMORPG com mercado global estilo Albion" foi trocada pela do GDD: **PVP com aposta de Ouro**, hub social e
  mercado só em Ouro no modelo Black Desert.
- **Equipamento** saiu das variáveis da corrida: só vale no AFK.
- Os **atributos** foram conferidos no código (Velocidade, Aceleração, Manobra, Força, Estamina, Garra, Sorte), assim
  como os **ginásios** (Fornalha, Remanso, Capoeira, 5 etapas). "Prado das Palmeiras" é um dos 8 nomes de pista; a pista
  do PVP sai da seed.
- A "**Prévia Galope Animado**" é a amostra de animação ambiente em `prototype/arte/animacao.html`, independente do jogo
  (`docs/auditoria/sistemas.md` §6). O vídeo não foi analisado.
- A Fase 1 começa pela **verificação confiável** (o `check.sh` não roda inteiro no Windows) e pelas **decisões de design
  em aberto**, antes de animação e conteúdo.
- As fases foram ligadas aos **blocos do GDD §8.7** e às **etapas do cronograma**, que seguem sendo a ordem oficial.
- Itens do original sem base no projeto (profissões, cuidados e vínculo, maestria) ficaram como **propostas** na Fase 4.
