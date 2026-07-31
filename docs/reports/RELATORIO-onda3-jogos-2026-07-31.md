# Relatório final — Onda 3 de Jogos Educativos (2026-07-31)

> Execução completa da SPEC `docs/specs/SPEC-jogos-educativos-onda3.md` (v1.1,
> juiz adversarial com 13 blockers pré-build). Resultado: **5 jogos novos em
> produção** — o hub fechou com **14 jogos**.

## Entregas

| PR | Jogo | Ensina | Review cross-model |
|----|------|--------|--------------------|
| [#27](https://github.com/andregusman-raiz/manuela-jogos/pull/27) | Pizza das Frações + infra (BD v4, hub 4/5 col, atualizarRegistro) | Ler/construir/comparar frações (produto cruzado, inteiros) | 1 BLOCKER (guard síncrono) + 3 → corrigidos |
| [#28](https://github.com/andregusman-raiz/manuela-jogos/pull/28) | Estados do Brasil | Geografia (malha oficial do IBGE, pinos escolares) | 7 findings → corrigidos |
| [#29](https://github.com/andregusman-raiz/manuela-jogos/pull/29) | Tangram da Manu | Raciocínio espacial (drag getScreenCTM, snap no motor) | 2 BLOCKERs + 5 → corrigidos/1 refutado |
| [#30](https://github.com/andregusman-raiz/manuela-jogos/pull/30) | Damas (2 jogadores) | Estratégia (regras da casa; placar transacional) | 6 findings → corrigidos |
| [#31](https://github.com/andregusman-raiz/manuela-jogos/pull/31) | Caça-Números | Múltiplos/fatores (gnumch) | 3 BLOCKERs → corrigidos |

## Achados que valeram a onda

1. **Asset com licença limpa exige teimosia**: os 3 mapas candidatos do
   Wikimedia eram CC-BY-SA (reprovados no gate); a solução foi a malha
   oficial do IBGE (dados abertos, Lei 12.527/2011 + Decreto 8.777/2016),
   processada por script próprio com salvaguardas topológicas — o review
   pegou centroides fora do polígono (AL) e anel de área zero (RJ).
2. **A conta do juiz sobre o DF (9×5px) matou a ideia de halos** — pinos
   escolares com linha-guia são o alvo real dos 9 estados pequenos.
3. **Letterbox de SVG**: `preserveAspectRatio` centra o desenho num box CSS
   não-quadrado; o componente com `getScreenCTM` é imune, mas o teste que
   convertia manualmente errava 113px — lição para qualquer drag em SVG.
4. **Efeitos em updaters do React**: a MESMA classe de bug apareceu pela 3ª
   vez (Frações e Tangram) — guard síncrono por identidade da rodada virou o
   padrão da casa.
5. **E2E de Damas joga uma partida COMPLETA de 49 lances gerada pelo próprio
   motor** e prova que a vitória SOMA no placar pré-existente.
6. **O centro do bbox de um triângulo cai na hipotenusa** — o WebKit resolve
   o hit para fora; agarrar pelo centroide real resolveu o drag do Tangram.

## Gates finais (main)

`typecheck` ✅ · `lint` ✅ · `test` **153/153** ✅ · `test:e2e` **175 passed /
1 skipped** ✅ (skip = offline WebKit, limitação documentada do driver).

## Verificação em produção

Cada PR verificado após o merge; Frações/Estados/Damas/Caça com interações
jogadas de verdade. SW `manu-app-v15`; hub com 14 cards na dobra
(4 colunas celular / 5 no desktop — contas do juízo).

## Gaps e decisões registradas

- **Silhuetas do Tangram** (gap declarado no PR #29, opção *a* aceita
  provisoriamente): funcionais como quebra-cabeça de sombra; reconhecibilidade
  fraca em parte das figuras — iteração de arte guiada pelo feedback da
  Manuela; o critério "contato poligonal real" fica para essa iteração.
- **Deslize de processo no PR B**: um commit entrou direto na main
  (esquecimento de branch); revertido e re-aplicado via PR com review — sem
  force-push, história preservada.
- Herdados: teste manual de 2 abas, offline em WebKit real, sessão de uso
  com a Manuela (agora com 14 jogos para calibrar).
- **Onda 4 segue condicional** (Digitação/Ciências — pré-condições na SPEC
  da onda 3 §7).
