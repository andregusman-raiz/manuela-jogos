# Relatório final — Onda Tabuleiros (2026-08-01 → 02)

> Execução completa de `docs/plans/PROMPT-EXECUCAO-jogos-tabuleiro.md` sobre a
> SPEC `docs/specs/SPEC-jogos-tabuleiro.md` v1.1 (juiz adversarial pré-build:
> **12 blockers com reprodução, todos acatados**). Resultado: **5 jogos novos
> em produção** — o hub fechou com **19 jogos**.

## Entregas

| PR | Jogo | Destaque | Review cross-model |
|----|------|----------|--------------------|
| [#36](https://github.com/andregusman-raiz/manuela-jogos/pull/36) | Ludo da Manu + infra (BD v5, fold-gate endurecido) | E2E re-executa o LCG da UI e confere o DOM **rolagem a rolagem** numa partida completa (semente 13, 67 rolagens) | 3 MAJOR + 6 MINOR → corrigidos/1 aceito |
| [#37](https://github.com/andregusman-raiz/manuela-jogos/pull/37) | Cobras e Escadas | Quique no 100 com atalho PÓS-quique; oráculo de geometria boustrophedon no DOM | 5 MINOR + 1 NIT → corrigidos/1 aceito |
| [#38](https://github.com/andregusman-raiz/manuela-jogos/pull/38) | Lig-4 (1º jogo vs aparelho) | Vitória REAL contra a IA determinística: linha vencedora achada por busca offline prova a persistência | 2 MINOR + 2 NIT → corrigidos |
| [#39](https://github.com/andregusman-raiz/manuela-jogos/pull/39) | Mancala/Kalah | Pulo DUPLO do kalah (cova de 27) e fim-domina-extra com estados do juiz hard-coded | 4 MINOR + 1 NIT → corrigidos |
| [#40](https://github.com/andregusman-raiz/manuela-jogos/pull/40) | Roda Romana | BFS do espaço INTEIRO como teste: 5.230 estados = contagem independente do juiz | 3 MINOR + 2 NIT → corrigidos |

## Achados que valeram a onda

1. **Dados determinísticos por URL** (`?semente=` + LCG compartilhado) viraram
   o padrão da casa: o E2E reproduz partidas inteiras espelhando o motor —
   zero mock, zero flake de aleatoriedade (blocker J4 do juiz).
2. **O fold-gate endurecido pagou em 24h**: o card do Lig-4 estourou a dobra
   no preset iPhone e o gate (que agora também reprova sobreposição) travou o
   PR — o hub foi re-orçado para 5 colunas ANTES de chegar a produção.
3. **Teste-primeiro salvou o Mancala**: o walk stateful original REPROVOU nos
   testes do juiz (pulo duplo) e foi reescrito como anel de 13 posições em que
   o kalah adversário nem existe — pular deixou de ser lógica para ser
   topologia.
4. **Verificação exaustiva como unit test**: a Rota é pequena o bastante para
   o teste ENUMERAR todo o espaço alcançável (5.230 estados) e provar que a
   regra de skip era código morto — números batendo com a enumeração
   independente do juiz da SPEC.
5. **A IA infantil tem contrato**: distração NUNCA pula vitória própria nem
   bloqueio (testado com rng hostil e distração 100%); o revisor enumerou os
   544 estados de ameaça da Rota e confirmou 336/336 bloqueios corretos.
6. **Autor ≠ revisor seguiu rendendo**: 17 MAJOR/MINOR reais pegos pelo Codex
   nos 5 PRs (ex.: peões coexistentes desenhados um sobre o outro, passe de
   vez 400ms antes do prometido, teste "44px" que aceitava 40).

## Gates finais (main)

`typecheck` ✅ · `lint` ✅ · `test` **255/255** ✅ · `test:e2e` **225 passed /
1 skipped** ✅ (skip = offline WebKit, limitação documentada). Hub com 19
cards na dobra (fold-gate endurecido + deitado). SW `manu-app-v20`.

## Verificação em produção (jogando, não curl)

Cada PR verificado após o merge jogando de verdade: Ludo (peões andando com
anel de vez), Cobras (corrida com escadas na semente 15), Lig-4 (3 rodadas vs
Manu), Mancala (vez extra + 48 sementes conservadas), Rota (Manu bloqueando a
ameaça dupla na casa 2). Screenshots em
`~/Claude/artefatos/screenshots/manuela-jogos/onda-tabuleiro/`.

## Gaps e pendências declaradas

- **Sem IA para Ludo/Cobras** (decisão de SPEC: corrida de dados é 2-4P local
  na v1; escopo negativo §7).
- **Batalha Naval e Dominó** seguem fora (mão secreta no mesmo aparelho exige
  SPEC própria de UX "passa o celular").
- Herdados: arte das silhuetas do Tangram (feedback da Manuela), offline em
  iPhone real, sessão de calibração com a usuária — agora com 19 jogos.
