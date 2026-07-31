#!/usr/bin/env python3
"""Gera lib/estados/mapa.ts a partir da malha oficial do IBGE.

Fonte: API de malhas v3 do IBGE (dados públicos; citar a fonte):
  https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR
    ?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF

Uso: python3 scripts/gerar-mapa-estados.py <brasil-uf.geojson>
Projeção equiretangular ajustada ao viewBox 200x200 (jogo, não cartografia).
UFs com bounding box pequena demais para o dedo ganham PINO (SPEC onda 3 §3.2).
"""

import json
import sys

UFS = {
    "11": ("RO", "Rondônia", "Porto Velho", "Norte"),
    "12": ("AC", "Acre", "Rio Branco", "Norte"),
    "13": ("AM", "Amazonas", "Manaus", "Norte"),
    "14": ("RR", "Roraima", "Boa Vista", "Norte"),
    "15": ("PA", "Pará", "Belém", "Norte"),
    "16": ("AP", "Amapá", "Macapá", "Norte"),
    "17": ("TO", "Tocantins", "Palmas", "Norte"),
    "21": ("MA", "Maranhão", "São Luís", "Nordeste"),
    "22": ("PI", "Piauí", "Teresina", "Nordeste"),
    "23": ("CE", "Ceará", "Fortaleza", "Nordeste"),
    "24": ("RN", "Rio Grande do Norte", "Natal", "Nordeste"),
    "25": ("PB", "Paraíba", "João Pessoa", "Nordeste"),
    "26": ("PE", "Pernambuco", "Recife", "Nordeste"),
    "27": ("AL", "Alagoas", "Maceió", "Nordeste"),
    "28": ("SE", "Sergipe", "Aracaju", "Nordeste"),
    "29": ("BA", "Bahia", "Salvador", "Nordeste"),
    "31": ("MG", "Minas Gerais", "Belo Horizonte", "Sudeste"),
    "32": ("ES", "Espírito Santo", "Vitória", "Sudeste"),
    "33": ("RJ", "Rio de Janeiro", "Rio de Janeiro", "Sudeste"),
    "35": ("SP", "São Paulo", "São Paulo", "Sudeste"),
    "41": ("PR", "Paraná", "Curitiba", "Sul"),
    "42": ("SC", "Santa Catarina", "Florianópolis", "Sul"),
    "43": ("RS", "Rio Grande do Sul", "Porto Alegre", "Sul"),
    "50": ("MS", "Mato Grosso do Sul", "Campo Grande", "Centro-Oeste"),
    "51": ("MT", "Mato Grosso", "Cuiabá", "Centro-Oeste"),
    "52": ("GO", "Goiás", "Goiânia", "Centro-Oeste"),
    "53": ("DF", "Distrito Federal", "Brasília", "Centro-Oeste"),
}

# 24px de dedo em tela de 390px ≈ 13.4 unidades lógicas do viewBox 200
PISO_LOGICO_SEM_PINO = 13.4
# tolerância do Douglas-Peucker em unidades lógicas (orçamento: <=2KB/UF)
TOLERANCIA_DP = 0.4


def _dist_ponto_segmento(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def simplificar(pontos, tolerancia):
    """Douglas-Peucker iterativo (sem recursão para anéis longos)."""
    if len(pontos) < 3:
        return pontos
    manter = [False] * len(pontos)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pontos) - 1)]
    while pilha:
        i0, i1 = pilha.pop()
        maior, indice = 0.0, -1
        for i in range(i0 + 1, i1):
            d = _dist_ponto_segmento(pontos[i], pontos[i0], pontos[i1])
            if d > maior:
                maior, indice = d, i
        if maior > tolerancia:
            manter[indice] = True
            pilha.append((i0, indice))
            pilha.append((indice, i1))
    return [p for p, m in zip(pontos, manter) if m]


def aneis(geometria):
    if geometria["type"] == "Polygon":
        return geometria["coordinates"]
    saida = []
    for poligono in geometria["coordinates"]:
        saida.extend(poligono)
    return saida


def main():
    dados = json.load(open(sys.argv[1]))

    todos = [p for f in dados["features"] for anel in aneis(f["geometry"]) for p in anel]
    lons = [p[0] for p in todos]
    lats = [p[1] for p in todos]
    lon0, lon1 = min(lons), max(lons)
    lat0, lat1 = min(lats), max(lats)
    escala = 196 / max(lon1 - lon0, lat1 - lat0)
    dx = (200 - (lon1 - lon0) * escala) / 2
    dy = (200 - (lat1 - lat0) * escala) / 2

    def projetar(p):
        return (
            round((p[0] - lon0) * escala + dx, 1),
            round((lat1 - p[1]) * escala + dy, 1),
        )

    linhas = []
    for f in sorted(dados["features"], key=lambda f: UFS[f["properties"]["codarea"]][0]):
        sigla, nome, capital, regiao = UFS[f["properties"]["codarea"]]
        partes = []
        xs, ys = [], []
        for anel in aneis(f["geometry"]):
            pontos = simplificar([projetar(p) for p in anel], TOLERANCIA_DP)
            # remove pontos consecutivos idênticos após o arredondamento
            limpos = [pontos[0]]
            for pt in pontos[1:]:
                if pt != limpos[-1]:
                    limpos.append(pt)
            if len(limpos) < 4:
                continue
            xs.extend(x for x, _ in limpos)
            ys.extend(y for _, y in limpos)
            d = f"M {limpos[0][0]} {limpos[0][1]} " + " ".join(
                f"L {x} {y}" for x, y in limpos[1:]
            ) + " Z"
            partes.append(d)
        caminho = " ".join(partes)
        cx = round(sum(xs) / len(xs), 1)
        cy = round(sum(ys) / len(ys), 1)
        menor_dim = min(max(xs) - min(xs), max(ys) - min(ys))
        pino = menor_dim < PISO_LOGICO_SEM_PINO
        linhas.append(
            f'  {sigla}: {{ nome: "{nome}", capital: "{capital}", regiao: "{regiao}", '
            f"centroide: [{cx}, {cy}], pino: {str(pino).lower()}, path: \"{caminho}\" }},"
        )

    corpo = "\n".join(linhas)
    saida = f"""/**
 * Mapa do Brasil por UF — GERADO por scripts/gerar-mapa-estados.py.
 * Fonte: malha oficial do IBGE (API de malhas v3, qualidade "minima") —
 * dados públicos; citação da fonte em docs/CREDITOS.md. NÃO editar à mão.
 */

export type SiglaUF = keyof typeof ESTADOS;

export const ESTADOS = {{
{corpo}
}} as const;
"""
    with open("lib/estados/mapa.ts", "w") as arquivo:
        arquivo.write(saida)
    tamanho = len(saida.encode("utf-8"))
    pinos = [l.split(":")[0].strip() for l in linhas if "pino: true" in l]
    print(f"27 UFs, {tamanho / 1024:.1f}KB UTF-8, pinos: {pinos}")


if __name__ == "__main__":
    main()
