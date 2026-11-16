# Estado do projeto

_Atualizado em 2026-11-16._

**Fase:** Protótipo, a caminho do MVP. **Ainda não é hora de publicar no Play**; o caminho, as
durações e o checklist estão em `docs/cronograma.md`. **Tecnologia decidida (2026-11-10):** o
protótipo vira o jogo, a mesma base web empacotada para Android, com os módulos de regra no servidor.

## Onde estamos
- **Branches:** a `main` tem tudo até o bloco 1b e a parte 2b da Visuais 2 (`claude/cavalos-v3` integrada em
  2026-11-14, por fast-forward). Em aberto só a `claude/empacotamento` (em pausa, só com as decisões iniciais; volta
  como bloco 3). A `claude/visuais-2` leva a frente "interface" da Visuais 2 inteira (3a acabamento, 3b Estábulo e
  montaria no celular, 3c tela da corrida), completa e **ainda sem merge na `main`**: o Vinicius joga antes e decide a
  integração. Trabalho novo sai da `main`.
- **Onde jogar** (artefatos privados do claude.ai; republicar depois de cada build):
  - jogo de produção, sem modo DEV: https://claude.ai/artifact/MKTKQUYmzBNun92abFzygn (`prototype/dist/jogo.html`)
  - build de teste com modo DEV: https://claude.ai/artifact/LiMr2cM7FRgFZqJ6dFHPhU (`prototype/dist/jogo-dev.html`)
  - wiki: https://claude.ai/artifact/Bp47f9qE3tSswu1A9zdF2y (`prototype/dist/wiki.html`)
  - no computador: `prototype/dist/preview.html` (com `?dev=1` para o modo DEV).
- **Modo DEV:** save separado (`galope-elemental:dev`), gaveta "DEV" com Moedas, Cavalo, Itens,
  Próxima corrida (pista, clima, vento, skills sempre) e Perfil. Nunca toca no save real.
- **Verificação:** `./scripts/check.sh` em 8 etapas termina em `VERIFICAÇÃO COMPLETA: OK` (129 testes de simulação, 117 de efeitos, 170 de moldes, 615 conferências do wiki, 87 metas de balanço no modo rápido e 165 no completo, e o teste de interface; contagem de 2026-11-16, parte 3c da Visuais 2, refeita depois da onda de correção da revisão final: 129 / 117 / 170 / 615 / 87, sem mudança nas regras; os testes de efeitos
  passaram de 104 para 117 com a 3c).

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

## Visuais 2, parte 3a: acabamento da interface (pronta em 2026-11-14, na `claude/visuais-2`)
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
  publicados depois da Tarefa 3 e republicados depois da Tarefa 5, sem esperar resposta. Os artefatos oficiais só depois
  do merge na `main`.
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

## Visuais 2, parte 3c: tela da corrida (pronta em 2026-11-16, na `claude/visuais-2`)
Spec em `docs/superpowers/specs/2026-11-15-tela-da-corrida-design.md` (aprovada pelo Vinicius), plano em
`docs/superpowers/plans/2026-11-16-tela-da-corrida.md`; decisões em `decisoes.md` (2026-11-16, as dele e as da execução);
`docs/GDD.md` §5. Com ela, a frente "interface" (3a, 3b, 3c) está completa na `claude/visuais-2`, **sem merge na `main`**: o
Vinicius joga antes e decide.
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
    retratos andam no relógio real. O saldo e o XP já não mudam (seed fixa); não se congela a animação.

## Em andamento
- **Ginásios:** ideia registrada (`docs/GDD.md` §8.6); desenho depois do bloco 1b, que também traz a fonte da Rédea nova. Cada ginásio tem o
  foco num elemento.
- **Frente "interface" da Visuais 2 completa na `claude/visuais-2`, esperando o Vinicius:** a 3c (tela da corrida) ficou
  pronta em 2026-11-16 (seção própria acima, com a lista "A confirmar com o Vinicius (gosto, 3c)"); com a 3a e a 3b, a
  frente está inteira e **sem merge na `main`** até ele jogar e decidir.
- **Parte 3b da Visuais 2 pronta na `claude/visuais-2`, esperando o Vinicius** (Estábulo e montaria no celular; spec em
  `docs/superpowers/specs/2026-11-15-estabulo-montaria-celular-design.md`, plano em `docs/superpowers/plans/2026-11-15-estabulo-montaria-celular.md`;
  decisões da execução em `decisoes.md`). Estábulo em lista de linhas, ficha com retrato grande e aba Ficha, aba Status em linha
  única com a barra do Confirmar presa, motivo visível no toque e ordinal lido pelo leitor de tela. Alturas a 360×780: Estábulo
  com 3 cavalos de 1.320 para 780 px, com 6 de 2.277 para 1.012 px; Status de 1.902 para ~1.455 px (1.450 a 1.457 conforme a densidade da tela; teto do teste 1.470); ficha com a linha de abas
  inteira na 1ª tela. `check.sh` OK (129 testes de simulação, 104 de efeitos, 170 de moldes, 615 conferências do wiki, 87 metas
  rápidas e o teste de interface). Capturas oficiais regeneradas; folha da interface com a linha nova do Estábulo. Sem merge
  na `main` até ele olhar. Já publicado: folha https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR (versão 5) e build de teste
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 11), build 2a381ff (o fim da 3b).
- **Parte 3a da Visuais 2 pronta na `claude/visuais-2`, esperando o Vinicius** (folha, build de teste e a lista "A confirmar
  com o Vinicius (gosto, 3a)" acima); sem merge na `main` até ele olhar.
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
- **Redistribuição:** a primeira de cada cavalo é grátis; depois só com a Rédea nova, que não tem fonte no
  jogo normal até os ginásios (só a gaveta DEV). Nenhum item sobe estrela até o bloco 4.
- **O Vinicius ainda não jogou o modelo novo:** os números saíram de simulação.
- **Balanço:** M6, M9, P1, S1 e A1 só são vigiadas pelo `balance.js` completo.

### A decidir / pendências do bloco 1b (spec §15)
- **A build equilibrada domina:** é a mais forte (o bot a 60–65% no nível 50; as inclinadas em 44–54%). Mudar a regra
  (custo que para de subir, retorno extra por concentrar) fica para depois de o Vinicius jogar.
- **A sensação da corrida mudou:** mais curta, "Cansou" some, a Garra dispara em 58% das corridas. Olhar a animação no artefato.
- **Os iniciais no nível 25 caem para a Prata** (eram Ouro): o meio da progressão ficou mais lento.
- **A Sorte vale pouco** (0,7 p.p. na corrida), por desenho: só de nascimento, mexe no Dado e na chance de skill.
- **Sem fonte de Rédea nova** no jogo normal até os ginásios: quem gastar a redistribuição grátis só muda a build pelo DEV.
- **O Ouro tem menos uso:** a loja de peças some; sobram entradas, cruza e troca do Haras.
- **Folga de ~1 p.p.** nas metas rebaseadas sobre o pior caso de 4 bases de seed; mexer na RNG pede a faixa de novo.
- **Equipamento suspenso:** voltar (talvez como cosmético) e a ferradura de tração do bloco 2 ficam em aberto.
- **Decisões do Vinicius ainda abertas:** o empacotador (a pergunta sobre o Capacitor ficou sem
  resposta) e, de `docs/exemplos.md` §5, o papel da Sorte, o conjunto de 3 peças, o "Cansou", a Garra
  e a zebra.
- **Arte:** crina própria de cada estilo no galope (6 a 10 gerações); retrato, largada e pódio sem
  respiração nem piscar.
- **Antes do próximo aumento de versão do save:** pôr uma guarda para save de versão maior que a do
  código (não adotar nem gravar por cima, e avisar para atualizar a página).
- **Pendências menores:** `docs/memoria/bugs.md`.
- **GDD §9+:** expedições, tecnologia do servidor, anti-trapaça, PVP assíncrono e ranqueada.

## Próximos passos
0. O Vinicius joga a 3a, a 3b e a 3c (folha da interface e build de teste) e decide as listas "A confirmar com o Vinicius
   (gosto, 3a)", "(gosto, 3b)" e "(gosto, 3c)" (acima) e a integração da `claude/visuais-2` na `main`; o que ele mudar entra
   antes do merge.
1. O Vinicius joga o modelo novo no artefato (jogo, DEV e wiki republicados com o 1b, já na `main`) e decide os
   pontos de calibração acima; o que ele mudar entra como ajuste por cima da `main`.
2. **2c (animações novas para todos os portes)** da Visuais 2: espera a confirmação de créditos do Vinicius.
3. O Vinicius apaga as branches antigas no GitHub (lista abaixo).
4. **Bloco 2, preparação com relógio:** spec, revisão do Vinicius, plano e execução.
5. **Bloco 3, empacotamento:** retomar pela pergunta do Capacitor; o teste fechado começa aqui. Os ginásios
   têm desenho depois do bloco 1b (seção "Em andamento").
6. Abrir a conta de desenvolvedor do Play e começar a juntar os 12 testadores (é o que mais atrasa).
7. Blocos 4 a 6 chegam como atualizações durante o teste fechado; o bloco 7 (online) vem depois.

## Branches para apagar no GitHub
Todas já integradas na `main`: `claude/equipamentos`, `claude/cruzamento`, `claude/nucleo-corrida-v2`,
`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`, `claude/menu-abas`,
`claude/visuais`, `claude/corrida-viva`, `claude/pente-fino` e `claude/cavalos-v3`. A `claude/visuais-2` voltou a ser
usada para a parte 3 (interface), avançada até a `main` em 2026-11-14. A `claude/nifty-newton-e8u133` é a
branch desta sessão e acompanha a `main`. A sessão não consegue apagar branch remota (o proxy bloqueia).
