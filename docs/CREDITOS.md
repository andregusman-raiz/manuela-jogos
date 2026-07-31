# Créditos e fontes de dados

## Mapa do Brasil (Estados do Brasil, `lib/estados/mapa.ts`)

Geometrias derivadas da **malha territorial oficial do IBGE** — Instituto
Brasileiro de Geografia e Estatística, API de Malhas Geográficas v3
(`servicodados.ibge.gov.br/api/v3/malhas/paises/BR`, parâmetros
`qualidade=minima`, `intrarregiao=UF`), obtidas em 2026-07-31.

Dados públicos do governo brasileiro; reprodução com citação da fonte.
Processamento próprio: projeção equiretangular para viewBox 200×200 e
simplificação Douglas-Peucker (`scripts/gerar-mapa-estados.py`).

Nenhum outro asset de terceiros é usado no app: todo o resto (desenhos,
ícones, sons, dinheiro estilizado) é original.
