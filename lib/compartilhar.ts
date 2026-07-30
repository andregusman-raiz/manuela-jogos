/**
 * Sair do aparelho é a ÚNICA coisa que passa pelo portão parental. Aqui só
 * acontece a mecânica: PNG -> arquivo -> menu de compartilhar do sistema
 * (WhatsApp da família, fotos) ou download, quando o navegador não tem share.
 */
export type ResultadoCompartilhar = "compartilhado" | "baixado" | "cancelado" | "falhou";

export async function compartilharPng(
  dataUrl: string,
  nomeArquivo = "desenho-da-manu.png",
): Promise<ResultadoCompartilhar> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const arquivo = new File([blob], nomeArquivo, { type: "image/png" });

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: "Desenho da Manu" });
        return "compartilhado";
      } catch (erro) {
        // usuário fechou a folha de compartilhamento: não é erro
        if (erro instanceof DOMException && erro.name === "AbortError") return "cancelado";
        throw erro;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
    return "baixado";
  } catch {
    return "falhou";
  }
}
