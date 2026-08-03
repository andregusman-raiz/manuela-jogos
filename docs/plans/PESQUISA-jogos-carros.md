# Pesquisa — Jogos de CARROS open source (corridas e oficinas), 5-10 anos

> Investigação 2026-08-03 a pedido do dono. Protocolo das ondas anteriores:
> mecânica reimplementada como engine TS pura + arte própria (zero deps);
> GPL/AGPL = referência de regras/UX apenas; MIT = leitura próxima sem cópia;
> arte só CC0/CC-BY/DP e mesmo assim redesenhada.

## 1. Corridas — repos de referência (licenças verificadas)

| Repo | Licença | Stack | O que aproveitar |
|---|---|---|---|
| [jakesgordon/javascript-racer](https://github.com/jakesgordon/javascript-racer) | **MIT (código)** ✅ — 1.2k★ | JS+Canvas puro | **A referência canônica de pseudo-3D** (estilo OutRun): pista em segmentos, projeção por distância, curvas/ladeiras, sprites escalados, IA simples. ⚠ sprites (OutRun/Sega) e músicas NÃO são redistribuíveis — só o CÓDIGO é MIT; arte 100% própria |
| [Gaetz/js-Racing](https://github.com/Gaetz/js-Racing) | **MIT** ✅ | JS top-down (kata) | Modelo mínimo de top-down 2D |
| [conkonig/Box2DJS-Topdown-Car-Game](https://github.com/conkonig/Box2DJS-Topdown-Car-Game) | verificar | JS + Box2D | Referência de FÍSICA top-down (juntas/derrapagem) — física completa é overkill para 5-10; ler para saber o que CORTAR |
| [byte-odromo/phaser-racer](https://github.com/byte-odromo/phaser-racer) + [mandarinx/SlotCarRacer](https://github.com/mandarinx/SlotCarRacer) | verificar no build | Phaser | **Mecânica slot car (autorama)**: acelerar/soltar num trilho fixo, sair da pista se rápido demais na curva — controle de UM BOTÃO, perfeito para 5-7 anos |
| [SuperTuxKart](https://github.com/supertuxkart/stk-code) | GPLv3 ⚠ referência | C++ | Game design infantil: rampa de dificuldade, desbloqueio progressivo, IA com rubber-banding amigável |

### Análise de viabilidade (engine própria testável, padrão da casa)

- **Pseudo-3D (OutRun-like)**: pista = lista de segmentos {curva, ladeira}
  — estado puro (posição, velocidade, deslocamento lateral) atualizado por
  tick determinístico → unit tests com oráculos e E2E com semente (o LCG da
  casa). Canvas 2D, sem física real. Controle touch: 2 zonas (esq/dir) com
  aceleração AUTOMÁTICA — criança só faz o carro "ficar na pista".
- **Slot car (autorama)**: ainda mais simples — progresso 1D num trilho
  SVG, velocidade limite por trecho de curva; segurar = acelera, soltar =
  freia; passar do limite na curva = rodada (voltinha e continua, nunca
  punitivo). UM dedo. Ideal como nível/modo dos 5-6 anos, ou 2 jogadores
  no MESMO aparelho (metades da tela, padrão Damas/Ludo).
- Corrida top-down com volante livre: DESCARTAR na v1 (direção contínua é
  difícil no touch para os pequenos; física derrapante frustra).

## 2. Oficina/garagem — o deserto honesto e o mapa das mecânicas

Open source do gênero infantil praticamente **não existe**. Achados:
- [victenna/Car-Assembly-with-Pygame](https://victenna.itch.io/car-assembly-with-pygame)
  (Pygame): **montar peças por silhueta com drag** — exatamente a mecânica
  do nosso Tangram.
- [tetreum/carmechanic](https://github.com/tetreum/carmechanic) (Unity):
  desmontagem/montagem adulta — referência distante.
- O padrão do gênero vem dos apps comerciais (Toca Boca-like): **lavar**
  (arrastar esponja até limpar), **trocar pneu** (drag+snap), **pintar**
  (balde/região), **montar** (peças por silhueta), **diagnosticar** (achar
  o item quebrado). Regras não têm copyright; arte/UX deles NÃO se copia.

### O que a casa JÁ sabe fazer (mecânica → precedente interno)

| Atividade da oficina | Precedente no repo | Oráculo de teste |
|---|---|---|
| Montar peças (porta, roda, farol) por silhueta | **Tangram** (drag SVG + snap por pose) | pose final por peça |
| Pintar o carro | **Ateliê/colorir** (fill por região SVG) | região → cor |
| Lavar (esponja revela limpo) | traço do Ateliê (ops de pincel) | % de área varrida |
| Trocar pneu / apertar parafuso | drag+snap + toques contados | estado por parafuso |
| Diagnóstico ("o que está quebrado?") | **Caça-Números** (achar itens certos) | conjunto certo/errado |

## 3. Arte — fontes CC0 verificadas (referência de redesenho)

[Kenney.nl](https://kenney.nl) (tudo **CC0** ✅): **Racing Pack** (420
assets top-down, pistas e carros), **Toy Car Kit** (100 assets, carros de
brinquedo — o tom certo para 5-10), Pixel Vehicle Pack, Car Kit. CC0
permite até uso direto, mas o padrão da casa é redesenhar em SVG próprio
na paleta manu-* usando estes como referência de proporção/leitura.

## 4. Recomendação — "Onda Carros" (2 jogos, 2 PRs)

1. **Corrida da Manu** (`/corrida`) — pseudo-3D referência MIT
   (jakesgordon), engine própria em segmentos: nível 1 = pista aberta sem
   oponentes, 3 estrelas por tempo (5-7 anos, aceleração automática, 2
   zonas de toque); nível 2 = 3 oponentes com rubber-banding leve +
   curvas/ladeiras. Determinístico por semente (`?semente=`, padrão da
   casa) → E2E espelhando o motor tick a tick. Arte própria (carros SVG
   cartoon, referência Toy Car Kit).
2. **Oficina da Manu** (`/oficina`) — rotação de 4 atividades num carro
   SVG grande: diagnosticar → trocar/montar (drag+snap) → lavar →
   pintar → carro sai buzinando feliz. Cada atividade com oráculo próprio;
   zero pressão de tempo (gênero é brincadeira livre, não desafio).

**Alternativa dos 5-6 anos** (se quiser um 3º menor): **Autorama**
(`/autorama`) — slot car de 1 botão, 2 jogadores no mesmo aparelho.

Riscos/decisões a fechar na SPEC: densidade do hub (21-22 cards — o
orçamento de 5 colunas aguenta 25 com a régua atual); Canvas do pseudo-3D
convive com E2E determinístico via espelho de estado (`data-*` do HUD, não
pixels); nome "OutRun" jamais aparece (marca Sega — o estilo não é marca).

## Fontes

[javascript-racer](https://github.com/jakesgordon/javascript-racer) · [js-Racing](https://github.com/Gaetz/js-Racing) · [Box2DJS-Topdown](https://github.com/conkonig/Box2DJS-Topdown-Car-Game) · [phaser-racer](https://github.com/byte-odromo/phaser-racer) · [SlotCarRacer](https://github.com/mandarinx/SlotCarRacer) · [SuperTuxKart](https://github.com/supertuxkart/stk-code) e [licenciamento](https://supertuxkart.net/Licensing) · [Car-Assembly-with-Pygame](https://victenna.itch.io/car-assembly-with-pygame) · [carmechanic](https://github.com/tetreum/carmechanic) · [Kenney Racing Pack](https://kenney.nl/assets/racing-pack) · [Kenney Toy Car Kit](https://kenney.nl/assets/toy-car-kit)
