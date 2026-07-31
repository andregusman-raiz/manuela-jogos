# Relatório final — Onda 2 de Jogos Educativos (2026-07-31)

> Execução completa da SPEC `docs/specs/SPEC-jogos-educativos-onda2.md` (v1.1,
> juiz adversarial com 10 blockers endereçados antes do build).
> Resultado: **4 jogos novos em produção** — o hub chegou a **9 jogos**.

## Entregas

| PR | Jogo | Ensina | Review cross-model |
|----|------|--------|--------------------|
| [#20](https://github.com/andregusman-raiz/manuela-jogos/pull/20) | Forca da Manu + infra (BD v3, hub 3 colunas) | Alfabetização (reusa o banco de 62 palavras; acentos de graça por NFD) | 1 BLOCKER + 4 → corrigidos |
| [#21](https://github.com/andregusman-raiz/manuela-jogos/pull/21) | Relógio Mágico | Ler horas no analógico (ponteiro de hora anda com os minutos) | 1 refutado via SPEC + 1 corrigido |
| [#22](https://github.com/andregusman-raiz/manuela-jogos/pull/22) | Lojinha da Manu | Dinheiro/troco em R$ (centavos inteiros, preço pagável por construção) | 2 BLOCKERs → 1 corrigido, 1 via SPEC |
| [#23](https://github.com/andregusman-raiz/manuela-jogos/pull/23) | Genius dos Sons | Memória auditiva (Simon; início por gesto) | 3 BLOCKERs → corrigidos |

## Achados de review que valeram a onda

1. **O fallback de `onblocked` da onda 1 nunca funcionou**: opens do mesmo
   banco são serializados — o segundo open entrava na fila ATRÁS do upgrade
   bloqueado. Política refeita: aguardar + invariante de conexões curtas
   (agora fechadas em TODOS os finais, inclusive `onabort`) + teto de 4s.
2. **Greedy é matematicamente errado para {2,5,10,20}** (R$6 = 2+2+2): preço
   da Lojinha nasce de uma combinação sorteada e o teste prova pagabilidade
   com DP independente.
3. **Replay inicial do Genius saía MUDO** (autoplay policy sem gesto): o jogo
   agora começa por um toque em "Começar ▶".
4. **Distrator-preço do troco nunca entrava** (posição no array) — o erro
   clássico "troco = o que custou" estava ausente das opções.

## Gates finais (main)

`typecheck` ✅ · `lint` ✅ · `test` **103/103** ✅ · `test:e2e` **121 passed /
1 skipped** ✅ (skip = offline WebKit, limitação documentada do driver).

## Verificação em produção

Cada PR verificado em produção após o merge; Forca e Genius **jogados** em
https://manuela-jogos.vercel.app (390×844, zero pageerrors). SW `manu-app-v10`;
hub com 9 cards na dobra (hub.spec é o gate — pegou 2 estouros durante a onda).

## Gaps herdados/abertos

- Teste manual de duas abas (herdado da onda 1) — cobertura automatizada
  existe; roteiro humano pendente.
- Offline em WebKit real: validação manual no iPhone.
- Sons/UX com a usuária final: sessão real com a Manuela.
- Exceção de toque registrada: teclado da Forca a 48px (26 teclas não cabem a
  72px em 390px; containment testado).
