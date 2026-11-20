# Estado do projeto

_Atualizado em 2026-11-20._

**Em andamento (2026-11-19):** redesenho das skills (100% de ativação + ranks que sobem com Ouro e um item ganho
jogando), spec (`docs/superpowers/specs/2026-11-19-skills-ranks-design.md`) e plano
(`docs/superpowers/plans/2026-11-19-skills-ranks.md`) aprovados; implementação no chat "Habilidades: implementação (ranks)",
Fable 5.2, branch `claude/skills-ranks`, com revisão final no chat de coordenação antes da `main`; o teste de engine web × Godot 4 num chat próprio
(`claude/teste-engine`); e a direção de arte noutro (`claude/direcao-de-arte`): guia aprovado em 2026-11-20 (`docs/arte/guia.md`, pesquisa em `ferramentas.md`, custos em `custos.md`); **amostra da corrida no Cerrado publicada (versão 2, com a interface de hoje e a câmera mais rápida, depois do retorno do Vinicius)** em https://claude.ai/artifact/VnjQHdXSZ1cP45e9xCVsi2 (`prototype/arte/corrida-amostra.html`, gerada por `node prototype/tools/arte-amostra-build.mjs`; assets em `prototype/assets/arte/`, script pago `prototype/tools/arte-amostra.mjs`). Gasto até agora: 6 gerações do PixelLab e US$ 1,96 da Retro Diffusion. Amostra aprovada em 2026-11-20; **plano em 9 etapas** em `docs/superpowers/plans/2026-11-20-direcao-de-arte.md` (~930 gerações e ~US$ 12–15 previstos; as etapas que tocam `prototype/src/` esperam as skills com ranks entrarem na `main`). Plano e regiões aprovados em 2026-11-20 (interface por código). **Etapa 0 pronta**: `arte-check.mjs` (no `check.sh`, etapa 5), `folha-arte.mjs`, `arte-regioes.mjs` (`--finalizar` e as fases pagas), `rd-comum.mjs`, manifesto `prototype/assets/arte/regioes.json`, finais do Cerrado em `prototype/assets/arte/cerrado/`. Gasto total: 6 gerações do PixelLab e US$ 2,08 da RD (saldo US$ 2,92). Fase 1 das 4 regiões gerada em 2026-11-20 (8 gerações + US$ 1,60; folhas em https://claude.ai/artifact/94uGAXsg6DtMpk1mcFbkPL): boas os 4 horizontes, os coqueiros do Litoral, o junco da Várzea e o capim do Planalto; falharam a mata da Várzea, a caatinga e a cana do Sertão e as araucárias do Planalto. Refação (fase 1b, US$ 1,00) e fase 2 (US$ 2,24, depois da recarga de US$ 5 do Vinicius) feitas: **as 5 regiões têm as 5 camadas finais** (`prototype/assets/arte/<regiao>/`, 25 camadas no `arte-check`), e a amostra ganhou o seletor de região (versão 4). Pendência: a arquibancada do Sertão saiu sem torcida (refação de US$ 0,20 se o Vinicius quiser). Saldo RD US$ 3,08; PixelLab 1.525. **Esperando a aprovação visual das 4 regiões novas.** As etapas 1 e 2 (código) esperam as skills com ranks na `main`. Decisões em `decisoes.md` (2026-11-19).

**Fase:** Protótipo, a caminho do MVP. **Ainda não é hora de publicar no Play**; o caminho, as
durações e o checklist estão em `docs/cronograma.md`. **Tecnologia decidida (2026-11-10):** o
protótipo vira o jogo, a mesma base web empacotada para Android, com os módulos de regra no servidor.

## Onde estamos
- **Branches:** a `main` tem tudo até o bloco 1b, a Visuais 2 até a parte 3, a frente de itens, mochila, loja e
  recompensa diária e os **ginásios da Expedição** (`claude/cavalos-v3` integrada em 2026-11-14, `claude/visuais-2` em
  2026-11-16, `claude/itens-loja-diaria` em 2026-11-17 e `claude/nifty-newton-e8u133`, a dos ginásios, em 2026-11-18, as
  quatro por fast-forward). O Vinicius escolheu integrar antes de jogar: as listas "A confirmar com o Vinicius (gosto,
  3a)", "(gosto, 3b)", "(gosto, 3c)", "(gosto, itens)" e "(gosto, ginásios)" continuam abertas e viram ajustes por cima
  da `main`. Os pedidos de 2026-11-18 (corrida 50% mais longa, informações da aba Skills e a curva com as pontas mais
  altas) entraram na `main` no mesmo dia, também por fast-forward, e depois deles o Recomeçar do DEV pela escolha do cavalo
  e a tela de desafio do ginásio (com a arte dos 15 oponentes). Em aberto: a `claude/empacotamento` (em pausa, só com as decisões iniciais; volta como bloco 3). Trabalho
  novo sai da `main`.
- **Onde jogar** (artefatos privados do claude.ai; republicar depois de cada build; os três foram republicados em
  2026-11-18 com o build 3b26519, o da integração dos pedidos do dia: jogo na versão 10, DEV na 8 e wiki na 9; no mesmo
  dia, jogo e DEV de novo com o build 53e4ced, o da tela de desafio do ginásio e do Recomeçar do DEV, já na `main`: jogo
  na versão 12 e DEV na 10; o wiki não mudou):
  - jogo de produção, sem modo DEV: https://claude.ai/artifact/MKTKQUYmzBNun92abFzygn (`prototype/dist/jogo.html`)
  - build de teste com modo DEV: https://claude.ai/artifact/LiMr2cM7FRgFZqJ6dFHPhU (`prototype/dist/jogo-dev.html`)
  - wiki: https://claude.ai/artifact/Bp47f9qE3tSswu1A9zdF2y (`prototype/dist/wiki.html`)
  - no computador: `prototype/dist/preview.html` (com `?dev=1` para o modo DEV).
- **Modo DEV:** save separado (`galope-elemental:dev`), gaveta "DEV" com Moedas, Itens e dia (mochila; avançar e
  voltar o dia), Ginásios (etapas vencidas de cada trilha, liberar a revanche, zerar), Cavalo, Itens (peças), Próxima corrida (pista, clima, vento, skills sempre) e Perfil ("Zerar perfil de teste" volta à Brasa). Nunca toca no save
  real. O "Recomeçar com outro inicial" do Perfil (👤) volta à escolha do cavalo inicial nos dois builds (no DEV desde
  2026-11-18; antes voltava direto à Brasa).
- **Verificação:** `./scripts/check.sh` em 8 etapas termina em `VERIFICAÇÃO COMPLETA: OK` (178 testes de simulação, 117 de
  efeitos, 172 de moldes, 759 conferências do wiki, 111 metas de balanço no modo rápido e 300 no completo, e 71 blocos do
  teste de interface; contagem de 2026-11-18, na `main` com os ginásios integrados; com os pedidos do mesmo dia, 179
  testes de simulação, 118 de efeitos e 72 blocos). A verificação leva ~12 min (com o
  teste de interface em paralelo desde 2026-11-17; antes dele, ~16 min com menos testes).

## Pronto (o detalhe de cada frente está na spec, em `docs/superpowers/specs/`)
| Frente | Entrega | Spec |
|---|---|---|
| Núcleo da corrida v2 | 7 atributos, 5 raridades, mapa em blocos, clima, Dado da Sorte, skills | `2026-11-06-nucleo-corrida-v2-design.md` |
| Estábulo, Haras e cruzamento | várias montarias, grau, potro pela seed, aluguel e Troca | `2026-11-06-cruzamento-design.md` |
| Equipamentos | 5 slots, 40 peças, melhoria +10, conjuntos, Loja, Pedra Negra | `2026-11-06-equipamentos-design.md` |
| Menu de abas | 4 abas (a Loja fica escondida com o equipamento suspenso), tela da Montaria com sub-abas, Perfil | `2026-11-08-menu-abas-design.md` |
| Visuais | moldes PixelLab recoloridos, 16 ícones, logotipo e capa | `2026-11-08-visuais-design.md` |
| Corrida viva e modo DEV | galope, dado por cavalo, skills visíveis, natureza, curvas, DEV | `2026-11-09-corrida-viva-design.md` |
| Wiki | `docs/wiki.md` e `prototype/dist/wiki.html` gerados do código | — |
| Cavalos v3, bloco 1 | genética visível, pontos livres e estrelas, skill de tipo por terço, pistas sem extremos, iniciais Comuns, save v5 | `2026-11-10-cavalos-v3-status-e-tipo-design.md` |
| Cavalos v3, bloco 1b | crescimento livre: pontos comprados com custo por faixa até 150, física linear, skill de tipo que multiplica, equipamento suspenso, save v6 | `2026-11-12-crescimento-livre-design.md` |

## Pente fino de 2026-11-10
Seis auditorias (regras, interface e save, desenho, balanceamento, arquivos, normas do Play), com as
correções; os motivos estão em `decisoes.md` e o veredito das normas em `docs/cronograma.md`.

## Bloco 1 dos cavalos v3 (2026-11-11)
Plano em `docs/superpowers/plans/2026-11-11-cavalos-v3-bloco-1.md`, oito tarefas; regras em `docs/GDD.md`
§3, §4, §6 e §7, números no wiki, medições em `docs/exemplos.md`, decisões em `decisoes.md`.
- **Regra:** status = genética (0–31, nota C a S) + crescimento por nível + pontos livres (até 34% num
  status), estrelas multiplicando os pontos (limite de 34% e crescimento por nível: substituídos pelo 1b, ver a seção
  do bloco 1b); sai o bônus fixo do tipo e o Neutro; skill de tipo sempre ativa num terço (agora multiplica: 1b); pistas de 1.400 a 2.000 m com curva e subida; equipamento com valores menores;
  Poder, bots e ligas recalculados.
- **Telas:** build na aba Status (rascunho, Confirmar, Desfazer), vaga do tipo na aba Skills, selo de
  nível e barra de XP, escolha do inicial, animação da skill de tipo e terços no minimapa.
- **Save v5** com migração do v4 (pontos devolvidos para distribuir, Neutro convertido).
- **Balanço:** as 126 metas do `balance.js` completo passam (números superados pelo 1b: ver a seção do bloco 1b).
- **Revisão final (2026-11-11):** fechou a trava do páreo aberto (a sala guarda o retrato dos pontos,
  R16), o valor da peça na tela (meio ponto por melhoria, como na simulação) e o aviso de pontos livres
  ao subir de nível.

## Bloco 1b, crescimento livre (pronto em 2026-11-13, na `claude/cavalos-v3`)
Spec em `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`, plano em
`docs/superpowers/plans/2026-11-13-crescimento-livre.md`; regra em `docs/GDD.md` §3, §4, §7 e §8.5; medições em
`docs/exemplos.md`; decisões em `decisoes.md` (2026-11-13).
- **Regra:** nada cresce sozinho; status = base (raridade + genética) + pontos comprados, com custo +1 a cada 10 pontos
  no mesmo status e teto único de 150; pontos por nível por raridade e estrelas; física da corrida linear até 150; Sorte só
  de nascimento (Dado em (Sorte − 40)/40); skill de tipo multiplica os dois status do tipo; bots e "Distribuir sugerido" pela
  mesma build por pesos; Poder e ligas sem equipamento.
- **Telas e save:** abas Status (+1/+5/+10, custo do próximo ponto, Redistribuir) e Skills (efeito em pontos), selo do
  Estábulo com os pontos que sobram, explicações "ⓘ"; equipamento e Loja suspensos (peças guardadas); save v6 que devolve
  os pontos, com aviso único; Rédea nova só pela gaveta DEV.
- **Verificação:** `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK` (129 testes de simulação, 104 de efeitos, 161 de moldes, 615 conferências do wiki, 87 metas no balanço rápido, interface); o `balance.js` completo passa as 165 metas. Capturas oficiais de `prototype/screens/` regeneradas (a da Loja, `final-09-loja.png`, saiu: a tela está escondida).
- **Revisão final da branch (2026-11-14):** código aprovado; uma rodada corrigiu textos do ⓘ (Poder e liga), o texto de
  equipamento do wiki, o comentário do `GEAR_ON`, o ⓘ de Poder e liga na aba Correr e a memória; `check.sh` OK em 9115ddf.
  Jogo, DEV, wiki e o build "Galope Ícones DEV" republicados com esse build em 2026-11-14.
- **Ainda não testado por gente:** os números saíram de simulação; a corrida mudou de sensação (mais curta).

## Visuais 2, parte 3a: acabamento da interface (pronta em 2026-11-14; integrada na `main` em 2026-11-16)
Spec em `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md`, plano em
`docs/superpowers/plans/2026-11-14-interface-acabamento.md`; decisões em `decisoes.md` (2026-11-14); `docs/GDD.md` (arte).
- **O que mudou:** fontes Press Start 2P e Jersey 10 embutidas no jogo (com o Google Fonts de reserva); painéis com
  rebites, títulos em placa de madeira, saldo como placar, avisos e moldura nos retratos; botões com bisel em três tons
  (e o ouro), opções, abas, barras com sulco, selos e ⓘ desenhado em pixel; a fonte display só em 8, 16 ou 24 px. Sem
  `border-image` (linhas por sombra, peças de pixel por cima). Nenhuma regra, número ou texto do jogo mudou.
- **Folha da interface** (todos os componentes, `prototype/dist/interface.html`): https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR
- **Verificação:** `./scripts/check.sh` OK (129 simulação, 104 efeitos, 170 moldes, 615 conferências do wiki, 87 metas no
  balanço rápido, interface; `jogo.html` 841,9 KB, fontes e peças 35,0 KB). Alturas a 360 px: Estábulo 1320 e Status 1940
  (limite de +4% sobre 1284 e 1894). Capturas oficiais de `prototype/screens/` regeneradas (31 imagens, nenhuma nova nem removida).
- **Publicação (feita):** a folha da interface https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 3) e o build de
  teste com o modo DEV https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 9), os dois com o build 341eb4c (o fim da 3a),
  publicados depois da Tarefa 3 e republicados depois da Tarefa 5, sem esperar resposta. Os artefatos oficiais foram
  republicados em 2026-11-16, com a integração na `main`.
- **Tamanho do jogo:** `jogo.html` de 813.461 B para 862.145 B (+47,5 KB, acima dos ~45 KB da spec §9; 5,6 KB são
  comentários do CSS).
- **A confirmar com o Vinicius (gosto, 3a):**
  - barras mais finas (preenchimento de 12 para 8 px e XP de 10 para 6 px);
  - saldo do cabeçalho em 16 px (o logotipo encolhe a partir de 5 dígitos: 122 para 98 px com 999.999);
  - Poder da largada em 16 px;
  - retrato sem a sombra projetada;
  - hover do botão de perigo mudando o fundo;
  - rebites do pote da corrida, em tela baixa ou paisagem, lidos como dois-pontos ("¦POTE … 400¦"); cada item uma linha.
- **A confirmar com o Vinicius (gosto, 3b):**
  - linha do Estábulo com 3 linhas de texto (~96 px, a spec dizia ~88);
  - plaquinha "Ativa" na borda de cima da linha;
  - Poder do rascunho ("Poder A → B") na barra presa, não no topo;
  - "Tornar ativa" dourado na ficha (some na ativa);
  - aba Status com ~1.455 px (teto do teste 1.470) em vez dos 1.200 px da spec aprovada (a cabeça com o retrato grande se repete em cima e a
    conta não fecha); meta nova: com as abas no topo, os 7 status inteiros numa tela;
  - "Genética" no topo da aba Status; custo "·N" embaixo do valor;
  - a barra presa não pega toque por ~0,4 s ao aparecer e por ~0,4 s depois do 1º toque no Confirmar (contra toque acidental).
- **Para depois (a 3c não mexeu):** o `::before` da `.opcao` escolhida já está ocupado pelo destaque; o bloco de
  `box-shadow` do botão se repete em `.btn`, `.app-aba`, `.capacete-btn` e `.montaria-linha` (4 cópias; dá para trocar por
  propriedades). As três pendências da 3b (o motivo repetido, a lista que pulava e a plaquinha "Ativa" nas cores forçadas) e
  o ordinal sem `.sr` na narração da corrida foram fechados na 3c (seção abaixo).
- **Pendências menores da 3a:** sem hover/apertado nas abas da barra de baixo; "ç" de Expedição encostado no bisel.

## Visuais 2, parte 3c: tela da corrida (pronta e integrada na `main` em 2026-11-16)
Spec em `docs/superpowers/specs/2026-11-15-tela-da-corrida-design.md` (aprovada pelo Vinicius), plano em
`docs/superpowers/plans/2026-11-16-tela-da-corrida.md`; decisões em `decisoes.md` (2026-11-16, as dele e as da execução);
`docs/GDD.md` §5. Com ela, a frente "interface" (3a, 3b, 3c) ficou completa e entrou na `main` em 2026-11-16, por escolha
do Vinicius, antes de ele jogar; a lista de gosto abaixo continua aberta.
- **O que mudou:** faixa de ordem embaixo da pista (todos os corredores em ordem, e quem vem logo à frente e logo atrás, com
  a distância); narração em caixa de altura fixa (cada frase em até 2 linhas, sem "…"; em tela baixa, uma frase em uma linha, que pode
  cortar com "…"); Dado da Sorte numa faixa grande na
  pista, com o número de cada corredor na faixa de ordem, revelados só quando os dados param; faixa do lugar na chegada;
  nome inteiro das skills dos rivais nas plaquinhas quando a plaquinha cabe na pista (perto da borda direita, um balão mais
  velho do mesmo cavalo que voltaria para cima do nome não é desenhado: em `final-12-dado.png` a da raia 6 sai "CASCO FIRME"
  inteira); contorno e bisel no painel do topo; resultado numa tela, com as abas
  Chegada e Momentos e o 1º lugar maior no pódio; as três pendências da 3b (motivo repetido, lista que pulava, "Ativa" nas
  cores forçadas). Nenhuma regra, número ou texto de regra mudou.
- **Medidas antes → depois** (modo DEV, densidade 2):
  - corrida a 360×780 (7 corredores): pista de 540 para 464 px; faixa de ordem 68 px; narração 66 px (igual);
  - corrida a 360×640 (tela baixa): pista de 400 para 398 px, sem o layout compacto; faixa de ordem 28 px (uma linha);
    narração de 66 para 33 px (uma frase);
  - a lista da faixa de ordem é reescrita no máximo 4 vezes por segundo (medido: 2 em 2 s em x2); pior quadro com 3.905
    chamadas de desenho para o limite de 4.500 (limite sem mudança), ~1,04 ms de JS por quadro;
  - resultado a 360×780 (7 corredores): página de 2.468 para 1.481 px (teto do teste 1.500); fim das abas em 732 px (janela
    de 780); linha da tabela de 77 para 66 px; pódio 336×172 px, 1º na escala 3 e 2º/3º na escala 2;
  - Confirmar travado (pendência da 3b): a barra presa ia de 165,75 a 257,5 px no toque, agora fica em 165,75 px; o +1
    tocado na linha de baixo ia de 419,5 para 345 px, agora de 419,5 para 419 px.
- **Verificação:** `./scripts/check.sh` OK (129 testes de simulação, 117 de efeitos — eram 104: a 3c acrescentou os das faixas
  novas e das plaquinhas e tirou os 2 da faixa de números antiga —, 170 de moldes, 615 conferências do wiki, 87 metas no
  balanço rápido e o teste de interface). Capturas oficiais de `prototype/screens/` regeneradas (31 imagens, nenhuma nova
  nem removida; 20 mudaram) e de novo na onda de correção da revisão final (19 de 31 mudaram; de propósito, a
  `final-12-dado.png`, com o nome inteiro na plaquinha; o resto são capturas de corrida, que mudam um pouco a cada rodada,
  e a 03, a 04 e a 10 do bloco "menu", que agora fixa o `seedBase`). Folha da interface com a faixa de ordem (normal, com o Dado e em tela baixa) e as abas do resultado
  (seções 4.16 e 4.17).
- **A confirmar com o Vinicius (gosto, 3c):**
  - a faixa de ordem só com a posição e o selo da raia (sem o nome do cavalo nos itens);
  - "colado" no lugar de "+0 m";
  - o momento do Dado: título "DADO DA SORTE" enquanto os dados giram; o vencedor, a narração, o clima do painel e a chuva ou
    a névoa da pista só depois;
  - a faixa do Dado e a do lugar descem para o pé da pista quando cobririam o cavalo dele (raias de cima);
  - o fim da corrida espera a faixa do lugar (2,5 s) antes do resultado;
  - resultado: as frases de enfeite embaixo da manchete saíram (fica só a do pódio sem prêmio); o saldo ao lado do XP; os
    degraus do pódio mais baixos (29/25/21 pixels de arte, eram 35/27/21); os botões lado a lado;
  - no caso "pódio sem prêmio", as abas ficam 42 px abaixo da primeira tela (a meta da primeira tela valia para o caso comum);
  - o motivo que já está na tela é destacado (contorno dourado por 2 s) em vez de repetido;
  - em paisagem, a faixa de ordem ao lado dos controles.
- **Pendências conhecidas:**
  - paisagem (780×360) com 7 ou 8 corredores: os controles da corrida saem da janela de 360 px de altura (o fundo
    deles fica em 374 px em produção com 8; 398 no DEV com 8; 374 no DEV com 7). Já era assim antes da 3c, e a faixa de ordem não piora; cabem produção com até 7 e DEV com até 6;
  - nas cores forçadas, o selo "Nv N" da linha do Estábulo continua sem contorno (só aparência);
  - `final-10-expedicao.png` muda a cada rodada completa do teste de interface sem a interface ter mudado: só a área dos
    retratos dos cavalos selvagens (de (152, 748) a (704, 1394) na imagem), porque as faíscas da raridade e o "idle" dos
    retratos andam no relógio real. O saldo e o XP já não mudam (seed fixa); não se congela a animação;
  - ajustes pequenos que a revisão final leu e deixou ficar (casos raros ou sem efeito na tela): com um dono de nome
    muito largo, a tabela da chegada pode rolar de lado dentro da própria caixa; a faixa no pé da pista pode cobrir
    a etiqueta de um rival de baixo que esteja fora da tela; o destaque do motivo procura a frase só pelo texto (um texto
    escondido igual seria escolhido); a altura do pé do cavalo no pódio (`HORSE_PE`) está escrita como número fixo; e os
    testes de tempo real da corrida (limite de 320 ms no da faixa de ordem, 2,4–2,7 s no da faixa do lugar) são o primeiro
    lugar a olhar se o `check.sh` falhar de vez em quando numa máquina carregada.
- **Publicação (feita em 2026-11-16, com o build b78e58e, o fim da 3c):** a folha da interface
  https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 6) e o build de teste com o modo DEV
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 12). Os artefatos oficiais (jogo, DEV e wiki, em "Onde jogar")
  foram republicados no mesmo dia, depois da integração na `main`, com o build e9460f4.

## Itens, mochila, loja e recompensa diária (pronta e integrada na `main` em 2026-11-17)
Spec aprovada pelo Vinicius em `docs/superpowers/specs/2026-11-16-itens-loja-diaria-design.md`, plano em
`docs/superpowers/plans/2026-11-16-itens-loja-diaria.md` (6 tarefas); regra em `docs/GDD.md` §8.2 e §8.2a; números no
wiki (seção "Itens e recompensa diária"); decisões em `decisoes.md` (2026-11-16 e 2026-11-17). **Integrada na `main` em
2026-11-17 por decisão do Vinicius, antes de ele jogar: a lista de gosto abaixo continua aberta e vira ajuste por cima da `main`.**
- **O que entrou:** os cinco itens (Torrão de açúcar, Estrela de treino, Rédea nova, Cupom de troca de skill e Manual de
  doma); a aba **Loja** de volta como 5ª aba, com as partes Comprar (só Ouro: Torrão 120, 2 por dia; Manual 200, 1 por dia;
  Cupom 250, 1 por dia; Estrela 2.000, 1 a cada 7 dias) e Mochila (até 99 de cada; Rédeas até 999); o uso pela Mochila e
  pela ficha do cavalo (Torrão e Estrela na aba Status; Manual e o Trocar do Cupom na aba Skills); a recompensa diária num
  cartão no topo do Estábulo, com um ponto na aba Estábulo enquanto há prêmio (7 dias: 60 de Ouro · Torrão · 100 de Ouro ·
  Manual · 150 de Ouro · Cupom · 200 de Ouro e Rédea nova; a cada 4 calendários, também uma Estrela). Save na versão 7,
  com a proteção contra save de versão mais nova (não é adotado nem gravado por cima). Os números ficam em
  `GameData.ITEMS` e `GameData.DAILY` (`prototype/src/data.js`). A Rédea nova passa a vir jogando (7º dia da diária).
- **Verificação:** `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK` (158 testes de simulação, 117 de efeitos,
  171 de moldes, 651 conferências do wiki, 87 metas no balanço rápido e o teste de interface; contagem de 2026-11-17, na
  cabeça `fb10d22`, depois da revisão final e da onda de correção; hoje leva ~16 min). O `balance.js` completo rodou em
  2026-11-17 (279 s): as 165 metas passam, sem mudança (os bots não usam itens; a onda de correção não mexeu em número).
  Capturas oficiais de `prototype/screens/` regeneradas, com quatro novas: `final-20-loja.png`,
  `final-21-mochila.png`, `final-22-diaria.png` (o Estábulo com o cartão grande) e `final-23-ficha-itens.png` (aba Status
  com "Usar Torrão de açúcar" e "Usar Estrela de treino"). Folha da interface com o produto da loja, a linha da mochila e
  o cartão da diária (seções 4.18 a 4.20).
- **Revisão final (2026-11-17):** a branch inteira foi revista depois das 6 tarefas. Nenhum defeito grave: Ouro e itens
  não duplicam nem somem (duas abas, recarregar no meio, gravação falhando), nada é sorteado antes de confirmar e nenhum uso
  de item muda a corrida já aberta. Uma onda de correção fechou o que faltava: frases velhas no GDD e no wiki, quatro
  testes de regras de Ouro, a tela que se atualiza quando o dia vira com o jogo aberto, o limite por dia tirado do catálogo
  e o dia estragado gravado já consertado. O que ficou para depois está em `bugs.md` ("Itens, loja e diária").
- **Publicação (feita em 2026-11-17, build `fb10d22`):** build de teste com o modo DEV
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 13) e a folha da interface
  https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 7). Os artefatos oficiais (jogo, DEV e wiki, em "Onde jogar")
  foram republicados com a integração, no mesmo dia.
- **A confirmar com o Vinicius (gosto, itens):**
  1. **Ícone da Rédea nova:** pouco reconhecível. Os cinco ícones de item são desenhos em código (16×16), sem créditos.
     Existe o `item-redea.png` do PixelLab, já pago em 2026-11-12 e guardado: trocar custa zero créditos, é só decidir.
  2. **Loja, texto do limite:** "Restam N de M hoje"; na Estrela, em quantos dias ela volta.
  3. **Loja, ordem dos produtos:** fixa (Torrão, Manual, Cupom, Estrela), e não por preço.
  4. **Loja, botão quando não dá para comprar:** "Limite de hoje", "Reservado", "Sem Ouro" ou "Mochila cheia". Não há
     botão ⓘ por item: a explicação é a linha de descrição do próprio produto.
  5. **Loja, aviso de compra:** fica na linha do produto até trocar de parte.
  6. **Ficha, aba Status:** "Usar Torrão de açúcar" e "Usar Estrela de treino" ficam dentro do bloco do Redistribuir e
     só aparecem com o item na mochila; com os dois, a aba fica 116 px mais alta.
  7. **Confirmação do Manual de doma:** mostra a chance (35%) e avisa que o manual é gasto mesmo se o cavalo não aprender;
     o resultado só é sorteado depois do "Confirmar".
  8. **Outra aba no meio de um uso de item:** a tela fica onde está, é atualizada com o progresso mais recente e
     confere tudo de novo (antes voltava ao Estábulo).
  9. **Diária, altura:** com prêmio para resgatar, o Estábulo de 3 cavalos não cabe mais numa tela (836 px numa tela de
     780; 860 no dia da Estrela); com a diária resgatada mede 780. Com 6 cavalos: 1.172 com prêmio (1.196 no dia da
     Estrela; limite 1.210) e 1.076 resgatada.
  10. **Diária, depois de resgatar:** o cartão vira uma linha com o prêmio de amanhã, sem "Ver os 7 dias" (os sete dias só
      se veem quando há prêmio para resgatar).
  11. **Diária, arranjo do cartão grande:** o "N / 7" abre a linha do prêmio (no esboço da spec ficava na linha do título)
      e o prêmio vai só em texto, sem ícone — o ícone fazia o prêmio mais longo passar do limite de altura.
  12. **Ponto na aba Estábulo:** só visual, como o da aba Correr (sem texto para leitor de tela).
  13. **Jogo aberto de um dia para o outro:** deixe o jogo aberto, volte à aba no dia seguinte: o cartão da diária e a
      loja têm de se atualizar sozinhos. Se o dia virou e você toca na tela antes, ela se atualiza e esse toque não vale
      (toque de novo).
  14. **Números de partida da economia:** os preços da loja, os 35% do Manual e os prêmios da diária são para você
      ajustar jogando (ficam juntos em `prototype/src/data.js`).
- **Pendências aceitas:**
  - **Relógio para a frente:** adiantar a data do aparelho libera a diária e os limites da loja. Sem servidor não há como
    impedir; fica aceito até o online (o Vinicius foi avisado em 2026-11-16). Cada registro guarda o seu último dia (a
    diária, o do último resgate; a loja, o da última compra; a Estrela, o da última Estrela), e voltar o relógio para antes
    desse dia não libera aquele registro. Mas quem mexe no relógio consegue resgates e compras a mais: com o último resgate
    no dia 90, pondo o relógio em 91, 92 … 100, são 10 resgates no mesmo dia real.
  - **Relógio adiantado por engano e depois corrigido:** a diária (e a loja, se comprou no dia adiantado) fica parada até
    passar daquela data, e o cartão diz só "volte amanhã" (escolha da spec §9, sem acusar ninguém).
  - **Nunca abrir um jogo antigo (de antes da versão 7 do progresso salvo) sobre um progresso novo:** o código antigo não
    tem a proteção e apagaria a mochila, a diária e os limites da loja.
  - **Loja de equipamento** (suspensa, `GEAR_ON = false`): quando religada, aparece dentro da parte "Comprar"; esse caminho
    não tem teste ligado.

## Ginásios da Expedição (prontos e integrados na `main` em 2026-11-18)
Spec aprovada pelo Vinicius em `docs/superpowers/specs/2026-11-17-ginasios-design.md` (no fim, as "Notas da execução"),
plano em `docs/superpowers/plans/2026-11-17-ginasios.md` (8 tarefas); regra em `docs/GDD.md` §8.6; números no wiki (seção
"Ginásios da Expedição") e em `GameData.GYM` e `GameData.GYMS` (`prototype/src/data.js`); regras em
`prototype/src/ginasio.js`; decisões em `decisoes.md` (2026-11-17, as dele; 2026-11-18, as da execução). **A frente foi
integrada na `main` em 2026-11-18 por fast-forward, por decisão do Vinicius, depois da revisão final e da correção do que
ela achou; a verificação completa passou na `main` antes do envio. Ninguém jogou ainda.**
- **O que entrou:** na aba Expedição, três ginásios (da Fornalha, do Remanso e da Capoeira), cada um com uma trilha de 4
  soldados e o líder; o preparo (o adversário, a pista da casa, a entrada, o prêmio e o time, na ordem escolhida, até o
  tamanho do time do adversário); a entrada em Ouro cobrada antes de simular; os duelos na tela de corrida, com 2 raias, o
  cartão entre duelos, "Pular" e "Pular tudo"; o cansaço pela distância na chegada; o ponto fraco por elemento (cerca de 4%
  nos status, só nos duelos de ginásio); o resumo; os prêmios da 1ª vitória; as insígnias com bônus da conta (+3% de Ouro
  nas corridas valendo, +3% de XP, +3 pontos na chance de skill por nível); a revanche diária do líder, com o ponto na aba;
  as insígnias no Perfil. Save na versão 8 (a migração da 7 zera os ginásios). Gaveta DEV com o grupo "Ginásios".
- **Verificação:** `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK` (178 testes de simulação, 117 de
  efeitos, 172 de moldes, 759 conferências do wiki, 111 metas no balanço rápido e 71 blocos do teste de interface, em
  ~9 min; contagem de 2026-11-18, na branch, depois da correção da revisão final).
- **Balanço completo** (`node prototype/tools/balance.js`, 2026-11-18, 281 s): **as 300 metas passam**, 135 delas dos
  ginásios (G1 a G9). Medido: G1 (mesmo elemento) 46,1% a 50,9%; G2 4 níveis acima 73,0% a 81,5% e 4 abaixo 15,8% a 32,9%;
  G3 com o ponto fraco 70,3% a 78,2%, em desvantagem 17,2% a 32,3%, e 38,1 a 59,6 pontos entre os dois; G4 (sem a
  vantagem, nível igual) 44,1% a 53,9%; G5 até 7,5 pontos entre os três ginásios; G6 cada faixa do cansaço acontece em
  18,6% ou mais das vitórias (a menor é a apertada da Fornalha); G7 um cavalo sozinho 4 níveis acima vence o
  líder 2,2% a 2,4% (sem o cansaço, 39,5 a 41,3 pontos a mais); G8 um duelo de 75,8 a 84,9 s no relógio da corrida; G9
  determinismo e nada de `Math.random` nem relógio. Os números são os mesmos da tabela que o Vinicius viu em 2026-11-17.
- **Na tela** (medido em 2026-11-18, depois de a corrida na tela ficar 50% mais longa): um duelo leva cerca de 42 s em x1
  e 24 s em x2 (eram 30 s e 18 s); um desafio do líder de 5 duelos, cerca de 3 min 30 s em x1 e 2 min em x2 (sem o tempo
  parado nos cartões).
- **Capturas oficiais:** regeneradas em 2026-11-18 (`node prototype/tools/ui-test.mjs`), com cinco novas:
  `final-24-expedicao-ginasios.png` (a aba com os três cartões: um no meio da trilha, um com a insígnia e "Revanche hoje",
  um do zero), `final-25-trilha.png` (a trilha da Fornalha como abre: no topo, porque a etapa próxima, o Sargento
  Candeeiro, já cabe inteira na primeira tela),
  `final-26-desafio.png` (o preparo com Maré 1º e Brasa 2º, o Ipê apagado e o "Desafiar"), `final-27-duelo.png` (o 1º
  duelo no meio da corrida) e `final-28-resumo.png` (o resumo de uma vitória em 3 duelos). Mudaram também a aba
  Expedição (`final-10`), o Perfil (`final-11`, `final-17` e as duas `marcas-perfil-*`, com as insígnias) e as capturas
  de corrida, que mudam um pouco a cada rodada. Depois, `final-21-mochila.png` foi regravada sozinha (o texto "de onde vem"
  dos itens passou a citar os ginásios).
- **Folha da interface:** seções novas 4.21 (cartão de ginásio), 4.22 (trilha), 4.23 (linha do time) e 4.24 (cartão entre
  duelos); o teste da folha confere que o markup de cada estado é o mesmo que o jogo desenha.
- **Revisão final (2026-11-18):** a branch inteira foi revista depois das 8 tarefas. Nenhum defeito grave nas regras
  (nada é sorteado antes de pagar; a gravação é uma só; a sala aberta e a corrida normal ficam como eram). Três pontos
  foram corrigidos numa rodada única: (1) uma gravação que falhava deixava a revisão do save em memória à frente do
  disco e, com duas falhas numa aba e outra aba pagando no meio, a aba velha podia refazer um desafio já pago (o
  conserto vale para o jogo todo: gravação que falha não muda a revisão); (2) a aba Skills dizia 8% de chance de
  aprender skill mesmo com a Insígnia da Capoeira (o sorteio já usava 11%; agora a tela mostra o mesmo número); (3) o
  teste da sala de treino aberta, que faltava. Também saiu a frase "feche a sala", que mandava fazer o que o jogo não
  tem (hoje: "Corra essa corrida primeiro."). Detalhe em `bugs.md`.
- **Publicação (feita em 2026-11-18, build `d01ca3c`):** build de teste com o modo DEV
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 14) e a folha da interface
  https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 8). Depois da integração, no mesmo dia, os artefatos
  oficiais (em "Onde jogar") foram republicados com o build `c3f9fb1`: jogo na versão 9, DEV na 7 e wiki na 8.
- **A confirmar com o Vinicius (gosto, ginásios):**
  1. **Os cavalos dos soldados e dos líderes** usam o nome e a aparência do cavalo inicial do elemento ("Brasa, Brasa"):
     quer nomes e aparência próprios? (Não mexe na força.)
  2. **Os nomes** dos ginásios (da Fornalha, do Remanso, da Capoeira), dos líderes (Capitã Labareda, Mestre Aguaceiro, Dona
     Capineira) e dos 12 soldados.
  3. **O cansaço e a vantagem:** as faixas em 1 m e 8 m (apertada: menos de 1 m; normal: de 1 a menos de 8 m; folgada: 8 m
     ou mais), o fôlego perdido (25%, 15% e 5%), o teto de 50%, e a vantagem de elemento de "cerca de 4%".
  4. **Quanto tempo leva:** um duelo, cerca de 42 s na tela em x1 e 24 s em x2; um desafio do líder de 5 duelos, cerca de
     3 min 30 s em x1 e 2 min em x2 (já com a corrida 50% mais longa na tela, de 2026-11-18).
  5. **Os cavalos de 3 estrelas do Remanso** (um do soldado 4 e o do meio do líder), postos para o Remanso ficar tão difícil
     quanto os outros.
  6. **A tela não diz quantos duelos faltam:** "Duelo 2", e não "Duelo 2 de 3".
  7. **Textos:** "por menos de 1 m" (abaixo de 1 m), as plaquinhas "Você venceu" e "Você perdeu" no resumo e "Vantagem:
     adversário" quando o cavalo do ginásio é que leva a vantagem.
  8. **O nome do dono no cavalo do adversário:** "Brasa (Sargento Candeeiro)" sempre no cabeçalho do duelo e no cartão; na
     faixa de ordem e na narração, só quando os dois cavalos têm o mesmo nome.
  9. **Depois de uma derrota, a frase do cansaço no cartão fala do adversário** ("Vitória normal (5 m): Brasa (Sargento
     Candeeiro) larga com 85% do fôlego").
  10. **Depois da chegada de um duelo, o botão diz "Continuar"** (na corrida da sala diz "Ver resultado").
  11. **Os metros dos duelos são truncados para baixo** (7,6 m aparece como "7 m"; abaixo de 1 m, "por menos de 1 m"), para
      o número nunca contradizer a faixa do cansaço.
  12. **A trilha abre já rolada** até a etapa que se pode tocar (ou a revanche livre de hoje), e não no topo.
  13. **Com uma sala de treino aberta, o cavalo ativo também não entra no time** (como com a sala valendo).
  14. **No nível máximo, o resumo mostra "+N XP" inteiro**, como a tela de resultado da corrida, embora o XP pare no teto.
  15. **A revanche já fica livre no mesmo dia em que a insígnia é conquistada:** a primeira pode ser feita logo depois de
      vencer o líder.
  16. **A etapa do líder com a revanche de hoje feita** mostra a plaquinha "Feita hoje" e também a frase "Revanche de hoje
      feita. Volte amanhã.".
  17. **A meta G1 fica perto de 50% quase por construção:** o time de referência é o mesmo cavalo do adversário (o inicial
      do elemento, no mesmo nível), então "vence metade das vezes" é esperado; o que a G1 prova é que nada no ginásio
      desequilibra o duelo.
  18. **As metas G2 e G3 foram afrouxadas pela medição** (a spec, §12, dizia que isso se decide com ele): um cavalo 4
      níveis abaixo ainda vence até cerca de 33% das vezes, e um em desvantagem de elemento até cerca de 32% (as duas
      metas eram de no máximo 25% e passaram a no máximo 35%).
  19. **O bônus de Ouro e de XP das insígnias não aparece em nenhuma linha do resultado da corrida:** o jogador recebe
      mais do que a tabela do pote mostra, sem a tela dizer por quê.
  20. **Contra o líder, um cavalo sozinho vence só cerca de 2% das vezes** (mesmo 4 níveis acima): é preciso ter um time.
  21. **Entre times iguais, cerca de 7 em cada 10 desafios do líder vão até o 5º duelo** (70% a 73%, medido na revisão
      final; não está no `exemplos.md`): o desafio do líder quase sempre é longo.
- **Pendências:** os achados pequenos das revisões das tarefas estão em `bugs.md` ("Ginásios da Expedição"); nenhum cobra
  Ouro errado nem dá prêmio duas vezes. Ninguém jogou ainda: os números saíram de simulação.
  - **Para o servidor:** o módulo `ginasio.js` devolver a entrada a cobrar (hoje a tela refaz a conta em `ginEntrada`), e
    os arredondamentos dos bônus das insígnias e as regras do time (sem repetir cavalo, o ativo preso na sala aberta)
    irem para o módulo.
  - **Medir num celular de verdade o tempo do toque em "Desafiar":** o desafio inteiro é resolvido de uma vez, no toque;
    num computador levou de 56 a 92 ms (seis toques no líder, 2026-11-18).
- **Com servidor (bloco 7):** o +3% de Ouro da Insígnia da Fornalha sobre prêmios pagos por outros jogadores cria Ouro do
  nada; rever antes do online.

## Em andamento
- **Teste de interface em paralelo (feito em 2026-11-17, commit `b3dda3d`; na `main` desde o mesmo dia, por decisão do
  Vinicius):** o `check.sh` roda o `prototype/tools/ui-test-paralelo.mjs`, um processo por bloco (68 blocos na `main`, 4 por vez, e os 8
  com medição de tempo depois, um por vez; com os ginásios são 71 blocos, 9 deles em série). A verificação caiu de ~16 para ~8 min (hoje, com os ginásios, ~10 min). A meta de ~5 min não fechou: o que
  falta é a fase em série (~3,5 min) e o bloco `itens` (~1,5 min sozinho). O jeito antigo (`ui-test.mjs` sem `UI_SO`)
  continua igual e é o que regrava as capturas oficiais.
- **Ginásios da Expedição (integrados na `main` em 2026-11-18, com a lista de gosto aberta):** seção própria acima, com
  a lista "A confirmar com o Vinicius (gosto, ginásios)", de 21 itens. Falta o Vinicius jogar e dizer o que ajustar. O
  galope ficou como está (decisão do Vinicius em 2026-11-16).
- **Frente "interface" da Visuais 2 integrada na `main` em 2026-11-16, com as listas de gosto abertas:** a 3c (tela da
  corrida) ficou pronta em 2026-11-16 (seção própria acima, com a lista "A confirmar com o Vinicius (gosto, 3c)"); com a 3a
  e a 3b, a frente está inteira. O Vinicius escolheu integrar antes de jogar; o que ele mudar ao jogar entra como ajuste
  por cima da `main`.
- **Parte 3b da Visuais 2 (integrada na `main` em 2026-11-16; lista de gosto aberta)** (Estábulo e montaria no celular; spec em
  `docs/superpowers/specs/2026-11-15-estabulo-montaria-celular-design.md`, plano em `docs/superpowers/plans/2026-11-15-estabulo-montaria-celular.md`;
  decisões da execução em `decisoes.md`). Estábulo em lista de linhas, ficha com retrato grande e aba Ficha, aba Status em linha
  única com a barra do Confirmar presa, motivo visível no toque e ordinal lido pelo leitor de tela. Alturas a 360×780: Estábulo
  com 3 cavalos de 1.320 para 780 px, com 6 de 2.277 para 1.012 px; Status de 1.902 para ~1.455 px (1.450 a 1.457 conforme a densidade da tela; teto do teste 1.470); ficha com a linha de abas
  inteira na 1ª tela. `check.sh` OK (129 testes de simulação, 104 de efeitos, 170 de moldes, 615 conferências do wiki, 87 metas
  rápidas e o teste de interface). Capturas oficiais regeneradas; folha da interface com a linha nova do Estábulo.
  Já publicado: folha https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 5) e build de teste
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 11), build 2a381ff (o fim da 3b); os dois foram republicados
  depois com a 3c (seção da 3c, acima).
- **Parte 3a da Visuais 2 (integrada na `main` em 2026-11-16; lista de gosto aberta)** (folha, build de teste e a lista
  "A confirmar com o Vinicius (gosto, 3a)" acima).
- **Visuais 2** (branch `claude/visuais-2`, criada da `claude/cavalos-v3`; a parte 1 foi integrada na
  `claude/cavalos-v3` em 2026-11-12, a parte 2a e a 2b em 2026-11-13): três partes, ícones →
  cavalos → interface. **Parte 1 (ícones) pronta na `claude/visuais-2`:** 58 ícones nas telas, na corrida e
  no wiki; 79 gerações (spec em `docs/superpowers/specs/2026-11-12-icones-design.md`). Revisão final da
  branch limpa e `check.sh` OK (598977e). Build de teste num artefato separado:
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch. A confirmar com o Vinicius: selo de liga só onde a
  liga já aparece, e medalhão de raridade também nas peças. **Parte 2 (cavalos)** dividida em 2a (marcas,
  jóquei e raridade, em código), 2b (portes no PixelLab) e 2c (animações). **A parte 2a está pronta e integrada na
  `claude/cavalos-v3`** (spec em `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`): marcas por
  cavalo com 3 genes herdados pela seed, jóquei do jogador no Perfil e raridade em escada, tudo em código e
  sem créditos. **2b (portes) pronta e integrada na `claude/cavalos-v3`** (spec em
  `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`): gene herdado com 3 portes (esguio, padrão, robusto)
  iguais nos três elementos, 12 moldes novos a partir de um corpo-mestre por porte; 155 gerações no lote.
  **2b integrada na `claude/visuais-2` (T7, 2026-11-13):** os 12 moldes dos portes (folha final aprovada) moram em
  `prototype/assets/pixellab/`, os 4 antigos saíram (histórico do git) e o caminho 'legado' do `sprites.js` também;
  `novos/` guarda só o registro do lote (para mexer no lote: `--reprocessar --manter-escolhas` antes, mover os moldes
  depois; cabeçalho do `pixellab-portes.mjs`). As pendências da 2a viraram testes no `moldes-test` ("Portes: moldes
  reais"): critérios aceitos na folha em `ACEITOS_NA_FOLHA`; meias por molde, pele acima do capacete (passa) e brilho
  das raridades. Na revisão da T7 saíram três defeitos: a canela (retrato dos robustos, galope do padrão e dos esguios)
  e o focinho (robustos) que o PixelLab pintou na cor da crina voltaram à pelagem-sombra e ao detalhe (`soltarCrina`,
  1.313 px em 61 quadros, sem custo); o capacete do jóquei sem pele ficou em 4 linhas; e a escala dos retratos é a
  mesma nos 12 moldes em qualquer dpr (o passo sai do molde mais alto). Wiki (seção "Portes"), GDD §6 e memória
  prontos (T8). **Revisão final da 2b feita (2026-11-13), com as decisões do Vinicius:** a escala dos retratos fica
  "todos os portes descem juntos" (com zoom de 125%, todos um passo menores; spec §4 emendada); o **brilho das
  raridades foi corrigido** (a cor se ajusta ao contraste com a crina: as 60 combinações do catálogo ficam ≥ 0,05 de
  luminância, antes 14 ficavam abaixo e a pior, Mágico sobre o Tição, era 0,005; `BRILHO_PENDENTE` vazia); o retrato do
  robusto-folhas com 3 pernas e as 5 frestas de 1 px entre cauda e anca no parado do robusto-ondas ficam aceitos (o
  teste da forma passou a revalidar com o defeito aceito neutralizado, e achou as frestas escondidas atrás do "fora da
  paleta"). **Ficam para a 2c**, medidos e listados no teste (`PENDENTES_2A`): meias que se juntam ou se partem em 5 dos
  24 retratos/parados e a zona da cara variando mais de 20% no galope em 5 moldes.
  **Próxima: 2c (animações novas para todos os portes) — espera a confirmação de créditos do Vinicius** (o `CLAUDE.md` exige
  confirmação explícita antes de gerar).
  **Pendências (Vinicius):** para a 2c, as meias que se juntam ou se partem (5 de 24) e a zona da cara que pulsa no
  galope (5 moldes); estrela de 1 px e listra curta em alguns quadros (`PENDENTES_2A`); no galope do robusto-chamas o
  vermelho do capacete é igual ao da pelagem e o tronco do jóquei sai manchado; a crina do robusto é fina no galope do
  mestre; forma ainda reprovada em crus com laranja > 2% (padrao-ondas, robusto-*), aceitos na folha.

## O que falta
- **Decidido em 2026-11-10:** o teste fechado do Play sai com o jogo offline; o lançamento público
  espera o PVP assíncrono.
- **Blocos 2 a 7 do redesenho** (`docs/GDD.md` §8), cada um com spec própria: preparação com relógio,
  empacotamento (espera a resposta sobre o Capacitor), itens de treino e gastos de Ouro, tempo e
  estábulo ativo, loja de Gemas, online.
- **Redistribuição:** a primeira de cada cavalo é grátis; depois só com a Rédea nova. A Rédea nova vem no 7º dia da
  recompensa diária (frente de itens, na `main` desde 2026-11-17) e, desde os ginásios (2026-11-18), também na 1ª vitória sobre
  cada líder; a Estrela de treino sobe estrela.
- **O Vinicius ainda não jogou o modelo novo:** os números saíram de simulação.
- **Balanço:** M6, M9, P1, S1 e A1 só são vigiadas pelo `balance.js` completo.

### A decidir / pendências do bloco 1b (spec §15)
- **A build equilibrada domina:** é a mais forte (o bot a 60–65% no nível 50; as inclinadas em 44–54%). Mudar a regra
  (custo que para de subir, retorno extra por concentrar) fica para depois de o Vinicius jogar.
- **A sensação da corrida mudou:** mais curta, "Cansou" some, a Garra dispara em 58% das corridas. Olhar a animação no artefato.
  Em 2026-11-18 o Vinicius achou as corridas rápidas demais e a corrida na tela ficou mais longa em dois passos (só a
  animação: de 20–34 s para 25–42,5 s e depois 30–51 s em x1, conforme a distância, mais as câmeras lentas;
  `TELA_S_MIN`/`TELA_S_MAX` no `game.js`).
- **Os iniciais no nível 25 caem para a Prata** (eram Ouro): o meio da progressão ficou mais lento.
- **A Sorte vale pouco** (0,7 p.p. na corrida), por desenho: só de nascimento, mexe no Dado e na chance de skill.
- **A Rédea nova é rara:** vem no 7º dia da recompensa diária e, com os ginásios, na 1ª vitória sobre cada líder; quem
  gastar a redistribuição grátis espera por uma delas.
  (Resolvido em 2026-11-17: a Rédea vem no 7º dia da recompensa diária; desde os ginásios (2026-11-18), também da 1ª vitória sobre
  cada líder.)
- **O Ouro tem menos uso:** a loja de peças some; sobram entradas, cruza e troca do Haras. (Desde 2026-11-17 a loja de
  itens e a diária dão entrada e saída de Ouro.)
- **Folga de ~1 p.p.** nas metas rebaseadas sobre o pior caso de 4 bases de seed; mexer na RNG pede a faixa de novo.
- **Equipamento suspenso:** voltar (talvez como cosmético) e a ferradura de tração do bloco 2 ficam em aberto.
- **Decisões do Vinicius ainda abertas:** o empacotador (a pergunta sobre o Capacitor ficou sem
  resposta) e, de `docs/exemplos.md` §5, o papel da Sorte, o conjunto de 3 peças, o "Cansou", a Garra
  e a zebra.
- **Arte:** crina própria de cada estilo no galope (6 a 10 gerações); retrato, largada e pódio sem
  respiração nem piscar.
- **Galope mais intenso (pedido do Vinicius em 2026-11-16, depois de jogar a parte 3):** a corrida às vezes parece
  trote, e não esforço para vencer. Hoje cada molde tem 9 quadros de galope (`galope-0..8`) e a cadência segue a
  velocidade (`self.gallop` em `prototype/src/game.js`: 13 × velocidade / 17 por segundo, ×1,3 em x2, até 35% na câmera
  lenta). Dois caminhos, ainda sem desenho nem decisão dele: sem créditos, em código (cadência mais alta e ligada ao
  esforço, balanço do corpo, mais poeira e risco de velocidade na reta final); com créditos, na 2c (quadros novos com a
  passada toda estendida e a fase no ar). **Teste feito no mesmo dia, a pedido dele ("as pernas devem ser mais intensas
  e espaçadas"):** página descartável em https://claude.ai/artifact/JUTm5mf3SwbvgDENeVAEeA, com o galope de hoje ao lado
  de uma versão ajustável; medidas, receita do efeito e limites em `docs/memoria/sistemas/galope.md`. Uma passada dura
  0,47–0,57 s em x1 (1,8 a 2,1 por segundo; o galope real fica em 2,2–2,5) e 1,2–1,6 s na câmera lenta. Sugestão do
  teste: ritmo 1,25×, abertura 100%, balanço 1, tempo 40%. **Decisão do Vinicius depois de ver o teste (2026-11-16): o galope fica como está**; nada entrou no jogo, e o assunto só volta com a 2c (quadros novos), se ele quiser.
- **Antes do próximo aumento de versão do save:** pôr uma guarda para save de versão maior que a do
  código (não adotar nem gravar por cima, e avisar para atualizar a página). (Feito em 2026-11-17, junto com o save versão 7,
  na frente de itens.)
- **Pendências menores:** `docs/memoria/bugs.md`.
- **GDD §9+:** expedições, tecnologia do servidor, anti-trapaça, PVP assíncrono e ranqueada.

## Próximos passos
- **Frente de itens (na `main`):** o Vinicius joga nos artefatos oficiais e decide a lista "A confirmar com o Vinicius
  (gosto, itens)"; o que ele mudar entra como ajuste por cima da `main`.
- **Pedidos de 2026-11-18 (na `main` desde o mesmo dia):** feitos: a corrida 50% mais longa na tela; na aba Skills da
  montaria, a chance de cada skill ativar (com a conta: raridade + nível + Sorte), o "Quando" de cada skill e o quadro da
  Garra deste cavalo, tudo calculado pelo `sim.js` e atualizado quando o cavalo melhora; e a curva visível na pista
  (escolha dele: "as pontas mais altas", um arco preso à tela de até 20 px; os cavalos só sobem com o arco, sem
  inclinar). **Feito e na `main` desde o mesmo dia:** a tela de desafio do ginásio ("Cena 2": antes de
  cada duelo, o oponente e o cavalo dele em cima, à direita, o cavalo do jogador embaixo, à esquerda; GDD §8.6), com a arte
  dos 15 oponentes do PixelLab (36 gerações no total; saldo do plano 1665/2000; escolhas em
  `prototype/assets/pixellab/treinadores/escolhas.json`; no build de teste https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch,
  versão 18, com o build 53e4ced). **Esperando o Vinicius:** jogar e dizer se troca alguma das 14
  escolhas do controlador (as candidatas estão na mesma pasta; trocar é mudar um número no `escolhas.json`).
- **Ginásios (`docs/GDD.md` §8.6), na `main` desde 2026-11-18:** o Vinicius joga nos artefatos oficiais e decide a lista
  "A confirmar com o Vinicius (gosto, ginásios)"; o que ele mudar entra como ajuste por cima da `main`.
- **Teste de interface em paralelo:** feito e na `main` (a verificação inteira leva ~10 min com os ginásios); em aberto se vale buscar os ~5 min (dividir o bloco
  `itens` e encurtar a fase em série).
0. O Vinicius joga a 3a, a 3b e a 3c nos artefatos oficiais (jogo, DEV e wiki, republicados com a integração; a folha
   da interface mostra os componentes) e decide as listas "A confirmar com o Vinicius (gosto, 3a)", "(gosto, 3b)" e
   "(gosto, 3c)" (acima); o que ele mudar entra como ajuste por cima da `main`.
1. O Vinicius joga o modelo novo no artefato (jogo, DEV e wiki, com o que está na `main`) e decide os
   pontos de calibração acima; o que ele mudar entra como ajuste por cima da `main`.
2. **2c (animações novas para todos os portes)** da Visuais 2: espera a confirmação de créditos do Vinicius. Leva o
   pedido dele de 2026-11-16: o galope tem de parecer esforço para vencer, não trote ("O que falta", acima).
3. O Vinicius apaga as branches antigas no GitHub (lista abaixo).
4. **Bloco 2, preparação com relógio:** spec, revisão do Vinicius, plano e execução.
5. **Bloco 3, empacotamento:** retomar pela pergunta do Capacitor; o teste fechado começa aqui. Os ginásios (o conteúdo
   offline do teste fechado) estão prontos na branch (seção própria acima).
6. Abrir a conta de desenvolvedor do Play e começar a juntar os 12 testadores (é o que mais atrasa).
7. Blocos 4 a 6 chegam como atualizações durante o teste fechado; o bloco 7 (online) vem depois.

## Branches para apagar no GitHub
Todas já integradas na `main`: `claude/equipamentos`, `claude/cruzamento`, `claude/nucleo-corrida-v2`,
`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`, `claude/menu-abas`,
`claude/visuais`, `claude/corrida-viva`, `claude/pente-fino`, `claude/cavalos-v3`, `claude/visuais-2` (a parte 3
inteira, a frente "interface", entrou na `main` em 2026-11-16) `claude/itens-loja-diaria` (entrou em 2026-11-17) e `claude/nifty-newton-e8u133` (a dos ginásios, entrou em 2026-11-18; é a
branch da sessão que os fez e está igual à `main`). A sessão não consegue apagar branch remota (o proxy bloqueia).
