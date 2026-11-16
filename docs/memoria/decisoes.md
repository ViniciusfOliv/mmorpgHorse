# Decisões

Formato: **decisão** — motivo. A mais nova fica no topo. O detalhe de cada frente está na spec dela
(`docs/superpowers/specs/`) e o design no `docs/GDD.md`; aqui fica o *quando* e o *porquê*.

## 2026-11-16 — Visuais 2, parte 3c: tela da corrida (decisões do Vinicius)
Spec em `docs/superpowers/specs/2026-11-15-tela-da-corrida-design.md` (aprovada por ele).
- **Faixa de ordem embaixo da pista** — todos os corredores em ordem e o nome de quem está logo à frente e logo atrás; não
  cobre a pista e mostra quem saiu da tela.
- **Dado da Sorte: faixa grande com o resultado na pista e os números na faixa de ordem** — sai a faixa de números a decifrar.
- **Chegada: faixa com o lugar do jogador; resultado numa tela, com as abas Chegada e Momentos.**
- **Pódio: só o 1º lugar maior, no centro** — os três maiores não cabem lado a lado a 360 px.
- Do controlador, na revisão da spec (o revisor mediu o jogo): em tela baixa (< 700 px de altura) a faixa de ordem tem uma
  linha, a narração uma frase em uma linha e o número do Dado toma o lugar da posição; as três frases de enfeite embaixo da
  manchete do resultado saem (fica a que explica o pódio sem prêmio); a tabela "Ordem de chegada" passa a 2 linhas de texto
  por corredor; "resultado numa tela" vale para o caso sem aviso de nível, skill ou Ouro.

## 2026-11-16 — Visuais 2, parte 3c: decisões da execução (controlador)
Tudo abaixo é do controlador (nada foi decidido pelo Vinicius). Plano em `docs/superpowers/plans/2026-11-16-tela-da-corrida.md`.
O que é gosto e espera a palavra dele está em `ESTADO.md` ("A confirmar com o Vinicius (gosto, 3c)").
- **(controlador) A faixa "CLIMA: X" que aparecia depois do Dado saiu** — a faixa nova do Dado já diz o efeito no clima;
  ficam o clarão leve da virada, o clima no painel do topo e o aviso para o leitor de tela. Se errado: é só pôr a faixa de volta.
- **(controlador) Os itens da faixa de ordem não mostram o nome do cavalo, nem em tela larga** (a spec deixava a escolha) —
  a linha dos vizinhos, logo embaixo, já traz os nomes. Se errado: acrescentar o nome é uma mudança pequena.
- **(controlador) Em paisagem (altura até 500 px) a faixa de ordem fica na linha dos controles** e não soma altura à tela —
  se errado: a faixa fica apertada ao lado dos controles.
- **(controlador) O estouro antigo em paisagem com 7 ou 8 corredores não se corrige na 3c** (os controles saem da janela; já
  era assim antes, e a faixa de ordem não piora) — mexer nisso é mexer no desenho da pista, e a 3c mira o celular em pé.
  Custo: quem joga deitado com sala cheia continua rolando para ver os controles. Fica como pendência no `ESTADO.md`.
- **(controlador) Distância que arredonda a 0 vira "colado"** na linha dos vizinhos ("À frente: Ipê colado") — "+0 m" lia
  como defeito. Se errado: é uma palavra.
- **(controlador) O Dado guarda o suspense até os dados pararem:** enquanto giram, a faixa grande mostra só o dado e "DADO DA
  SORTE", centralizados e grandes, e a faixa de ordem fica sem números; o vencedor, os números, a frase da narração (a do Dado
  e a da virada de clima que ele causa), o clima do painel, o clarão e o aviso para o leitor de tela aparecem juntos, na
  revelação. Com movimento reduzido nada espera. A chuva e a névoa desenhadas na pista seguem a corrida, como antes — nada
  na tela pode adiantar o que a pista ainda não mostrou. Custo se errado: por ~1 s a faixa mostra um título no lugar do
  resultado, e a narração do Dado chega ~1 s depois do instante do evento.
- **(controlador) A faixa do Dado e a faixa do lugar ficam em cima, logo abaixo do painel; quando ali cobririam o cavalo do
  jogador, vão para o pé da pista** (sobre o gramado e a cerca). A posição é escolhida uma vez por Dado (e na chegada, quando
  o jogador cruza a linha) e não muda enquanto a faixa está na tela, só se a tela for redimensionada; as duas faixas nunca
  se sobrepõem. A faixa pode cobrir o alto de um rival na raia 1, nunca o cavalo do jogador — o cavalo da raia 1 sobe acima
  do próprio painel, então nenhuma posição em cima o livra. Custo: com o jogador nas raias de cima, as faixas aparecem
  embaixo, longe do painel.
- **(controlador) "VOCÊ TIROU N" fica na mesma linha da frase do clima quando cabe** — a faixa ocupa menos pista.
- **(controlador) A faixa do lugar, do 4º para baixo, usa o creme do texto do painel** (a spec dizia "a cor do painel", que é
  a do fundo da faixa). Se errado: é uma cor.
- **(controlador) Na tabela da chegada, a linha de baixo (dono · nível · skills) só quebra entre os pedaços** — "Nv 14" e
  "skills 46%" nunca se partem; a 360 px pode ocupar duas linhas, e a linha da tabela continua com até 70 px. Cortar o nome
  do dono com reticências esconderia dado. Se errado: é uma regra de CSS.
- **(controlador) O fim da corrida espera a faixa do lugar sumir (2,5 s) antes de ir ao resultado; "Pular" continua
  imediato** (proposta do executor, aceita na revisão) — sem isso, quem chega em último via a faixa só ~1,5 s.
- **(controlador) Código:** `FX.stripOrder`, da faixa de números antiga, saiu junto com os testes dele (nada no jogo o usava;
  volta do git se precisar); `FX.nomeEmLinhas` devolve o nome em maiúsculas, porque a fonte desenhada na pista só tem
  maiúsculas (nada muda na tela); o rodapé dos commits do plano é "Claude Fable 5.2", o da sessão.

## 2026-11-15 — Visuais 2, parte 3b: decisões da execução (controlador)
Tudo abaixo é do controlador (nada foi decidido pelo Vinicius).
- **(controlador) Meta do Status: documento ≤ 1.470 px** (medido ~1.455: 1.450 a 1.457 conforme a densidade) (a conversa dizia ~1.100, a spec 1.200) — a cabeça com o retrato grande se
  repete em cima e a spec §2 manda a §5 vencer. Meta nova: com as abas no topo, as 7 linhas de status inteiras visíveis (169–583 px;
  `.app-abas` em 724). O Status caiu de 1.902 para ~1.455 px (−24%).
- **(controlador) "Poder A → B" do rascunho na barra presa, não no topo** — a lista não pula sob o dedo no 1º toque.
- **(controlador) Barra presa:** por ~400 ms ao aparecer não pega toque (o 2º toque rápido cai no +N de baixo, não em
  Desfazer/Confirmar); por ~400 ms depois do 1º toque no Confirmar os botões dela não pegam toque (o toque duplo não grava sem
  ler o aviso). Teclado não é afetado; o foco de teclado nunca fica atrás da barra.
- **(controlador) "Genética" no topo da aba Status**, ao lado dos pontos; o custo "·N" fica embaixo do valor, na mesma linha do grid.
- **(controlador) Estábulo: linha de 3 linhas de texto** (nome / raridade + estrelas / tipo + Poder), ~96 px (a spec dizia ~88);
  selo "Ativa" como plaquinha na borda de cima; a ordem nunca muda.
- **(controlador) `history.scrollRestoration = 'manual'` no jogo todo** — o Voltar devolve o foco e a rolagem à linha do cavalo;
  um reload abre no topo, como o boot já fazia.
- **(controlador) Ficha:** retrato grande na escala 6 (as abas cabem com 97 px de folga); "+N" no canto de baixo à direita (em
  cima cobria a cabeça); "Tornar ativa" some na ativa (o texto "Esta já é a montaria ativa." saiu) e fica dourado nas outras;
  trocar de aba fecha o campo de renomear e a confirmação de liberar, como o rascunho; rótulos "Sexo:", "Cruzas restantes: N",
  "Pais:".
- **(controlador) Pais reconhecidos pelo `uid`** ("(fora do estábulo)" com uid nulo ou fora do estábulo, mesmo com nome igual ao
  de um cavalo presente).
- **(controlador) Motivo no toque:** `aria-disabled` nos 7 botões das telas da 3b; região viva `#motivo-vivo` fora da tela para o
  leitor anunciar; Liberar e Tornar ativa recusam já no clique.
- **(controlador) Ordinal com ".sr º" em todo o jogo, menos na faixa de eventos da corrida** (o .sr ali causava rolagem lateral; o
  anúncio do jogador já vai pelo `#anuncio`) — rever na 3c.
- **(controlador) Pendências para a onda final / depois:** nome acessível da linha do Estábulo sem o "+N"; contorno da plaquinha
  "Ativa" nas cores forçadas; Corcel na linha "Sexo:" e "+N" do retrato grande sem contexto para o leitor de tela.

## 2026-11-15 — Visuais 2, parte 3b: Estábulo e montaria no celular (decisões do Vinicius)
Spec em `docs/superpowers/specs/2026-11-15-estabulo-montaria-celular-design.md` (aprovada por ele).
- **Aba Status em linha única com +1/+5/+10** — um toque soma, como hoje; a aba cai de 1.940 para até 1.200 px a 360 px.
- **Estábulo em lista de linhas; "Tornar ativa" só na ficha** — cerca de 6 cavalos por tela; tocar na linha abre a ficha.
- **Ficha com retrato grande e uma 3ª aba "Ficha"** (ações, porte, marcas, cruzas, pais) — o cavalo em destaque e as abas
  na primeira tela.
- Do controlador, na revisão da spec: meta do Status 1.200 px (não 1.100: a cabeça com o retrato grande se repete); se
  retrato e abas brigarem, as abas vencem; barra do Confirmar = a `.barra-acao` sticky de hoje; o motivo de botão
  indisponível aparece abaixo do grupo dele, um por vez; pais reconhecidos pelo `uid`.

## 2026-11-14 — Visuais 2, parte 3 (interface): divisão e 3a (controlador, sob delegação)
O Vinicius pediu "Decida sozinho a divisão e pode começar". Spec em `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md`.
- **Parte 3 em três: 3a acabamento, 3b estábulo e montaria no celular, 3c tela da corrida** — o acabamento define as peças
  que as outras usam; a 3b mexe nas telas que o 1b reescreveu (as mais compridas); a corrida é a mais independente.
  "Celular" vira regra das três (spec 3a §7), e a 3b é a que corta rolagem.
- **Acabamento em camadas: linhas por sombra do CSS e peças pequenas de pixel (rebites, pregos, veio, ⓘ) por cima** —
  num teste descartável, molduras inteiras por `border-image` mostraram linhas nas emendas na densidade 2,625 (comum em
  Android), mesmo com bordas em múltiplos de 8 px; as camadas ficaram nítidas. Um kit do PixelLab gastaria créditos e
  teria o mesmo problema das emendas.
- **Peças de pixel feitas à mão em mapas de texto, com as cores dos tokens do `game.css`** — sem IA, sem custo, e a paleta
  não diverge.
- **Fontes dentro do jogo (subconjunto latino, OFL), com o Google Fonts de reserva** — o app Android sem rede cairia na
  fonte do sistema.
- **Press Start 2P só em 8, 16 ou 24 px** — 12 regras usavam 11–12 px (e 5 outras o teste achou a mais) e borravam a
  fonte. Destino: foram para **16 px** `.status .valor` (já estava), `.poder b`, o saldo do cabeçalho (`.app-topo .ouro` e
  `.pedras`), `.montaria-cabeca .titulo small`, `.montaria .cavalo-nome small` e `.nota-genetica`; foram para a **Jersey 10**
  (`--t-s`, `--t-m` ou o tamanho em volta) `.nivel`, `.build-topo .pontos-livres`, `.build-nome`, `.build-mais`,
  `.inicial .contador`, `.badge-ativa`, `.tag-voce`, `.levelup b`, `.status dt`, `.selo-nivel`, `.pontos-livres--selo`,
  `.raia--mini` e `.ajuda`. Regra de escolha: número ou letra curta fica em 16 px; frase, rótulo ou selo que quebraria ou
  cobriria o retrato vai para a Jersey.
- **Folha da interface publicada para o Vinicius depois da Tarefa 3, e não antes** — publicada com as telas já mudadas
  (na branch `claude/visuais-2`) e republicada depois da Tarefa 5, sem esperar resposta. Antes da T3 a folha mostraria o
  visual antigo, e a branch ainda não está na `main`. Links: folha https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR
  (versão 3, a final) e build de teste https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 9, a final). O gosto é dele; se ele quiser
  outro rumo, a execução para.
- **Trabalho na `claude/visuais-2`, avançada até a `main`** — é a branch da frente visual que ele pediu em 2026-11-12.
- **Decisões da execução da 3a (controlador, sob delegação):**
  - **`.chip` sem `clip-path`** — o ⓘ dentro do chip tem alvo de 44 px, maior que o chip; o corte recortaria o alvo de toque (desvio da spec §4.10). O chip fica só com o contorno e o bisel por sombra.
  - **O botão apertado desce 2 px também com movimento reduzido** (saiu o `mov-reduzido` do apertado) — como pede a spec §7: é feedback de toque, não animação.
  - **Mapa do ⓘ redesenhado** — o da Tarefa 1 lia como "H" em 14 px.
  - **Barra de abas com uma coluna por aba** — antes eram 5 colunas fixas para 4 abas (a Loja está suspensa), e com as abas em botão a 5ª aparecia como um buraco.
  - **A velocidade escolhida da corrida (ouro) segue a mesma receita do botão ouro** — apertada desce 2 px e a sombra encolhe; desabilitada fica com o bisel escuro também no topo (o seletor dela vencia `.btn:active` e `.btn:disabled`; corrigido na Tarefa 5, com checagem no `ui-test`).
  - **`.montaria--ativa` no lugar de `.caixa--destaque`** (spec §4.2) — a classe já marca o lugar e evita mexer no markup.
  - **A folha da interface não simula o modo de cores forçadas** — simular repetiria as regras do `@media`; o `ui-test` emula o modo de verdade (`forcedColors`).
  - **Retrato em linha anda 4px para a direita (revisão final):** a moldura de madeira do retrato avança 6px e encostava no rebite do canto (4–10px) no cartão da Montaria ativa e na cabeça da Montaria em tela larga; `.cavalo-cabeca > .retrato` ganhou `margin: 0 -4px 0 4px` (o texto fica onde estava, altura igual) e em tela estreita (coluna) volta a `0`. Correr segue em 834px (limite 834).
  - **Ponto de aviso da aba Correr** a `top: 2px` (ficava no bisel claro). **Teste de altura** ganhou Correr (802, medida na `main` 7fe5124) e Skills da ativa (1145): limite 1,04 vezes cada.
  - **Os estados de demonstração da folha (`.foco-demo`, `.apertado-demo`) entram como seletores extras** nas mesmas regras de `:focus-visible` e `:active`, sem regra copiada.

## 2026-11-14 — Integração dos blocos 1 e 1b na `main` (decisão do Vinicius)
- **A `claude/cavalos-v3` entrou na `main` antes do teste no artefato** — escolha do Vinicius depois da revisão final
  limpa e do `check.sh` OK; o plano era jogar antes. Os pontos de calibração do 1b (spec §15, lista no `ESTADO.md`)
  continuam abertos e viram ajustes por cima da `main`. A `claude/visuais-2` já estava contida e também sai da lista.

## 2026-11-13 — Decisões delegadas pelo Vinicius ("Prossiga, decida sozinho o melhor para o jogo")
- **Spec do bloco 1b (crescimento livre) aprovada como está** — é o próximo passo do roteiro (antes de integrar o bloco 1
  na `main` e antes da parte 3 da Visuais 2, que mexe nas mesmas telas). Ficam valendo as escolhas da spec que estavam
  para a revisão dele: skill de tipo que multiplica os dois status do tipo; Loja e Equipamento escondidos com as peças
  guardadas; Pedra Negra do pódio parada; a ativa não redistribui com páreo aberto; Rédea nova só pela gaveta DEV até os
  ginásios; aviso único da migração; +5/+10 somam exatamente N ou ficam desabilitados.
- **A equilibrada continua a build mais forte (spec 1b §15)** — mudar a regra (custo que para de subir, bônus por
  concentrar) fica para depois de o Vinicius jogar; o bot e o "Distribuir sugerido" são a equilibrada com leve
  inclinação no tipo.
- **O jóquei do jogador continua o mesmo ao "Recomeçar com outro inicial"** — é a identidade do jogador (escolha do
  Perfil), como a opção de animações; entra junto com o bloco 1b, que já mexe no `game.js`.
- **Ícones: selo de liga só onde a liga já aparece; medalhão de raridade nas peças fica para quando o equipamento voltar**
  — com o 1b o equipamento fica suspenso e as telas de peças somem.
- **Parte 2c (animações) espera a confirmação de créditos do Vinicius** — o `CLAUDE.md` exige confirmação explícita para
  geração paga; o 1b não gasta nada.
- **Execução do 1b (controlador, sob delegação; decisões de design; o detalhe está no ledger e na spec):**
  - **Os grupos +1/+5/+10 e o "Distribuir sugerido" somem quando nenhum ponto cabe** (nível 1, ou o que sobra não paga o próximo
    ponto de nenhum status); ficam desabilitados, com o motivo, só quando algum N cabe e outro não — entre um nível e outro o
    estado "tudo cinza" seria o normal, e 18 rótulos "indisponível" atrapalham o leitor de tela. Spec §11 emendada.
  - **O selo do Estábulo mostra o orçamento de pontos** ("sobram X", o mesmo número do topo da aba Status) enquanto algum ponto
    cabe; antes contava pontos de status, número que divergia do topo.
  - **A sala aberta migrada para a v6 mantém seed, mapa, nomes, ordem e sedas, mas os bots podem mudar de nível** — a spec manda
    recalcular o Poder da sala pela regra do retrato (R16); acontece uma vez, só para quem migra com páreo aberto.
  - **A skill de tipo mostra dois números quando os ganhos dos dois status diferem** (por exemplo Velocidade +12, Aceleração +9).
  - **Sala e "Distribuir sugerido" não re-sorteiam nada:** o teste do bloco build continua conferindo os rivais da sala, por ser regra do `CLAUDE.md` §8.
  - **O texto do custo diz "sobe a cada 10 pontos no mesmo status"**, tirado do `costStep` do código (o wiki-test confere), e não "cada ponto custa mais que o anterior".

## 2026-11-13 — Portes (parte 2b): revisão final, decisões do Vinicius
Correções em `prototype/src/sprites.js` (`corBrilho`) e `prototype/tools/moldes-test.mjs` (`formaComAceitos`); specs da 2a (§3, §5) e da 2b (§4, §6) emendadas. A escala dos retratos, também decidida aqui, está na seção abaixo.
- **O brilho das raridades foi corrigido na 2b: a cor se ajusta ao contraste com a crina — decisão do Vinicius** — a cor clareada fixa sumia em 14 combinações do catálogo (a pior, Mágico na crina laranja do Tição, 0,005 de luminância). O brilho é um reflexo claro: a clareada de 35% fica sempre que já muda a luminância da crina em 0,05 no alfa de pico; só onde não muda, vale a clareada ou a escurecida, a de maior diferença, indo até 65% se nenhuma chega a 0,05. As 60 combinações do catálogo ficam ≥ 0,05 (a menor, Lendário na crina da Faísca, 0,052, na clareada): 46 seguem na clareada como na 2a, 13 passam à escurecida e o Mítico no Mandacaru, à clareada de 45%. O matiz continua o da raridade e o rastro do Mítico segue na clareada. (A 1ª versão desta correção usava sempre a de maior diferença, e 46 das 60 viravam faixa escura; ajustada no mesmo dia: o pedido era consertar onde o brilho sumia, não escurecer o que já aparecia.)
- **Meias que se juntam ou se partem (5 de 24 retratos/parados) e a zona da cara que pulsa no galope (5 moldes) ficam para a 2c — decisão do Vinicius** — a 2c refaz as animações de todos os portes; até lá seguem medidas no `moldes-test` (`PENDENTES_2A`), sem afrouxar regra.
- **Aceitos pelo Vinicius: o retrato do robusto-folhas com 3 pernas e as 5 frestas de 1 px entre cauda e anca no parado do robusto-ondas** — escolha dele na revisão final, com o valor medido fixado em `ACEITOS_NA_FOLHA`; as frestas estavam escondidas atrás do "fora da paleta" aceito na folha (o teste da forma só olhava o 1º defeito) e agora o teste revalida com o defeito aceito neutralizado.

## 2026-11-13 — Portes (parte 2b): decisões da execução
Detalhes das gerações em `docs/memoria/assets.md`; spec em `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`.
- **Mestres aprovados na folha com o esguio parado e o robusto aceitos como estão** — o esguio parado (seed 3101) mostra 2 pernas e o robusto guiado reprova em proporção e forma, mas ambos leem bem na folha; refazer gastaria mais sem ganho visível.
- **Robusto gerado guiado pelo mestre padrão** — pedido sozinho, o robusto saiu quase igual ao padrão (proporções contra o padrão de 0,965 a 1,075 nas tentativas escolhidas das duas rodadas sem guia, seeds 3103 e 4103); partir do padrão aprovado separa o corpo. O robusto aceito é o guiado pelo padrão (refação 2), que pela medida automática saiu 1,056 (altura) e 0,817 (espessura) contra o padrão, reprovado, e foi aceito na folha.
- **Teto do lote subiu de 90 para 130 e depois 170, por decisão do Vinicius** — a refação dos mestres, o piloto e as 7 versões restantes passaram do previsto; cada subida foi confirmada antes de gastar. **Total: 155 gerações.**
- **Versões de padrão e robusto partem do mestre (`init_image`); as do esguio saem sem guia** — no piloto o esguio com guia não manteve o corpo do mestre (focinho 10 a 13 px fora), então o esguio perde a garantia de "mesmo corpo" entre elementos.
- **A classificação das cores foi corrigida offline, sem gastar, em duas rodadas** — seda que pintava o corpo no galope; crina e jóquei do robusto (cores naturais no cru, achadas pela forma); capacete separado por contorno vira seda; canela e focinho do robusto classificados como crina voltam à pelagem-sombra e ao detalhe.
- **A escala dos retratos sai do molde mais alto dos 12 e todos os portes descem juntos — decisão do Vinicius (2026-11-13, na revisão final)** — os 3 portes ficam proporcionais no cartão em qualquer zoom; decidir o passo por molde deixava o robusto (o retrato mais alto) menor que o padrão, e tolerar mais corte cortaria a cabeça do robusto (14% em k = 4). Com zoom de 125% (k = 4), todos ficam um passo menores que antes da 2b, o padrão também; a spec §4 (que pedia o padrão do tamanho de hoje) foi emendada.

## 2026-11-13 — Portes: classificação das cores corrigida sem gastar (tarefa 6a)
Código em `prototype/tools/moldes-lib.mjs` (`corrigirGrupo`, com o diagnóstico nos comentários) e `--manter-escolhas` no `pixellab-portes.mjs`; crus e escolhas de antes no commit 8037a97.
- **A sombra roxa escura da pelagem (314–330°, muito saturada) volta à pelagem quando encosta mais nela do que no jóquei, decidida por cor no grupo de quadros** — a faixa magenta é da sombra da seda; numa pelagem carmim ou castanho-arroxeada ela pintava o corpo com a cor da seda no galope (padrao-ondas, robusto-ondas, robusto-folhas).
- **Cru de cores naturais (grupo sem nenhum pixel da família crina): crina e cauda achadas pela forma (manchas escuras grossas presas no alto do cavalo) e seda que caiu na família da pelagem devolvida ao jóquei** — o robusto guiado pelo padrão com força 35 saiu com cores naturais (crina preta, às vezes da cor do contorno) e as versões herdaram pelo init_image; só cor não separa.
- **`--reprocessar --manter-escolhas`: reprocessa sem trocar o desenho já visto na folha** — com a classificação nova, outras seeds passaram a passar (esguio-folhas, robusto-chamas e robusto-ondas trocariam de parado); a etapa grava a seed que seria escolhida (`mantida`), para o Vinicius decidir.
- **A regra "laranja (25–38°) conta como fora da paleta, máx. 2%" não mudou** — é o que ainda reprova a forma do padrao-ondas e de parte dos robustos (sombra laranja da seda e da manta no cru); mudar é decisão de desenho.

## 2026-11-13 — Visuais 2, parte 2b (portes): desenho
Conversa com o Vinicius. Spec em `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`, aguardando a revisão dele.
- **O porte é um gene herdado, como as marcas (só aparência)** — escolha do Vinicius; dá mais variedade e não amarra a cara do cavalo ao balanceamento (a outra opção era o porte sair da genética de status).
- **Três portes inspirados em raças brasileiras: esguio, padrão e robusto, iguais nos três elementos** — dito pelo Vinicius; o cruzamento mistura elementos, então o gene precisa valer em qualquer um.
- **O padrão também é gerado de novo (9 desenhos novos, os de hoje saem)** — escolha do Vinicius; os três portes saem com a mesma receita, todos com as 4 pernas separadas (fecha o limite das meias) e cada elemento com a sua crina no galope.
- **Um corpo-mestre por porte, com as versões de Fogo, Água e Grama partindo dele** — escolha do Vinicius; garante o mesmo corpo do porte em qualquer elemento e barateia as refações.
- **Galope: ≥ 2 pernas em todo quadro** (sai o "≥ 3 em todo quadro e 4 em pelo menos 5 dos 9"; retrato e parado seguem com 4) — na vista de lado as pernas se cruzam no galope; os galopes dos mestres parecem bons e reprovavam só por isso; decidido pelo Vinicius na folha dos mestres.

## 2026-11-13 — Visuais 2, parte 2a pronta (marcas, jóquei e raridade)
Regra em `docs/GDD.md` §6; números no wiki (seção "Marcas e jóquei").
- **As zonas de cara e pernas são calculadas pelas regras de `prototype/src/marcas.js` (cara: raio de 0,19 × largura útil a partir do focinho, cortado em `nose.y + 1`; pernas: componentes 4-conexas partidas no vão entre cascos)** — as regras da spec original falhavam nos moldes reais: na cara, a zona derivava no galope e pegava o pescoço; nas pernas, os grupos de colunas juntavam pernas vizinhas.
- **O brilho da crina usa a cor da raridade clareada (a mesma do rastro do Mítico)** — o verde do Mágico sumia na crina verde dos cavalos de Grama (Capim, Mandacaru); a luminância do brilho sobre a crina passou de 0,034–0,041 para 0,061–0,064. (Substituída na 2b: a cor passou a se ajustar ao contraste com a crina.)
- **O limite das 3 e 4 meias (pernas encostadas contam como uma, 2 a 4 pernas por quadro) fica aceito até os moldes da 2b** — não mexer no código das pernas agora; os moldes novos separam as 4 pernas e ganham teste de contagem de meias.
- **Os 15 cavalos do catálogo têm marcas fixas, e o rival da sala usa as do modelo dele** — o mesmo cavalo tem a mesma cara em qualquer corrida; só o jóquei do rival varia, pela seed da sala.
- **Cavalo sem marcas válidas (save antigo, alugado) vale pelas do modelo do catálogo, ou pelas calculadas do identificador** — nunca muda de aparência entre sessões e o save não precisa de versão nova.
- **A raridade é um efeito por cima do cavalo (brilho na crina, faíscas, rastro), não pintura no molde** — não multiplica os moldes recoloridos e liga e desliga com movimento reduzido.
- **A ficha e o Haras mostram "Marcas: …" (só o que existe, ou "Marcas: nenhuma")** — o jogador escolhe reprodutores sabendo o que o potro pode herdar.

## 2026-11-12 — Visuais 2, parte 2 (cavalos): divisão e desenho da 2a
Spec da 2a em `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`.
- **Cavalos em três subpartes: 2a em código (marcas, jóquei, raridade), 2b portes no PixelLab, 2c animações** — o que é grátis primeiro; as animações saem uma vez só, para todos os portes.
- **Cada porte novo traz a sua crina e cauda** — crina separada do porte multiplicaria as gerações.
- **Jóquei é do jogador, escolha livre no Perfil, vale para todos os cavalos; bots sorteiam pela seed da sala** — identidade do jogador; a cor da seda continua mostrando a raia.
- **Marcas em três genes (cara, patas, corpo), herdados de um dos pais pela seed, 10% de mutação; só aparência** — muitas combinações com regra simples.
- **Raridade em escada (Mágico brilho na crina → Mítico com rastro), sem usar o contorno da skill** — o contorno já significa skill ativa.
- **Marcas por zonas calculadas no molde, não por máscaras à mão nem pelo PixelLab** — sem créditos e funciona sozinho para os portes da 2b.

## 2026-11-12 — Visuais 2: ícones, cavalos e interface (branch `claude/visuais-2`)
Conversa com o Vinicius. Spec da parte 1 em `docs/superpowers/specs/2026-11-12-icones-design.md`.
- **Três partes, cada uma com spec, plano e execução: ícones, cavalos, interface** — o pedido inteiro era grande demais para uma spec; os ícones são os mais baratos e independentes.
- **Interface por último, depois do bloco 1b implementado** — mexe nas mesmas telas (Status, Skills) que o 1b muda.
- **Branch criada da `claude/cavalos-v3`** — a frente visual entra depois do bloco 1; da `main`, daria conflito no `game.js` e no `fx.js`.
- **Cavalos novos para variedade entre cavalos, raridade visível e animações novas** — escolha do Vinicius; os retratos maiores ficaram de fora.
- **58 ícones com a mesma receita dos 16 de hoje; folha aprovada pelo Vinicius antes de entrar nas telas; teto de 100 gerações da cota** — a receita já foi testada e combina com o que existe.
- **Cada ginásio tem o foco num elemento (Fogo, Água, Grama); as insígnias seguem esse foco** — dito pelo Vinicius; vale para o desenho dos ginásios.
- **Refação dos ícones começa pela descrição (cor por extenso), não pela seed** — o PixelLab ignorava a cor do tema.
- **Estrela vazia em cinza-claro (#a9b5ae), não cinza-escuro** — sumia no painel.

## 2026-11-12 — crescimento livre: rodadas 2 e 3 da calibração (a revisar na spec)
O Vinicius pediu os quatro ajustes sugeridos depois da rodada 1 ("Pode incluir os quatro"). Números e
motivos na spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`.
- **Seis status valendo como foco** — na rodada 1, Aceleração e Garra rendiam pouco (A1 8,6 p.p.) e as builds inclinadas nelas ficavam em 37–49%.
- **Pontos por nível crescentes (2 → 6), com o mesmo total no 50** — com a taxa fixa, dez níveis no topo davam só +16 de status e o M3 40→50 tinha 2 p.p. de folga.
- **Sorte só de nascimento; 2º dado = (Sorte − 40)/40** — ponto na Sorte não valia nada (A1 0,1 p.p.).
- **Corridas mais curtas por uma escala de tempo inteira (×1,067)** — subir só a velocidade base desmontava os iniciais.
- **Skill de tipo multiplica os dois status do tipo** (decisão da calibração, a confirmar) — com efeito próprio, investir no tipo rendia menos e a build "forte no tipo" não passava de 43%.
- **Bot × 1,2 no tipo, não × 1,3** (decisão da calibração) — com 1,3 o M6 do Raro 50 reprovava.
- **Custo continua subindo a cada 10 pontos (rodada 3, pedida pelo Vinicius, testou 12 e 15)** — inclinar perde ~5% dos pontos com qualquer degrau; degrau maior afiou a corrida e piorou o domínio da equilibrada.
- **Equilibrada fica como a build mais forte; metas apertadas = pior caso de 4 seeds + ~1 p.p.** (M6 até 62/64/67%, inclinadas ≥ 45%) — tirar o domínio pede mudar a regra (custo que para de subir ou retorno por concentrar); fica para depois do teste no artefato.

## 2026-11-12 — crescimento livre e ginásios (desenho aprovado; a implementar)
Conversa com o Vinicius; regras em `docs/GDD.md` §8.5 e §8.6. A calibração e a spec vêm depois.
- **Crescimento 100% por pontos (abordagem A)** — liberdade de build; também acaba com o ponto que perdia o efeito quando o crescimento automático alcançava o teto.
- **Custo por faixa: +1 a cada 10 pontos num status, no lugar do limite de 34%** — sonda: sem regra, "tudo em Velocidade" vencia 86%; com "até 10 custa 1, depois sempre 2" ainda vencia 63%; com o custo subindo sempre, cinco builds ficaram entre 47% e 62%.
- **Escala até 150, sem teto por raridade** — o custo crescente já impede chegar ao máximo; com 200 as barras ficariam com dois terços vazios.
- **Raridade define nascimento e pontos por nível; estrelas multiplicam os pontos com valores menores** — se multiplicassem todo o crescimento com 1 / 1,2 / 1,5, três estrelas venceriam quase sempre.
- **Redistribuição: a primeira de cada cavalo é grátis; depois, Rédea nova, ganha jogando ou por Gemas e nunca por Ouro** — vendida pelos dois, a Gema substituiria Ouro (regra do `CLAUDE.md` §8).
- **Equipamento sem status por enquanto, escondido, peças guardadas** — tira uma variável do balanço enquanto o crescimento muda; validar depois, talvez como cosmético.
- **Ginásios: 2 básicos de dificuldade comum na Expedição primeiro; os online (Fogo, Água, Grama e o trono) são extras do bloco 7** — conteúdo offline para o teste fechado.
- **Insígnias com bônus de conta pequenos (% de Ouro, % de XP, % de skill nova)** — não mexem na corrida, então o Poder e o PVP ficam limpos.

## 2026-11-11 — cavalos v3, bloco 1 (status, tipo e pista; implementado)
Spec: `docs/superpowers/specs/2026-11-10-cavalos-v3-status-e-tipo-design.md`. As seis primeiras saíram da calibração por simulação e diferem do que foi dito na conversa (o Vinicius pode vetar).
- **R16: a sala aberta guarda o retrato dos pontos (`pending.alloc`, como já guarda o do equipamento) e o Poder da sala nunca fica abaixo do Poder com que a ativa corre** — tirar peça, distribuir pontos e recarregar subia o Poder da sala e refazia os rivais (re-sorteio de graça); o piso também desfaz o retrato rebaixado à mão. Sala aberta antes disso usa os pontos atuais uma vez.
- **Tabela de raridade nova: nasce de 40–56 (Comum) a 60–76 (Mítico), tetos de 80 a 100** — com os números antigos uma raridade acima vencia de 89% a 96% e não sobrava espaço para a build; agora vence cerca de 84%.
- **Equipamento com cerca de metade dos valores e +0,5 por melhoria** — a distância entre raridades caiu de 8 para 5 pontos; o conjunto Raro +10 continua valendo pouco mais de um degrau.
- **Estrelas valem 1 / 1,2 / 1,5** (na conversa, 1 / 1,25 / 1,5) — recomendação da calibração; com eles três estrelas vencem uma em 71–73% e duas vencem uma em 59–61%.
- **No máximo 34% dos pontos livres num mesmo status** — sem limite, "tudo em Velocidade" ou "tudo em Força" vencia até 72% dos duelos.
- **As três skills de tipo não rendem o mesmo; a meta é o equilíbrio dos tipos (M9)** — Força vale tanto quanto Velocidade; com rendimentos iguais a Grama vencia 20,5% e a Água 14,2% num campo de seis.
- **Pistas sem extremos entram no bloco 1, não no 2** — as metas dos iniciais só fecham com a regra nova de pista.
- **Os bots do jogo usam a genética do catálogo; genética sorteada só nos cavalos sintéticos das medições** — a spec dizia as duas coisas (§2 × §7).
- **Estrelas fora da faixa são presas a 1–3; ausente ou não numérico vale 2** — save adulterado ou antigo nunca quebra a conta.
- **Molde fixo da pista depois de 60 sorteios falhos: reta 15%, curva 30%, reta 10%, subida 30%, reta 15%** — respeita a regra de nenhum tipo passar de metade.
- **O bot para no teto ao encher o status do tipo; ligas 0 / 810 / 910 / 1.010 / 1.110 / 1.220** — ponto acima do teto não rende; o inicial de nível 1 começa na Bronze.
- **Metas 3 e 3c rebaseadas (65–85% e 75–93%)** — a Velocidade pesa menos de propósito, então o especialista vence mais na pista dele; em pista sorteada quem vigia é a M6.
- **Durações aceitas: curta 88–104 s, longa 116–138 s** — em volta dos 96 e 127 s da calibração.
- **No `--quick`, M6, M9, P1, S1 e A1 são só informação; contam como meta no `balance.js` completo** — o `check.sh` fica rápido; mudança de número pede o completo.
- **Sala aberta na migração v4 → v5 sobrevive com a mesma seed e a entrada reservada, mas a pista e os rivais são refeitos pelas regras novas** — o save v4 não guarda a pista; acontece uma vez por save.
- **Montaria cujo modelo saiu do catálogo (Pangaré) fica no save, sem modelo e com a própria paleta; o Neutro converte por `hash2(seedBase, nº do uid) % 3`, em qualquer versão de save** — ninguém perde cavalo, e a conversão não usa a RNG do jogo.
- **Saves v1 e v2 recriam o inicial pelo catálogo novo (Comum ★★)** — esses saves não têm o que migrar.
- **O ícone do Neutro virou o das skills gerais (`el-geral.png`)** — reaproveita a arte, sem geração nova.
- **Na vaga da skill de tipo, a força aparece como "Intensidade ×N"** — "Força" já é o nome de um status.
- **Com páreo aberto, distribuir pontos no cavalo ativo só vale se o Poder não passar do que a sala viu** — a mesma regra das peças: não dá para abrir a sala fraco e ficar forte.

## 2026-11-10 — redesenho dos cavalos e da economia (desenho aprovado, a construir em blocos)
Resumo completo no `docs/GDD.md` §8. Tudo decidido em conversa com o Vinicius, parte por parte.
- **Crescimento híbrido:** automático pela genética e um ponto livre por nível para a build — mantém o forte do cavalo visível e dá escolha ao jogador; só com pontos livres todos iriam para Velocidade.
- **Genética visível (C a S por status) no lugar do "potencial" escondido** — o jogador precisa ver por que um cavalo é melhor que outro.
- **Estrelas multiplicam os pontos livres e sobem com item raro de treino** — é o "cavalo bem cuidado"; um cavalo de uma estrela deixa de ser fraco para sempre.
- **Iniciais passam a Comuns, com o mesmo total de pontos** — a escada fica mais longa e a diferença entre eles vem só do tipo.
- **Skill de tipo para todo cavalo, em vaga própria, sempre ativa no terço da pista que é do tipo** — medição de 6.000 corridas: a Brasa vencia 67% das pistas curtas e 11% das longas, e a skill dela rendia 4,5 pontos contra 8 das outras; ligar a skill a um momento que toda pista tem tira a sorte do terreno.
- **Sai o bônus fixo do tipo (+8) e sai o Neutro, por enquanto** — +8 de Força rendia mais que +8 de Estamina; o Neutro vencia metade do justo.
- **Skill que atrapalha rival fica fora** — o valor dela depende de quantos rivais há e de que tipo, e cada skill nova reabriria o balanço; rever depois do teste fechado.
- **Pistas sem extremos e preparação com relógio de 12 segundos** (ideia do Vinicius, para parecer partida online): trocar de cavalo e de ferradura com um toque, com Poder até o da sala.
- **A Gema compra tempo, espaço, conveniência e aparência; nunca poder nem Ouro** — o Vinicius precisa de receita na loja, e a regra "Gemas nunca viram Ouro" fica de pé.
- **Ouro nunca é vendido por Gemas; mercado entre jogadores só em Ouro, com servidor** — o Vinicius propôs mercado em Gemas com venda de Ouro; como o Ouro é o que se aposta, isso tornaria a ficha de aposta comprável com dinheiro (cassino social, classificação 18 anos, risco pela Lei 14.790/2023 e pelo precedente Big Fish). Ele escolheu manter a regra.
- **Item de Gema tem resultado garantido; a versão sorteada é a ganha jogando ou por Ouro** — item pago com resultado sorteado é caixa de recompensa.
- **Gemas também caem de graça, em pouca quantidade, por missões.**
- **Cruza de 12 a 24 horas, circuito ocioso que rende mais para cavalos de Poder maior, e aluguel de cavalo** — cada cavalo tem um trabalho por vez; estábulo grande e bem cuidado rende mais.
- **Ração (bônus de XP) no lugar de cansaço** — o mesmo gasto recorrente de Ouro, sem punir quem joga muito.
- **Ordem dos blocos:** status e tipo, pista e preparação, empacotamento, itens e gastos de Ouro, tempo e estábulo ativo, loja de Gemas, online — os dois primeiros mudam o save e a sensação da corrida, então vêm antes dos testadores.

## 2026-11-10 — empacotamento (em pausa: volta como bloco 3)
- **O nome do jogo é "Galope Elemental", agora definitivo** (escolha do Vinicius, depois de avaliar nomes em inglês) — a ficha do Play é traduzida por idioma, então a marca fica em português e a descrição vai no idioma de cada loja; o logotipo e a capa já existem. Identificador previsto para o Play: `com.galopeelemental.game` (não pode mudar depois da primeira publicação).
- **Durante o teste fechado o jogo existe só dentro do aplicativo** (escolha do Vinicius) — os arquivos vão dentro do pacote, funciona sem rede desde a primeira abertura e ninguém joga fora do teste.
- **Ordem das frentes** (trocada no mesmo dia pelo redesenho acima): o empacotamento vira o bloco 3; tutorial e som entram junto dele; expedições depois do teste fechado. A pergunta sobre usar o Capacitor ficou sem resposta.

## 2026-11-10 — pente fino
- **Primeira versão do Play: teste fechado com o jogo offline, lançamento público só com PVP** (escolha do Vinicius) — o teste fechado (12 testadores, 14 dias) é exigido antes da produção e o app pode mudar entre um e outro; assim o retorno de jogadores chega cedo e o jogo só estreia ao público com o pilar do design.
- **O protótipo vira o jogo final** (escolha do Vinicius): a mesma base web, empacotada para Android, com os módulos de regra (`sim.js`, `data.js`, `breed.js`, `gear.js`) indo para o servidor — é o caminho mais curto até o teste fechado e aproveita os testes que já existem; reescrever num motor custaria meses.
- **`claude/pente-fino` integrada na `main`** (aprovado pelo Vinicius), levando junto os visuais, a corrida viva e o wiki.
- **Pacote de balanceamento com medição pareada** (velocidade, curva, subida, 10 skills, gatilho de estamina baixa em 30%, skill de clima ×1,08) — o ganho de uma skill ia de 0,05 a 16,2 p.p. de vitória; ficou entre 4,8 e 11,9.
- **Pesos do Poder refeitos** (Velocidade e Força pesam mais; conjunto de 3 peças vale 3 pontos) — o Poder errava até 10,5 p.p. por montaria; agora no máximo 3,8.
- **Metas novas no `balance.js`** (S1 por skill, A1 por status, P1 e P2 do Poder, Em1 de emoção) — vigiam o que antes ninguém media.
- **Entrada da sala aberta fica reservada e sala aberta nunca é trocada antes de correr** — dava para re-sortear a sala gastando o Ouro, ou trocando um treino por sala valendo.
- **Gasto só vale se a gravação der certo** — com o armazenamento cheio, recarregar desfazia a corrida já vista.
- **`jogo.html` de produção sem modo DEV, sem gancho de teste e sem o CSS deles; o build falha se sobrar** — `?dev=1` ligava Ouro infinito no jogo do jogador.
- **Pedra Negra do pódio sorteada por lugar; prêmios com porcentagens inteiras** (4 corredores a 100: 252 + 108) — os lugares saíam amarrados e o ponto flutuante errava 1 de Ouro.
- **Resultado da corrida leva `simVersion` e `tuningHash`** — um servidor poderá auditar corridas antigas depois de um rebalanceamento.
- **Desenho da corrida com hachura, serras e texto guardados prontos, escala de trabalho menor em tela densa e laço parado fora da corrida** — as subidas triplicavam o custo do quadro; o desenho ficou idêntico pixel a pixel.
- **Nada de minificador feito à mão no build** — tirar comentário por expressão regular quebra código em silêncio; fica para o empacotador da tecnologia final.
- **Seed secreta, validação das entradas e seeds por domínio ficam para o servidor** (`docs/cronograma.md`) — no cliente o save é editável de qualquer jeito.
- **Peça Rara e Lendária do mesmo conjunto seguem com o mesmo nome** — é decisão do GDD §7, não erro.
- **149 arquivos sem uso apagados e documentos encurtados; o checklist de lançamento virou `docs/cronograma.md`** — pedido do Vinicius ("não deixe informações demais"). O `comparativo.html` fica enquanto houver arte de molde pendente.
- **Ainda não é hora de publicar no Play** — faltam tecnologia final, empacotamento, documentos legais, conta e teste fechado.

## 2026-11-09 — corrida viva, modo DEV e wiki
- **Wiki gerado do código** (`docs/wiki.md`, `prototype/dist/wiki.html`) — uma chave nova sem tradução quebra o build, para o wiki nunca mentir.
- **Build de teste `jogo-dev.html` liga o modo DEV sozinho** — o artefato do claude.ai não repassa `?dev=1`.
- **Modo DEV com save separado (`galope-elemental:dev`)** — testar sem tocar no save real; Ouro infinito só em memória.
- **Única mudança do DEV na simulação: `config.dev.skillsAlways`** — o determinismo da corrida real não muda.
- **Skills visíveis na pista** (balão preso à raia, contorno na cor do elemento) — dá para ver quem ativou sem ler o rodapé.
- **Dado da Sorte na pista** (um dado por cavalo, o maior brilha, "↻" em quem desempatou) — a faixa ordena por desempate e depois pelo número.
- **Natureza só visual** (vento pela seed, folhas, respingos, calor e poeira por piso) — o vento não entra na regra.
- **Opção "Animações" no Perfil** — respeita o sistema sem deixar a chuva parada.
- **Curvas vizinhas viram uma só no desenho** (a simulação continua por bloco) — duas coladas pareciam um ziguezague falso.
- **Efeitos em segundos reais por um fator `escala`** — em x1 a simulação anda ~4× o tempo real.
- **Galope de corrida de ondas, folhas e lisa guiado pelo quadro de chamas** — crina própria por estilo não passou nos critérios e ficou pendente.
- **O ui-test serve `prototype/dist/` por http local** — em `file://` o localStorage às vezes sumia e o `check.sh` oscilava.

## 2026-11-08 — menu de abas e visuais
- **Menu de abas antes das expedições e dos visuais** (escolha do Vinicius) — a rolagem única não comportava as telas novas.
- **5 abas (Estábulo, Correr, Expedição, Haras, Loja) e Perfil no cabeçalho; Equipamento vira sub-aba da Montaria** — uma tela por assunto.
- **A corrida PVP continua automática; a batalha de expedição terá modo automático e manual** (escolha do Vinicius).
- **Cavalos com moldes do PixelLab recoloridos no jogo** — arte melhor sem gerar um sprite por cavalo.
- **Cores naturais e classificação local, sem paleta forçada** — com `color_image` o PixelLab pintava tudo num tom só.
- **Escala inteira única para todos os estilos** — pixels nítidos e cavalos do mesmo tamanho.
- **Ícones do PixelLab; logotipo e capa do Canva** — marca sem custo avulso.
- **Script de geração com dry-run por padrão e `--teto`** — cota só com confirmação.
- **Bônus de 4 peças do conjunto: ×1,10 → ×1,07** — a skill de clima volta a valer mais que o conjunto.
- **Branches já mescladas não podem ser apagadas pela sessão** (o proxy bloqueia) — fica para o Vinicius no GitHub.

## 2026-11-06 — núcleo v2, cruzamento e equipamentos
- **Redesign em 6 subprojetos** (núcleo → cavalos e cruzamento → equipamentos → expedições → montarias → economia) — a ordem segue as dependências.
- **7 atributos (entram Manobra e Sorte) e 5 raridades** — cada trecho do mapa tem um atributo dono; a raridade define teto, vagas e chance de skill.
- **Tática e "Disposição do dia" removidas** — corrida = status + terreno + RNG; a única sorte é o Dado da Sorte, visível.
- **Elementos agem só pelo clima** (Fogo > Grama > Água > Fogo) — uma regra em vez de três tabelas.
- **Mapa aleatório em blocos, sem pistas fixas** (ideia do Vinicius) — nenhum tipo de montaria fica sem pista.
- **Skills aprendidas por nível** (8% por nível até lotar as vagas) — dá valor ao nível e ao cruzamento.
- **Pacotes de montaria só com moeda ganha jogando; Gemas só para cosméticos e passe** — a Lei 15.211/2025 veda caixa de recompensa paga em jogo de acesso provável por menores, e pacote pago também furaria "Gemas nunca viram Ouro".
- **Grau (★ a ★★★) dentro da raridade** — variação de qualidade sem criar uma 6ª raridade.
- **Status do potro sorteados na faixa do grau, não herdados** (pedido do Vinicius); as chances saturam no nível 30 e a égua pesa 60%.
- **Mítico fora do cruzamento** (só por despertar, depois das expedições).
- **Haras com reprodutores de aluguel e Troca; estábulo com vagas limitadas** — seguram a inflação de cavalos.
- **5 slots de equipamento com status dono; conjuntos por clima com bônus de 3, 4 e 5 peças** — cria a escolha antes da corrida.
- **Melhoria +0 a +10 com queda a partir de +6** (o Vinicius pediu chances menores); sorteio só pela seed.
- **Loja com Ouro; Pedra Negra só no pódio de corrida valendo; Lendário fora da loja até as expedições.**
- **Trava parcial com páreo aberto** — dá para trocar de conjunto pela previsão do clima, não para abrir a sala fraco e equipar forte.
- **Save migrado a cada versão em vez de chave nova** — não perder o Ouro do jogador.
- **`game.js` não será dividido agora** — o que sobrevive para a tecnologia final são os módulos puros (`sim.js`, `breed.js`, `gear.js`, `data.js`).
- **Testes unitários no `check.sh` e snapshot dos 3 potros de exemplo** — qualquer chamada de RNG a mais derruba o teste.

## 2026-11-05 — regras de trabalho
- **Uma conversa principal e uma branch por frente** — a principal integra na `main` e escolhe modelo e esforço por tarefa.
- **Design em `docs/GDD.md`; `CLAUDE.md` enxuto; memória versionada em `docs/memoria/`** — sessões na nuvem rodam em contêiner descartável.
- **`prototype/dist/` versionado** — abre o jogo sem rodar o build.
- **Protótipo sem dependências** (Playwright já instalado para os testes) — nada para instalar.
- **Não reorganizar `prototype/` antes de escolher a tecnologia final.**
- **Prêmios nunca crescentes por colocação; sem Ouro para a entrada, a sala vira treino** — correções do primeiro pente fino.
- **Pilares do GDD §2 aprovados** — corrida automática por seed, duas moedas (Gemas nunca viram Ouro), PVP de 4 a 8 com pote, ligas por Poder.
- **Nome do projeto "MMORPG Horse"; título do jogo "Galope Elemental"** (provisório até 2026-11-10, quando virou definitivo).
- **2026-11-13 · Explicações curtas ("ⓘ") em `GameData.HELP`; `STATS[k].desc` passa a ser o mesmo texto · o jogo e o wiki mostram uma frase só por conceito; no toque o texto abre embaixo do rótulo (`aria-expanded`, `role="note"`), sem re-renderizar a tela.**
