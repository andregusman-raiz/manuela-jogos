# Relatório — Onda Carros (Autorama + Corrida da Manu)

> 2026-08-03. SPEC: `docs/specs/SPEC-jogos-corrida.md` (v1.1 + adendos v1.2).
> Pesquisa: `docs/plans/PESQUISA-jogos-carros.md`. Hub: **21 jogos**.

## Entregas

| PR | Jogo | O que é |
|---|---|---|
| #55 | — | SPEC julgada pelo Codex (10 blockers na v1.0 → v1.1) |
| #56 | **Autorama** (`/autorama`) | Slot car 1 botão: spin-out não punitivo, vs mascote (IA cinemática por semente + rubber-band) e 2 jogadores no mesmo aparelho; nível 2 chicane desbloqueável |
| #57 | **Corrida da Manu** (`/corrida`) | Estrada pseudo-3D em segmentos: aceleração automática, 2 zonas de toque, grama desacelera e NUNCA para, estrelas por tempo; nível 2 com 3 oponentes-fantasma e rubber-band |

Primeiro TEMPO REAL da casa — infra nova reutilizável: `lib/tempo-real.ts`
(fixed timestep + acumulador, teto de passos, delta truncado), contrato de
render fora do React (estado em ref, pintura 1×/quadro, HUD `data-*` 10 Hz),
pausa por botão + auto (`visibilitychange`/blur/pagehide) com relargada 3-2-1.
BD v7 (+2 lojas), SW v25, identidade flexionada (Corrida da Manu / do Leo).

## Verificação adversarial (autor ≠ revisor, Codex em todas as fases)

- **Juiz da SPEC**: 10 blockers (loop 120 Hz, E2E tick-exato impossível,
  multi-touch inexistente no Playwright, contradição do autopiloto…).
- **Review PR #56**: 5 blockers confirmados (rAF imortal no fim, largada em
  segundo plano no blur, captura implícita do touch no iOS, HUD sem publicar
  transições, E2E 2P sem exclusividade).
- **Review PR #57**: 3 blockers confirmados (colisão atravessável tick a
  tick, estrada com vão pulsante no rodapé, oponente encostado desenhado a
  400 u).

## Bugs de PRODUTO pegos por teste antes de qualquer criança ver

1. **IA imbatível** (E2E perdeu nos 2 engines → telemetria em unit de 8 ms):
   a VMAX pleno ela fazia 26,6 s/volta MESMO rodando 6×. Fix: teto de
   velocidade por nível (0,75/0,92·VMAX) — adendo registrado na SPEC.
2. **Race condition de largada** (WebKit): o toque vencia o IDB e a partida
   nascia com semente 0 (IA trocada). Fix: semente em ref síncrona.
3. **Deadlock da IA**: freando com velocidade já segura, estacionava antes
   da curva para sempre.
4. **Viés do Park-Miller**: 1º output com semente pequena ≈ 0 → err da IA
   colava no piso (100% spin). Fix: burn-in de 3.
5. **21º card estourou a dobra** em 1440×900 → hub a 6 colunas em `lg`.

## Números finais

- **338 units** (oráculos exatos, matriz de 50 sementes em faixas, fuzz
  200+100 corridas, teoremas: sem toque sempre termina ≤175 s; controlador
  compartilhado tira 3★; piloto com latência de 200 ms vence a semente 81).
- **297 E2E** verdes na suíte completa (corridas COMPLETAS dirigidas e
  vencidas/terminadas por engine; flakes iphone da classe SW conhecida
  passam isolados). 2 skips por design (CDP multi-touch é android-only).
- Produção verificada JOGANDO os dois; screenshots `autorama-*`/`corrida-*`
  em `~/Claude/artefatos/screenshots/manuela-jogos/`.

## Lições operacionais

- `reuseExistingServer: true` + servidor manual esquecido na 3006 = suíte
  testando build VELHO em silêncio (3 rodadas "bimodais" até o diagnóstico).
  Nunca deixar `bun run start` vivo antes de E2E.
- Equivalência tick-a-tick pertence aos UNITS; E2E de tempo real dirige por
  heurística com dead-reckoning e assere invariantes + desfecho.
- O hub tem DUAS grades (a real e a do modal de config) — o fold-gate mede
  a real; conferir o `aria-label` antes de "consertar" layout.

## Fora do escopo (registrado)

Oficina da Manu (pesquisada, sem SPEC), loop de som de motor, elevação com
efeito físico, multiplayer online, aceite manual em iPhone físico
(multi-touch real do 2P + auto-pausa WebKit) fica para a sessão com a dona.
