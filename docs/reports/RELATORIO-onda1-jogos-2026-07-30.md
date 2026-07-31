# Relatório final — Onda 1 de Jogos Educativos (2026-07-30)

> Execução completa de `docs/plans/PROMPT-EXECUCAO-jogos-onda1.md` sobre a SPEC
> `docs/specs/SPEC-jogos-educativos-onda1.md` (v1.1, revisada por juiz adversarial).
> Resultado: **4 jogos novos em produção** em https://manuela-jogos.vercel.app.

## Entregas

| PR | Jogo | Rota | Ensina | Review cross-model |
|----|------|------|--------|--------------------|
| [#13](https://github.com/andregusman-raiz/manuela-jogos/pull/13) | Foguete das Contas + infra da onda | `/contas` | Aritmética (soma → tabuada, 5 níveis) | REQUEST CHANGES → 2 blockers corrigidos, 1 refutado |
| [#14](https://github.com/andregusman-raiz/manuela-jogos/pull/14) | Jogo da Memória | `/memoria` | Memória + pares conta↔resultado | REQUEST CHANGES → 4 minors corrigidos, 1 major refutado |
| [#15](https://github.com/andregusman-raiz/manuela-jogos/pull/15) | Labirinto da Manu | `/labirinto` | Lógica/sequenciamento (giro relativo) | REQUEST CHANGES → 4 corrigidos |
| [#16](https://github.com/andregusman-raiz/manuela-jogos/pull/16) | Palavra Mágica | `/palavras` | Alfabetização (letra/sílaba faltante) | REQUEST CHANGES → 2 blockers corrigidos, 1 refutado |

Infra transversal (PR A): IndexedDB v1→v2 aditivo com gaveta por jogo, política
de duas abas (fallback sem upgrade — o Ateliê nunca perde gravação), progresso
monotônico em transação única; 4 sons WebAudio novos + fix do primeiro som
pós-suspend; `Confete` com `data-ativo`; helper E2E de toque com dedo real;
SW v3→v6 (uma versão por rota nova precacheada).

## Auditoria Definition of Done (SPEC §6.4)

- [x] **4 jogos no hub, jogáveis do card ao confete** em celular 390px, tablet
  820px e desktop 1440px — E2E de 3 formatos por jogo + fluxo feliz completo;
  cada jogo também foi **jogado de verdade** (localhost e produção) com
  screenshots em `~/Claude/artefatos/screenshots/manuela-jogos/onda1-contas/`.
- [x] **Todo texto PT-BR** — grep por strings EN visíveis: vazio.
- [x] **Zero dependência nova** — `grep -riE "blockly|phaser|howler" package.json`
  → vazio; `dependencies` continua só next/react/react-dom.
- [x] **Nenhum código/asset de terceiros** — mecânicas reimplementadas do zero
  (TuxMath, GCompris memory, Blockly Maze e missing-letter como referência
  pedagógica apenas; nada de AGPL/GPL no repo).
- [x] **Galeria intacta no upgrade v1→v2** — teste E2E de migração com registro
  sentinela + smoke em produção com o Ateliê abrindo normal.
- [ ] **Duas abas simultâneas (teste manual guiado)** — PENDENTE DE MÃO HUMANA:
  coberto por unidade (gravação monotônica em transação única) e pela política
  de `onblocked` com fallback, mas o roteiro manual com duas abas reais não foi
  executado. Ver "Gaps" abaixo.

## Gates finais (main)

`bun run typecheck` ✅ · `bun run lint` ✅ · `bun run test` **75/75** ✅ ·
`bun run test:e2e` **75 passed / 1 skipped** ✅ (skip = offline no driver
WebKit, limitação documentada; offline provado no project android).

## Verificação em produção (por merge, não só no final)

Cada PR teve o deploy de `main` verificado JOGANDO em produção via Playwright
(390×844): hub → jogo → fase/acertos → zero `pageerror`. SW confirmado em
`manu-app-v6`; hub final com 5 jogos e sem card "Em breve".

## Decisões de processo registradas

1. **Gate de dono do PR A**: o prompt previa parada obrigatória após o PR A em
   produção. A parada foi bloqueada duas vezes pelo Stop hook do `/goal`
   (diretiva explícita do dono de completar o prompt) e o dono confirmou em
   seguida com "continue proximos" — os PRs B/C/D seguiram sem novo checkpoint,
   como o prompt previa.
2. **Reviews**: com o guard de memória bloqueando subagents locais (90+
   processos Node de outras sessões), o papel de revisor autor≠revisor foi
   exercido pelo Codex via MCP (read-only). Rendeu 4 REQUEST CHANGES com
   findings reais (2 deles blockers de perda de dados); 3 findings foram
   refutados com evidência e registrados nos PRs.
3. **Refutações mantidas**: par certo na Memória não trava o tabuleiro (SPEC
   "dois iguais somem"); controles de header a 56px seguem o padrão do Ateliê
   (SPEC §3.5); `newContext` herda `baseURL` no `@playwright/test` (provado em
   runtime).

## Gaps e follow-ups (Esperado vs Atual)

| # | Esperado | Atual | Opções |
|---|----------|-------|--------|
| 1 | Teste manual de duas abas (DoD §6.4 último item) | Coberto só por unidade/política | (a) André roda o roteiro (abrir 2 abas, jogar nas duas, conferir progresso); (b) aceitar cobertura automatizada como suficiente; (c) E2E multi-page em PR futuro |
| 2 | Offline validado no aparelho da Manuela (WebKit real) | Provado só no Chromium (driver WebKit não suporta setOffline+SW) | (a) validação manual no iPhone; (b) aceitar como está |
| 3 | Sons/UX calibrados com a usuária final | Sintetizados, não testados com criança | Sessão de uso real com a Manuela e ajuste fino depois |

## Estado do repo

`main @ d856d62` — 4 squash merges (#13-#16), branches deletadas, working tree
limpo. Nenhuma mudança fora do escopo da SPEC; Ateliê intocado exceto as
exceções nomeadas (§7 da SPEC).
