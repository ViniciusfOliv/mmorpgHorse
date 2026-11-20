# Ferramentas de arte — pesquisa de 2026-11-20

Pesquisa sem gasto (documentação ao vivo e páginas oficiais; nenhuma geração). Serve ao `docs/arte/guia.md`; os custos
estão em `docs/arte/custos.md`.

## Recomendação: uma ferramenta por tipo de asset

| Asset | Ferramenta | Por quê |
|---|---|---|
| Cavalos e jóqueis | **PixelLab** (moldes atuais; novos com `create_image_pro` + referência de estilo, galope com `animate-with-text-v3`) | os 12 moldes já estão pagos, aprovados e recoloridos pelo jogo; a escala do jogo passa a ser a deles (guia §2) |
| Treinadores e personagens | **PixelLab `create_image_pro`** com paleta travada e o molde do cavalo como referência de estilo | 10 gerações por chamada devolvem 25 candidatos a 48 px (escolhe-se o melhor); paleta exata; mesmo traço dos cavalos |
| Camadas de cenário por região | **Retro Diffusion `rd_plus` (estilo de ambiente) com `tile_x` e `input_palette`**, a confirmar no piloto contra o PixelLab | é a única que entrega a camada já **sem emenda na horizontal** e já **na paleta**, em pixel nativo, até 384 px de lado, a US$ 0,06 a imagem. No PixelLab a camada sai sem emenda só com uma pintura extra (inpaint) por camada |
| Objetos de cenário (arquibancada, placas, poste da chegada, torre do juiz) | **PixelLab `create_image_pro`** com o quadro de estilo da região como referência | objetos isolados com fundo transparente, paleta travada, vários candidatos por chamada |
| Interface (painéis 9-fatias, botões com estados, abas, barras, placas) | **PixelLab `create_ui_asset` + `create_ui_states`**, recortados em peças por script | gera o painel inteiro na paleta exata e os estados (normal, apertado, desligado); o recorte em 9 fatias e a montagem ficam no código, que já faz isso com as peças de hoje (`interface-arte.mjs`) |
| Fonte | **Galmuri** (OFL; Galmuri11 Bold, Galmuri9, Galmuri7) | única família verificada com vários tamanhos na mesma grade, Bold de verdade, português completo (inclusive º e ª) e licença OFL sem nome reservado; renderizada crispa no tamanho nativo (`fontes-comparacao.png`). O gerador de fontes do PixelLab (15 gerações) não tem acentos: o atlas é só A–Z, a–z, 0–9 e pontuação. Não serve para português |
| Efeitos (poeira, chuva, rastros, auras, dado) | **Código** (`fx.js`, já existente, refeito na paleta e na grade) | têm de ser determinísticos (sem `Math.random`), baratos por quadro e presos à grade; IA de VFX (PixelLab `/vfx`, Retro Diffusion `rd_animation__vfx`) entrega folhas de sprite com fundo próprio e não respeita a regra de determinismo de graça |
| Logo | **PixelLab `create_image_pro`** em tamanho de pixel (ex.: 192 × 64) + acabamento por código | um logo desenhado na grade de pixel não borra; o do Canva era imagem grande reduzida |
| Capa, feature graphic e ícone do Play | **Composição por código** com as camadas, os cavalos e a fonte do jogo, ampliada por fator inteiro (512 × 250 × 2 = 1024 × 500; 128 × 128 × 4 = 512 × 512); a arte-chave que faltar, no PixelLab Pro | fica exatamente no estilo do jogo e é refeita sem custo quando a arte muda; o Canva não garante pixels nítidos na exportação (não verificado) |

**O Canva sai da produção de arte**: o logo e a capa passam a ser feitos na grade de pixel. Pode continuar como
ferramenta de rascunho de diagramação.

## PixelLab (API v2), conferido na documentação ao vivo

Fontes: `https://api.pixellab.ai/v2/openapi.json`, `https://api.pixellab.ai/v2/llms.txt` e o guia de ferramentas MCP
`https://api.pixellab.ai/mcp/docs` (gerados da API a cada publicação). Conta: plano **Tier 1: Pixel Apprentice**, 2.000
gerações por ciclo, **1.539 disponíveis** em 2026-11-20, US$ 0 de crédito avulso (`GET /balance`, grátis).

| Recurso | Endpoint | Tamanho | Custo (gerações) |
|---|---|---|---|
| Imagem simples | `create-image-pixflux` | até 400 × 400 (fundo transparente até 200 × 200) | 1 |
| Imagem simples, modelo Pixen | `create-image-pixen` | lados múltiplos de 4, área até 512 × 512 (ex.: 640 × 360, 768 × 340) | 1 |
| Imagem Pro (melhor qualidade; até 4 referências, imagem de estilo, **paleta exata**) | `generate-image-v2` | até 512 × 512 ou 688 × 384 | 10 a 25 por chamada; até 50 px: 25 candidatos por 10; 86–128 px: 4 por 10; 171–256: 1 por 10; 342–512: 1 por 25 |
| Imagem no estilo de outras | `generate-with-style-v2` | quadrado, até 512 | mesma escada do Pro |
| Pro Flash (com âncora de estilo, paleta) | `create-image-pro-flash` | 16–256 | 5 até 96 px, 6 até 208, 9 até 256 |
| Animação por texto | `animate-with-text-v3` | | ~1 por direção a 64 px, 8 quadros |
| Painel de interface | `create-ui-asset` | 192–688 (16:9 até 688 × 384) | 10 até 256 × 256, 15 até 341, 25 acima |
| Elementos de interface | `generate-ui-v2` | até 688 × 384 | escada do Pro |
| Tileset lateral | `create-tileset-sidescroller` | ladrilhos de 16 ou 32 | 1 (padrão) ou 15 (pro) |
| Objeto de mapa | `map-objects` | 16–160 | 10 (128/160: 15) |
| Efeito animado | `vfx` | | cotado no envio |
| Fonte | `generate-font-pro` | 8 a 64 px por glifo | 15; **sem acentos** |
| Edição, pintura, redução de cores | `edit-images-v2`, `inpaint-v3`, `reduce-colors` | | 10 / 10 / 0,1 |

Observações:
- O Pro aceita a paleta como lista de cores: "todo pixel do resultado é uma delas". É o caminho para gerar já na
  Resurrect 64.
- Fundos grandes não ficam sem emenda sozinhos: a emenda exige pintar a junta (`inpaint-image-pro-flash`, 5 a 6
  gerações por recorte de até 208 px).
- A API devolve HTTP 502 com frequência, sem cobrar (histórico do projeto).

## Retro Diffusion

Fontes: `https://github.com/Retro-Diffusion/api-examples`, `https://www.retrodiffusion.ai/` (sem data; © 2026).
- REST (`POST https://api.retrodiffusion.ai/v2/inferences`, chave no cabeçalho `X-RD-Token`), com `check_cost` grátis.
- `width`/`height` de 12 a 512 px; `input_palette` trava as cores numa imagem de paleta; `remove_bg`; **`tile_x` e
  `tile_y`** (sem emenda), exceto nos modelos Lite e Core.
- Preço por imagem: Fast US$ 0,03 (64–384), **Plus US$ 0,06 (64–384)**, Lite 0,05, Core 0,10 (até 512), Pro 0,18
  (até 256; o FAQ fala em 384, conflito não resolvido); tileset 0,10; objeto de cena 0,06; inpaint/outpaint 0,12;
  conversor de paleta e corretor de pixel grátis.
- Saldo pré-pago a partir de US$ 5, que não expira; conta nova ganha US$ 0,50. "Você é dono das saídas", uso pessoal e
  comercial (página inicial; a página de termos dá 404).
- Precisa de chave: pedida pelo formulário seguro da sessão (`request_credential`), nunca na conversa.

## Descartadas (e por quê)

- **Scenario**: para pixel art, revende os modelos da Retro Diffusion; API só com plano mensal (a partir de US$ 15).
- **GPT Image, Gemini**: geram a partir de ~1K; o pixel sai falso e teria de ser reduzido e requantizado (o guia
  reprova pixel falso). O Gemini põe marca d'água SynthID.
- **Layer.ai, Ludo.ai**: sem evidência de pixel art de verdade; API cara (Ludo: US$ 300/mês).
- **Kits de interface prontos** (Kenney Pixel UI Pack e UI Pack Pixel Adventure, CC0; Crusenho Complete UI Essential,
  CC BY 4.0 com dúvida de "ND" num comentário do autor; Sprout Lands UI, comercial só no Premium e com "sem
  redistribuição" ambíguo num build web; Ninja Adventure, CC0): servem de referência, não de base. Nenhum está na
  paleta, na escala ou no traço do jogo, e recolorir um kit genérico daria a mesma cara de outros jogos.

## Fontes verificadas (arquivos baixados e conferidos com fontTools)

| Fonte | Licença | Português completo | Grade (em / maiúscula) | Observação |
|---|---|---|---|---|
| **Galmuri 7/9/11/11 Bold/14** | OFL 1.1 | sim, com º ª | 8/7 · 10/9 · 12/11 · 15/14 | **escolhida**; exige subconjunto (arquivos com coreano) |
| Micro 5 + Jersey 10/15/20/25 | OFL | sim | 11/5; maiúscula 10–25 | mesma autora; a Micro 5 só lê ampliada |
| m5x7 | CC0 | sim | 16/7 | ótimo texto; o par de títulos (m6x11) não tem licença comercial explícita |
| Pixel Operator | CC0 | falta º e ª | 16/9 | |
| Tiny5, Silkscreen, Press Start 2P | OFL | sim | 8/5 · 8/5 · 8/7 | Silkscreen sem minúsculas; Press Start larga demais |
| Pixelify Sans | OFL | sim | fora da grade | borra em tamanho pequeno |
| Alagard / Romulus | confusa | | | evitar |

Fontes das licenças: github.com/quiple/galmuri, github.com/scfried/soft-type-micro, github.com/scfried/soft-type-jersey,
managore.itch.io/m5x7, dafont.com/pixel-operator.font, openfontlicense.org/ofl-faq.

## Google Play (para a capa e o ícone)

- Ícone: PNG 32 bits com alfa, 512 × 512, até 1.024 KB, quadrado cheio (o Play aplica a máscara e a sombra), sem texto
  de ranking ou preço.
- Feature graphic: 1024 × 500, JPEG ou PNG 24 bits **sem alfa**.
- Fontes: developer.android.com/distribute/google-play/resources/icon-design-specifications e
  support.google.com/googleplay/android-developer/answer/9866151.

## Não verificado

- A qualidade real das camadas da Retro Diffusion (nada foi gerado): o piloto da amostra decide entre ela e o PixelLab.
- Preço mensal do plano do PixelLab em dólares (o site é desenhado no navegador). O crédito avulso sai a ~US$ 0,008 por
  geração (a API cota 15 gerações = US$ 0,115).
- Se o Canva exporta sem reamostrar os pixels.
