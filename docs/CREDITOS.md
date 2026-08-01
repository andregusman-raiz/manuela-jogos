# Créditos e fontes de dados

## Mapa do Brasil (Estados do Brasil, `lib/estados/mapa.ts`)

Geometrias derivadas da **malha territorial oficial do IBGE** — Instituto
Brasileiro de Geografia e Estatística, API de Malhas Geográficas v3
(`servicodados.ibge.gov.br/api/v3/malhas/paises/BR`, parâmetros
`qualidade=minima`, `intrarregiao=UF`), obtidas em 2026-07-31.

**Regime legal**: dados abertos do Poder Executivo Federal — Lei de Acesso à
Informação (Lei nº 12.527/2011) e Política de Dados Abertos (Decreto nº
8.777/2016), que garantem uso, reutilização e redistribuição livres dos dados
governamentais, com atribuição da fonte (IBGE), aqui registrada.

Processamento próprio: projeção equiretangular para viewBox 200×200 e
simplificação Douglas-Peucker com salvaguardas topológicas
(`scripts/gerar-mapa-estados.py`).

Nenhum outro asset de terceiros é usado no app: todo o resto (desenhos,
ícones, sons, dinheiro estilizado) é original.

## Jogos de tabuleiro (onda tabuleiros, 2026-08)

Regras de domínio público reimplementadas do zero em TypeScript próprio:
**Ludo** (parente do Pachisi indiano; "Ludo" é nome genérico — nenhuma relação
com marcas comerciais como "Ludo King"), **Cobras e Escadas** (Moksha Patam),
**Lig-4** (mecânica de conexão), **Mancala/Kalah** (família mancala africana)
e **Rota** (moinho romano). Referências de REGRAS consultadas (sem cópia de
código): Wikipedia (regras canônicas), avirati/ludo (MIT — referência de
modelagem do tabuleiro em 56 passos), boardgame.io (MIT — padrões de engine
turn-based) e FreeBoardGames.org (AGPL-3.0 — apenas confirmação de UX
mobile-first; código não consultado durante a escrita das engines).

Tabuleiros, peças, animações e sons: originais.
