# Visuais 2, parte 3b: Estábulo e montaria no celular

Desenho de 2026-11-15, conversado com o Vinicius. Branch `claude/visuais-2`, sobre a parte 3a (acabamento), que ainda
espera a avaliação dele (`docs/memoria/ESTADO.md`, lista "A confirmar com o Vinicius"). Divisão da parte 3 e regras de
celular: spec da 3a, `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md` §§ topo e 7.

## 1. Intenção

O pedido do Vinicius para a interface (2026-11-08 e 2026-11-12) foi "menos rolagem" e "o cavalo em destaque", com o
celular em pé como alvo. Hoje, a 360 px:

| Tela | Altura | Por quê |
|---|---|---|
| Estábulo (3 cavalos) | 1.320 px, quase 2 telas | um cartão de ~360 px por cavalo (retrato, dados, XP, Tornar ativa e Ver) |
| Ficha da montaria | o cabeçalho enche a 1ª tela | retrato, porte, marcas, cruza, XP, Poder, liga, chance de skill e 3 botões; as abas Status/Skills só aparecem rolando |
| Aba Status | 1.940 px, 2,5 telas | cada status gasta 3 linhas (nome e nota, barra, custo e +1/+5/+10) |

Também ficam duas pendências do 1b que são destas telas: o motivo de um botão indisponível só aparece com o mouse (o
`title`), e o leitor de tela lê "1º" como "1" (o "º" está num `<sup aria-hidden>`).

**Decisões do Vinicius (2026-11-15):** aba Status em linha única com +1/+5/+10; Estábulo em lista de linhas, com
"Tornar ativa" só na ficha; ficha com retrato grande e uma 3ª aba "Ficha".

## 2. Objetivo, fora do escopo e o que não pode acontecer

**Objetivo.** No celular a 360×780:
- **Estábulo:** com 3 cavalos, a tela inteira cabe numa tela (≤ 780 px de altura do documento); com 6, ≤ 1.100 px.
- **Ficha:** as abas Status | Skills | Ficha ficam inteiras visíveis acima da barra de abas, sem rolar, ao abrir a
  ficha.
- **Aba Status:** a altura do documento cai de 1.940 para ≤ 1.100 px (montaria ativa do `SAVE_3A` da 3a).
- **Toque:** todo botão indisponível destas telas mostra o motivo quando tocado.
- **Leitor de tela:** "1º", "2º" e "3º" chegam como ordinais.

**Fora do escopo:** a tela da corrida, a largada e o resultado (são da 3c); o Correr, o Haras, a Expedição e o Perfil
(só herdam o que for comum); o cartão do potro no resultado do Haras (`mountCardHtml` com `semAcoes`, fica como está);
qualquer regra, número ou texto de regra; o equipamento (suspenso, `GEAR_ON = false`); o desktop ganhar layout próprio
(continua uma coluna).

**Não pode acontecer:**
- botão indisponível que, tocado, executa a ação. Isso inclui a trava do páreo (CLAUDE.md §8: com páreo aberto,
  ponto que suba o Poder da ativa acima do que a sala viu não entra, e a ativa não troca);
- teste do 1b ou da 3a afrouxado para caber o markup novo;
- rolagem lateral a 360 px;
- alvo de toque menor que 44×44 px;
- o Estábulo trocar a ordem dos cavalos sozinho.

## 3. Abordagem

Refazer o HTML das três telas no `game.js` (que já monta as telas em texto) e o CSS no `game.css`, com as peças da 3a
(painel, placa, botão, selos, ⓘ). Descartadas: só CSS sem mexer no HTML (não dá para criar a aba Ficha nem tirar
"Tornar ativa" da lista) e um sistema de componentes (reorganizar o protótipo pede plano próprio, CLAUDE.md §9).

## 4. Estábulo: uma linha por cavalo

```
Estábulo 3/6 vagas            (placa, como hoje)
┌──────────────────────────────────┐
│[🐎 +46] Brasa #1     ★★☆  ATIVA  │ ← destaque dourado (.montaria--ativa)
│[Nv 20 ] Comum · Fogo · Poder 673 │
├──────────────────────────────────┤
│[🐎 +35] Ventania #2  ★★★      ›  │
│[Nv 12 ] Raro · Grama · Poder 702 │
└──────────────────────────────────┘
[ Expandir estábulo (300) ]
```

- **Linha:** um `<button>` por cavalo (`data-acao="montaria"`, `data-id` = uid) que abre a ficha. Conteúdo:
  - retrato pequeno com o selo do nível e o +N (`pontosQueCabem`, como hoje), na escala inteira que deixa a linha com
    ~88 px de altura;
  - nome e número (`#1`); estrelas; selo "Ativa" na ativa;
  - na 2ª linha: raridade, tipo e Poder (`RS.powerRating`, sem equipamento).
- **Sem na linha:** sexo, cruza, corcel e XP (vão para a ficha, que já os tem) e os botões "Tornar ativa" e "Ver".
- **Nome acessível** do botão, por `aria-label`: "Brasa #1, nível 20, ativa. Abrir ficha." (sem "ativa" nas outras).
  O retrato dentro dele fica `aria-hidden`.
- **Ordem:** a de hoje (`state.mounts`), sem mudar quando a ativa troca.
- **Ativa:** o destaque dourado de `.montaria--ativa`, com os rebites da 3a.
- **Abaixo da lista:** "Expandir estábulo" e o aviso de reserva, como hoje.
- **Desktop:** uma coluna (hoje são duas a partir de 601 px).
- **Função:** nova, `mountRowHtml(m, isActive)`; `mountCardHtml` continua só para o potro do Haras.

## 5. Ficha da montaria

```
‹ Voltar
[        retrato largo, na baia        ]
[ Nv 20                           +46  ]
══ Brasa #1 ════════════ ATIVA ══ (placa)
Comum · Fogo · ★★☆ ⓘ
Poder 673 ⓘ   Liga Bronze ⓘ
XP ▰▰▰▱▱▱▱▱▱  10/550
[ Status ] [ Skills ] [ Ficha ]
```

**Topo (cabeça):**
- **Retrato:** ocupa a largura da coluna, com a cena da baia e o cavalo na maior escala inteira que cabe a 360 px.
  A escala é a mesma para todos os moldes, porque o passo sai do molde mais alto (regra da 2b).
- **Selos:** nível e +N nos cantos.
- **Nome:** o `h1` vira a placa de madeira, com o `#N` e o selo "Ativa". O `id="t-montaria"` e o foco continuam.
- **Linhas embaixo:**
  - raridade, tipo e estrelas, com os ⓘ de raridade e estrelas;
  - Poder e liga, com os ⓘ de hoje;
  - XP (`xpHtml`).

**Abas:** Status | Skills | Ficha (`MONTARIA_ABAS` ganha `{ id: 'ficha', rotulo: 'Ficha' }`). A ficha abre em
Status, como hoje. Com `GEAR_ON = true` voltaria a aba Equipamento, e a ordem seria Status | Skills | Equipamento |
Ficha.

**Aba Ficha:**
- **Ações:**
  - Tornar ativa: aparece só se não for a ativa;
  - Renomear: o campo na própria tela, como hoje;
  - Liberar: com a confirmação de hoje.

  As condições de cada uma não mudam: Tornar ativa trava com páreo aberto; Liberar trava na ativa, no único cavalo e
  com páreo aberto.
- **Dados:** sexo, porte (`porteTexto`), marcas (`marcasTexto`), cruzas que restam (`breedLeft`), corcel e chance de
  skill por nível ("Skills: 45% de ativar", como hoje).
- **Pais:** se a montaria tiver `parents`, o nome dos dois. Se o nome não estiver mais no estábulo, o texto
  "fora do estábulo".

## 6. Aba Status: uma linha por status

```
Pontos: sobram 46 de 56 ⓘ   Genética ⓘ
⚡VEL  S  52 ·1    [+1][+5][+10]
▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱
…
☘SOR  B  46  de nascimento
──────────────── (fixo embaixo, com rascunho)
[ Desfazer ]  [ Confirmar ]
```

**Linha de cada status:**
- **Nome:** ícone e sigla. Tocar mostra a explicação. O nome é o próprio botão de ajuda (`ajudaBtn`: mesmo
  `data-ajuda`, `aria-label` "O que é Velocidade?", `title` e `aria-expanded`) e substitui o ⓘ separado, que não
  caberia a 360 px. A peça ⓘ da 3a aparece pequena junto da sigla.
- **Nota de genética** (S/A/B/C).
- **Valor:** com o "+N" do rascunho, como hoje.
- **Custo do próximo ponto** ("·1"), com texto para o leitor de tela: "próximo ponto custa 1".
- **Botões:** +1, +5 e +10.
- **Barra fina:** a segmentada de hoje, embaixo, em 6 px de altura.

A Sorte não tem botões e mostra "de nascimento".

Se a linha não couber a 360 px com alvos de 44 px, o custo desce para baixo do valor, dentro da mesma linha do
grid. A escolha é do executor; os botões nunca encolhem.

**Topo:** "Pontos: sobram X de Y" com o ⓘ do custo e "Genética" com o seu ⓘ, numa linha (quebra se precisar).

**Ações:**
- Com rascunho, Desfazer e Confirmar ficam numa barra fixa embaixo, acima da barra de abas (`.barra-acao`, com a
  área segura). A barra some sem rascunho.
- O pedido de confirmação ("Toque em Confirmar de novo para gravar") e o motivo do Confirmar travado aparecem na
  própria barra.
- "Distribuir sugerido" e o bloco Redistribuir (Rédea) continuam no fim da lista.

**Regras que não mudam:**
- os +N e "Distribuir sugerido" somem quando nenhum ponto cabe;
- ficam indisponíveis, com o motivo, só quando algum N cabe e outro não (spec 1b §11 emendada);
- Confirmar travado com páreo aberto e rascunho acima do Poder da sala (RF3);
- Redistribuir travado na ativa com páreo aberto.

## 7. Motivo no toque (botões indisponíveis)

Nas telas desta parte, um botão indisponível usa `aria-disabled="true"` no lugar de `disabled`. Ele continua
focável e tocável. Vale para:
- Expandir estábulo;
- Tornar ativa e Liberar;
- +1, +5 e +10;
- Distribuir sugerido;
- Confirmar;
- Redistribuir.

- **Aparência:** igual à do desabilitado da 3a, inclusive o bisel escuro no topo e a opacidade.
- **Tocar ou acionar pelo teclado (Enter/Espaço):** **não executa a ação.** Mostra o motivo, o mesmo texto do
  `title` de hoje, numa linha `role="status"` logo abaixo do grupo do botão. A linha some no próximo toque em outro
  lugar ou ao redesenhar.
- **Handler:** o de cada ação confere de novo a condição (como já faz para +N e Confirmar, revisão do 1b) e devolve
  o motivo. Nenhuma ação depende só do atributo para não acontecer.
- **Mouse:** o `title` continua.
- **Fora destas telas:** os botões continuam com `disabled`.

## 8. Ordinais para o leitor de tela

A troca de "º" por `<sup class="ord" aria-hidden="true">o</sup>` (`game.js` ~linha 127) passa a deixar o ordinal
legível. O "o" sobrescrito visual fica `aria-hidden`, e o "º" vai num `<span class="sr">º</span>`, de modo que o
leitor recebe "1º" e diz "primeiro". Vale em todo o jogo, inclusive "1º terço" na skill de tipo e "1º/2º/3º" no
Correr e no resultado.

## 9. Celular e desktop

- **Regras da 3a §7, inclusive o limite de altura:** a 3b reduz altura, então os testes de altura da 3a (Estábulo e
  Status) ganham os limites novos da seção 2.
- **Correr e Skills:** continuam presos em +4% sobre a `main`.
- **Desktop (≥ 900 px):** a mesma coluna de até 520 px. A barra fixa do Status respeita a barra lateral de abas.
- **Movimento reduzido:** nada novo anima.

## 10. Testes

**Testes que já existem.** Os blocos do `ui-test.mjs` que usam o markup destas telas (`crescimento`, `build`,
`ajuda`, `nivel-pontos`, `selo-teto`, `build-nivel1`, `vaga-tipo`, `reserva`, `marcas`, `portes`, `acabamento` e os
outros que abrem o Estábulo ou a ficha) passam a usar os seletores novos.
- **Nenhuma asserção sai e nenhuma fica mais fraca.**
- Onde um teste conferia `disabled`, ele passa a conferir `aria-disabled="true"` **e** que o toque não mudou o estado
  (save, ativa, pontos, Rédea).

**Novos, no bloco `acabamento` (ou num bloco `celular`, filtrável por `UI_SO`):**
1. **Alturas a 360×780:**
   - Estábulo com 3 cavalos ≤ 780 px;
   - Estábulo com 6 cavalos ≤ 1.100 px;
   - aba Status da ativa ≤ 1.100 px;
   - o fundo da linha de abas da ficha fica acima do topo da barra de abas do app, sem rolar.
2. **Estábulo:**
   - uma linha (botão) por cavalo, na ordem de `state.mounts`;
   - tocar abre a ficha daquele cavalo;
   - nenhum "Tornar ativa" na lista;
   - nome acessível como na seção 4;
   - a ordem não muda depois de trocar a ativa pela ficha.
3. **Aba Ficha:**
   - Tornar ativa, Renomear e Liberar funcionam como antes;
   - com páreo aberto, Tornar ativa e Liberar estão `aria-disabled`, mostram o motivo ao toque e não mudam a ativa
     nem o estábulo.
4. **Motivo no toque:** para cada botão da seção 7, num estado em que ele fica indisponível:
   - o toque mostra a linha `role="status"` com o texto do motivo;
   - o estado do jogo não muda.

   Para o +N, isso inclui o caso do páreo aberto (trava do Poder).
5. **Ajuda no nome:** o bloco `ajuda` continua com as mesmas conferências (nome acessível, `title`, alvo ≥ 44×44,
   abrir e fechar), agora sobre o nome de cada status.
6. **Ordinais:** o texto acessível de "1º terço" contém "1º" (o `sr` com "º"), e o "o" visual continua `aria-hidden`.
7. **Overflow a 360 px:**
   - Estábulo e ficha com o `SAVE_3A_LONGO` da 3a (10 vagas, nome de 24 caracteres);
   - as três abas da ficha;
   - a barra fixa com rascunho.

As capturas oficiais de `prototype/screens/` são regeneradas (a interface muda de propósito).

## 11. Documentos e memória

- `docs/GDD.md` (seção das telas): Estábulo em lista e ficha com as três abas.
- `docs/memoria/decisoes.md`: as três decisões do Vinicius e as do executor.
- `docs/memoria/ESTADO.md`: a 3b pronta e o próximo passo (3c).
- O wiki não muda: não descreve o layout.

## 12. Deixado para o executor

- O desenho exato da linha do Estábulo e da linha de status, dentro das restrições acima e das peças da 3a.
- O tamanho do retrato pequeno e do grande (escalas inteiras).
- Onde o custo do próximo ponto fica, se a linha apertar a 360 px.
- O texto curto de cada motivo quando o `title` de hoje não existir (por exemplo, "Expandir estábulo" sem Ouro).
  Deve ser no tom dos outros.
