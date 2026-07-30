#!/usr/bin/env python3
"""Processa o banco de imagens de colorir para dentro do app.

Entrada:  ~/Pictures/banco-colorir/<pasta>/*.{jpg,webp} + SVGs rasterizados
          (scripts/rasterizar-svgs.ts) no scratchpad da sessão.
Saída:    public/colorir-img/<categoria>/<slug>.webp + lib/colorir/imagens.ts

Passos por imagem: grayscale -> níveis (papel branco puro, linha preta) -> resize <=1100px -> WebP.

A pasta bobbie-goods NÃO entra: as páginas carregam a assinatura oficial
"BOBBIE GOODS" (produto comercial protegido). As demais exclusões vêm da
triagem visual (fotos, silhuetas, liga-pontos, alfabeto em inglês, gravuras
densas de adulto) — lista explícita abaixo.
"""
from __future__ import annotations

import json
import pathlib
import re
import unicodedata

from PIL import Image, ImageOps

BANCO = pathlib.Path.home() / "Pictures/banco-colorir"
SCRATCH = pathlib.Path(
    "/private/tmp/claude-501/-Users-andregusmandeoliveira-Claude/26f2dfa8-325f-4bd8-bc2b-e99cba28edae/scratchpad"
)
PROJETO = pathlib.Path.home() / "Claude/GitHub-pessoal/manuela-jogos"
SAIDA_IMG = PROJETO / "public/colorir-img"
SAIDA_TS = PROJETO / "lib/colorir/imagens.ts"

# pasta do banco -> categoria do app
CATEGORIA = {
    "animais": "animais",
    "esportes": "esportes",
    "fantasia": "castelo",  # aba "Fantasia" do app (id preservado)
    "natureza-mandalas": "natureza",
    "veiculos": "veiculos",
    # bobbie-goods: FORA (IP oficial da marca)
}

# exclusões da revisão visual, por índice da folha de contato (triagem.json)
EXCLUIR = {
    "animais": {24, 25, 26, 29, 31, 32},
    "esportes": {23, 25, 27},
    "fantasia": {48, 49, 52, 55},
    "natureza-mandalas": {29, 30, 39, 40, 41},
    "veiculos": {17},
}

# tradução de palavras dos slugs para o nome falado (leitor de tela)
PALAVRAS = {
    "cat": "gato", "kitten": "gatinho", "dog": "cachorro", "puppy": "cachorrinho",
    "horse": "cavalo", "pony": "pônei", "bear": "urso", "lion": "leão",
    "shark": "tubarão", "whale": "baleia", "elephant": "elefante",
    "butterfly": "borboleta", "butterflies": "borboletas", "bee": "abelha",
    "bird": "passarinho", "bunny": "coelhinho", "rabbit": "coelho",
    "unicorn": "unicórnio", "dragon": "dragão", "princess": "princesa",
    "fairy": "fada", "castle": "castelo", "mermaid": "sereia",
    "dinosaur": "dinossauro", "rex": "rex",
    "soccer": "futebol", "football": "futebol", "basketball": "basquete",
    "baseball": "beisebol", "tennis": "tênis", "player": "jogador",
    "ball": "bola", "goal": "gol", "robot": "robô", "swimmer": "nadador",
    "car": "carro", "cars": "carros", "taxi": "táxi", "truck": "caminhão",
    "trucks": "caminhões", "plane": "avião", "airplane": "avião",
    "jet": "avião a jato", "police": "polícia", "fire": "bombeiro",
    "beetle": "fusca", "race": "corrida", "racing": "de corrida",
    "flower": "flor", "flowers": "flores", "sunflower": "girassol",
    "mandala": "mandala", "garden": "jardim", "rainbow": "arco-íris",
    "moon": "lua", "sun": "sol", "cloud": "nuvem", "clouds": "nuvens",
    "mushroom": "cogumelo", "leaf": "folha", "cactus": "cacto",
    "jar": "potinho", "cute": "fofo", "baby": "bebê", "little": "pequeno",
    "happy": "feliz", "playing": "brincando", "sleeping": "dormindo",
    "riding": "montando", "flying": "voando", "reading": "lendo",
    "painting": "pintando", "guitar": "violão", "music": "música",
    "coloring": "", "page": "", "pages": "", "pagina": "", "para": "",
    "book": "", "printable": "", "free": "", "and": "e", "with": "com",
    "the": "", "a": "", "an": "", "of": "de", "in": "em", "on": "em",
}


def slugificar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")
    return re.sub(r"-{2,}", "-", texto)


def nome_amigavel(arquivo: str, categoria: str, n: int) -> str:
    base = re.sub(r"\.(jpg|jpeg|png|webp|svg)$", "", arquivo, flags=re.I)
    partes = re.split(r"[-_ ]+", base.lower())
    traduzidas = [PALAVRAS.get(p, "") if p in PALAVRAS else p for p in partes]
    frase = " ".join(t for t in traduzidas if t and not t.isdigit())
    frase = re.sub(r"\s{2,}", " ", frase).strip()
    if len(frase) < 4:
        frase = f"desenho de {categoria} {n}"
    return frase[:70]


def apagar_carimbo_site(im: Image.Image) -> Image.Image:
    """Apaga o carimbo do site ("ColoringPagesHQ.com" etc.) na base da página.

    Estratégia por COMPONENTES CONEXOS na faixa inferior (15% da altura):
    o carimbo é um bloco pequeno, central e isolado; a moldura é um componente
    que atravessa a página, e partes do desenho continuam acima da faixa
    (componentes que tocam o topo da janela nunca são apagados). Cobre os três
    layouts vistos no banco: texto acima da linha da moldura, abaixo dela e
    embutido num vão aberto na própria linha.
    """
    from PIL import ImageFilter

    largura, altura = im.size
    y0 = int(altura * 0.85)
    janela = im.crop((0, y0, largura, altura)).convert("L")
    jl, ja = janela.size
    # 1) Fica só com o traço FINO: abertura morfológica remove o que sobrevive
    #    a uma erosão de ~5px — a moldura (grossa) sai da máscara, o texto do
    #    carimbo (fonte fina) fica. Resolve o caso do texto encostado no vão
    #    da moldura, que a análise por componente cru não separa.
    # 2) Dilata para fundir as letras numa faixa única antes de rotular.
    bruta = janela.point(lambda v: 255 if v < 140 else 0)
    grossa = bruta.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    from PIL import ImageChops

    fina = ImageChops.subtract(bruta, grossa)
    k = max(3, (int(largura * 0.012) // 2) * 2 + 1)
    mascara = fina.filter(ImageFilter.MaxFilter(k))
    px = mascara.load()

    pai = list(range(jl * ja))

    def achar(i: int) -> int:
        while pai[i] != i:
            pai[i] = pai[pai[i]]
            i = pai[i]
        return i

    def unir(a: int, b: int) -> None:
        ra, rb = achar(a), achar(b)
        if ra != rb:
            pai[rb] = ra

    tinta = [[px[x, y] > 0 for x in range(jl)] for y in range(ja)]
    for y in range(ja):
        for x in range(jl):
            if not tinta[y][x]:
                continue
            i = y * jl + x
            if x > 0 and tinta[y][x - 1]:
                unir(i, i - 1)
            if y > 0 and tinta[y - 1][x]:
                unir(i, i - jl)
            if y > 0 and x > 0 and tinta[y - 1][x - 1]:
                unir(i, i - jl - 1)
            if y > 0 and x < jl - 1 and tinta[y - 1][x + 1]:
                unir(i, i - jl + 1)

    caixas: dict[int, list[int]] = {}
    for y in range(ja):
        for x in range(jl):
            if not tinta[y][x]:
                continue
            r = achar(y * jl + x)
            c = caixas.get(r)
            if c is None:
                caixas[r] = [x, y, x, y]
            else:
                c[0] = min(c[0], x)
                c[1] = min(c[1], y)
                c[2] = max(c[2], x)
                c[3] = max(c[3], y)

    from PIL import ImageDraw

    d = ImageDraw.Draw(im)
    for xa, ya, xb, yb in caixas.values():
        if ya <= 1:
            continue  # continua acima da janela: é desenho
        alt_c = yb - ya + 1
        larg_c = xb - xa + 1
        centro = (xa + xb) / 2 / jl
        if (
            alt_c <= altura * 0.030 + k
            and largura * 0.05 <= larg_c <= largura * 0.75
            and 0.25 <= centro <= 0.75
            and yb >= ja - int(altura * 0.10)
        ):
            d.rectangle([xa - 2, y0 + ya - 2, xb + 2, y0 + yb + 2], fill="#FFFFFF")
    return im


def processar(caminho: pathlib.Path) -> Image.Image:
    with Image.open(caminho) as im:
        im = ImageOps.exif_transpose(im.convert("RGB"))
        cinza = ImageOps.grayscale(im)
        # níveis: JPEG deixa o papel acinzentado e halos ao redor das linhas;
        # o flood fill agradece papel 255 e linha firme
        cinza = cinza.point(lambda v: 0 if v < 90 else (255 if v > 215 else int((v - 90) * 255 / 125)))
        cinza.thumbnail((1100, 1100), Image.LANCZOS)
        return apagar_carimbo_site(cinza.convert("RGB"))


def main() -> None:
    triagem = json.loads((SCRATCH / "triagem/triagem.json").read_text())
    aprovadas = []
    for item in triagem:
        pasta = item["pasta"]
        if pasta not in CATEGORIA:
            continue
        if not item["aprovada"] or item["indice"] in EXCLUIR.get(pasta, set()):
            continue
        aprovadas.append(item)

    registros = []
    usados: set[str] = set()
    contador: dict[str, int] = {}
    total_bytes = 0
    for item in aprovadas:
        origem = pathlib.Path(item["arquivo"])
        categoria = CATEGORIA[item["pasta"]]
        contador[categoria] = contador.get(categoria, 0) + 1
        slug = slugificar(origem.stem)[:60] or f"{categoria}-{contador[categoria]}"
        while slug in usados:
            slug = f"{slug}-{contador[categoria]}"
        usados.add(slug)

        destino = SAIDA_IMG / categoria
        destino.mkdir(parents=True, exist_ok=True)
        imagem = processar(origem)
        arquivo_saida = destino / f"{slug}.webp"
        imagem.save(arquivo_saida, "WEBP", quality=80, method=6)
        total_bytes += arquivo_saida.stat().st_size

        registros.append({
            "slug": slug,
            "nome": nome_amigavel(origem.name, categoria, contador[categoria]),
            "categoria": categoria,
            "src": f"/colorir-img/{categoria}/{slug}.webp",
            "largura": imagem.width,
            "altura": imagem.height,
        })

    registros.sort(key=lambda r: (r["categoria"], r["slug"]))
    linhas = [
        "// GERADO por scripts/processar-banco-colorir.py — não editar à mão.",
        "// Origem: banco pessoal de páginas para colorir (uso familiar).",
        'import type { PaginaImagem } from "./tipos";',
        "",
        "export const PAGINAS_IMAGEM: PaginaImagem[] = [",
    ]
    for r in registros:
        nome = r["nome"].replace('"', "'")
        linhas.append(
            f'  {{ slug: "{r["slug"]}", nome: "{nome}", categoria: "{r["categoria"]}", '
            f'src: "{r["src"]}", largura: {r["largura"]}, altura: {r["altura"]} }},'
        )
    linhas.append("];")
    linhas.append("")
    linhas.append("export function buscarImagem(slug: string | undefined): PaginaImagem | undefined {")
    linhas.append("  if (!slug) return undefined;")
    linhas.append("  return PAGINAS_IMAGEM.find((p) => p.slug === slug);")
    linhas.append("}")
    linhas.append("")
    linhas.append("export function imagensDaCategoria(categoria: string): PaginaImagem[] {")
    linhas.append("  return PAGINAS_IMAGEM.filter((p) => p.categoria === categoria);")
    linhas.append("}")
    linhas.append("")
    SAIDA_TS.write_text("\n".join(linhas), encoding="utf-8")

    por_cat = {}
    for r in registros:
        por_cat[r["categoria"]] = por_cat.get(r["categoria"], 0) + 1
    print(json.dumps(por_cat, indent=1, ensure_ascii=False))
    print(f"total: {len(registros)} páginas, {total_bytes / 1024 / 1024:.1f}MB em public/colorir-img/")


if __name__ == "__main__":
    main()
