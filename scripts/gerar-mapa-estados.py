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
PISO_LOGICO_SEM_PINO = 17.5  # pior formato: celular deitado (~290px uteis)
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


def _area_shoelace(pontos):
    soma = 0.0
    for i in range(len(pontos)):
        x1, y1 = pontos[i]
        x2, y2 = pontos[(i + 1) % len(pontos)]
        soma += x1 * y2 - x2 * y1
    return soma / 2.0


def _centroide_por_area(aneis_pts):
    """Centroide poligonal (shoelace) do MAIOR anel — média de vértices cai
    fora do polígono em formas côncavas como AL/PA (review do PR B)."""
    maior = max(aneis_pts, key=lambda a: abs(_area_shoelace(a)))
    area = _area_shoelace(maior)
    cx = cy = 0.0
    for i in range(len(maior)):
        x1, y1 = maior[i]
        x2, y2 = maior[(i + 1) % len(maior)]
        cruz = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cruz
        cy += (y1 + y2) * cruz
    return round(cx / (6 * area), 1), round(cy / (6 * area), 1)


def _segmentos_cruzam(a, b, c, d):
    def orient(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return 0 if abs(v) < 1e-9 else (1 if v > 0 else -1)

    return (
        orient(a, b, c) != orient(a, b, d)
        and orient(c, d, a) != orient(c, d, b)
        and orient(a, b, c) != 0
    )


def _comprimento(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


# cruzamento entre segmentos AMBOS menores que isto é subpixel: invisível no
# render (fill nonzero) e irrelevante para o toque — não vale pagar bytes
SEGMENTO_RELEVANTE = 1.5


def _tem_autointersecao(pontos):
    n = len(pontos)
    for i in range(n):
        a, b = pontos[i], pontos[(i + 1) % n]
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            c, d = pontos[j], pontos[(j + 1) % n]
            if _comprimento(a, b) < SEGMENTO_RELEVANTE and _comprimento(c, d) < SEGMENTO_RELEVANTE:
                continue
            if _segmentos_cruzam(a, b, c, d):
                return True
    return False


AREA_MINIMA = 1.0  # anéis menores que isto (ilhotas/ruído do DP) são descartados


def simplificar_sem_cruzar(pontos):
    """DP com tolerância adaptativa: recua UM degrau por vez até o anel não se
    auto-intersectar (despencar direto para 0 estourava o orçamento de bytes)."""
    for tolerancia in (0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.0):
        s = simplificar(pontos, tolerancia) if tolerancia else pontos
        if not _tem_autointersecao(s):
            return s
    return pontos


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
        aneis_validos = []
        for anel in aneis(f["geometry"]):
            pontos = simplificar_sem_cruzar([projetar(p) for p in anel])
            # remove pontos consecutivos idênticos após o arredondamento
            limpos = [pontos[0]]
            for pt in pontos[1:]:
                if pt != limpos[-1]:
                    limpos.append(pt)
            # anel degenerado (colinear/área ~0, ex.: 3º anel do RJ) sai fora
            if len(limpos) < 4 or abs(_area_shoelace(limpos)) < AREA_MINIMA:
                continue
            aneis_validos.append(limpos)
            xs.extend(x for x, _ in limpos)
            ys.extend(y for _, y in limpos)
            d = f"M {limpos[0][0]} {limpos[0][1]} " + " ".join(
                f"L {x} {y}" for x, y in limpos[1:]
            ) + " Z"
            partes.append(d)
        caminho = " ".join(partes)
        cx, cy = _centroide_por_area(aneis_validos)
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
