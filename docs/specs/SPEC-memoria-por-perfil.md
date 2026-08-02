# SPEC — Memória por perfil (progresso, galeria e configurações)

> **v1.1** (2026-08-02, pós-juiz — registro no fim). Auditoria prévia: hoje SÓ a escolha do jogador é por
> perfil; progresso dos 19 jogos, galeria/rascunho do Ateliê e config de
> jogos visíveis são do aparelho. Objetivo: isolar por perfil SEM perder
> nenhum dado existente (tudo que existe pertence à Manuela, dona histórica).

## 1. Decisões fechadas

| Memória | Destino | Mecanismo |
|---|---|---|
| Progresso/nível + melhor (19 jogos) | **por perfil** | chave composta `progresso:<perfilId>` nas MESMAS lojas (sem bump de BD) |
| Rascunho do Ateliê | **por perfil** | id `rascunho:<perfilId>` |
| Galeria do Ateliê | **por perfil** | campo `perfil` no registro do desenho |
| Config de jogos visíveis (⚙️) | **por perfil** | localStorage `manu-jogos-ocultos:<perfilId>` |
| Placar da Damas | aparelho (2 crianças no mesmo tabuleiro) | intocado |
| Som mudo | aparelho (quase hardware) | intocado |
| Dica "descobriu mais" | aparelho (hint de onboarding) | intocado |

## 2. Migração SEM migração (lazy, zero perda)

**Nada de transação de upgrade nem bump de versão.** O dado legado FICA onde
está e passa a pertencer à Manuela por fallback de leitura:

- `lerProgresso(jogo)`: lê `progresso:<ativo>`; se ativo === "manuela" e não
  existir, cai para o legado `"progresso"`. Escritas SEMPRE na chave nova
  (o legado congela como estava; `Math.max` do salvar monotônico usa o que
  a leitura-fallback devolver).
- Rascunho: mesma regra com `"rascunho"` legado; `limparRascunho()` da
  Manuela apaga AMBOS (novo e legado — senão o rascunho velho ressuscita).
- Galeria: `listarGaleria()` filtra `perfil === ativo`, e para a Manuela
  inclui também registros SEM campo `perfil` (legados). `salvarNaGaleria`
  grava `perfil: ativo`. Atualizar desenho legado (mesmo `galeriaId`)
  carimba o campo na regravação.
- Ocultos: `manu-jogos-ocultos:<ativo>`; Manuela sem chave nova lê a legada.
  Escrita na nova.

## 3. Quem conhece o perfil

`lib/armazenamento.ts` e `lib/preferencias.ts` derivam o ativo SINCRONAMENTE
via `perfilAtivo()` de lib/perfis (import sem ciclo: perfis→identidade
apenas). Os 19+ call-sites dos jogos NÃO mudam. `lib/preferencias.ts`:
cache vira `Map<perfilId, string[]>`; GradeJogos já re-renderiza na troca de
jogador (store), e o snapshot de ocultos re-lê pelo ativo.

## 4. Testes

- E2E novo `perfil-memoria.spec.ts` (semeando IndexedDB/localStorage direto
  e assertando pela UI): (a) legado `progresso` nível 4 → Manuela vê nível 4
  (fallback) e Leo vê nível 1 (isolamento); (b) `progresso:leo` nível 2 →
  Leo vê 2, Manuela segue 4; (c) Manuela esconde Damas → Leo vê Damas;
  Leo esconde Caça → Manuela mantém Caça e continua sem Damas; (d) galeria:
  desenho legado sem `perfil` aparece para Manuela e NÃO para Leo; desenho
  com `perfil: "leo"` só para Leo; (e) subir de nível como Leo e recarregar
  persiste (escrita na chave nova).
- Suíte existente INTEIRA passa sem edição (storageState = manuela + os
  fallbacks garantem semântica idêntica) — qualquer spec que quebrar é bug
  da implementação, não do spec.

## 5. Escopo negativo

Sem UI nova; sem migração em massa; sem bump de BD; sem tocar em placar da
Damas, mudo e descoberta; sem sincronização entre perfis; sem export.

---

## Registro do julgamento (v1.0 → v1.1) — Codex, 1 rodada: REVISE

- **B1 acatado como DECISÃO DE PRODUTO**: os perfis existem há dias sem
  isolamento — legado PODE ter jogadas do Leo/Gustavo. Atribuir tudo à
  Manuela é decisão do dono (aprovada no chat), não "zero perda" absoluto;
  documentado aqui e no PR.
- **B2 acatado**: `salvarProgresso` faz o fallback DENTRO da transação única
  (ler chave nova → se ausente e Manuela, ler legado na MESMA tx → gravar
  nivel=max / melhor=MIN entre não-nulos). `melhor` é MENOR-é-melhor.
- **B3 acatado**: autorizada a atualização de `atelie.spec` (contagem) e
  `pwa.spec` (predicado do rascunho) para reconhecer `rascunho:*`.
- Melhorias acatadas: API real é `apagarRascunho`; sanitização/último-visível
  por CHAVE de perfil (fallback só quando `getItem(nova) === null`);
  `assinarOcultos` assina também o store do jogador (contrato do snapshot);
  cobertura extra (melhor por perfil, min cruzando fallback, rascunho
  sombreado, troca na mesma aba, Gustavo); são 18 lojas de progresso + ateliê.
