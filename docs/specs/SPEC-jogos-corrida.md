# SPEC — Onda Carros: Autorama e Corrida da Manu

> v1.1 (2026-08-03) — pós-juiz Codex (1 rodada, REVISE, 10 blockers; registro no §7).
> Pesquisa: `docs/plans/PESQUISA-jogos-carros.md`.
> Protocolo da casa: engine TS pura + arte própria (zero deps); referência
> MIT (jakesgordon/javascript-racer) LIDA e nunca copiada; nada de marca
> ("OutRun" não aparece); determinismo por `?semente=` (lib/dado LCG).

## 0. Infra da onda

- `lib/bd.ts`: **BD v7** — `LOJAS_JOGOS` += `autorama`, `corrida` (upgrade
  aditivo; dono único já garante qualquer ordem).
- **Testes existentes que a SPEC AUTORIZA atualizar** (juiz B9):
  - `contas.spec.ts` upgrade: v3→v7 (+2 lojas na lista integral);
  - **novo** teste v6→v7 com sentinelas em `perfis` E `progresso:<id>`
    preservadas (banco v3 não prova os dados do v6);
  - `perfil-memoria.spec.ts` `ESPERADAS = 20` → **22** (ateliê + 20 jogos + perfis);
  - comentários "18 jogos" → "20 jogos" onde tocados.
- Cards no PR do próprio jogo:

| PR | rota | nome | emoji | cor |
|---|---|---|---|---|
| A | `/autorama` | Autorama | 🏎️ | `bg-manu-sol/50` |
| B | `/corrida` | Corrida ${daMascote()} | 🛣️ | `bg-manu-ceu/60` |

- Hub: 21 cards (19+2); gates de dobra/deitado iteram o catálogo dinâmico —
  a 5ª linha precisa passar o fold-gate real.
- SW: bump por PR + rota na CASCA. Identidade via helpers (gate AST vigia).
  Sons pontuais da lib/som: spin-out=erro, volta=acerto, vitória=vitoria,
  largada=passo. Sem loop de motor (v1).

### 0.1 Loop de tempo real (contrato comum aos dois jogos — juiz B1)

Primeiro tempo real da casa. Motor continua `tick(estado, entrada)` PURO com
dt fixo; quem fecha o loop é um controlador com **fixed timestep + acumulador**:

- `STEP = 1000/60 ms`; acumulador alimentado pelo timestamp do rAF
  (`delta = agora - anterior`), com `MAX_FRAME_DELTA = 250 ms` (delta acima
  é truncado);
- por frame: `while (acumulador >= STEP && passos < MAX_STEPS_PER_FRAME=5)`
  → tick; excedente após o teto é DESCARTADO preservando `acumulador % STEP`
  (nunca rajada de recuperação que congela a UI);
- timestamp/acumulador RESETAM no mount e em toda retomada de pausa;
- **zero ticks** fora de `situacao === "correndo"` (contagem, pausa, fim);
- simular N vezes, **renderizar 1 vez por frame**. Em 120 Hz (ProMotion) o
  jogo NÃO acelera: ~metade dos frames executa 0 ou 1 tick.
- Melhoria opcional de build: interpolar render entre estado anterior/atual.

### 0.2 Render e HUD (contrato comum — juiz B7)

- Estado do jogo vive em `useRef` — **nenhum `setState` no caminho do tick**;
  React só para telas/overlays (seleção de modo, contagem, pausa, fim).
- Canvas (Corrida) e SVG dos carros (Autorama) pintados imperativamente
  1×/frame; Canvas com `dpr = min(devicePixelRatio, 2)`.
- `data-*` do HUD publicados a **10 Hz** (a cada 6 ticks) E em toda transição
  de `situacao` (o valor congelado da pausa fica visível ao E2E).
- `data-ticks` sempre presente (relógio do motor exposto — juiz B2).

### 0.3 Pausa (contrato comum — juiz B8)

- **Botão ⏸ visível nos dois jogos** (testável nos 2 engines) + auto-pausa
  quando `document.hidden`/`blur`/`pagehide` (criança troca de app).
- `tempoTicks`/`ticks` só crescem em `correndo` — contagem 3-2-1 (largada e
  retorno) e pausa NÃO contam para as estrelas.
- Ao pausar: limpar TODOS os inputs (sets de pointer), cancelar rAF, zerar
  acumulador. Ao voltar: novo 3-2-1 + timestamp resetado. `fim` não retoma.
- Testes: botão ⏸ nos 2 engines (data-ticks congela); auto-pausa por
  visibilidade = Chromium-only (CDP/lifecycle) — `dispatchEvent` de
  `visibilitychange` NÃO muda `document.hidden`, não serve de prova;
  WebKit real fica no aceite manual de produção.

## 1. Autorama (`/autorama`) — PR A

### 1.1 Modelo e números (motor puro)

```ts
interface TrechoTrilho { comprimento: number; limite: number | null }
interface CarroAutorama { progresso: number; velocidade: number; rodando: number; voltas: number }
interface EstadoAutorama {
  pista: TrechoTrilho[]; carros: CarroAutorama[];  // sempre 2
  situacao: "contagem" | "correndo" | "pausa" | "fim";
  vencedor: number | null;   // -1 = empate
  ticks: number;
}
tick(estado, pressionados: boolean[]): EstadoAutorama   // dt = 1/60
```

Constantes (u = unidade de trilho): `VMAX = 120 u/s`, `ACELERACAO = 60 u/s²`,
`FREIO = 90 u/s²`, `SPIN_TICKS = 60`, `VOLTAS = 3`.

Pistas FIXAS:
- Nível 1 (oval, 2000 u): reta 700 (null) · curva 300 (55) · reta 700 (null)
  · curva 300 (55).
- Nível 2 (chicane, 2400 u): reta 500 · curva 250 (55) · reta 150 ·
  curva 200 (40) · curva 200 (40) · reta 500 · curva 300 (55) · reta 300.

**Ordem normativa do tick** (juiz B3):
1. atualizar velocidade pela entrada (`v ± taxa*dt`, clamp `[0, VMAX]`);
2. verificar o trecho ATUAL: `v > limite` (comparação estrita, sem EPS) → spin;
3. calcular deslocamento `v*dt`;
4. verificar TODO trecho limitado cruzado pelo deslocamento: `v > limite`
   → spin NA ENTRADA desse trecho (progresso = início do trecho);
5. spin: `v = 0`, `rodando = SPIN_TICKS`; carro em spin não anda nem acelera.

Ou seja: entrar a 54 (limite 55) e acelerar DENTRO da curva até 56 → roda
(caso de teste obrigatório). Nunca sai do trilho nem perde volta.

Fim: primeiro carro a cruzar com `voltas === 3` vence; **os dois no MESMO
tick → `vencedor = -1`, tela "Empate! Os dois ganharam!"** (juiz B10).
Vencer a Manu no nível 1 libera o 2 (`salvarProgresso`).

### 1.2 IA da Manu (cinemática, não chute — juiz B4)

- Distância de frenagem: `dFreio(v, limite) = max(0, (v² - limite²) / (2*FREIO))`.
- A IA solta o botão a `dFreio + MARGEM + err` unidades da próxima entrada de
  trecho limitado; segura em todo o resto.
- `MARGEM`: nível 1 = 30 u; nível 2 = 46 u (adendo v1.2: era 45; +1 empurra a
  borda de discretização — sementes com efetivo 0 entravam no limite exato e o
  lado dependia do tick, estourando a faixa do oráculo para 11/50).
- **Teto de velocidade da IA (adendo v1.2)**: nível 1 = 0.75·VMAX, nível 2 =
  0.92·VMAX. Sem teto a IA era IMBATÍVEL — provado por simulação (telemetria:
  com 6 spins em 3 voltas ela ainda fazia 26.6 s/volta contra 29+ do melhor
  piloto realista): criança nunca desbloquearia o nível 2. A criança recupera
  nas retas (segura reto a VMAX; a IA cruza a 90/110).
- `err` inteiro sorteado POR TRECHO LIMITADO na largada (LCG da semente, com
  burn-in de 3 sorteios — os primeiros outputs do Park-Miller com semente
  pequena são ~0 e o err colaria no piso): nível 1 ∈ [−60, +20]; nível 2 ∈
  [−48, +12]. `err` efetivo < −MARGEM = solta tarde → roda naquela curva.
- Oráculos por MATRIZ de sementes 1..50 (faixas, não pontos): nível 1 — IA
  roda em **30%–90%** das corridas; nível 2 — **0%–20%**. Com `err = 0`
  forçado a IA NUNCA roda (agora garantido pela cinemática); com
  `err = −(MARGEM+dFreio+1)` forçado SEMPRE roda.
- Rubber-band (só a favor da criança): `distanciaTotal = voltas*C + progresso`;
  se a IA lidera por `> C/2` → `MARGEM *= 1.3` E teto da IA ×0.8 enquanto
  durar (espera de verdade). Criança liderando → IA normal.

### 1.3 UI e entrada

- Trilho top-down SVG; geometria progresso→ponto é do MOTOR (polyline por
  trecho), não `getPointAtLength`. Carros SVG próprios (referência Toy Car
  Kit CC0, redesenho), rotação pela tangente; spin = giro animado por classe.
- **vs-Manu**: botão único inferior. **2P**: tela dividida em 2 botões
  gigantes (cores dos jogadores).
- Entrada por **conjunto de `pointerId`** por botão: pressionado = set
  não-vazio; remove em `pointerup`, `pointercancel`, `pointerleave`,
  `lostpointercapture` e na pausa (dedo escorregou = soltou; juiz B5).
- HUD 10 Hz: `data-progresso-0/1`, `data-trecho-0/1`, `data-voltas-0/1`,
  `data-rodando-0/1`, `data-situacao`, `data-vencedor`, `data-semente`,
  `data-ticks`.

### 1.4 Testes (contrato honesto — juiz B2/B5)

- **Unit (oráculos exatos — a equivalência tick-a-tick vive AQUI)**: física
  acelera/freia/clamp; spin na entrada acima do limite e NÃO no limite
  exato; o caso 54→56 dentro da curva; cruzamento de MÚLTIPLOS trechos num
  tick; wrap + 3 voltas; empate no mesmo tick; IA: `err=0` nunca roda /
  atraso forçado sempre roda / matriz 1..50 nas faixas do §1.2; rubber-band
  liga/desliga por `distanciaTotal` (meia volta = `C/2`, nunca diferença
  bruta pós-wrap); `pressionados=[true,true]` move os dois; fuzz 200
  corridas vs-Manu com entradas seeded terminam ≤ 7200 ticks com invariantes
  (0 ≤ v ≤ VMAX, progresso monotônico módulo wrap).
- **E2E** (semente fixa; SEM promessa de tick exato — polling real não
  distingue tick 1 de 59): heurística de piloto lendo `data-progresso-0` a
  10 Hz com a tabela de trechos da SPEC hard-coded (solta `dFreio+folga≥25u`
  antes da curva); semente do teste escolhida (e provada por UNIT com a
  mesma semente) em que a Manu roda na volta 1 → `data-rodando-1` aparece;
  vitória → confete + nível 2 persistido; segurar o botão SEM soltar →
  spin próprio na 1ª curva (`data-rodando-0`); botão ⏸ congela `data-ticks`
  nos 2 engines. **2P**: nos 2 engines, toques ALTERNADOS movem cada carro +
  teste lógico com `PointerEvent`s de `pointerId` distintos simultâneos;
  multi-touch físico (CDP `Input.dispatchTouchEvent`) SÓ no projeto android,
  documentado; iPhone real = aceite manual. Corrida completa 1× por engine
  com `test.setTimeout(180_000)`; os 3 formatos testam LAYOUT (largada
  visível), não corridas inteiras.

## 2. Corrida da Manu (`/corrida`) — PR B

### 2.1 Motor pseudo-3D e números

```ts
interface SegmentoPista { curva: number /* -1..1 */; elevacao: number /* SÓ visual */ }
interface EstadoCorrida {
  posicao: number; lateral: number; velocidade: number; tempoTicks: number;
  oponentes: { posicao: number; lateral: number; velocidade: number }[];
  situacao: "contagem" | "correndo" | "pausa" | "fim";
}
tick(estado, direcao: -1 | 0 | 1): EstadoCorrida   // dt = 1/60
```

- **Elevação é PURAMENTE visual** (colinas desenham, não afetam física —
  decisão que simplifica o motor para 1 dimensão lateral).
- Constantes: segmento = 200 u; pista nível 1 = 300 segmentos (60 000 u),
  composição FIXA por blocos declarada em `lib/corrida.ts` (reta/curva ±0.5
  /colinas); `VMAX = 1200 u/s`; `ACELERACAO = 300 u/s²` (automática);
  grama (|lateral| > 1): desacelera 800 u/s² até `VGRAMA = 350 u/s`, segue
  andando, NUNCA para; `lateral` clamp `[-2.5, 2.5]` (juiz-melhoria).
- Curva empurra: `lateral += curva * (v/VMAX) * 1.6 * dt`; criança compensa:
  `lateral -= direcao * 1.2 * dt` (zonas de toque esq/dir, pointer sets §1.3).
- **Contrato de produto** (juiz B6): sem toque NENHUM o carro visita a grama
  nas curvas mas SEMPRE termina — unit prova `direcao=0` do início ao fim
  termina em ≤ **10 500 ticks (175 s)**. Dirigir bem reduz o tempo e vale
  estrelas.
- **Estrelas nível 1**: terminar = 1★ (sempre); ≤ 95 s = 2★; ≤ 70 s = 3★
  (fundo teórico = 50 s). `melhor` = menor tempo (semântica min existente).
- **Nível 2** (libera ao terminar o 1): mesma pista + 3 oponentes; largam a
  +1500/+3000/+4500 u; velocidade-base por semente ∈ [0.80, 0.92]·VMAX;
  rubber-band: jogador atrás do ÚLTIMO → todos ×0.95; à frente do primeiro
  por > 3000 u → ×1.05 (sobre a base, por tick). Estrelas nível 2: terminar
  = 1★; terminar em 1º = 2★; em 1º e ≤ 70 s = 3★ — **clamp 3, sem 4ª**
  (juiz B10).
- **Colisão** (bug do juiz corrigido): oponente À FRENTE com
  `0 < (op.posicao - jogador.posicao) ≤ 80` E `|Δlateral| < 0.3` → a
  velocidade do jogador fica ≤ à do oponente naquele tick (empurrão zero,
  dano zero). Ordem de atualização: jogador primeiro, oponentes por índice.
- Render Canvas 2D (projeção `escala = CAM/(CAM+z)`), cores da casa (grama
  manu-grama, zebras rosa/branco, céu manu-ceu); carros SVG próprios
  rasterizados 1× no load; `prefers-reduced-motion` → sem paralaxe de fundo.
- HUD 10 Hz: `data-velocidade`, `data-lateral` (2 casas), `data-posicao`,
  `data-tempo` (s, 1 casa), `data-estrelas`, `data-situacao`,
  `data-semente`, `data-ticks`.

### 2.2 Testes

- **Unit**: aceleração até clamp; curva empurra proporcional; grama
  desacelera a VGRAMA e recupera; clamp de lateral; estrelas nas faixas
  EXATAS (69.9→3★, 70.1→2★, 95.1→1★); colisão só com oponente à frente
  (oponente ATRÁS a −900 u NÃO limita — regressão do bug do juiz);
  rubber-band dois sentidos; oponentes determinísticos por semente (mesmo
  roteiro 2× = mesmo estado); `direcao=0` termina ≤ 10 500 ticks; o
  **controlador de teste** `direcaoTeste(lateral) = |lateral| ≤ 0.25 ? 0 :
  -sinal(lateral)` completa a pista nível 1 em ≤ 70 s (3★) — mesmo
  controlador usado no E2E; fuzz 100 corridas com direção aleatória seeded
  mantêm invariantes (lateral ∈ clamp, v ∈ [0, VMAX], posição monotônica).
- **E2E**: dirige com `direcaoTeste` lendo `data-lateral` a 10 Hz — com o
  atraso real do polling o carro pode pisar na grama, então o aceite é
  honesto: TERMINA com `data-estrelas ≥ 1` e `data-tempo ≤ 95 s`
  (`test.setTimeout(180_000)`; corrida completa 1× por engine); toque
  contínuo num lado só → grama → `data-velocidade` cai ≤ 350; botão ⏸
  congela `data-ticks`; persistência de `melhor` e desbloqueio do nível 2;
  3 formatos = layout da largada, não corridas inteiras.

## 3. Aceite da onda

1. Gates completos verdes na main após cada merge (unit ~+45, E2E ~+14).
2. Hub 21 cards nos gates de dobra/deitado; upgrades v3→v7 E v6→v7 verdes.
3. Produção verificada JOGANDO os dois (spin-out no Autorama; grama e
   estrelas na Corrida), 2 formatos + auto-pausa real trocando de aba,
   screenshots em `~/Claude/artefatos/screenshots/manuela-jogos/`.
4. Identidade: títulos flexionam (Corrida da Manu / do Leo); gate AST verde.
5. Relatório da onda em `docs/reports/`.

Calibráveis no BUILD sem re-spec (visual apenas): câmera/horizonte/paralaxe,
desenho do trilho, decoração, cores de carro. Física, IA, estrelas, faixas
de oráculo, timeouts e tetos de loop/render são NORMATIVOS desta SPEC.

## 4. Escopo negativo

Sem física realista (Box2D-like), sem drift, sem dano/crash, sem loop de som
de motor, sem pista procedural, sem multiplayer online, sem acelerômetro,
sem marca de terceiros (nomes, sprites, música — arte 100% própria), sem
modo paisagem obrigatório, sem promessa de equivalência tick-a-tick no E2E
(ela vive nos units), sem elevação com efeito físico.

## 5. Entrega

PR A (Autorama + BD v7 + autorizações §0) → review cross-model → merge →
produção; PR B (Corrida) idem.

## 7. Registro do julgamento (Codex, 1 rodada — VEREDITO: REVISE → v1.1)

| # | Blocker | Resolução na v1.1 |
|---|---|---|
| B1 | Loop sem contrato (120 Hz = 2× rápido; aba lenta congela) | §0.1: acumulador, MAX_FRAME_DELTA 250 ms, MAX_STEPS 5, descarte, resets |
| B2 | E2E "tick conhecido via data-progresso" impossível | Equivalência exata → UNIT; E2E vira heurística+invariantes; `data-ticks` |
| B3 | Spin-out: entrada × dentro do trecho contraditório | §1.1 ordem normativa 1-5; caso 54→56 obrigatório; comparação estrita |
| B4 | IA por chute não garante oráculos | §1.2 cinemática v²/2a + margens/err numéricos + matriz de sementes em FAIXAS |
| B5 | Multi-touch simultâneo não existe nos 2 engines | §1.4: alternado+PointerEvent lógico nos 2; CDP só android; manual iPhone; pointer sets |
| B6 | "Autopiloto" × "termina sem toque" contraditório | §2.1 contrato: sem toque termina ≤175 s (1★); controlador compartilhado unit(3★)/E2E(≥1★); timeout 180 s |
| B7 | setState por tick / render 60 Hz caro | §0.2: estado em ref, render 1×/frame, HUD 10 Hz, dpr ≤ 2 |
| B8 | dispatchEvent(visibilitychange) não muda document.hidden | §0.3: botão ⏸ cross-engine; visibilidade Chromium-only; tempo só em correndo |
| B9 | perfil-memoria fixa 20 lojas; v3 não prova dados v6 | §0: autorizações explícitas + teste v6→v7 com sentinelas |
| B10 | Números abertos; colisão sem abs; empate; 4ª estrela | Constantes fechadas §§1-2; colisão só à frente 0<Δ≤80; empate=-1; clamp 3★ |

### Adendos v1.2 (descobertos no BUILD do PR A, registrados antes do merge)

1. **Teto de velocidade da IA por nível** (§1.2): sem ele a IA era imbatível
   mesmo errando muito — derrotabilidade é requisito de produto num jogo
   infantil; o E2E que perdeu nos 2 engines foi o detector.
2. **MARGEM nível 2 = 46** (borda de discretização do oráculo da matriz).
3. **Burn-in de 3 no LCG da IA** (viés do Park-Miller com sementes 1..50 — o
   primeiro output é ~16807·s/2³¹ ≈ 0 e o err colava no piso: 100% de spin).
4. Semente canônica dos testes: **81** (err −48 nas DUAS curvas — a mascote
   roda nas duas mesmo com rubber-band ativo).
