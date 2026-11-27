# Estado do projeto

**Auditoria e Fase 1 (2026-11-25, sessão local, que agora coordena):** auditoria da Fase 0 em `docs/auditoria/` e
roadmap adaptado (proposta) em `docs/roadmap.md`. Decisões D1–D9 tomadas (`decisoes.md`). Na `main`: T1 (LF), T2
(moldes-test no Windows) e T3 (Playwright em `prototype/tools`); o `check.sh` completo passa no Windows — instale uma
vez com `npm ci --prefix prototype/tools`. Feitos também o T15 (a sala saiu do `game.js` para o `sala.js`) e a D9
(salas justas e estreia: o inicial vence ~42% nas 10 primeiras salas e ~20% depois; metas ES1–ES3) e a D4 (ginásios
em sequência Grama → Água → Fogo, Comuns → Mágicos → Mágicos mais altos, times maiores; o AFK segue a fase) e a D2
(preparação: 12 s na sala para trocar de cavalo até o Poder da sala; no zero larga sozinha) e a D8 (a genética de
Sorte melhora a cruza, até 5 p.p., e o drop raro do AFK, até +15%; o Dado Viciado não soma Poder).
A D1 (vagas): o estábulo começa com 2 e compra até 5 (2.000 · 10.000 · 50.000); saves antigos ficam com as suas.
D3 e D5 (só texto: clima "+1,5 em cada status"; insígnias só no PVE antes do online) aplicadas.
Farm medido (`docs/auditoria/medicao-farm-vagas.md`): preços das vagas mantidos; o treino fechado rende 70%.
Texto de Gemas/VIP aplicado no `CLAUDE.md` §8 (o Ouro nunca é vendido; vantagens pagas só listadas, com teto).
D7 fechada: T3 (Playwright local) e T4 (CI no GitHub Actions, `.github/workflows/check.yml`: `check.sh` e balanço completo em cada envio para a main e em cada PR).
T5 (save seguro): migração e descarte guardam uma cópia em `:pre-v<N>` e o descarte avisa uma vez (`docs/superpowers/specs/2026-11-27-t5-copia-save.md`).
**Próximo:** T6 (aviso sem armazenamento); spec da loja (Gemas, VIP, vagas pagas) quando chegar o bloco 6;
tickets em `docs/auditoria/plano-fase-1.md`. O ramo `claude/fluidez` foi integrado (D6, 2026-11-26); `claude/salas-economia` fica como referência.

**Atualização geral de 2026-11-25 (pedido do Vinicius, para trabalhar numa pasta local):** a `main` recebeu a memória da
coordenação, o README com o passo a passo de clonar, jogar, gerar o build e enviar (capa corrigida) e as capturas oficiais
de `prototype/screens/` refeitas com a animação e o mapa. **Branch esquecido:** `claude/nifty-newton-e8u133` tem 21 commits
de 2026-11-18/19 que nunca entraram na `main` (balanço "cavalo superior vence" com Garra v2 e skills niveladas, ginásios em
sequência Capoeira → Remanso → Fornalha, mapa da Expedição antigo, medição de fluidez `fluidez.mjs` e trocas de tela mais
rápidas). Parte foi refeita depois por outro caminho (o mapa); o resto espera a decisão do Vinicius — não integrar sem ela.

**Fluidez das trocas de tela (2026-11-25, ramo `claude/fluidez`, fora da `main`; a integração é da coordenação).** Pedido
repassado pela coordenação como aprovado pelo Vinicius: trazer para a `main` de hoje a fluidez que ficou no ramo `claude/nifty-newton-e8u133`. Feito por
reimplementação (o mapa antigo não existe mais). Medição: `node prototype/tools/fluidez.mjs` (CPU 4× mais lenta, 360 × 780,
dpr 3, mediana de 5 rodadas, save com 8 montarias; do toque ao 2º quadro; na viagem, o pior intervalo entre quadros).
Antes → depois, em ms: aba Expedição 618 → 58 (2ª vez 88 → 58); viagem ao ginásio 349 → 39; voltar ao mapa 79 → 41; Haras
321 → 95; Estábulo 120 → 66; preparo 112 → 72; voltar do preparo 71 → 31; resumo → trilha 77 → 28; Desafiar → cena 152 →
76; pôr cavalo no time 72 → 43; voltar da ficha 114 → 65; voltar do Perfil 113 → 66; Loja 87 → 59; Mochila 60 → 57; ficha 63
→ 57; Correr ~45; Perfil ~35; resumo ~22 (sem ganho, já rápidos); carga ~1,0 s (sem ganho). **O que mudou** (`game.js`,
`sprites.js`; o que aparece na tela não muda): (1) o cache dos moldes recoloridos só é limpo na fronteira da corrida (era a
cada troca); (2) "aquecimento": imagens, cena de cada aba, mapa-múndi, trilhas e arenas montados em tempo ocioso depois da
carga (pronto ~3,5 s depois dela no perfil lento; quem toca antes monta na hora, como antes: a viagem aí engasga ~280 ms
uma vez); (3) o quadro do instante 0 das cenas, do mapa e das trilhas fica guardado; (4) retratos fora da tela desenhados
depois do 1º quadro (`adiaDesenho`); (5) mapa-múndi, trilha e cena de desafio em canvas na resolução de arte, ampliados
pelo CSS; (6) idle das cenas pintado em fatias. Bloco `fluidez` no `ui-test` (teto por troca, 80–170 ms, em série; ~1 min a
mais no `check.sh`). **Acima da meta de 60 ms:** Haras na 1ª visita (95: os retratos dos cavalos do Haras são pintados pela
1ª vez), Desafiar (76: ~35 ms são a simulação dos duelos, que é regra), preparo (72), Estábulo, voltar da ficha e do Perfil
(~66). O piso desta medição é ~20–35 ms (dois quadros). **Ideias não feitas:** cena das abas na resolução de arte (o cavalo
com efeito de raridade não sai igual a 1×; pediria desenhar o cavalo num canvas por cima), manter o DOM do cabeçalho e das
abas entre as telas (medido: o HTML custa 2–7 ms; o ganho seria pequeno), transição curta entre telas (mexe em foco e
capturas), aquecer os retratos do Haras, `content-visibility`, e a carga (~1 s: quase toda do HTML de 2,5 MB). Dois testes
do `ui-test` (marcas, portes) passaram a esperar os retratos adiados (`retratosProntos`). Capturas: as do fluxo regravadas num processo
só diferem das oficiais só no que já varia de uma rodada para a outra (partículas, chuva, o instante da íris, o potro
sorteado), e 59 de 64 capturas com movimento reduzido saem iguais pixel a pixel às do build de antes (as outras 5 são telas
que dependem da seed do perfil); as oficiais não foram regravadas. Build de teste do ramo (o `jogo-dev.html` com outro
título): https://claude.ai/artifact/WuzcYRrrDofQcgPCBFHcBK (versão 1). Os oficiais não foram republicados.

**Integração de 2026-11-24 (aprovada pelo Vinicius):** animação ambiente (etapas 0 a 6) + mapa dos ginásios (blocos A e
B: mapa-múndi vivo, viagem, trilha que se pinta, cena de desafio com as vistas Meshy e idle) na `main` por avanço direto
(77ba27e4), com o `check.sh` completo OK (83 blocos, 132 metas; desenho por quadro 2,17 ms). Republicados: jogo v18, DEV
v16, wiki v15, testadores v4. Próximas frentes visuais: tela inicial (3) e inventário (4).

**Integração de 2026-11-23 (aprovada pelo Vinicius: "pode integrar tudo na main e republicar"):** AFK (blocos A e B), forja,
bestiário, equipamento de PVE, reforja, Selo do campeão, as correções da revisão, o build dos testadores e o lote 1 de
ajustes (câmera, skills resumidas, sexo, selvagens escondidos) entraram na `main` por avanço direto (100e438), com o
`check.sh` completo OK (213 + 69 testes de regra, 139 de efeitos, 176 de moldes, 1064 do wiki, 132 metas, 81 blocos de
interface). Republicados: jogo (versão 16), DEV (14), wiki (13) e testadores (2, https://claude.ai/artifact/2McVg8D1wv5Qm8WWnSN8hL).
Em andamento: animação ambiente (`claude/animacao-ambiente`: plano aprovado, etapa 0 — integração visual P1 — feita no
ramo, esperando retorno); depois mapa dos ginásios, tela inicial e inventário.

**Próxima frente (2026-11-23): corrida AFK, drops, forja, bestiário e equipamento de PVE.** Spec
`docs/superpowers/specs/2026-11-23-afk-drops-design.md` e plano `docs/superpowers/plans/2026-11-23-afk-drops.md` (blocos A e B)
aprovados pelo Vinicius; a implementação parte da `main` (que já tem as skills com ranks e a direção de arte). O rancho
ficou só como ideia.


**Mapa dos ginásios, frente 2 das visuais (2026-11-24, ramo `claude/mapa-ginasios`, fora da `main`): amostra v1
publicada** em https://claude.ai/artifact/XkbbtUoHuAxcYFQ45thNTF (`prototype/arte/mapa-amostra.html`, gerada por
`node prototype/tools/mapa-amostra-build.mjs` a partir de `prototype/arte/mapa.html` + `mapa.js`; não toca em `src/` nem
`dist/`). Mostra: o mapa-múndi em tela única (ilha 256 × 384 por código: Fornalha no vulcão, Remanso no lago, Capoeira na
mata), vivo (mar, rio e lava em ciclo de cor, copas no vento, fumaça e bombas do vulcão, nuvens com sombra, pássaros),
névoa sobre o que não foi conquistado (só visual), medalhão do líder (cabeça do corpo 1:1), insígnia e "!" da revanche;
tocar num ginásio → aproximação 1×→2×→3× e íris na cor do elemento → a trilha (mapa de hoje, com ciclo de cor) com a pista
de terra que se pinta tile a tile ao vencer (ponte de tábuas sobre a água no Remanso), os estados das paradas e o cavalo
ativo (molde do jogo) trotando até o próximo oponente; e a volta. Lista de botões, teclado e leitor de tela; medidor de
custo (desenho do quadro ~0,2–0,4 ms no mundo e ~0,25–0,6 na trilha no contêiner). Ao lado, as capturas de hoje. Custo
zero. **v1 aprovada como direção (2026-11-24); piloto pago feito** (confirmado pelo Vinicius aqui; teto 15): 14
gerações (saldo 879 → 858), script `prototype/tools/arte-mapa-mundo.mjs`, folha `prototype/arte/folha-mapa-mundo.html`. A
amostra v2 (mesmo artefato) abre na ilha pintada A (s9902), com a B (s9901) e a v1 no seletor, os ginásios do piloto
assentados com sombra de contato e todos os candidatos embaixo. **Próximo:** escolha do Vinicius (ilha e ginásios),
retoques e a spec. **Guia de integração (`docs/arte/integracao.md`, na `main`) aplicado na amostra, só código (versão
3 do artefato):** ginásios com sombra de silhueta e capim na base, estandartes do líder no lugar dos medalhões, espuma
nas margens, névoa em massas de 2 × 2, bases de pedra e sombras dos treinadores e do cavalo na trilha, pista com borda
recortada e trecho fechado como chão pisado. Pendentes do Vinicius: D1 (REST pintado × Map Workshop) e D5 (origem das
referências); nada mais é gasto antes. **Decisões de 2026-11-24 (via coordenação, confirmadas aqui):** ilha B; ginásios
Fogo s9921 e Água s9932; Capoeira refeita (s9953, 3 gerações); referências do Vinicius são da vitrine do PixelLab e
ficam só como alvo de comparação; mapa pintado é o principal, com o exemplo de mapa de peças feito (9 gerações) para
comparar; **a cena de desafio passa a ser desta frente**, na direção de batalha de RPG de criaturas (oponente de frente no
alto à direita, o nosso de costas embaixo): piloto da Brasa feito (12 gerações), na amostra (versão 5). Gasto da
rodada 2: 24 gerações (saldo 848 → 824). Próximo: escolha do candidato de costas e da vista de frente, estimativa do
lote (12 moldes, de costas e de frente, com idle) e a spec. **Versão 6 (retorno do Vinicius à 5):** um padrão só de
cavalo (a trilha trota com o mesmo desenho do parado, passo de 1 px); a cena de desafio com o chão da arena como plano
(oponente e líder pisando no fundo, o nosso na frente cortado pela borda, marcas de terra gasta no chão, sombras deitadas
no piso), arena 1 e arena 0 no seletor. Lote dos 12 cavalos NÃO aprovado; o oponente de frente no estilo do molde pede
teste pago (perguntado). **Versão 7:** o Vinicius aprovou o teste de frente (10 gerações, saldo 824 → 814): saiu todo de
lado, então o oponente passou a ser o próprio molde espelhado (mesmo traço). Pedido dele sobre a arena: os jogadores
"dentro do cenário", com a arena só de fundo: a imagem da arena vale até o horizonte e abaixo dele há um piso em
perspectiva por código, onde todos pisam. Vista de frente no estilo do molde segue em aberto (outra técnica a estudar). **Versão 9 (2026-11-24):** arena 0
escolhida; nome na cor da raridade; comparação de ferramentas aprovada pelo Vinicius: PixelLab inpaint (10 gerações,
814 → 804), Meshy 3D (30 créditos, 465 → 435; um cavalo 3D renderizado em pixel em 8 vistas coerentes, o melhor
resultado para frente/costas), Canva (2 fundos, só prévias), Gemini bloqueado (conta sem créditos pré-pagos). Chaves do
Meshy e do Gemini salvas no ambiente (proxy), nunca no código.
**Versão 10 (2026-11-24):** rodada aprovada pelo Vinicius: Meshy 2º cavalo (Ipê, porte robusto, crina de folhas; 30
créditos, 435 → 405): o porte aparece, a crina de folhas virou manchas; troca de cor funciona sem modelo novo só onde as
cores dos papéis não se misturam (na Brasa crina e jóquei dividem tons), então "1 modelo por porte + recolor" pede modelos
nascidos de imagem com cores puras por papel, e o formato da crina exige outro modelo. Canva: os 2 fundos exportados em
1920 × 1080, reduzidos à grade e usados como arenas "Canva 1/2" na cena (créditos do plano). Gemini: a chave nova está
salva, mas no cabeçalho Authorization; a geração de imagem é só na API nativa, que lê `x-goog-api-key` (401, nada
cobrado); o Vinicius mudou o cabeçalho e o teste rodou (4 variações, ~US$ 0,155): a cena volta quase igual, com
sombras de contato um pouco mais marcadas; ganho pequeno.
**Lote do Meshy por molde (opção A, 2026-11-24, confirmado pelo Vinicius aqui):** Ipê refeito a partir do molde em cores
puras por papel (30 créditos) e, aprovado o resultado, os outros 10 moldes (300 créditos; saldo 405 → 75; 330 dos 360 do
teto). O render volta cada pixel ao seu papel (formato dos moldes) e a amostra recolore como o jogo (versões 12 e 13).
A Brasa (padrao-chamas) também foi refeita pelos papéis (30; saldo 45): os 12 moldes prontos, 360 créditos, o teto.
**Spec:** `docs/superpowers/specs/2026-11-24-mapa-ginasios-design.md`, com as 4 escolhas do Vinicius (sem marcas nas vistas 3D
na v1, cena de 256 × 160, crina cheia aceita, plano começando pelo mapa e pela trilha). Âncoras das vistas de frente e de costas (`meshy-ancoras.json`, script `arte-desafio-ancoras.mjs`) entregues à frente 1,
que já ligou o `IdleMolde` a elas (claude/animacao-ambiente, 7bf5977). **Spec aprovada pelo Vinicius (2026-11-24).** Plano: `docs/superpowers/plans/2026-11-24-mapa-ginasios.md` (bloco A: mapa,
transição e trilha, sem custo; bloco B: vistas de frente e de costas nos moldes, chão por elemento e a cena), aguardando
aprovação. `main` (e157f3f5) trazida para o ramo. **Plano aprovado pelo Vinicius (2026-11-24); bloco A implementado:**
`prototype/src/mapa.js` (mundo, trilha, viagem; testes em `prototype/tools/mapa-test.js`, no `check.sh`), arte do mapa no
build (`window.__MAPA_MUNDO`, +35 KB), mapa-múndi na aba Expedição (acima dos cartões; tocar = cartão), viagem com zoom e
íris, trilha com a pista que se pinta e o cavalo ativo (o fundo animado das trilhas fica com a frente 1, por
`window.Ambiente.cena('mapa:<el>')`, com a máscara do caminho), bloco `expedicao-mapa` no `ui-test`, capturas final-24 e
final-25 novas. `check.sh` completo OK (82 blocos de interface, 132 metas). DEV do ramo publicado para teste:
https://claude.ai/artifact/EmQzDqJgwnWjZAgagDkXcC. Nada na `main`. **Bloco B implementado (2026-11-24):** as vistas de frente
e de costas dos 12 moldes (`assets/arte/desafio/vistas/`, `arte-desafio-moldes.mjs`) entram nos moldes pelo `lerMoldes`
(tudo ou nada) e o `drawHorse` aceita `vista: 'frente' | 'costas'` (sem marcas); a cena de desafio é a `Mapa.cena`: arena 0,
256 × 160, piso por código na Fornalha e o chão pintado da arena no Remanso e na Capoeira, oponente de frente com o
treinador, o nosso de costas, marcas e sombras deitadas, placas no canvas (nome na cor da raridade, nível, fôlego do duelo
gravado; o texto também em HTML para o leitor de tela). `check.sh` completo OK; DEV republicado (versão 2 do mesmo
artefato). Fica para a integração com a frente 1: o idle nas vistas (a linha do `vivo` no `drawHorseMolde`, que ela faz) e o
fundo animado das trilhas (`Ambiente.cena`, já ligado do meu lado). Próximo: integração na `main`, quando a coordenação e o
Vinicius decidirem. Lote dos 12 cavalos segue não aprovado.
Depois: spec em `docs/superpowers/specs/` e plano. A spec da animação (frente 1) já lista os mapas das trilhas no §3.4;
o ambiente das trilhas fica com ela, e o mapa-múndi e a trilha de terra com esta frente.

_Atualizado em 2026-11-23 (ajustes de interface, lote 1)._

**Em andamento (2026-11-23): corrida AFK, drops, forja, bestiário e equipamento de PVE**, no branch `claude/afk` (chat
próprio de implementação). Spec `docs/superpowers/specs/2026-11-23-afk-drops-design.md` e plano
`docs/superpowers/plans/2026-11-23-afk-drops.md` (blocos A e B), aprovados pelo Vinicius. **Blocos A e B prontos (seções próprias
abaixo), esperando a revisão do chat de coordenação; nada foi integrado na `main` nem republicado nos oficiais.** O rancho
ficou só como ideia.

**Ajustes de interface, lote 1 (2026-11-23, ramo `claude/ajustes-1`, a partir de `claude/afk`; fora da `main`):** quatro
pedidos do Vinicius, um commit cada, com teste. (1) **Câmera centrada no jogador**: 12 px/m de perto, afasta só o
necessário para caber, inteiro, quem está a até 30 m (à frente ou atrás), suave e sem saltos; além de 30 m, a seta com os
metros (`RaceFx.CAMERA`, `camZoomAlvo`, `camEsquerda`, `camSuaviza` no `fx.js`; 11 testes no `fx-test`; bloco
`corrida-camera` no `ui-test`). Escala inteira mantida (o zoom é em metros por pixel de arte). (2) **Skills em resumo**:
nome, rank e `resumo` (novo em `GameData.SKILLS`, teste no `sim-test`) na aba Skills (vagas, tipo e Garra), na escolha do
Cupom e no resultado; o texto completo num balão (`skillDicaHtml`/`dicaAreaHtml`, `aria-describedby`; mouse e foco por
cima, toque embaixo, Esc fecha); bloco `skills-resumo` no `ui-test`. O wiki não muda. (3) **Símbolo ♂/♀** (ícones
`ui-macho`/`ui-femea`) ao lado do nome no Estábulo e na cabeça da ficha, com "macho"/"fêmea" acessível. (4) **Expedição**:
os cavalos selvagens viraram um bloco recolhido e desativado com o selo "em breve" (some a vitrine animada que fazia a
`final-10-expedicao.png` mudar a cada rodada). Decisões em `decisoes.md`. **Verificação:** `check.sh` completo OK (213 testes de
simulação + 69 do AFK, 139 de efeitos, 176 de moldes, 25 camadas de arte, 1064 conferências do wiki, 132 metas do
balanço rápido e 81 blocos de interface); custo por quadro sem piora (mesmas condições, antes → depois: chuva e ventania a
1280 1,91 → 1,77–2,19 ms; 8 Míticos 1,96 → 1,91–2,13; portes 2,04 → 1,94–2,07; ruído da máquina). Capturas oficiais
regeneradas (39 mudaram, nenhuma nova nem removida). **Artefato de teste novo** (jogo de produção do ramo):
https://claude.ai/artifact/KnwuELhSrLKrMSEmNtAZ4N. Os oficiais não foram republicados; nada na `main`.

**Em andamento (2026-11-23): animação ambiente, entrega 1 (amostra)**, no branch `claude/animacao-ambiente` (frente 1 de 4
das visuais; depois vêm o mapa dos ginásios, a tela inicial e o inventário). Pedido do Vinicius: nenhuma imagem parada
(vulcão em erupção, placas ao vento, folhas, pássaros, cavalos com idle natural), qualidade sempre. **Amostra publicada**
em https://claude.ai/artifact/2azaDeDRV77ZhvYCuhQNmz (`prototype/arte/animacao-amostra.html`, gerada por
`node prototype/tools/arte-animacao-build.mjs` a partir de `prototype/arte/animacao.html` + `animacao.js`; não toca em
`src/` nem `dist/`). Quatro cenas, cada uma "hoje" (parada) ao lado da animada, com medidor de custo por camada
(liga/desliga): **Litoral** (mar e rio por ciclo de cor, farol, veleiros, coqueiros e capim que dobram com o vento,
torcida, bandeirolas, placa de madeira que balança e gira, biruta, gaivotas, areia, cavalos em idle na largada),
**Fornalha** (a arena gerada não tem vulcão: o pico da esquerda virou vulcão por código; fosso e encostas de lava, ar
quente, braseiros, emblemas, brasas), **Expedição** (vulcão, rio, placas que giram no poste, capim, pinheiros, nuvens
finas, pássaros, folhas) e **Cavalos** (idle em camadas no Haras: respiração, piscar, cauda, orelha, cabeça, crina ao
vento; botões para disparar). Tudo por código, custo de crédito zero, RNG só cosmética (mulberry32 de semente fixa, fora
da seed). Custo medido no contêiner: 0,3–0,6 ms por quadro de animação (≈ 1,2–1,6 ms num celular médio pela régua ×4 do
teste de engine; orçamento 2 ms), ≤ 160 chamadas de desenho e ≤ 90 partículas. **Retorno do Vinicius (2026-11-23, pela coordenação):** a versão
atual está **aprovada como a principal**; pediu uma variante **"mais movimento"** para comparar, feita na mesma página
(seletor "Atual / Mais movimento" em cada cena: rajada forte que dobra tudo junto, ondas que quebram na mureta, "ola" na
torcida, revoadas em V, redemoinho de folhas e areia, jorros de lava, bolhas no fosso, corredeira, borboletas, gestos dos
cavalos a cada 1–3,5 s e o "sacudir a cabeça"); medidas no contêiner (atual / mais): Litoral 0,48/0,47 ms, Fornalha
0,19/0,27, Expedição 0,25/0,32, Cavalos 0,08/0,21 (≤ 1,3 ms no celular médio; ≤ 270 chamadas, ≤ 140 partículas).
**Piloto pago rodado** (confirmado pelo Vinicius): 6 gerações do `animate-with-text-v3` no molde padrão-lisa
(`prototype/tools/arte-animacao-piloto.mjs`; PixelLab 915 → 909), quadros em `prototype/assets/pixellab/idle/`, no
painel "PixelLab × código" da cena dos cavalos: comer (8102) e cavar (8111) bons e naturais, o que o código não faz;
cauda e respiração o código já resolve. **2ª rodada (2026-11-23/24):** o Vinicius
escolheu a **"mais movimento"** como padrão e pediu a **vegetação e a água mexendo sempre** (feito: folhas dos coqueiros
ondulando, capim em onda contínua, espuma na mureta, matas e pinheiros balançando, espuma descendo o rio, pasto do Haras
com faixas de brilho; amostra na versão 3, abrindo na escolhida; Litoral em 0,46–0,54 ms ≈ 1,8–2,1 ms no celular, no
limite: o remédio é pré-assar os loops, na spec). **Lote pago autorizado e rodado**: comer e cavar nos 12 moldes, 30
gerações (o teto; PixelLab 909 → 879), os 24 limpos depois de apagar por código os fiapos de capim soltos da boca no
comer; painel com o seletor dos 12 moldes na amostra. **Spec da entrega 2 escrita**:
`docs/superpowers/specs/2026-11-23-animacao-ambiente-design.md` (todas as imagens, arquitetura `ambiente.js` +
manifesto + pré-assado, orçamento por tela, custo, testes, ordem). **Spec aprovada (2026-11-24)**, com os opcionais
cata-vento e cavar com jóquei (o vulcão por VFX fica para depois); pedido de qualidade: "o personagem não pode parecer
PNG por cima do fundo" (referências em `docs/arte/referencias/2026-11-24-estilo-*.png`, no branch da coordenação; guia
de integração a caminho). **Opcionais rodados**: cavar com jóquei nos 12 moldes (14 gerações, todos limpos) e o
Planalto sem as pás (3 gerações de `/inpaint` + preenchimento por código; rotor de 4 pás por código, cena nova
"Planalto · cata-vento" na amostra). Sombra de contato sob os cavalos já na amostra (versão 5). **Plano escrito**:
`docs/superpowers/plans/2026-11-24-animacao-ambiente.md` (6 etapas; divisão com o chat do mapa: esta frente faz o
ambiente dentro dos mapas das trilhas). O **guia de integração visual** (`docs/arte/integracao.md`, na `main` desde 93d4741) entrou no
plano como **etapa 0, antes de animar mais coisa**: os P1 só de código (sombra opaca na rampa do chão, LUT de luz e
clima por rampa no atlas, pelagem dos moldes em 4 tons por sombreado de código — os crus têm quase só 2 tons —,
constantes na paleta, contato e casco sem patinar com base de quadros comum de 12 q/s, leitura por valor); D1–D6 com o
Vinicius, nada da etapa 0 depende delas. **Plano aprovado (2026-11-24). Etapa 0 feita no ramo** (sem integrar na `main`
nem republicar os oficiais; um commit por item): 0.4 `prototype/src/luz.js` (rampas da R64, `degrau`, `valor`,
`sombraDoChao`) e as cores fixas do molde na paleta; 0.1 sombra opaca na rampa do chão (lateral +2 px; silhueta na
diagonal pixel a pixel sobre o chão pintado no desafio; treinador; catraca do alfa parcial no `arte-check`: fx 20,
sprites 12, game 6); 0.3 pelagem e crina em 4 tons por sombreado de código **na recoloração, sem mudar o formato dos
PNGs** (desvio do plano, que previa papéis novos com cinza × 17: o resultado é o mesmo, sem regerar os 12 moldes); 0.2
LUT por degrau de rampa (`Luz.lutCondicao`: nublado −1, chuva −2, névoa +1 com tinta neutra; tarde/noite/calor prontas),
figura com LUT mais branda (chuva −1), pré-assada por clima na largada, virada em passos (sol → nublado → chuva), tinta
de cena e contraluz (Fornalha, Estábulo, Remanso); 0.5 contato por raia, poeira no pouso presa ao chão em 2 tons, sombra
da cerca, palha/tufos na frente dos cascos, amostra em 6/12 q/s; 0.6 leitura por valor (degrau do piso das raias por
tabela, L* ≥ 5 onde dá; terra ao sol de 0 para 13,9). **Decisão pendente do Vinicius (C11):** casco sem patinar exige
galope a ~36 q/s porque a corrida é reproduzida ~2× comprimida (o chão anda ~400 px de arte/s); na cadência natural de
hoje o casco patina ~15 px por quadro; a gaveta DEV tem "galope casado com o chão" para comparar (0,25 px). `check.sh` completo
OK (8/8, 81 blocos; desenho por quadro a 1280 com chuva e ventania 2,05 ms, era 1,62). **DEV de teste do ramo:**
https://claude.ai/artifact/JRBwAmXN9cRi4ABWuD5cEn; **prancha antes × depois** (1×, 3×, cinza, C1–C12):
https://claude.ai/artifact/CexCcMiyqTZcwrGcfKR5tn (`node prototype/tools/prancha-etapa0.mjs`). **Etapa 0 aprovada
(2026-11-24, "Prossiga")**; casco: **opção C** (meio-termo, média geométrica entre a cadência natural e a casada: patina
4,6 px em vez de 14,7), com as 3 na gaveta DEV. **Etapa 1 feita** (motor): `prototype/src/ambiente.js` (UMD; o motor e as
cenas saíram da amostra sem mudar um pixel, conferido por hash), API `Ambiente.cena(id)`, manifesto
`prototype/assets/arte/animacao.json` (peças, rampas e pontos por imagem; as cenas leem dali), folha de máscaras
(`prototype/tools/arte-animacao-mascaras.mjs`), pré-assado por estado da peça (coqueiros, torcida, araucárias; ≤ 1,42 MB
por tela), testes no fx-test e no arte-check. **Achado e corrigido:** desde que o "fatia" saiu, as peças da deformação
do Litoral e do Planalto ficavam paradas na tela da amostra (faltava o putImageData). O motor ainda não está no build do
jogo (entra quando o jogo usar, etapa 3). **Etapa 2 feita (cavalos vivos no jogo):** âncora `olho` nos 12 moldes
(`moldes-lib.mjs` olhoMolde + `prototype/tools/moldes-olho.mjs`; 4 à mão no OLHO_MANUAL), `Sprites.IdleMolde` (idle de
código pintado pelo pipeline do molde) e os gestos do PixelLab (comer e cavar no retrato, cavar com jóquei no parado; a
cada 15–30 s, embutidos no build: +240 KB) no Estábulo, no desafio e na espera da largada (`opts.anima`). Folha:
`node prototype/tools/folha-cavalos-idle.mjs`. O esguio-chamas parado não abana a cauda (a crina não fica atrás da
garupa). **Etapa 3a feita:** o motor e o manifesto
entram no build; topo da Expedição e do Haras (com até 2 cavalos do jogador vivos no pasto) e a arena da Fornalha
animam no laço "vivo" (`AMB_ABA`/`AMB_ARENA` no game.js); bloco `ambiente` no ui-test (em série; 0,21 / 0,12 / 0,14 ms
por quadro a 60 q/s; "Reduzidas" parado). O vulcão da Fornalha fica no corte de cima da arena do desafio (não aparece
nela). **Etapa 3b feita:** cenas novas do
Estábulo (lampiões, poeira dourada, poeira no ar, feno nas rajadas) e da Loja (lanternas, lanternas verdes, poções com
bolhas e brilho, luz do chão — atrás da placa do título —, poeira no facho), no manifesto e no jogo; as 4 abas animam
(0,04 / 0,07 / 0,24 / 0,11 ms por quadro a 60 q/s). Remanso e Capoeira ficaram fora: a cena de desafio vai ser trocada
pela da frente 2 (o `IdleMolde` já aceita as vistas de frente e de costas dela). **Etapa 5 feita (regiões na
corrida, adiantada pela coordenação; a 4 espera a spec do mapa):** `Ambiente.regiao` / `RegiaoViva` no `ambiente.js`
(uma por região e clima, montada aos poucos na contagem da largada pela fila do `sprites.js`: `setAmbiente`,
`regiaoViva`, `prepararRegiaoViva`, `statsViva`); as 5 camadas vivas no lugar das paradas (mesmo tamanho, paralaxe e
recorte do arco) e o que vai por cima (sol girando, nuvens em 2 velocidades, pássaros e revoada, placa e biruta na
cerca em carimbos de 12 q/s, fumaça, pétalas, areia, rotor). Litoral: mar em ciclo de cor (ciclo de 8 s guardado),
farol, veleiros, espuma, coqueiros (cache comum entre climas), torcida e varais; Planalto: `meio-sem-pas` + rotor de
24 ângulos, copas, nuvem baixa entre os picos; Várzea: reflexo da lagoa e brilhos, copas, bandeiras, torcida; Cerrado:
neblina, copas e pétalas dos ipês, bandeiras; Sertão: ar quente, fumaça da chaminé, juazeiro, caatinga nas rajadas,
bandeirinhas de São João. Capim de todas num laço próprio (`OndaRapida`). Custo do ambiente na corrida (1280, chuva e
ventania; passo + o que vai por cima): Litoral 0,27, Sertão 0,22, Várzea 0,19, Planalto 0,18 ms por quadro; partículas
≤ 60. Linha de base (pedido da coordenação, mesma condição, 3× cada): desenho por quadro `main` 2,04 / 1,71 / 2,03 ms
(média 1,93) e o ramo antes da etapa 5 2,32 / 2,17 / 2,18 (média 2,22): +0,3 ms reais da etapa 0 (perfil: `drawImage`
da sombra, da faixa de contato e da poeira de pouso). Cenário escolhido na gaveta DEV ("Cenário das corridas"). Verificação: `check.sh` completo OK (166 testes de
efeitos, 82 blocos); corrida a 1280 com chuva e ventania, com e sem a região viva na mesma página (3× cada):
~2,45 ms contra ~2,15 ms no regime (+0,25–0,3 ms, o custo do ambiente). DEV v6 publicado no artefato de teste. **Etapa 6, a parte sem o aparelho:** spike do teste de engine na v4
(regiões + ambiente vivo + o que a etapa 0 pôs na corrida; botão "Etapa 6: rodada de 60 s" com o veredito), publicado
em https://claude.ai/artifact/4CGJheLECVrZRwuynZi3jH, rodada no celular do Vinicius (`docs/teste-engine.md` §7.1). **Achado da etapa 6 (S24 FE):** a rodada de 60 s
reprovou pelo cenário nas **subidas**: a hachura diagonal pintada com ~19 preenchimentos por padrão custava até 20–28 ms
por quadro no aparelho (no contêiner, nada). Corrigida sem mudar o desenho (tira pré-desenhada + relevo em tela à parte),
com testes no bloco `teto`; commits isolados 40f9fe46 + e157f3f5 sobre a `main` no ramo `claude/fix-subidas-gpu`
(push com OK do Vinicius, para a coordenação levar à `main`) e integrados aqui. Spike com o diagnóstico, as subidas e a
medição por parte do cenário (`o.perfil` do `drawTrack`). Etapa 6 de 60 s de novo no aparelho, com a correção: 0,2% dos quadros acima de 20 ms (passa) e 1% low 52,5 (não chega a
55); JS 4,7/6,6 ms, cenário 1,3/2,6/4,1. Os 7 quadros lentos parecem o ritmo da tela, não o desenho
(`docs/teste-engine.md` §7.1). **Sem a trava em 60 (como o jogo roda, no ritmo da tela): 119,1 FPS, 1% low 69,4,
1 de 7.138 quadros acima de 20 ms, JS 3,1/4,3 ms — passa.** Os soluços eram da trava do spike numa tela de 120 Hz.
Decidido: sem trava por enquanto; **pendente perto do lançamento:** a trava em 60 para poupar bateria, com um método
melhor que o acumulador da v3. A correção das subidas entrou na `main` (e157f3f5) e os oficiais foram republicados pela
coordenação. A spec do mapa foi aprovada: a etapa 4 segue quando o plano do chat do mapa definir a camada. Capturas
oficiais com o tempo congelado: `?quadro=<segundos>` no jogo (o laço "vivo" parado nesse instante) e o `ui-test`
abrindo as páginas com `quadro=3` quando grava em `prototype/screens/` (o bloco `ambiente` abre sem). Fora:
garças da Várzea (cabeça que abaixa) e a revoada de garças. **Etapa 4 (mapas das trilhas) feita no ramo (2026-11-24):**
`Ambiente.CENAS['mapa:agua'|'mapa:fogo'|'mapa:grama']` no `ambiente.js` (correnteza em riscos, espuma, coqueiros e junco,
peixe; lava em ciclo de cor pela distância da fenda, brasas, fumaça, tufos; copas ao vento, sombras de nuvem, borboletas,
folhas), tique de 8 q/s, desenho direto no buffer do mapa; custo 0,105/0,113/0,286 ms por quadro (teto 0,35); 2 testes
no `fx-test` (determinismo, paleta, nada nasce no caminho). Vitrine: https://claude.ai/artifact/AAxGUNY1Fa8SjoRNTrfoRW
(`prototype/tools/mapas-vivos-vitrine.mjs`). `check.sh` completo OK (168 de efeitos, 82 blocos de interface); DEV
versão 7. A frente 2 já passa `{ imagem, caminho: MP.mascaraCaminho() }` no `trilhaObj` (entra no `claude/mapa-ginasios`
depois do bloco B). **Junção com o mapa dos ginásios (2026-11-24, pedido da coordenação):** `claude/mapa-ginasios`
(blocos A e B, 4a7f485) juntado neste ramo (19417636), sem rebase; conflitos resolvidos preservando os dois lados (a cena do
desafio nova do `mapa.js` fica, com a luz de cena e o clima dos cavalos do `pintaMolde`; a escada de clima da corrida
volta; o `?quadro=` congela o laço vivo novo). O fundo das 3 trilhas anima no jogo; o idle vivo vale nas vistas de frente
e de costas (`drawHorseMolde`; o `mapa.js` redesenha o cavalo da cena pelo idle, sem o balanço da figura inteira). A
arena antiga da Fornalha saiu do motor (`CENAS.fornalha`, a entrada `ginasios/fogo` do manifesto e da folha das máscaras;
a amostra antiga fica sem ela). Custo da cena do desafio com o idle: `IdleMolde.chave(t)` (chave sem montar o mapa),
opções fixas por cavalo, consulta a 10 q/s, pré-pintura dos próximos segundos; o idle soma ~0,03 ms por quadro (bloco
sozinho 0,69 ms; régua 1,2). O bloco `fluxo-capturas-ginasio` foi para a fase em série do `ui-test-paralelo` (mede tempo
real; em paralelo passava da régua até sem o idle). Com `?quadro=`, o que anda por dt nos mapas segue o relógio.
`check.sh` completo OK (b203f58e; 83 blocos, 4 por vez + 11 em série); capturas oficiais regeneradas. DEV versão 8;
jogo de teste novo: https://claude.ai/artifact/6dBBKxNgCobippyXKbVn2c. Nada na `main`: a coordenação leva depois do OK
do Vinicius.
Quando os ramos se juntarem: 'frente'/'costas' na condição do `vivo` do `drawHorseMolde`. Total gasto na frente: 53 gerações (saldo 848; caiu 14 a mais no período, provavelmente outro chat na mesma conta). O olho de cada molde deve virar âncora no JSON (a busca automática
falha no robusto-folhas; na amostra está à mão).

**Teste de engine fechado e na `main` (2026-11-23): fica web** (relatório em `docs/teste-engine.md`; Godot só volta se um
aparelho-alvo ficar abaixo de 45 FPS no 1% low até em escala 1×). Steam no escopo (Electron + steamworks.js). Antes do
lançamento: rodada longa travada em 60 FPS no celular e bateria num Android fraco.

**Em andamento (2026-11-21):** as **skills com 100% de ativação e ranks**, com a Garra também sem falhar, **entraram na
`main` em 2026-11-21** (pedido do Vinicius; seção própria abaixo) e os três artefatos oficiais foram republicados; o teste de engine web × Godot 4 num chat próprio
(`claude/teste-engine`); e a direção de arte noutro (`claude/direcao-de-arte`): guia aprovado em 2026-11-20 (`docs/arte/guia.md`, pesquisa em `ferramentas.md`, custos em `custos.md`); **amostra da corrida no Cerrado publicada (versão 2, com a interface de hoje e a câmera mais rápida, depois do retorno do Vinicius)** em https://claude.ai/artifact/VnjQHdXSZ1cP45e9xCVsi2 (`prototype/arte/corrida-amostra.html`, gerada por `node prototype/tools/arte-amostra-build.mjs`; assets em `prototype/assets/arte/`, script pago `prototype/tools/arte-amostra.mjs`). Gasto até agora: 6 gerações do PixelLab e US$ 1,96 da Retro Diffusion. Amostra aprovada em 2026-11-20; **plano em 9 etapas** em `docs/superpowers/plans/2026-11-20-direcao-de-arte.md` (~930 gerações e ~US$ 12–15 previstos; as etapas que tocam `prototype/src/` esperam as skills com ranks entrarem na `main`). Plano e regiões aprovados em 2026-11-20 (interface por código). **Etapa 0 pronta**: `arte-check.mjs` (no `check.sh`, etapa 5), `folha-arte.mjs`, `arte-regioes.mjs` (`--finalizar` e as fases pagas), `rd-comum.mjs`, manifesto `prototype/assets/arte/regioes.json`, finais do Cerrado em `prototype/assets/arte/cerrado/`. Gasto total: 6 gerações do PixelLab e US$ 2,08 da RD (saldo US$ 2,92). Fase 1 das 4 regiões gerada em 2026-11-20 (8 gerações + US$ 1,60; folhas em https://claude.ai/artifact/94uGAXsg6DtMpk1mcFbkPL): boas os 4 horizontes, os coqueiros do Litoral, o junco da Várzea e o capim do Planalto; falharam a mata da Várzea, a caatinga e a cana do Sertão e as araucárias do Planalto. Refação (fase 1b, US$ 1,00) e fase 2 (US$ 2,24, depois da recarga de US$ 5 do Vinicius) feitas: **as 5 regiões têm as 5 camadas finais** (`prototype/assets/arte/<regiao>/`, 25 camadas no `arte-check`), e a amostra ganhou o seletor de região (versão 4). O Vinicius pediu e foram feitas as duas correções: a arquibancada do Sertão refeita com torcida (US$ 0,20) e a mata da Várzea descida 28 px (`posicao` no `regioes.json`) para a lagoa aparecer. Saldo RD US$ 2,88; PixelLab 1.525. **Regiões aprovadas pelo Vinicius (2026-11-20).** As skills com ranks ainda não estão na `main`, então a próxima é a parte da etapa 4 que não toca o código: piloto dos ícones feito (16×16 pelo `/resize` e pelo Pixen: 16 gerações; 24×24 pelo `/resize`: 3 gerações; nenhum bom). O Vinicius escolheu a recomendação (ícones simples em 16×16 desenhados em código, complexos em 24×24); primeira leva de 8 ícones em código pronta (`prototype/tools/icones16-mapas.mjs`). Ícones: traço de código aprovado; lotes Pro dos complexos rodados (200 gerações; PixelLab em 1.276); conjunto final dos 74 montado (`prototype/tools/icones-final.mjs` → `prototype/assets/arte/icones/`, folha publicada). Três ajustes pedidos pelo Vinicius feitos sem gastar: raridades tingidas no medalhão inteiro, `el-geral` redesenhado (pedra com runa) e insígnia da grama trocada pelo candidato 38 com o anel dourado. **Ícones aprovados (2026-11-20)**. Etapa 5 começou: `prototype/tools/arte-treinadores.mjs` (Pro; corpo de ~40 px em 32×48 e busto 64×64); piloto da Capitã Labareda gerado (20 gerações; PixelLab em 1.256; folha https://claude.ai/artifact/WoPGrWFPtYT75xTFGou25L), Labareda: corpo 00 e busto 00; lotes `corpos` e `bustos` dos outros 14 gerados (280 gerações; PixelLab em 966). Escolhas do Vinicius: 00 e 00 para todos; o corpo do Recruta Broto (43 px no lote) foi refeito num quadro de 36 (15 gerações; PixelLab em 951) e ficou o 08, com 33 px. Os 30 escolhidos estão em `prototype/assets/arte/treinadores/finais/` (`arte-treinadores.mjs finais`). Conjunto aprovado pelo Vinicius (2026-11-20). Fundos dos 3 ginásios gerados (`arte-ginasios.mjs`, US$ 0,96; RD em US$ 1,92; folha https://claude.ai/artifact/Uf3s9WFBpTHn69TJanvkhi): as paredes boas, mas os pisos vieram como salas inteiras em perspectiva e não casam com a parede; o Vinicius pediu cenário aberto: arenas ao ar livre em 256×160, uma imagem por ginásio, geradas (4 de cada, US$ 0,72; RD em US$ 1,20). Escolhidas pelo Vinicius: Fornalha 1, Remanso 0, Capoeira 2 (`prototype/assets/arte/ginasios/finais/`). **Assets da etapa 5 fechados** (15 treinadores em corpo e busto, 3 arenas); a troca no jogo é a parte de código da etapa 5. Etapa 6: cenas das 4 abas (US$ 0,96; RD em US$ 0,24) e mapas das 3 trilhas (6 gerações; PixelLab em 945) gerados; prévias no jogo (`arte-telas-previa.mjs`) e dos mapas com caminho e oponentes. Escolhas do Vinicius: Estábulo 3, Haras 3, Loja 1, Expedição 3; mapas fogo 9841, água 9852, grama 9862 (`prototype/assets/arte/telas/finais/`). **Assets da etapa 6 fechados**; a integração é a parte de código. Etapa 7: emblema (25) e ícone do app (8) gerados (30 gerações; PixelLab em 915), letreiro desenhado em código (`arte-letreiro.mjs`), logos de prévia montados. Escolhas do Vinicius: emblema 10, ícone 03. Logo, ícone 512, destaque do Play 1024×500 e capa montados em código (`arte-capa.mjs`, captura da amostra no modo `?captura=`). Marca aprovada (2026-11-20). **Etapa 8, a parte sem código feita**: texto dos créditos (`docs/arte/creditos.md`), rascunho da declaração de IA da Steam (`docs/arte/declaracao-ia.md`), GDD §8a e a lista do que sai na integração (no plano). **Todos os assets do plano estão prontos e aprovados.** **Integração, etapa 1a pronta (2026-11-21, ramo `claude/direcao-de-arte`, ainda fora da `main`)**: interface toda em Galmuri na grade de pixel (`--px` = s / densidade, `s = min(floor(largura × densidade / 240), floor(altura × densidade / 300))`, `aplicaGrade` no `game.js`); Press Start 2P e Jersey 10 saíram (o wiki ainda usa as dele, da internet); o Pular ignora o 2º clique de um toque duplo no Largar; limites de altura do `ui-test` remedidos com a fonte nova. Spec: `docs/superpowers/specs/2026-11-21-arte-etapa1.md`. **1b pronta (2026-11-21)**: tokens do `game.css` na Resurrect 64 pelos papéis do guia (teste no `moldes-test`), cores dos cavalos levadas à mestra na recoloração (`naMestra`/`coresNaMestra` no `sprites.js`, o save não muda; os tons derivados ficam do lado certo da base), cavalos 1:1 nos retratos (pequeno 64×56, normal 96×72, grande 96 de altura e a largura da coluna), no pódio (224 px de arte, o 1º pelo degrau, não maior) e na cena do desafio; contraste ajustado à paleta. Build DEV do ramo publicado em https://claude.ai/artifact/CevdHXdTBRPpbXEMFY1HTY (2026-11-22). Etapa 2 em andamento (1c junto): **2.1** corrida num buffer na resolução de arte, cavalos 1:1; **2.2** texto do canvas em Galmuri (atlas `prototype/assets/fontes/galmuri-glifos.json`, `fonte-glifos.mjs`; contagem em Galmuri14); **2.3** cenário pelas camadas das 5 regiões (`window.__REGIOES`, `lerRegioes` no `arte-embutida.mjs`; `SP.setRegioes`, `drawTrack({ regiao })`, `drawTrackFront`), pista/cercas/placas na paleta; **2.4** câmera a 12 px/m (`PPM_ARTE`), galope a 21 q/s do molde (`GALOPE_QPS`), setas na borda para quem está fora da tela, margem de baixo de 22 px para o capim; **2.5** clima por troca de paleta das camadas (pré-desenhado na largada; névoa em pontilhado), natureza e efeitos do `fx.js` na mestra sem véus (só o relâmpago com alfa), HUD sólido, testes da corrida recalibrados e capturas oficiais regeneradas. **Etapa 2 pronta (2026-11-22): `check.sh` completo OK** (8/8; 72 blocos de interface). **Na `main` em 2026-11-22** (dc847ef, junto com as skills com ranks). **Etapa 4 (ícones) pronta no ramo** (ícones finais 16/24 1:1 na grade, pista com os 8×8 de código, medalha de raridade só na ficha; `check.sh` OK), ainda fora da `main`. **Etapa 5 pronta no ramo** (arenas na cena do desafio, treinadores de 40 px, bustos nos cartões da trilha; `check.sh` OK). **Etapa 6 pronta no ramo** (cenas no topo de 4 abas, cavalo ativo na cena do Estábulo, mapas das trilhas com os oponentes). **Etapa 7 pronta no ramo** (logo desenhado na tela inicial em 2×, letreiro pequeno no cabeçalho). **Etapa 8 pronta no ramo** (tela de créditos no Perfil com a licença da Galmuri; assets substituídos fora do repositório). **A integração da direção de arte terminou** (2026-11-22, `check.sh` OK, 74 blocos de interface); etapas 4 a 8 na `main` em 2026-11-23 (cfd678c, avanço direto) e os três oficiais republicados. Nome de autor nos créditos: "Vinicius" (confirmado em 2026-11-23). **Direção de arte na `main` em 2026-11-21** (avanço direto até 90dd532, a pedido do Vinicius; o jogo não muda: `src/` e `dist/` intocados). Falta só código, que espera as skills com ranks na `main` (o Vinicius dispensou a conferência a cada 2 horas): integrar regiões/corrida (etapas 1–2), ícones (4), treinadores, arenas e cena do desafio (5), cenas e mapas (6), marca (7), tela de créditos e a limpeza dos assets antigos (8). Saldos: PixelLab 915/2000, RD US$ 0,24. A RD precisa de recarga para as próximas etapas; a troca dos ícones no jogo é a parte de código da etapa 4, depois das etapas 1 e 2. Decisões em `decisoes.md` (2026-11-19).

**Refino depois da integração (2026-11-23, ramo `claude/direcao-de-arte`, fora da `main`):** cinco observações do Vinicius
ao jogar o protótipo "completo". (1) **Status sem sobreposição**: a coluna do nome herda a grade da lista (subgrid, do
tamanho do nome mais largo) e a Força virou 16×16 como os outros status (eea20f8). (2) **Nunito + tom azul** na interface
(escolha do Vinicius entre 5 variantes): Nunito SemiBold/ExtraBold embutida (WOFF2, OFL), painéis em 323353/3e3546/484a77/
4d65b4, texto branco; a Galmuri ficou só no canvas da corrida; créditos com as duas fontes e as duas licenças (f14cc5a).
(3–4) **Cenas das abas num painel com moldura** e **fundo pontilhado** no lugar das tábuas (escolha do Vinicius numa prévia
com 3 fundos; 0f95be2). (5) **Câmera que enquadra a disputa** (4 a 12 px/m, suave, o jogador e os rivais a até 45 m) e
**seta + metros** ("+12 m"/"–8 m") para quem está fora da tela — a placa de metros tinha saído na etapa 2.4 de propósito
(o guia dizia "sem metros"), e voltou a pedido (37559a4). `check.sh` completo OK (74 blocos), capturas oficiais
regeneradas (536e54f) e DEV do ramo republicado (versão 8). **Na `main` em 2026-11-23** (05927d1, junto com o teste de engine que já estava lá) e os três
oficiais republicados: jogo na versão 15, DEV na 13 e wiki na 12.

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
  na versão 12 e DEV na 10; o wiki não mudou; em 2026-11-21, os três com o build 97d99df, o das skills com 100% e ranks
  junto com a direção de arte: jogo na versão 13, DEV na 11 e wiki na 10; em 2026-11-23, os três com o build cfd678c, o da
  direção de arte inteira integrada (etapas 1 a 8), já na `main`: jogo na versão 14, DEV na 12 e wiki na 11; no mesmo dia,
  os três com o build 05927d1, o do refino (Nunito + azul, moldura nas cenas, câmera que enquadra): jogo na versão 15, DEV
  na 13 e wiki na 12):
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
    retratos andam no relógio real. O saldo e o XP já não mudam (seed fixa); não se congela a animação (resolvido no
    ramo `claude/ajustes-1`, 2026-11-23: a vitrine saiu da tela);
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

## Skills com 100% e ranks (implementadas em 2026-11-19 na `claude/skills-ranks`; na `main` desde 2026-11-21)
Spec `docs/superpowers/specs/2026-11-19-skills-ranks-design.md`, plano `docs/superpowers/plans/2026-11-19-skills-ranks.md`
(as 9 tarefas marcadas), regra no `docs/GDD.md` §3 e
§8.2, números no wiki (seção Skills, "Rank das skills"), medições em `docs/exemplos.md` §3, decisões em `decisoes.md`.
- **Regra:** a skill de vaga ativa sempre que o gatilho acontece (sem sorteio; `RaceSim.VERSION` 4.0.0); rank I a V por
  cavalo (`skillRanks`), fator 1,00 a 1,60 só na parte de bônus e um marco no V; o rank entra no Poder; bots com o rank
  médio do cavalo do jogador; potro herda rank − 1; Cupom e Manual entram no rank I. Sobe com Ouro + Pergaminho de técnica
  (150+1, 400+2, 900+4, 2.000+7), sem falhar; o cavalo ativo não sobe com o páreo aberto. Pergaminho: pódio de corrida
  valendo (50/30/15%, pela seed da sala) e ginásios (1 nos soldados 2 e 4, 3 no líder, só na 1ª vitória).
- **Telas:** aba Skills com as 5 marcas, o efeito de agora e o do próximo rank, o custo e "Subir rank" (com confirmação);
  balão e faixa com o rank em romano, dourados no V; gaveta DEV com o rank por skill (saiu o "skills sempre ativam");
  ícone do Pergaminho feito por código (a arte do PixelLab fica para quando o Vinicius confirmar). **Save v9.**
- **Garra sem falhar (pedido do Vinicius, 2026-11-19):** a arrancada final sai sempre; a Garra dá o ponto de início e
  a força média, e a seed dá a força de cada corrida (de 0 a 2× a média). Os três marcos ficaram menores (Saída Rápida
  7 s, Chama Final 11 s, Arrancada Final ×1,01). `RaceSim.VERSION` 4.1.0.
- **Balanço:** as 344 metas do `balance.js` completo e as 111 do rápido passam, com as faixas rebaseadas (lista e motivo
  no `decisoes.md` de 2026-11-19): favorito do Poder 51,1%, rank I das skills de 4,2 a 8,7 p.p., rank V até 18,0.
- **Verificação (2026-11-20):** `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK` (201 testes de simulação, 129
  de efeitos, 173 de moldes, 989 conferências do wiki, 111 metas no balanço rápido e os 73 blocos do teste de interface,
  com o bloco novo `ranks`); as capturas oficiais de `prototype/screens/` foram regeneradas. No teste de interface, as
  seeds fixas que mudaram de desfecho foram trocadas (nota "sim 4.1.0: era N" ao lado de cada uma).
- **Esperando o Vinicius:** jogar o build de teste e dizer se os ranks e a Garra se sentem na corrida; aprovar a
  integração na `main` (a revisão é do chat de coordenação). Pontos de gosto: os números de custo e de pódio do
  Pergaminho (partida), o quanto a força da Garra varia (`garraSpread`), o desenho da aba Skills e do balão dourado, e a
  arte do Pergaminho no PixelLab (hoje é um ícone feito por código).
- **Build de teste desta branch:** https://claude.ai/artifact/77SCN1gGcMb9DjMcUXwfkQ (artefato novo, versão 2, com a
  Garra sem falhar; os três oficiais não foram tocados).

## Treino AFK, bloco A (pronto em 2026-11-23 no `claude/afk`; fora da `main`)
Spec e plano acima; regra no `docs/GDD.md` §8.3a; números no wiki (seção "Corrida AFK") e em `GameData.AFK`
(`prototype/src/data.js`); regras em `prototype/src/afk.js`; medições em `docs/exemplos.md` §5b; decisões em
`decisoes.md` (2026-11-23, "execução do bloco A").
- **O que entrou:** o duelo do ginásio como função (`Ginasio.dueloCfg`); as 45 fases (15 etapas × Normal, Difícil,
  Lendária), a liberação por 50 vitórias e as 5 vagas; a corrida AFK e a tabela de drops (29 itens novos: materiais,
  incomuns, comidas, Pergaminho de reforja e 15 troféus; peças com linhas de farm sorteadas); a chance medida (2.400
  duelos em fatias) e o offline; o baú, o bestiário e as comidas; **save v10** (`state.afk`, itens do AFK na mochila,
  `linhas` e `rerolls` em cada peça); as telas: cartões "Treino AFK" e "Bestiário" na Expedição, "Treinar (AFK)" nos
  oponentes vencidos da trilha, a escolha do treino, as vagas com o baú, assistir (a tela de corrida, no tempo real do
  duelo), "Enquanto você estava fora" (também ao abrir o jogo), o bestiário por ginásio e os itens do treino na Mochila
  (comidas com "Usar"); o grupo "Treino AFK" na gaveta DEV (relógio, vitórias, itens, zerar). 18 ícones 16×16 feitos em
  código (`prototype/tools/icones-afk.mjs`), sem créditos.
- **Como o relógio funciona:** `vaga.inicioMin` é até onde o treino da vaga já foi contado. Com a tela do treino
  aberta, cada corrida larga quando agora ≥ inicioMin, é gravada (contador + ganho) antes de aparecer e leva inicioMin
  ao fim dela; fora da tela, o tempo é acertado pelo `Afk.offline` (chance medida) na volta. O cavalo ativo com a sala
  aberta não treina. Detalhe no comentário da seção "Corrida AFK" do `game.js`.
- **Metas (balance.js completo):** E1, E3 e E5 passam; a E2 passa na primeira parte ("não é sempre a mais difícil") e a
  segunda ("1 ou 2 degraus abaixo em metade dos casos") deu 44% e fica como informação até a B2 (as peças dos oponentes).
  A E4 e a E6 são do bloco B. `node prototype/tools/balance.js --afk` roda só essa seção (~45 s).
- **Números de partida que mudaram:** Ouro por vitória × 0,15 (E1) e amostra da chance de 400 para 2.400 (E3).
- **Para o Vinicius decidir** (em `docs/exemplos.md` §5b): o XP do AFK por hora é de 2 a 15 vezes o do PVP; os
  oponentes são fracos para um cavalo Raro; o prêmio quase não cresce com a etapa.

## Treino AFK, bloco B (pronto em 2026-11-23 no `claude/afk`; fora da `main`)
Regra no `docs/GDD.md` §7 (reescrito: equipamento só de PVE) e §8.3a; números no wiki (Equipamento e Corrida AFK, com a
Forja); medições em `docs/exemplos.md` §5b; decisões em `decisoes.md` (2026-11-23, "execução do bloco B").
- **O que entrou:** peças com principal de corrida e **linhas de farm**, valendo **só no treino AFK**
  (`Gear.resolvePve`; `entry.statAdd` e `entry.pve` no duelo); oponentes da Difícil com 5 Mágicas +3 e da Lendária com 5
  Raras +5 do conjunto; **forja** (`prototype/src/forja.js`, `GameData.FORJA`, tela na Expedição); sub-aba **Peças** da
  Montaria (selo "só AFK", total do treino, linhas), loja de peças e Pedras de volta; **reforja** de uma linha
  (`Gear.custoReforja/podeReforjar/reforjar`); **Selo do campeão** (`Itens.seloPodio`: 1º lugar valendo, 10%; exigido no
  rank IV → V, na reforja garantida e na forja da Lendária). Save continua v10 (campo novo `forjaCounter`; `selo` na mochila).
- **Chaves no `game.js`:** `GEAR_ON = true` (telas) e `GEAR_PVP = false` (o caminho antigo das peças no Poder, na sala e
  nos bots, e a Pedra do pódio: desligado). O `ui-test.mjs` lê as duas do build.
- **O PVP não muda:** Poder, pareamento, sala e corrida ignoram as peças; não há trava de peça com páreo aberto.
- **Metas:** E1 a E6 no `balance.js` (a E4 e a E6 novas). Testes: `afk-test.js` (forja), `sim-test.js` (reforja, Selo),
  blocos `equipamento`, `forja` e `reforja` no `ui-test.mjs`.
- **Para o Vinicius decidir:** os mesmos pontos do bloco A (XP do AFK alto, oponentes fracos para um Raro, prêmio que
  quase não cresce com a etapa) e a segunda parte da E2, que continua sem fechar (só informação).
- **Revisão da coordenação e merge da `main` (2026-11-23):** a `main` (29f65fd: arte refinada, teste de engine,
  créditos) foi trazida para o `claude/afk`; os quatro defeitos do relógio das vagas e a receita do Pergaminho foram
  corrigidos (`decisoes.md`, "correções da revisão"). `check.sh` OK (79 blocos) e `balance.js` completo OK (380 metas)
  depois disso. Artefatos de teste (não são os oficiais): produção https://claude.ai/artifact/BYNyJ3vZrmuJDiTWBryCxj e
  DEV https://claude.ai/artifact/U17yYPgft3zCqQZzrTEgaP.
- **Build dos testadores** (`prototype/dist/jogo-teste.html`: evolução ×10, iniciais Raros nota A, rivais um pouco
  abaixo; save próprio; decisões de 2026-11-23). `check.sh` OK (79 blocos, 132 metas no rápido).
- **Falta:** a aprovação do Vinicius para integrar na `main` e republicar os oficiais.

## Em andamento
- **Teste de engine, web × Godot 4 (spike de 2026-11-19, branch `claude/teste-engine`, fora da `main`): resultado,
  fica web.** Relatório em `docs/teste-engine.md`; decisão em `decisoes.md` (o Vinicius pode vetar). Página de carga em
  `prototype/spike/` (descartável, fora do `check.sh` e do build), publicada como artefato:
  https://claude.ai/artifact/UvJifXrNdRyHJngmAaJHTm (`prototype/spike/engine.html`, gerado por
  `node prototype/spike/gerar-engine.mjs`; bateria no contêiner: `node prototype/spike/medir-engine.mjs`).
  - No celular do Vinicius, na WebView do app do Claude, o pior caso fez 119,6 FPS a 120 Hz, com 1% low de 82,4 e
    JS de 3,2 ms.
  - A fase "travada em 60" reprovou por defeito do limitador do spike, corrigido na v3.
  - **Falta:** uma rodada longa (Rodada livre de 60 s, limite 60 FPS, v3) no celular e a bateria num Android fraco antes
    do lançamento.
  - **No jogo, quando for a hora:** travar a corrida em 60 FPS com o acumulador do spike.
  - Aparelho do Vinicius: Galaxy S24 FE. A rodada longa estava sendo feita por ele em 2026-11-19.
  - **Steam no escopo (2026-11-19):** caminho Electron + steamworks.js sobre a mesma base web; comparação de motores
    com jogos de referência no §8 do relatório; itens novos no checklist da Steam no `docs/cronograma.md`.
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
- **Teste de engine:** decidido, fica web. Falta a rodada longa no celular (60 s travada em 60, spike v3) e, perto do
  lançamento, a bateria num Android fraco (checklist do empacotamento). Travar a corrida em 60 FPS no `game.js` leva
  ½ dia e pode entrar com o bloco de empacotamento.
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
