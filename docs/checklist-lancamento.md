# Fases do projeto e checklist de lançamento

Material de consulta. A fase atual fica registrada no `CLAUDE.md` e em `docs/memoria/ESTADO.md`.

## Fases
1. **Ideia** — conceito em uma frase, referências, público. Registrar em `docs/GDD.md`.
2. **Protótipo** ← _estamos aqui_ — a mecânica principal é divertida? Código descartável.
3. **MVP** — versão mínima jogável do começo ao fim. Escopo travado. Escolher a stack final.
4. **Produção** — conteúdo, arte, som, menus, save, configurações, servidor.
5. **Teste** — testadores reais (Play: teste fechado / web: beta). Corrigir e balancear.
6. **Lançamento** — página da loja, divulgação, build final com tag `vX.Y.Z`.
7. **Pós-lançamento** — correções, atualizações, ouvir jogadores.

## Checklist antes de publicar
Regras de loja mudam: confirme cada item na documentação oficial no momento do lançamento.

### Geral
- [ ] `./scripts/check.sh` (ou a verificação da stack final) passando
- [ ] Testado em aparelho real e em resoluções diferentes (celular pequeno, tablet, desktop)
- [ ] Versão e tag criadas
- [ ] Política de privacidade publicada (obrigatória no Play; também se houver contas/chat)
- [ ] Declaração de uso de IA atualizada a partir de `docs/memoria/assets.md`

### Específico deste jogo (apostas + gacha)
- [ ] **Apostas com moeda virtual:** conferir a política de *jogos de azar simulados* do Google
      Play e o questionário de classificação etária (IARC). Garantir e documentar que o Ouro não
      tem valor real: não se compra, não se saca e Gemas nunca viram Ouro.
- [ ] **Ovos/gacha (loot boxes):** o Google Play exige mostrar as probabilidades **antes** da
      compra. Algumas regiões têm regras próprias (ex.: Bélgica proíbe loot boxes pagas).
- [ ] Chat/hub social: denúncia, bloqueio e moderação mínima.

### Google Play
- [ ] Conta **pessoal** criada após 13/nov/2023: teste fechado com **12 testadores por 14 dias
      seguidos** antes de liberar produção, **para cada app novo** (contas de organização são
      isentas). Reserve ~3 semanas.
- [ ] Formulário de segurança de dados (Data safety) preenchido.
- [ ] Política de IA do Play: vale para apps que **geram** conteúdo com IA dentro do app; assets
      feitos com IA durante o desenvolvimento não exigem rótulo (conferir na época).

### Web
- [ ] Hospedagem com HTTPS; testado em Chrome, Firefox, Safari (iOS) e Android.

### Steam (se entrar no escopo)
- [ ] Página publicada cedo (lista de desejos).
- [ ] Declaração de IA: desde jan/2026, só conteúdo gerado por IA que o jogador consome (arte,
      som, texto, loja); ferramentas de código ficam de fora. IA gerada *ao vivo* no jogo exige
      descrever as proteções.
- [ ] Build enviado via SteamPipe; teste no Steam Deck.
