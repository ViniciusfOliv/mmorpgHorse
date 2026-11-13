# Visuais 2, parte 2b: portes (esguio, padrão e robusto)

Especificação da parte 2b da frente "Visuais 2". O desenho foi conversado com o Vinicius em 2026-11-13.
A parte 2 (cavalos) tem três subpartes, nesta ordem:
- **2a** (pronta e integrada na `claude/cavalos-v3`): marcas, jóquei e raridade, feitas em código;
- **2b** (esta): portes novos, gerados no PixelLab;
- **2c**: animações novas para todos os portes, também no PixelLab.

Trabalho na branch `claude/visuais-2`, que hoje é igual à `claude/cavalos-v3` (b7d1d0c).

## 1. Intenção

**Por quê.** Hoje todo cavalo de Fogo tem o mesmo corpo, e o mesmo vale para Água e Grama. Cada elemento tem um
desenho só. A 2a deu marcas, jóquei e raridade a cada cavalo; a 2b muda o **formato do corpo**, para que dois
cavalos do mesmo elemento deixem de parecer cópias. O porte também dá ao cruzamento mais um traço visível
para colecionar.

**Decidido com o Vinicius:**
- O porte é um **gene herdado, como as marcas** (escolha dele entre três caminhos: gene herdado, genética de
  status ou raridade). Ele só muda a aparência.
- São **três portes, inspirados em raças brasileiras:** esguio, padrão e robusto.
- **O padrão também é gerado de novo:** saem os desenhos de hoje e entram 9 desenhos novos (3 portes × 3
  elementos), feitos todos com a mesma receita.
- **Caminho de geração: um corpo por porte.** Para cada porte sai primeiro um corpo-mestre sem elemento. As
  versões de Fogo, Água e Grama partem dele e trocam a crina, a cauda e os detalhes.

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos:**
- Os três portes se distinguem de relance, também no tamanho da pista e no celular.
- O mesmo porte tem o mesmo corpo nos três elementos, porque é isso que o gene promete.
- Os desenhos novos têm as **4 pernas separadas** no retrato e no parado. Isso fecha o limite das meias da 2a.
- Cada elemento ganha a **sua crina no galope**, e acaba a pendência antiga: o galope de Água e Grama vinha
  guiado pelo de Fogo.
- As marcas, o jóquei e a raridade da 2a funcionam nos desenhos novos sem código de zona novo.

**Não objetivos (ficam de fora):**
- animações novas: largada, pódio, respiração e piscar ficam para a 2c;
- qualquer efeito do porte em status, Poder, preço, chance de skill, aluguel ou corrida;
- corpo próprio por elemento;
- gene de cor de crina;
- retratos maiores;
- marcas no desenho por código, que continua só como reserva quando os moldes não carregam.

**Antiobjetivos (fracasso mesmo que funcione):**
- portes que não se distinguem no tamanho da corrida;
- o robusto de Fogo com proporções diferentes do robusto de Água;
- um cavalo que muda de porte entre sessões;
- gasto de créditos sem a confirmação explícita do Vinicius;
- qualquer mudança nos sorteios que já existem ou no resultado da corrida.

## 3. O gene `porte`

**Valores** (em `GameData.PORTES`): `['esguio', 'padrao', 'robusto']`, com os rótulos "Esguio", "Padrão" e
"Robusto". A mutação é de 0,10, a mesma das marcas.

**Herança.** O potro herda o porte de um dos pais, 50% de cada, e com 10% de chance o valor é trocado por um
dos três, sorteado por igual (pode sair o mesmo valor). Os sorteios saem de um fluxo próprio da seed:
`mulberry32(hash2(seedBase >>> 0, 0x504F0000 + breedCounter))`, com 2 sorteios, primeiro a mutação e depois o
valor. As regras de antes continuam valendo:
- os sorteios que já existem no `foal()` (passos 1 a 8 e as marcas) não mudam em número nem em ordem;
- o Mítico nunca nasce de cruzamento.

**Catálogo** (escolha minha, que o Vinicius confere na revisão desta spec; depois dela, a tabela é a fonte da
verdade para os testes e o wiki). Os iniciais ficam todos no padrão, para que a escolha do inicial compare cavalos
com o mesmo corpo. Os nomes guiaram o resto:

| Cavalo | Elemento | Porte |
|---|---|---|
| Brasa, Maré, Ipê (iniciais) | Fogo, Água, Grama | padrão |
| Faísca | Fogo | esguio |
| Tição | Fogo | robusto |
| Fogaréu | Fogo | robusto |
| Boitatá | Fogo | esguio |
| Lambari | Água | esguio |
| Garoa | Água | padrão |
| Pororoca | Água | robusto |
| Iara | Água | esguio |
| Capim | Grama | esguio |
| Mandacaru | Grama | robusto |
| Ventania | Grama | esguio |
| Jequitibá | Grama | robusto |

Total: 6 esguios, 4 padrões e 5 robustos.

**Save.** Não há versão nova do save. `porte` é um campo opcional no cavalo, e o cavalo sem porte válido segue
a mesma escada das marcas:
1. o porte do modelo do catálogo (`templateId`);
2. se não houver, `porteDoId(chave)`, calculado do identificador por `Breed.hashChave`;
3. o resultado é sempre um dos três valores e nunca muda entre sessões.

Em todos os casos o porte do save é validado com `indexOf` estrito.

**Rivais.** O rival da sala usa o porte do modelo, como já faz com as marcas.

## 4. Desenhos (moldes)

**Conjunto.** São 3 portes × 4 estilos:
- `lisa` é o corpo-mestre, sem elemento;
- `chamas` é Fogo, `ondas` é Água e `folhas` é Grama.

Cada um dos 12 tem retrato, parado e galope de 9 quadros, em 64×64, vista lateral, com os mesmos papéis de cor,
o mesmo JSON de âncoras e o mesmo `larguraUtil` de hoje. Os arquivos se chamam
`prototype/assets/pixellab/molde-<porte>-<estilo>-<estado>.png` e `molde-<porte>-<estilo>.json`. Os moldes de hoje saem do
repositório e ficam no histórico do git. O `assets.md` marca o lote antigo como substituído.

**O mestre (`lisa`) tem duas funções.** Ele guia as versões de elemento e é o desenho de reserva de um
elemento fora da lista; hoje o `lisa` já cumpre esse papel. O galope do mestre também serve de guia para o
galope de uma versão que falhar, como o de chamas guiou os outros no primeiro lote.

**Aparência de cada porte** (o texto exato do pedido fica com quem constrói):

| Porte | Inspiração | Como se reconhece de lado |
|---|---|---|
| Esguio | Mangalarga | pernas longas e finas, pescoço comprido, cabeça pequena, cauda alta |
| Padrão | Campolina | meio-termo, perfil de cabeça levemente curvo, corpo equilibrado |
| Robusto | Crioulo | mais baixo e largo, peito e pescoço grossos, pernas curtas e fortes, crina farta |

Os pedidos exageram a diferença: o esguio claramente mais alto e fino, o robusto claramente mais compacto.

**Crina e cauda por elemento:** as de hoje. Chamas para Fogo, ondas para Água e folhas para Grama, cada uma
com o seu detalhe (papel 6). As versões de elemento mantêm o corpo do mestre.

**Tela e escala.** O canvas continua 64×64. O PixelLab tende a encher o canvas com o cavalo, qualquer que seja o
porte pedido, então a diferença entre os portes está nas **proporções** (altura e espessura do corpo em relação ao
comprimento), e não no tamanho absoluto do desenho. Hoje a escala única sai do maior `larguraUtil` entre os
estilos. Ela passa a sair do maior `larguraUtil` **entre os 4 desenhos do padrão** (`lisa` incluído), e os
cavalos do padrão ficam do tamanho dos de hoje. O encaixe continua pelas âncoras de cada molde, como hoje: pés
no `footY`, focinho no `nose`, retrato pelo bbox. Se um porte não couber na raia ou no cartão (o teste de
interface já confere que o cavalo nunca sai da tela e que nada rola de lado a 360 px), ajusta-se o pedido ou o
recorte daquele porte, nunca a escala dos outros.

**Medidas do corpo** (usadas nos critérios da seção 5): só os papéis 1 a 3 (contorno e pelagem). Ficam de fora
a crina e a cauda (4 e 5), o detalhe (6), o jóquei (7 e 8) e a sela (9). As orelhas contam como corpo.
- **altura do corpo:** do pixel de corpo mais alto até o `footY`;
- **comprimento:** o `larguraUtil`;
- **espessura:** do lombo à barriga, na coluna da sela; no retrato, que não tem sela, na coluna do meio do bbox.

## 5. Geração (PixelLab, API v2, com o mesmo script)

**Receita** (`prototype/tools/pixellab-moldes.mjs`, num lote novo `portes`):
1. **Mestres:** para cada porte, retrato, parado e pose de corrida pelo `create-image-pixflux`, sem elemento,
   com a mesma receita do primeiro lote (cores de papel pedidas por texto e classificadas no script). Depois,
   o galope de 9 quadros pelo `animate-with-text-v3`, a partir da pose de corrida.
2. **Versões de elemento:** para cada porte e elemento, retrato, parado e pose de corrida pelo
   `create-image-pixflux`, com `init_image` = a imagem do mestre no mesmo estado e o texto da crina e da cauda
   do elemento; depois o galope a partir da própria pose. Se a crina mudar pouco partindo do mestre, aquela
   versão sai sem `init_image`, pela receita do primeiro lote, e passa nos mesmos critérios.
3. O dry-run é o padrão, com `--gerar`, `--teto`, `--only`, `--repetir` e `--reprocessar`, como hoje. As
   respostas cruas ficam em `raw/`.

**Critérios automáticos de aceite** (no script, antes de qualquer conferência visual):
- **pernas:** `Marcas.zonas` acha exatamente 4 pernas no retrato e no parado; no galope (e na pose de corrida, que
  vira o quadro 0 dele), pelo menos 2 em todo quadro. Na vista de lado as pernas se cruzam no galope: a regra de
  antes (pelo menos 3 em todo quadro e 4 em pelo menos 5 dos 9) reprovava os galopes dos mestres, que pareciam bons
  na folha. Mudança decidida pelo Vinicius em 2026-11-13;
- **forma:** a regra de silhueta e de contorno do primeiro lote, sem buraco que deixe o fundo entrar no corpo;
- **mesmo corpo:** no retrato e no parado, cada versão de elemento fica a no máximo 2 px do mestre no `footY`,
  no `nose`, na altura do corpo e no comprimento (medidas da seção 4, sem a crina);
- **portes distintos,** em proporção, no retrato dos mestres:
  - altura do corpo ÷ comprimento: no esguio, pelo menos 1,10 × a do padrão; no robusto, no máximo 0,92 × a do
    padrão;
  - espessura ÷ comprimento: no robusto, pelo menos 1,15 × a do padrão;
- **galope estável:** nos 9 quadros, o lombo na coluna da sela varia no máximo 3 px, o `nose.x` fica a ±6 px do
  da pose de corrida (o critério do primeiro lote) e o comprimento varia no máximo 4 px. O porte não pode mudar
  no meio do galope.

**Quando um critério falha:**
- **Repetição:** cada item tem até 3 seeds.
- **Piloto:** antes das 9 versões, sai uma versão piloto por porte (a de Fogo), para ver se o `init_image`
  segura o corpo do mestre. Se o piloto não passar no "mesmo corpo" em 3 seeds, as versões daquele porte saem
  pelo caminho 2 (sem `init_image`), com os mesmos critérios.
- **Item ainda reprovado depois das 3 seeds:** a melhor tentativa vai para a folha marcada com o critério que
  falhou, e o Vinicius decide entre aceitar, refazer ou dar mais teto. O teto nunca sobe sem a confirmação dele.
- **Limiares:** os de 1,10, 0,92 e 1,15 são o meu ponto de partida. Se o PixelLab não chegar neles, o Vinicius
  decide na folha dos mestres se aceita o que saiu.

**Entrega.** É tudo ou nada: a 2b só entra na `claude/cavalos-v3` com os 12 moldes aprovados. Até lá:
- o código do gene, do save, das telas e do wiki pode ser feito antes, com os desenhos de hoje fazendo as vezes
  dos três portes, e o `check.sh` fica verde a cada passo;
- os moldes novos entram, e os antigos saem, no mesmo commit, depois da folha final.

**Folhas para o Vinicius aprovar** (artefato do claude.ai, como a folha dos ícones):
1. **Folha dos mestres:** os 3 portes lado a lado, em retrato, parado e galope animado, em tamanho real e
   ampliado. Só depois da aprovação dela saem as versões de elemento.
2. **Folha final:** as 9 versões com o galope animado, recoloridas com a paleta de alguns cavalos do
   catálogo, com marcas, jóquei e raridade. Só depois dela os desenhos entram no jogo.

**Custo e confirmação.** A estimativa vai de 50 a 75 gerações. Os mestres são 3 × (3 imagens + 1 galope) = 12,
e as versões são 9 × 4 = 36, mais as refações. O teto do lote é de **90 gerações** da cota do plano. Hoje
sobram 1.846 gerações, e o custo avulso é de US$ 0. **Nada é gerado sem a confirmação explícita do Vinicius**
na hora de rodar `--gerar`, com o teto dito. Cada arquivo final entra no `docs/memoria/assets.md` com
endpoint, prompt, seed e custo, porque isso alimenta a declaração de IA da Steam.

## 6. No jogo

- **Desenho:** o `drawHorse` escolhe o molde por `porte` + elemento. Sem porte nas opções, vale o padrão. Os
  caches incluem o porte na chave. A carga dos moldes continua "tudo ou nada": se faltar um dos 12, vale o
  desenho por código, como hoje.
- **Telas:** a ficha da Montaria e as linhas do Haras ganham "Porte: Robusto" antes da linha das marcas. A
  Calculadora do Haras mostra os portes que o potro pode ter. A gaveta DEV ganha um seletor de porte.
- **Wiki** (gerado do código): uma seção "Portes" com os 3 valores, a herança e a tabela dos 15 cavalos. O GDD
  §6 ganha a regra numa linha, como a das marcas.
- **Pendências da 2a resolvidas aqui:**
  - teste de contagem de meias por molde novo: no retrato e no parado, N meias dão N manchas brancas, de 1 a 4;
  - teste do caso "pele acima do capacete" (`marcas.js` ~386-388) com os moldes novos;
  - o brilho de cada raridade conferido sobre a crina de cada molde novo, com o mesmo teste de luminância do
    Mágico na Grama.

## 7. Testes

- **`sim-test` (cruzamento e save):**
  - herança do porte: mutação entre 8,5% e 11,5%, e sem mutação a égua entre 47% e 53%;
  - os sorteios antigos do `foal()` iguais, campo a campo, aos de antes da 2b, numa amostra de potros;
  - Mítico nunca nasce;
  - `porteDoId` determinístico e cobrindo os 3 valores em 1.000 chaves;
  - o catálogo com os portes da tabela;
  - save com lixo no `porte` cai na escada da seção 3.
- **`moldes-test`:** os 12 moldes carregam e cumprem os critérios automáticos da seção 5, incluindo os dois
  testes da 2a que dependiam dos moldes novos.
- **`fx-test`:**
  - `drawHorse` usa o molde do porte;
  - sem moldes, o desenho por código continua igual byte a byte;
  - a chave do cache inclui o porte.
- **`ui-test`:**
  - "Porte:" na ficha e no Haras;
  - o rival com o porte do modelo;
  - corrida com 8 Míticos robustos dentro do teto de desempenho;
  - o cavalo inteiro na tela a 360 px nos três portes;
  - capturas oficiais novas.
- **`wiki-test`:** a seção "Portes" existe e tem as 15 linhas da tabela.
- **`check.sh`** termina em OK antes de dizer que acabou.

## 8. Caminhos considerados

1. **Um corpo por porte, com três crinas por cima (escolhido).** O mesmo porte tem o mesmo corpo nos três
   elementos, as pernas são conferidas uma vez por porte e as refações saem baratas. Os elementos se
   diferenciam só pela crina, pela cauda e pelos detalhes.
2. **Cada desenho do zero, com a receita do primeiro lote.** Dá mais variedade de corpo entre elementos, mas
   o mesmo porte pode sair com proporções diferentes em cada elemento, e cada um dos 9 desenhos precisa
   passar sozinho na conferência das pernas. Foi aí que o primeiro lote mais falhou. Estimativa de 55 a 90
   gerações.
3. **O mesmo esqueleto de galope para todos (descartado).** Deformaria o robusto, que ficaria com a passada
   do esguio, e as animações são refeitas na 2c de qualquer jeito.

O gene também teve três caminhos: herdado (o escolhido); pela genética de status, que permitiria "ler" o
rival mas amarra a aparência ao balanceamento; e pela raridade, que repete a escada da 2a e não resolve dois
Comuns iguais.

## 9. Restrições

- ES5 em `prototype/src/` e nenhuma dependência nova.
- `sim.js` e `gear.js` não mudam, a corrida dá o mesmo resultado e não entra `Math.random`.
- `prototype/dist/` e `docs/wiki.md` só saem do build.
- O save não muda de versão.
- Nada é gerado sem confirmação.
- A regra de "só aparência" da 2a vale também para o porte.

## 10. O que fica com quem constrói

- O texto exato dos pedidos ao PixelLab, as seeds, o `init_image_strength` e os limiares de classificação.
- Os nomes internos das funções; a sugestão é `porteDoId`, `porteValido` e `Breed.porteDe`, seguindo o
  padrão das marcas.
- A arrumação do lote `portes` no script e da página de conferência (`comparativo.html?so=portes`).
- A ordem das linhas na ficha e no Haras, desde que o porte venha perto das marcas.
