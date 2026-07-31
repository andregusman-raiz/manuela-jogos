# Pesquisa — candidatos open source para a Onda 2 (2026-07-30)

> Investigação sobre os catálogos GCompris (GPL/AGPL — referência pedagógica,
> nunca código), Sugarizer (Apache-2.0 — código pode ser consultado) e busca
> direta no GitHub. Critérios: valor pedagógico 6-10, lacuna curricular vs os
> 5 jogos atuais, custo de reimplementação zero-dep e reuso da infra da onda 1.

## Lacunas curriculares hoje

Coberto: arte (Ateliê), aritmética (Contas), memória (Memória), lógica/
pré-programação (Labirinto), alfabetização (Palavra Mágica).
Descoberto: **horas no relógio, dinheiro/troco, frações, ciências/natureza,
geografia, memória auditiva, estratégia, digitação**.

## Recomendação — Onda 2 (4 jogos, mesmo formato de PRs A-D)

| # | Jogo | Referência open source | Por quê | Custo |
|---|------|------------------------|---------|-------|
| 1 | **Forca da Manu** (forca amigável: balão murchando, sem enforcado) | GCompris `hangman` | **Reusa o banco de 61 palavras + sílabas da Palavra Mágica** — o candidato mais barato de toda a lista; consolida alfabetização | Mínimo |
| 2 | **Relógio Mágico** (ler horas analógico/digital, níveis hora cheia → minutos) | GCompris `clockgame` · Sugarizer `Clock.activity` (Apache) | Curricular forte do 2º-4º ano; relógio é um SVG próprio simples; motor puro trivial (ângulos↔hora) | Baixo |
| 3 | **Lojinha da Manu** (pagar e dar troco em R$) | GCompris `money`/`money_back` | Matemática APLICADA (a ponte que falta depois do Foguete); notas/moedas BRL como SVG próprio; emojis como produtos | Baixo-médio |
| 4 | **Genius dos Sons** (sequência de cores+sons para repetir — Simon) | Mecânica clássica (domínio público) | Memória auditiva — única modalidade sonora; **reusa o motor WebAudio existente**; zero assets | Mínimo |

## Fila de reserva (onda 3+)

- **Pizza das Frações** (GCompris `fractions_create/find`, Sugarizer `FractionBounce`) — 8-10 anos; SVG de pizza por fatia (mesma técnica do colorir por região).
- **Estados do Brasil** (GCompris `geo-country` como modelo) — mapa SVG do IBGE/Wikimedia (domínio público/CC-BY, conferir arquivo escolhido); clicar no estado pedido.
- **Tangram** (GCompris `baby_tangram`) — formas SVG próprias; arrasto já dominado pelo motor do Ateliê.
- **Damas** (GCompris `checkers`, 2 jogadores no mesmo aparelho) — estratégia sem o problema de assets do xadrez (peças de xadrez boas são CC-BY-SA cburnett, exigiria atribuição).
- **Caça-Números** (GCompris `gnumch-*`: múltiplos, fatores, comparações) — evolução natural do Foguete para 9-10 anos.
- **Digitação** ([steveruizok/kdtype](https://github.com/steveruizok/kdtype), MIT, 83⭐, ativo 05/2026) — único repo third-party que valeria adaptação direta (MIT); só faz sentido quando houver teclado físico no uso real.
- **Ciências** (Sugarizer `FoodChain`/`HumanBody`, Apache) — cadeia alimentar/corpo humano; custo de arte alto (precisaria de assets próprios), por isso fora da onda 2.

## Regras que continuam valendo

Mesmas da onda 1: zero código AGPL/GPL (GCompris é só mapa pedagógico),
zero dependência de runtime nova, tudo PT-BR nativo, motor puro testável,
SPEC → juiz → build → review cross-model → deploy verificado jogando.
