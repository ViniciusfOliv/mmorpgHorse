# Visuais 2, parte 1: ícones

Especificação da primeira parte da frente "Visuais 2", desenho aprovado em 2026-11-12. A frente tem três
partes, cada uma com especificação, plano e execução próprios, nesta ordem: **ícones** (esta),
**cavalos** (variedade entre cavalos, raridade visível e animações novas) e **interface** (acabamento
pixel art, tela da corrida, celular, estábulo e montaria; entra depois do bloco 1b implementado). Branch
`claude/visuais-2`, criada da `claude/cavalos-v3`: a frente visual entra no jogo depois do bloco 1.

## 1. Objetivo e escopo

**Objetivo.** Tirar os emojis e símbolos que sobraram na interface e dar ícone pixel art a tudo que hoje
é só texto colorido ou desenho em código: status, skills, clima, piso, ligas, raridades e pódio. Ficam
prontos também os ícones de recursos que estão chegando: Rédea nova (bloco 1b), Gema (loja, bloco 6) e
insígnias dos ginásios.

**Entra:** 58 ícones novos (seção 2), o lote no script do PixelLab, a folha de conferência, os ícones nas
telas, na corrida e no wiki, os testes, as capturas e o registro em `docs/memoria/assets.md`.

**Fica de fora:** trocar os 16 ícones de hoje; cavalos; acabamento da interface (molduras, botões,
fonte); qualquer regra do jogo. Só a aparência muda: a corrida dá o mesmo resultado.

## 2. Os 58 ícones

Descrição = o pedido ao PixelLab (em inglês, como os 16 de hoje), sempre um objeto simples e sem letras
nem números. Cor = a cor do tema que se soma à paleta da interface (seção 3). Seeds a partir de 2201, na
ordem da tabela. As tabelas trazem o pedido original; as descrições refeitas estão em
`prototype/tools/icones-catalogo.mjs`, com a anterior em comentário.

### 2.1 No lugar dos emojis e símbolos (7)

| Arquivo | Descrição | Cor | Substitui | Onde |
|---|---|---|---|---|
| `ui-perfil` | jockey riding helmet with a short visor, side view | `#ff6b5e` | 👤 | botão do Perfil no cabeçalho |
| `ui-dado` | white six-sided die showing three pips, slight three-quarter view | `#ffffff` | 🎲 | nota do Dado na sala; balão do Dado na corrida |
| `ui-macho` | male symbol: a circle with an arrow pointing to the upper right | `#62b8ff` | ♂ | fichas, Haras |
| `ui-femea` | female symbol: a circle with a small cross below it | `#ff8ad8` | ♀ | fichas, Haras |
| `ui-estrela` | five-pointed star, filled solid gold | — | ★ | grau do cavalo (estrelas) em todo lugar |
| `ui-estrela-vazia` | five-pointed star outline only, hollow dark center | `#a9b5ae` | ☆ | idem |
| `ui-corcel` | small pennant flag on a short pole with a horseshoe emblem | — | ⚑ | selo de Corcel (herança garantida) |

### 2.2 Status (7)

No lugar do desenho em código de hoje (`STAT_ICON_ROWS`), que fica como reserva.

| Arquivo | Descrição | Cor |
|---|---|---|
| `st-vel` | lightning bolt | `#ffd86a` |
| `st-acel` | bold forward arrow with three motion lines behind it | `#ff8a4c` |
| `st-man` | curved arrow turning around a bend | `#5fd3c8` |
| `st-forca` | flexed strong arm | `#86d86a` |
| `st-est` | heart with a pulse line across it | `#ff6b5e` |
| `st-garra` | three diagonal claw slash marks | `#62b8ff` |
| `st-sorte` | four-leaf clover | `#7be07a` |

Onde: aba Status, ficha do cavalo, wiki.

### 2.3 Skills (18)

Cor pelo elemento da skill: Fogo `#ff8a4c`, Água `#62b8ff`, Grama `#86d86a`, gerais `#f2c230`.

| Arquivo | Skill | Descrição |
|---|---|---|
| `sk-arranque` | Arranque | horseshoe with a speed burst behind it |
| `sk-sprint` | Sprint | double chevron arrow pointing right |
| `sk-drift` | Drift | curved skid trail with small dust puffs |
| `sk-saida-rapida` | Saída Rápida | arrow curving out of a bend and shooting forward |
| `sk-folego-de-montanha` | Fôlego de Montanha | small mountain with a puff of breath |
| `sk-segundo-ar` | Segundo Ar | wind swirl with a small plus sign |
| `sk-arrancada-final` | Arrancada Final | checkered finish flag with an upward arrow |
| `sk-dado-viciado` | Dado Viciado | die with one glowing extra pip and a small sparkle |
| `sk-sol-a-pino` | Sol a Pino | blazing sun with sharp rays |
| `sk-chama-final` | Chama Final | flame shaped like an arrow pointing right |
| `sk-pe-na-chuva` | Pé na Chuva | horseshoe under falling raindrops |
| `sk-canto-da-iara` | Canto da Iara | seashell with two music notes |
| `sk-nascente` | Nascente | water spring bubbling up between rocks |
| `sk-nevoa-amiga` | Névoa Amiga | soft mist cloud with a small leaf |
| `sk-casco-firme` | Casco Firme | hoof pressing down on a rock step |
| `sk-tipo-fogo` | Labareda | tall blazing flame with a motion trail |
| `sk-tipo-grama` | Raízes Firmes | tree roots gripping the ground |
| `sk-tipo-agua` | Maré Alta | tall cresting ocean wave |

Onde: aba Skills (32 px no cartão), lista de skills na ficha (16 px), faixa e balões de skill na corrida,
wiki. A skill de tipo não pode se confundir com os selos de elemento de hoje (`el-fogo` chama, `el-agua`
gota, `el-grama` folha).

### 2.4 Clima e piso (7)

| Arquivo | Descrição | Cor |
|---|---|---|
| `cl-sol` | sun with short rays | `#ffd86a` |
| `cl-chuva` | rain cloud with falling drops | `#62b8ff` |
| `cl-nevoa` | three horizontal wavy fog bands | `#9fb8a8` |
| `cl-nublado` | gray cloud | `#b8c2cc` |
| `pi-grama` | tuft of grass on a thin strip of soil | `#5fa34a` |
| `pi-terra` | clump of brown earth with small stones | `#9a6b3f` |
| `pi-areia` | small sand dune | `#e2c27a` |

Onde: chips da sala ("Piso", "Clima inicial"), painel da corrida ("Clima: Sol"), aviso de virada de clima,
melhor e pior clima na ficha, wiki.

### 2.5 Ligas, raridades e pódio (14)

As ligas têm a mesma forma de propósito (família) e se distinguem pela cor e por um enfeite que cresce. O
mesmo vale para as raridades.

| Arquivo | Descrição | Cor |
|---|---|---|
| `liga-bronze` | shield badge with a horse head silhouette, plain | `#b0703c` |
| `liga-prata` | shield badge with a horse head silhouette and one small star | `#b8c2cc` |
| `liga-ouro` | shield badge with a horse head silhouette and two small stars | `#f2c230` |
| `liga-platina` | shield badge with a horse head silhouette and three small stars | `#5fd3c8` |
| `liga-diamante` | shield badge with a horse head silhouette and a diamond on top | `#7ab8ff` |
| `liga-lenda` | shield badge with a horse head silhouette, a crown on top and flames around it | `#ff7a3d` |
| `rar-comum` | round medallion with a horse head, plain | `#9e9e9e` |
| `rar-magico` | round medallion with a horse head and two small sparkles | `#4caf50` |
| `rar-raro` | round medallion with a horse head and four small sparkles | `#2196f3` |
| `rar-lendario` | round medallion with a horse head, sparkles and a glowing rim | `#ff9800` |
| `rar-mitico` | round medallion with a horse head, sparkles and a radiant aura | `#9c27b0` |
| `podio-1` | gold medal hanging from a ribbon | `#f2c230` |
| `podio-2` | silver medal hanging from a ribbon | `#b8c2cc` |
| `podio-3` | bronze medal hanging from a ribbon | `#b0703c` |

Onde:
- ligas: selo no cabeçalho, no Perfil e na sala;
- raridades: selo no estábulo, na ficha e na sala;
- pódio: 1º, 2º e 3º no resultado e no histórico.

O ícone se soma à cor e ao nome de hoje, sem substituí-los. O "1º" continua em texto ao lado da medalha.

### 2.6 Reservados para recursos que estão chegando (5)

| Arquivo | Descrição | Cor | Entra na tela com |
|---|---|---|---|
| `item-redea` | coiled leather horse reins with a metal buckle | `#9a6b3f` | bloco 1b (botão Redistribuir e saldo de Rédeas) |
| `moeda-gema` | faceted cut gemstone with a sparkle | `#5fd3c8` | loja de Gemas (bloco 6) |
| `ins-fogo` | round pin badge with a flame emblem inside a ring | `#ff8a4c` | ginásios: cada um tem o foco num elemento |
| `ins-agua` | round pin badge with a water drop emblem inside a ring | `#62b8ff` | idem |
| `ins-grama` | round pin badge with a leaf emblem inside a ring | `#86d86a` | idem |

Até lá, só o wiki e a folha de conferência mostram esses cinco.

## 3. Geração

- **Receita igual à dos 16 de hoje** (`prototype/tools/pixellab-moldes.mjs`):
  - `/create-image-pixflux` 32×32, `no_background`;
  - `outline: 'single color black outline'`, `shading: 'basic shading'`;
  - descrição = `<descrição>, <SUFIXO_ICONE>` (o sufixo de hoje);
  - `color_image` = `PALETA_ICONES` mais a cor da tabela, quando houver.
- **Lote novo `icones2`:** `--lote icones2`, também incluído em `--lote tudo`. Sem `--gerar` é simulação:
  lista as chamadas e o total, sem rede. `--only`, `--repetir`, `--teto` e `--reprocessar` valem como hoje.
  O cru vai para `prototype/assets/icons/raw/` e o final para `prototype/assets/icons/<arquivo>.png`, em 32×32.
- **Folha de conferência:** o build gera `prototype/dist/icones.html`, com os 16 ícones de hoje e os 58
  novos, por família, em 16 e 32 px, no fundo escuro (`--painel`) e no claro (creme).
- **Critério de recusa:**
  - ilegível em 16 px;
  - parecido com outro da mesma família (fora a forma comum de ligas e raridades, que é de propósito);
  - parecido com um ícone que já existe;
  - letras ou números;
  - cortado, fora do centro ou com fundo.
- **Refação:** até 2 seeds novas por item; depois, a descrição reescrita uma vez. Se ainda falhar, o item
  fica sem arquivo (vale o texto ou o desenho de hoje) e a lista vai para o Vinicius.
- **Aprovação:** depois da minha conferência, publico a folha num artefato para o Vinicius aprovar antes
  de ligar os ícones nas telas. Ícone recusado por ele entra na mesma regra de refação.
- **Gasto:** teto de 100 gerações (`--teto 100`) da cota do plano do PixelLab (saldo registrado: 1.925),
  sem custo avulso esperado. A geração só roda com a confirmação explícita do Vinicius no momento de rodar.
  Cada geração entra em `docs/memoria/assets.md` (declaração de IA).

## 4. Integração

**Telas em HTML** (`game.js`). Tudo pelo `iconeHtml(nome, reserva, tam)` de hoje: sem o ícone, volta a
reserva (o texto ou o símbolo de hoje). Funções pequenas concentram as trocas, para mexer pouco no
`game.js` (o bloco 1b também muda as abas Status e Skills):
- `statIcon(k)`: `iconeHtml('st-' + k, <svg de hoje>)`;
- `estrelasHtml(grau)`: três estrelas, cheias e vazias, com `aria-label` "N de 3 estrelas";
- `sexoHtml(sexo)`: ícone + "Macho"/"Fêmea";
- `skillIcone(id, tam)`: `sk-<id>` (as de tipo: `sk-tipo-<elemento>`);
- `climaIcone(id)`, `pisoIcone(id)`, `ligaIcone(id)`, `raridadeIcone(id)` e `podioIcone(lugar)`.

Na gaveta DEV, os `<option>` não aceitam imagem: o sexo vira "Macho"/"Fêmea", sem símbolo.

**Corrida (canvas).** Os ícones usados na corrida (`sk-*`, `cl-*`, `ui-dado`) são carregados uma vez, de
`window.__ICONES`, em objetos `Image` guardados num cache, e desenhados em escala inteira:
- na faixa de skill do jogador, à esquerda do nome;
- nos balões de skill, no lugar do chip desenhado hoje;
- no aviso de clima;
- no balão do Dado.

Enquanto um ícone não carrega (ou se faltar), fica o desenho de hoje. O ícone só é desenhado quando ocupa
pelo menos 16 px do canvas: reduzir 32×32 a menos que isso apaga o desenho, e aí também fica o de hoje.
Nada disso toca a simulação.

**Wiki** (`prototype/tools/wiki.mjs`):
- `wiki.html` mostra o ícone ao lado de cada skill, status, clima, piso, liga e raridade, e lista os
  reservados;
- `docs/wiki.md` aponta para os PNGs (`../prototype/assets/icons/<arquivo>.png`).

**Tamanho:** os 58 PNGs somam cerca de 70 KB a mais no `jogo.html` (embutidos como `data:`).

## 5. Testes

- **Arte** (`prototype/tools/moldes-test.mjs`, que hoje confere os moldes; ganha a parte dos ícones):
  - cada ícone que o código usa existe em 32×32, com fundo transparente e pelo menos um pixel opaco;
  - todo PNG em `prototype/assets/icons/` é usado pelo código ou está na lista de reservados (seção 2.6);
  - o lote `icones2` do script tem exatamente os 58 nomes da seção 2.
- **Interface** (`prototype/tools/ui-test.mjs`):
  - nenhum dos símbolos trocados (👤 🎲 ♂ ♀ ★ ☆ ⚑) aparece no texto visível das telas principais
    (Estábulo, Montaria, sala, corrida, resultado, Haras, Perfil);
  - cada ícone novo nas telas tem `alt=""` e o texto ao lado; as estrelas têm o `aria-label`;
  - com `window.__ICONES` vazio, as telas abrem e mostram o texto de reserva.
- **Corrida** (`prototype/tools/fx-test.js`): com um contexto falso, a faixa de skill desenha a imagem do
  ícone quando ela está no cache e o desenho de hoje quando não está.
- **Wiki** (`prototype/tools/wiki-test.mjs`): segue determinístico; cobre os ícones das skills.
- **Verificação completa:** `./scripts/check.sh`. Capturas novas em `prototype/screens/` (a interface muda
  de propósito).

## 6. Arquivos

| Arquivo | O que muda |
|---|---|
| `prototype/tools/pixellab-moldes.mjs` | lote `icones2` (seção 2 e 3) |
| `prototype/assets/icons/*.png` e `raw/` | 58 ícones novos e as respostas cruas |
| `prototype/build.mjs`, `prototype/tools/arte-embutida.mjs` | folha `dist/icones.html` |
| `prototype/src/game.js`, `prototype/src/game.css` | funções da seção 4 e as trocas nas telas e na corrida |
| `prototype/tools/wiki.mjs` | ícones no wiki |
| `prototype/tools/moldes-test.mjs`, `ui-test.mjs`, `fx-test.js`, `wiki-test.mjs` | testes da seção 5 |
| `docs/memoria/assets.md`, `docs/memoria/*`, `prototype/screens/` | registro de IA, memória e capturas |

`prototype/dist/` e `docs/wiki.md` saem do build. Nenhum módulo de regra muda (`data.js`, `sim.js`,
`breed.js`, `gear.js`).

## 7. Riscos

1. **Símbolos abstratos** (sexo, estrela vazia, seta de Manobra) podem sair ruins no PixelLab em 32×32.
   A regra de refação cobre; no pior caso, fica o texto ou o desenho de hoje.
2. **Família com a mesma forma** (ligas, raridades): o PixelLab não garante a mesma forma entre seeds.
   Se as seis ligas não lerem como família, a saída é repetir com seeds até achar formas parecidas, dentro
   do teto.
3. **Conflito com o bloco 1b:** os dois mexem nas abas Status e Skills do `game.js`. As trocas ficam em
   funções pequenas para o merge ser simples; quem integrar depois resolve.
4. **Teto de 100 gerações:** 58 itens deixam 42 para refações. Se acabar, os itens que faltarem ficam
   para uma rodada nova, com nova confirmação.
