/**
 * Wrappers de canvas do pipeline de imagem (SPEC-perfis-pela-interface §3/§5).
 * Fino de propósito: a lógica de pixels é PURA em lib/imagem.ts; aqui vive só
 * o que precisa de navegador (decode, canvas, toBlob). Coberto pelo E2E real
 * de upload — jsdom não tem canvas.
 */

import { LIMIAR_FUNDO, caixaUtil, fundoClaro, removerFundo, temAlpha } from "./imagem";

export const LADO_MAXIMO = 1024;
export const TAMANHO_MAXIMO_ARQUIVO = 12 * 1024 * 1024;
export const MEGAPIXELS_MAXIMOS = 32;

export type ResultadoCorpo =
  | { ok: true; blob: Blob; largura: number; altura: number; previa: string }
  | { ok: false; motivo: "grande" | "nao-abriu" | "vazia" };

async function decodificar(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  // EXIF: from-image aplica a orientação da câmera (foto deitada — juiz B5)
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // fallback <img> (decodifica JPEG/PNG/HEIC onde o navegador souber)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function dimensoes(origem: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return "width" in origem && "naturalWidth" in origem
    ? { w: origem.naturalWidth, h: origem.naturalHeight }
    : { w: origem.width, h: origem.height };
}

/** Foto do corpo: decode → downscale ≤1024 → fundo claro vira alpha → PNG. */
export async function processarCorpo(file: File): Promise<ResultadoCorpo> {
  if (file.size > TAMANHO_MAXIMO_ARQUIVO) return { ok: false, motivo: "grande" };
  const origem = await decodificar(file);
  if (!origem) return { ok: false, motivo: "nao-abriu" };
  const fechar = () => {
    if ("close" in origem) origem.close();
  };
  const { w, h } = dimensoes(origem);
  if (w === 0 || h === 0) {
    fechar();
    return { ok: false, motivo: "nao-abriu" };
  }
  if ((w * h) / 1_000_000 > MEGAPIXELS_MAXIMOS) {
    fechar();
    return { ok: false, motivo: "grande" };
  }

  // downscale DIRETO no drawImage — nunca canvas no tamanho original (juiz B5)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(w, h));
  const largura = Math.max(1, Math.round(w * escala));
  const altura = Math.max(1, Math.round(h * escala));
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    fechar();
    return { ok: false, motivo: "nao-abriu" };
  }
  ctx.drawImage(origem, 0, 0, largura, altura);
  fechar();

  const dados = ctx.getImageData(0, 0, largura, altura);
  const pixels = { dados: dados.data, largura, altura };
  if (!temAlpha(pixels) && fundoClaro(pixels)) {
    removerFundo(pixels);
    ctx.putImageData(dados, 0, 0);
  }
  const caixa = caixaUtil(pixels);
  if (!caixa) return { ok: false, motivo: "vazia" };

  const recorte = document.createElement("canvas");
  recorte.width = caixa.largura;
  recorte.height = caixa.altura;
  recorte
    .getContext("2d")!
    .drawImage(tela, caixa.x, caixa.y, caixa.largura, caixa.altura, 0, 0, caixa.largura, caixa.altura);

  const blob = await new Promise<Blob | null>((r) => recorte.toBlob(r, "image/png"));
  if (!blob) return { ok: false, motivo: "nao-abriu" };
  return {
    ok: true,
    blob,
    largura: caixa.largura,
    altura: caixa.altura,
    previa: URL.createObjectURL(blob),
  };
}

/** Recorta o rosto (quadrado em coords da imagem processada) em 512×512. */
export async function recortarAvatar(
  corpo: Blob,
  recorte: { x: number; y: number; lado: number },
): Promise<Blob | null> {
  const bitmap = await createImageBitmap(corpo);
  // downscale em 2 passos para qualidade (canvas não tem LANCZOS)
  const meio = document.createElement("canvas");
  const ladoMeio = Math.max(512, Math.round(recorte.lado / 2));
  meio.width = ladoMeio;
  meio.height = ladoMeio;
  meio
    .getContext("2d")!
    .drawImage(bitmap, recorte.x, recorte.y, recorte.lado, recorte.lado, 0, 0, ladoMeio, ladoMeio);
  const final = document.createElement("canvas");
  final.width = 512;
  final.height = 512;
  final.getContext("2d")!.drawImage(meio, 0, 0, ladoMeio, ladoMeio, 0, 0, 512, 512);
  bitmap.close();
  return await new Promise<Blob | null>((r) => final.toBlob(r, "image/png"));
}

export { LIMIAR_FUNDO };
