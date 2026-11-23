# Créditos da arte — conteúdo da tela de créditos

Texto da tela de créditos (direção de arte, etapa 8). A tela está no jogo desde 2026-11-22: Perfil → "Créditos"
(`renderCreditos` no `prototype/src/game.js`; a licença vem de `prototype/assets/fontes/OFL-galmuri.txt` pelo build).
Mudou o texto aqui? Mude lá também. Manter em sincronia com `declaracao-ia.md`.

## Texto da tela

**Galope Elemental**

Jogo, regras e código: Vinicius

**Arte**
- Direção de arte, acabamento e composição por código.
- Arte gerada com ajuda de IA (PixelLab, Retro Diffusion), escolhida e acabada à mão. Nada é gerado por IA durante o jogo.

**Fontes**
- Nunito, de The Nunito Project (Vernon Adams e colaboradores), na interface.
- Galmuri, de Lee Minseo, no texto da corrida.
- As duas sob a SIL Open Font License 1.1 (o texto completo das licenças fica num botão "Licenças das fontes").

**Paleta**
- Resurrect 64, de Kerrie Lake (Lospec).

## Notas para a implementação

- O texto completo das OFL está em `prototype/assets/fontes/OFL-nunito.txt` e `OFL-galmuri.txt`; a licença exige que ele
  acompanhe a fonte quando ela é distribuída (o jogo embute as fontes). Mostrar o texto num painel que rola, sem resumir.
- Nunito: subconjunto latino em WOFF2 do pacote @fontsource/nunito 5.1.0, sem alterar desenhos (pode manter o nome).
- O nome reservado da fonte não pode ser usado num derivado modificado: o jogo usa um subconjunto latino sem alterar os
  desenhos, então pode manter o nome "Galmuri" (conferir de novo se algum glifo for editado).
- A paleta Resurrect 64 é de uso livre; o crédito é cortesia e fica.
- O nome do desenvolvedor nos créditos é "Vinicius" (confirmado por ele em 2026-11-23).
