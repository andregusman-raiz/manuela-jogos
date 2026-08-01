# PROMPT DE EXECUÇÃO — Onda Tabuleiros (5 jogos, até produção)

> Executar de ponta a ponta a onda de tabuleiros pesquisada em
> `docs/plans/PESQUISA-jogos-tabuleiro.md`: **Ludo, Cobras e Escadas, Lig-4,
> Mancala e Rota** — SPEC julgada, 5 PRs, gates, verificação jogada, produção.
> Batalha Naval e Dominó ficam FORA (mão secreta no mesmo aparelho = SPEC própria
> futura); Trilha completa fica fora (9-10 anos; a Rota é a versão 6-8).

## Missão

Levar o hub de 14 para **19 jogos em produção** (manuela-jogos.vercel.app),
seguindo o protocolo consolidado das ondas 1-3 sem exceções.

## Contexto fixo (não rediscutir)

- Repo: `~/Claude/GitHub-pessoal/manuela-jogos` (PÚBLICO, andregusman-raiz).
  Next 16 + React 19 + Tailwind 4. **ZERO dependências de runtime novas.**
- Engines TS puras em `lib/<jogo>/motor.ts` + testes unit em `tests/unidade/`;
  UI em `components/<jogo>/`; SVG próprio nas cores da casa; sons via `lib/som.ts`.
- Padrões React da casa (inegociáveis): efeito colateral NUNCA em updater de
  setState (StrictMode); guards síncronos por identidade de rodada (padrão
  `respondidaRef`); sons seguem transição real em useEffect.
- IndexedDB: `lib/armazenamento.ts` — bump ÚNICO `VERSAO_BD=5` no PR A com as
  5 lojas novas (`ludo`, `cobras`, `lig4`, `mancala`, `rota`); upgrades aditivos;
  conexões curtas.
- SW: `public/sw.js` — bump `VERSAO` + rotas novas na `CASCA` em cada PR.
- Hub: 19 cards precisam passar no fold-gate (`tests/e2e/hub.spec.ts`, 3 formatos)
  — se a dobra estourar, densificar o grid no PR A (mesma manobra do PR #18) e
  manter `deitado.spec.ts` verde. Cores de card NUNCA `bg-manu-nuvem` (invisível).
- E2E: `_toque.ts` (dedo 80px), 3 formatos via `browser.newContext`, oráculos
  independentes da engine, confete via `canvas[data-ativo='true']`, hooks `data-*`.
- Licenças: mecânica reimplementada do zero. Repos AGPL/GPL (libreludo,
  FreeBoardGames) = referência de regras/UX com o código FECHADO na hora de
  escrever. MIT (avirati/ludo, boardgame.io) = leitura próxima ok, cópia não.
  Nome "Ludo" ok; NUNCA "Ludo King" (marca). Arte 100% própria.
- Git: feature branch por PR + squash merge; commits conventional EN; NUNCA
  commit na main (incidente do PR #28), NUNCA force-push. Screenshots em
  `~/Claude/artefatos/screenshots/manuela-jogos/` (nunca no repo).

## Fase 0 — SPEC única da onda + juiz

1. Escrever `docs/specs/SPEC-jogos-tabuleiro.md` cobrindo os 5 jogos: regras
   fechadas por nível, contratos das engines (tipos, funções puras, invariantes),
   layout retrato+deitado, plano de testes (unit + E2E com oráculos), critérios
   de aceite verificáveis, escopo negativo.
2. Juiz adversarial Codex (MCP `mcp__codex__codex`, sandbox read-only, approval
   never, **1 rodada**): pedir REPRODUÇÃO dos furos ("qual sequência de dados
   quebra?", "qual mutação semântica passa nos testes?"). Corrigir blockers,
   registrar refutações com evidência na própria SPEC (v1.1).

## Fase 1 — 5 PRs, nesta ordem

### PR A — Ludo da Manu (`/ludo`) + infra da onda
- Infra: VERSAO_BD=5 (5 lojas), hub com 19 cards na dobra, manifest `lib/jogos.ts`.
- Engine: tabuleiro clássico em cruz — 52 casas de volta + coluna final de 6 por
  cor (peão completa em 56 passos; referência de modelagem: avirati/ludo, MIT).
  Estado imutável; dado seeded; 2-4 jogadores locais.
  - Nível 1: 2 peões/jogador, 1 já fora da base, sem regra dos três 6,
    auto-move quando só há 1 jogada legal, 6 repete a vez.
  - Nível 2: 4 peões, bloqueio de dupla, três 6 perde a vez.
  - Sempre: captura devolve à base; casas seguras marcadas; chegada exata.
- UI: anel de vez nas bordas (padrão Damas), dado automático animado (SVG),
  peões tocáveis ≥44px, destaque das jogadas legais.
- E2E: partida completa determinística GERADA PELO MOTOR (padrão Damas),
  cobrindo captura, casa segura, chegada exata e vitória; persistência do nível.

### PR B — Cobras e Escadas (`/cobras`)
- Engine: trilha 1-100 boustrophedon, mapa de atalhos (≥5 cobras + ≥5 escadas,
  posições fixas da SPEC), passar de 100 quica de volta o excedente, 2-4P.
- UI: tabuleiro 10×10 com NÚMEROS GRANDES (pedagogia 1-100), cobras/escadas SVG.
- E2E: oráculo = tabela de atalhos hard-coded no teste (não importada da engine);
  partida completa determinística; quique no 100 exercitado.

### PR C — Lig-4 (`/lig4`) — primeiro jogo contra o aparelho
- Engine: grade 7×6, vitória nas 4 direções, empate; queda por coluna.
- IA: minimax profundidade 2 PURA e determinística sob seed, com 20% de jogada
  aleatória ("Manu distraída"). Unit tests: IA vence em 1 lance quando existe;
  IA bloqueia ameaça iminente do humano; nunca joga coluna cheia.
- Modos: 2P local E vs-Manu (seleção na entrada, padrão Genius de gesto).
- E2E: vitórias H/V/diagonal com oráculo independente; sob seed fixa, a IA
  bloqueia a ameaça do teste; empate declarado.

### PR D — Mancala/Kalah (`/mancala`)
- Engine: 6 covas + kalah por lado; semeadura anti-horária pulando o kalah
  adversário; jogada extra ao terminar no próprio kalah; captura da cova oposta
  ao terminar em cova própria vazia; fim quando um lado esvazia (resto ao dono).
- Modos: 2P local + "vs Manu" greedy (maior ganho imediato).
- E2E: partida com capturas e jogada extra, placar final correto por oráculo.

### PR E — Rota (`/rota`)
- Engine: roda de 8 posições + centro; 3 peças por jogador; fase de colocação →
  fase de movimento (adjacência ou centro); vitória = 3 em linha passando pelo
  centro ou arco de 3 vizinhas; sem remoção de peças; sem empate possível
  (movimento sempre existe — provar no unit test).
- Modos: 2P local + "vs Manu" (bloqueia se ameaça, senão aleatório).
- E2E: colocação, movimento, vitória nas duas geometrias.

## Protocolo POR PR (o mesmo das ondas 1-3)

1. Branch `feat/<jogo>`; implementar engine → unit → UI → E2E.
2. Gates: `bun run typecheck && bun run lint && bun run test && bun run test:e2e`
   — TODOS verdes localmente.
3. Verificação de intent JOGADA (Playwright script, dedo 80px): jogar de verdade
   nos 2 formatos, screenshots antes do PR em `artefatos/`.
4. PR com descrição honesta; review cross-model Codex (autor≠revisor, 1 rodada);
   findings: corrigir ou REFUTAR com evidência no PR. Iteração máx: 3 ciclos.
5. Squash merge → aguardar deploy Ready → **verificar produção JOGANDO** →
   comentar o PR com a verificação.
6. Gap sem solução em 3 ciclos → parar, reportar Esperado vs Atual + opções.

## Fase 2 — Fechamento

- `deitado.spec.ts`: adicionar os 5 jogos ao gate deitado (mesmos invariantes:
  tudo na tela, sem sobreposição).
- `pwa.spec.ts`: precache das 5 rotas novas; offline exercitado em ≥1 jogo novo.
- Relatório final `docs/reports/RELATORIO-onda-tabuleiro-<data>.md`: entregas,
  achados, gates, gaps declarados.
- Atualizar `docs/CREDITOS.md` (referências de regras consultadas, licenças).

## Regras de parada

- Memory-guard bloqueando spawns → executar inline (padrão das ondas 1-3).
- Rate limit do juiz/review Codex → avisar e seguir com o PR marcando
  "review pendente" — NUNCA merge sem review em PR de engine nova.
- Qualquer ação destrutiva ou fora deste escopo → PARAR e perguntar.
