# Custos da direção de arte — estimativa de 2026-11-20

**Nada foi gerado.** Os números vêm das tabelas de preço publicadas (PixelLab: guia MCP gerado da API ao vivo;
Retro Diffusion: repositório oficial de exemplos). Toda geração paga espera a confirmação explícita do Vinicius.

## Base

- **PixelLab**: plano Tier 1 (Pixel Apprentice), 2.000 gerações por ciclo, **1.539 disponíveis hoje**; US$ 0 de crédito
  avulso. Gerar dentro da cota não custa nada além do plano que já está pago. Fora da cota, o crédito avulso sai a
  **~US$ 0,008 por geração** (a API cota 15 gerações = US$ 0,115 e 10 = US$ 0,08).
- **Retro Diffusion**: saldo pré-pago, mínimo **US$ 5** (não expira); conta nova ganha US$ 0,50. Plus: US$ 0,06 por
  imagem. Precisa de conta e de chave (formulário seguro da sessão).
- **Canva**: sai da produção de arte (custo zero). **Fonte Galmuri**: grátis (OFL). **Efeitos e interface montada**:
  código, sem custo.

## Amostra: a tela da corrida no Cerrado

| Etapa | O que | Ferramenta | Custo |
|---|---|---|---|
| A. Piloto de camadas | as mesmas 3 camadas (chapadas, cerrado, primeiro plano) nas duas ferramentas: RD Plus com `tile_x` e paleta (2 sementes cada) × PixelLab Pixen (2 sementes cada) + 1 camada no PixelLab Pro com a paleta | RD + PixelLab | US$ 0,36 + 31 gerações |
| B. Quadro de estilo | a cena inteira da corrida em 688 × 384, com o molde do cavalo como referência: define luz, cor e traço da região e vira referência de estilo das outras peças (2 tentativas) | PixelLab Pro | 50 gerações |
| C. Camadas da região | céu, chapadas, cerrado do meio, fundo da arquibancada, chão da pista, primeiro plano (6 camadas × 3 sementes) | **RD** (se vencer o piloto) | ~US$ 1,10 |
| | | ou PixelLab Pro (6 × 2 × 25) + emendas | ou ~330 gerações |
| D. Objetos | arquibancada principal (3 × 10), poste da chegada, placas de distância e de curva, torre do juiz (2 × 10, 16 candidatos cada) | PixelLab Pro | 50 gerações |
| E. Reserva | refazer o que não passar no guia (~20%) | | 30 gerações |
| **Total, se a RD vencer** | | | **~160 gerações + ~US$ 1,50 (de um saldo de US$ 5)** |
| **Total, se o PixelLab vencer** | | | **~490 gerações, US$ 0** |

**Tetos que proponho para a amostra:** PixelLab **200 gerações** (sobe para **500** só se a RD perder o piloto, e eu
aviso antes de passar dos 200); Retro Diffusion **US$ 5** de saldo, com gasto previsto abaixo de US$ 2.

## Jogo inteiro (ordem de grandeza)

| Frente | Quantidade | Gerações (PixelLab) | Retro Diffusion |
|---|---|---|---|
| Amostra (Cerrado) | 1 região | 160 | US$ 1,50 |
| Outras regiões de corrida | 4 (várzea/lagoa, planalto/ventania, sertão/engenho, litoral/palmeiras) | 400 (quadro de estilo + objetos) | US$ 5 (camadas) |
| Ginásios (cena do desafio e fundo) | 3 | 180 | — |
| Treinadores na escala certa (corpo 40 px) + bustos 64 × 64 | 15 + 15 | 300 | — |
| Cenas de tela (Estábulo, Haras, Loja, Expedição) | 4 | 240 | — |
| Mapas da Expedição | 3 | 150 | — |
| Interface (painéis, botões com estados, abas, barras, placas, cartões) | ~10 componentes | 250 | — |
| Ícones refeitos em 16 × 16 | ~70 | 140 | — |
| Logo na grade de pixel | 1 | 60 | — |
| Arte-chave da capa e do ícone do Play | 2 | 80 | — |
| Reserva (~20%) | | 390 | US$ 3 |
| **Total** | | **~2.350 gerações** | **~US$ 10 a 15** |

- Em dinheiro: as 2.350 gerações cabem em pouco mais de um ciclo do plano atual (US$ 0 a mais), ou custariam ~US$ 19 em
  crédito avulso. Se o PixelLab fizer também as camadas de cenário, somam-se ~1.500 gerações (~3.850 no total).
- Cavalos e jóqueis: **zero** (os 12 moldes ficam; muda só a escala e a paleta, por código).
- Não entram: sons e músicas (ElevenLabs ou o gerador do PixelLab, outra frente), animações novas dos treinadores.
