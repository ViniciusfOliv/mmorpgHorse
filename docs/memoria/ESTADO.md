# Estado do projeto

_Atualizado em 2026-11-13._

**Fase:** Protótipo, a caminho do MVP. **Ainda não é hora de publicar no Play**; o caminho, as
durações e o checklist estão em `docs/cronograma.md`. **Tecnologia decidida (2026-11-10):** o
protótipo vira o jogo, a mesma base web empacotada para Android, com os módulos de regra no servidor.

## Onde estamos
- **Branches:** a `main` tem tudo até o pente fino (2026-11-10). Em aberto: `claude/cavalos-v3`
  (bloco 1 do redesenho implementado, a integrar na `main` depois da revisão) e `claude/empacotamento`
  (em pausa, só com as decisões iniciais; volta como bloco 3).
- **Onde jogar** (artefatos privados do claude.ai; republicar depois de cada build):
  - jogo de produção, sem modo DEV: https://claude.ai/artifact/MKTKQUYmzBNun92abFzygn (`prototype/dist/jogo.html`)
  - build de teste com modo DEV: https://claude.ai/artifact/LiMr2cM7FRgFZqJ6dFHPhU (`prototype/dist/jogo-dev.html`)
  - wiki: https://claude.ai/artifact/Bp47f9qE3tSswu1A9zdF2y (`prototype/dist/wiki.html`)
  - no computador: `prototype/dist/preview.html` (com `?dev=1` para o modo DEV).
- **Modo DEV:** save separado (`galope-elemental:dev`), gaveta "DEV" com Moedas, Cavalo, Itens,
  Próxima corrida (pista, clima, vento, skills sempre) e Perfil. Nunca toca no save real.
- **Verificação:** `./scripts/check.sh` em 8 etapas termina em `VERIFICAÇÃO COMPLETA: OK` (117 testes
  de simulação, 96 de efeitos, 69 de moldes, 492 conferências do wiki, 77 metas de balanço no modo
  rápido e 126 no completo, e o teste de interface).

## Pronto (o detalhe de cada frente está na spec, em `docs/superpowers/specs/`)
| Frente | Entrega | Spec |
|---|---|---|
| Núcleo da corrida v2 | 7 atributos, 5 raridades, mapa em blocos, clima, Dado da Sorte, skills | `2026-11-06-nucleo-corrida-v2-design.md` |
| Estábulo, Haras e cruzamento | várias montarias, grau, potro pela seed, aluguel e Troca | `2026-11-06-cruzamento-design.md` |
| Equipamentos | 5 slots, 40 peças, melhoria +10, conjuntos, Loja, Pedra Negra | `2026-11-06-equipamentos-design.md` |
| Menu de abas | 5 abas, tela da Montaria com sub-abas, Perfil | `2026-11-08-menu-abas-design.md` |
| Visuais | moldes PixelLab recoloridos, 16 ícones, logotipo e capa | `2026-11-08-visuais-design.md` |
| Corrida viva e modo DEV | galope, dado por cavalo, skills visíveis, natureza, curvas, DEV | `2026-11-09-corrida-viva-design.md` |
| Wiki | `docs/wiki.md` e `prototype/dist/wiki.html` gerados do código | — |
| Cavalos v3, bloco 1 | genética visível, pontos livres e estrelas, skill de tipo por terço, pistas sem extremos, iniciais Comuns, save v5 | `2026-11-10-cavalos-v3-status-e-tipo-design.md` |

## Pente fino de 2026-11-10
Seis auditorias (regras, interface e save, desenho, balanceamento, arquivos, normas do Play), com as
correções; os motivos estão em `decisoes.md` e o veredito das normas em `docs/cronograma.md`.

## Bloco 1 dos cavalos v3 (2026-11-11)
Plano em `docs/superpowers/plans/2026-11-11-cavalos-v3-bloco-1.md`, oito tarefas; regras em `docs/GDD.md`
§3, §4, §6 e §7, números no wiki, medições em `docs/exemplos.md`, decisões em `decisoes.md`.
- **Regra:** status = genética (0–31, nota C a S) + crescimento por nível + pontos livres (até 34% num
  status), estrelas multiplicando os pontos; sai o bônus fixo do tipo e o Neutro; skill de tipo sempre
  ativa num terço; pistas de 1.400 a 2.000 m com curva e subida; equipamento com valores menores;
  Poder, bots e ligas recalculados.
- **Telas:** build na aba Status (rascunho, Confirmar, Desfazer), vaga do tipo na aba Skills, selo de
  nível e barra de XP, escolha do inicial, animação da skill de tipo e terços no minimapa.
- **Save v5** com migração do v4 (pontos devolvidos para distribuir, Neutro convertido).
- **Balanço:** as 126 metas do `balance.js` completo passam.
- **Revisão final (2026-11-11):** fechou a trava do páreo aberto (a sala guarda o retrato dos pontos,
  R16), o valor da peça na tela (meio ponto por melhoria, como na simulação) e o aviso de pontos livres
  ao subir de nível.

## Em andamento (2026-11-12)
- **Crescimento livre (bloco 1b):** desenho aprovado (`docs/GDD.md` §8.5); três rodadas de calibração.
  O modelo é o da rodada 2 (os quatro ajustes pedidos); a rodada 3 testou o degrau do custo e ficou o 10,
  com as metas apertadas no pior caso de 4 seeds (165 metas passam). Anexos em
  `docs/superpowers/specs/anexos/`; a rodada 1 está no commit 78e61cd. Spec em
  `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`, **aguardando a revisão do Vinicius**
  (seção 15: equilibrada como a build mais forte; skill de tipo nova).
  Depois: plano e execução na branch `claude/cavalos-v3`, **antes** de integrar o bloco 1 na `main`.
- **Ginásios:** ideia registrada (`docs/GDD.md` §8.6); desenho depois do bloco 1b. Cada ginásio tem o
  foco num elemento.
- **Visuais 2** (branch `claude/visuais-2`, criada da `claude/cavalos-v3`; a parte 1 foi integrada na
  `claude/cavalos-v3` em 2026-11-12 e a parte 2a em 2026-11-13): três partes, ícones →
  cavalos → interface. **Parte 1 (ícones) pronta na `claude/visuais-2`:** 58 ícones nas telas, na corrida e
  no wiki; 79 gerações (spec em `docs/superpowers/specs/2026-11-12-icones-design.md`). Revisão final da
  branch limpa e `check.sh` OK (598977e). Build de teste num artefato separado:
  https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch. A confirmar com o Vinicius: selo de liga só onde a
  liga já aparece, e medalhão de raridade também nas peças. **Parte 2 (cavalos)** dividida em 2a (marcas,
  jóquei e raridade, em código), 2b (portes no PixelLab) e 2c (animações). **A parte 2a está pronta e integrada na
  `claude/cavalos-v3`** (spec em `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`): marcas por
  cavalo com 3 genes herdados pela seed, jóquei do jogador no Perfil e raridade em escada, tudo em código e
  sem créditos. **2b (portes) em desenho:** gene herdado com 3 portes (esguio, padrão, robusto) iguais nos três
  elementos, 9 desenhos novos a partir de um corpo-mestre por porte; spec em
  `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`, **aguardando a revisão do Vinicius**. Geração só
  com confirmação de créditos (teto proposto: 90).
  **2b integrada na `claude/visuais-2` (T7, 2026-11-13):** os 12 moldes dos portes (folha final aprovada) moram em
  `prototype/assets/pixellab/`, os 4 antigos saíram (histórico do git) e o caminho 'legado' do `sprites.js` também;
  `novos/` guarda só o registro do lote (para mexer no lote: `--reprocessar --manter-escolhas` antes, mover os moldes
  depois; cabeçalho do `pixellab-portes.mjs`). As pendências da 2a viraram testes no `moldes-test` ("Portes: moldes
  reais"): critérios aceitos na folha em `ACEITOS_NA_FOLHA`; meias por molde, pele acima do capacete (passa) e brilho
  das raridades. Na revisão da T7 saíram três defeitos: a canela (retrato dos robustos, galope do padrão e dos esguios)
  e o focinho (robustos) que o PixelLab pintou na cor da crina voltaram à pelagem-sombra e ao detalhe (`soltarCrina`,
  1.313 px em 61 quadros, sem custo); o capacete do jóquei sem pele ficou em 4 linhas; e a escala dos retratos é a
  mesma nos 12 moldes em qualquer dpr (o passo sai do molde mais alto). **Para decidir com o Vinicius** (medido e
  listado no teste, sem afrouxar regra): 5 dos 24 retratos/parados com meias que se juntam ou se partem
  (`PENDENTES_2A.meias`); 14 combinações elemento × raridade ×
  crina do catálogo com o brilho abaixo de 0,05 de luminância (ex.: Mágico na crina do Tição, 0,005;
  `BRILHO_PENDENTE`); zona da cara variando mais de 20% no galope em 5 moldes, estrela de 1 px e listra curta em
  alguns quadros (`PENDENTES_2A`); o retrato do robusto-folhas passou a 3 pernas com a canela de volta à pelagem
  (registrado no teste com o motivo). Faltam a T8 (wiki, GDD,
  memória e artefato) e a revisão final da 2b.

## O que falta
- **Decidido em 2026-11-10:** o teste fechado do Play sai com o jogo offline; o lançamento público
  espera o PVP assíncrono.
- **Blocos 2 a 7 do redesenho** (`docs/GDD.md` §8), cada um com spec própria: preparação com relógio,
  empacotamento (espera a resposta sobre o Capacitor), itens de treino e gastos de Ouro, tempo e
  estábulo ativo, loja de Gemas, online.
- **Até o bloco 4** não existe item que redistribui pontos nem que sobe estrela: ponto confirmado é
  definitivo.
- **O Vinicius ainda não jogou o modelo novo:** os números saíram de simulação.
- **Balanço:** a Sorte continua quase sem valor na corrida; a Grama no Lendário nível 50 fica no piso
  da M9. M6, M9, P1, S1 e A1 só são vigiadas pelo `balance.js` completo.
- **Decisões do Vinicius ainda abertas:** o empacotador (a pergunta sobre o Capacitor ficou sem
  resposta) e, de `docs/exemplos.md` §5, o papel da Sorte, o conjunto de 3 peças, o "Cansou", a Garra
  e a zebra.
- **Arte:** crina própria de cada estilo no galope (6 a 10 gerações); retrato, largada e pódio sem
  respiração nem piscar.
- **Ponto distribuído pode perder o efeito** quando o crescimento natural encosta no teto: resolvido
  pelo crescimento livre (bloco 1b), que tira o crescimento automático.
- **Antes do próximo aumento de versão do save:** pôr uma guarda para save de versão maior que a do
  código (não adotar nem gravar por cima, e avisar para atualizar a página).
- **Pendências menores:** `docs/memoria/bugs.md`.
- **GDD §9+:** expedições, tecnologia do servidor, anti-trapaça, PVP assíncrono e ranqueada.

## Próximos passos
1. O Vinicius joga o bloco 1 (republicar os artefatos de jogo, DEV e wiki) e decide os seis pontos da
   calibração (`decisoes.md`, 2026-11-11); depois a `claude/cavalos-v3` entra na `main`.
2. O Vinicius apaga as branches antigas no GitHub (lista abaixo).
3. **Bloco 2, preparação com relógio:** spec, revisão do Vinicius, plano e execução.
4. **Bloco 3, empacotamento:** retomar pela pergunta do Capacitor; o teste fechado começa aqui.
5. Abrir a conta de desenvolvedor do Play e começar a juntar os 12 testadores (é o que mais atrasa).
6. Blocos 4 a 6 chegam como atualizações durante o teste fechado; o bloco 7 (online) vem depois.

## Branches para apagar no GitHub
Todas já integradas na `main`: `claude/equipamentos`, `claude/cruzamento`, `claude/nucleo-corrida-v2`,
`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`, `claude/menu-abas`,
`claude/visuais`, `claude/corrida-viva` e `claude/pente-fino`. A `claude/nifty-newton-e8u133` é a
branch desta sessão e acompanha a `main`. A sessão não consegue apagar branch remota (o proxy bloqueia).
