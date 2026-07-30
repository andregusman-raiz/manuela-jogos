import { preencherRegiao } from "./balde";
import { desenharCarimbo, desenharForma } from "./formas";
import { desenharTraco } from "./pinceis";
import type { Desenho, Operacao } from "./tipos";

/**
 * Motor do Ateliê.
 *
 * O desenho é uma LISTA DE OPERAÇÕES, não um bitmap. Desfazer é remover a
 * última operação e reconstruir — sem guardar snapshots gigantes de imagem
 * (que estouram a memória de celular de entrada). O bitmap é só o resultado.
 *
 * Três camadas:
 *   fundo  — cor de fundo (o livro de colorir vive num SVG por baixo)
 *   arte   — tudo o que a criança já terminou de desenhar
 *   prévia — o traço que está saindo do dedo agora
 *
 * O traço em andamento fica na prévia e só é consolidado na arte quando o dedo
 * levanta: assim o traço ao vivo é redesenhado sem custo de reprocessar o
 * desenho inteiro a cada quadro.
 */

export type Camadas = {
  fundo: HTMLCanvasElement;
  arte: HTMLCanvasElement;
  previa: HTMLCanvasElement;
};

/** Teto de resolução: celular de entrada não aguenta canvas gigante. */
export const MAX_LADO = 2048;

export class Motor {
  private camadas: Camadas;
  private operacoes: Operacao[] = [];
  private refazer_: Operacao[] = [];
  private corFundo = "#FFFFFF";
  private colorir_: string | undefined;
  /** Chamado quando o histórico muda (React redesenha os botões e o SVG). */
  aoMudar: (() => void) | null = null;

  constructor(camadas: Camadas) {
    this.camadas = camadas;
  }

  get largura(): number {
    return this.camadas.arte.width;
  }

  get altura(): number {
    return this.camadas.arte.height;
  }

  get tela(): { largura: number; altura: number } {
    return { largura: this.largura, altura: this.altura };
  }

  get podeDesfazer(): boolean {
    return this.operacoes.length > 0;
  }

  get podeRefazer(): boolean {
    return this.refazer_.length > 0;
  }

  get vazio(): boolean {
    return this.operacoes.length === 0;
  }

  get livroColorir(): string | undefined {
    return this.colorir_;
  }

  /** Cores já pintadas por região (o SVG do livro lê isto para renderizar). */
  regioesPintadas(): Record<string, string> {
    const mapa: Record<string, string> = {};
    for (const op of this.operacoes) {
      if (op.kind === "regiao") mapa[op.regiao] = op.cor;
    }
    return mapa;
  }

  private ctx(camada: keyof Camadas): CanvasRenderingContext2D {
    const ctx = this.camadas[camada].getContext("2d", { willReadFrequently: camada === "arte" });
    if (!ctx) throw new Error(`camada ${camada} sem contexto 2d`);
    return ctx;
  }

  // ------------------------------------------------------------------ tamanho

  /**
   * Ajusta o tamanho real dos canvas. Chamado na montagem e ao girar a tela;
   * o conteúdo é reconstruído a partir das operações, então nada se perde.
   */
  redimensionar(larguraCss: number, alturaCss: number, dpr: number): void {
    const escala = Math.min(1, MAX_LADO / Math.max(larguraCss * dpr, alturaCss * dpr));
    const l = Math.max(1, Math.round(larguraCss * dpr * escala));
    const a = Math.max(1, Math.round(alturaCss * dpr * escala));

    for (const canvas of [this.camadas.fundo, this.camadas.arte, this.camadas.previa]) {
      if (canvas.width !== l || canvas.height !== a) {
        canvas.width = l;
        canvas.height = a;
      }
    }
    this.reconstruir();
  }

  // ------------------------------------------------------------------ operações

  aplicar(op: Operacao): void {
    this.operacoes.push(op);
    this.refazer_ = []; // caminho novo apaga o "refazer" antigo
    this.pintar(op);
    this.aoMudar?.();
  }

  desfazer(): void {
    const op = this.operacoes.pop();
    if (!op) return;
    this.refazer_.push(op);
    this.reconstruir();
    this.aoMudar?.();
  }

  refazer(): void {
    const op = this.refazer_.pop();
    if (!op) return;
    this.operacoes.push(op);
    this.pintar(op);
    this.aoMudar?.();
  }

  limparTudo(): void {
    this.operacoes = [];
    this.refazer_ = [];
    this.reconstruir();
    this.aoMudar?.();
  }

  /**
   * Operação em andamento na camada de prévia (traço saindo do dedo, forma
   * sendo esticada). Redesenhada a cada quadro sem tocar no desenho já feito.
   */
  previa(op: Operacao | null): void {
    const ctx = this.ctx("previa");
    ctx.clearRect(0, 0, this.largura, this.altura);
    if (!op) return;
    if (op.kind === "traco") desenharTraco(ctx, op, this.tela);
    else if (op.kind === "forma") desenharForma(ctx, op);
    else if (op.kind === "carimbo") desenharCarimbo(ctx, op);
  }

  private pintar(op: Operacao): void {
    switch (op.kind) {
      case "fundo": {
        this.corFundo = op.cor;
        const ctx = this.ctx("fundo");
        ctx.fillStyle = op.cor;
        ctx.fillRect(0, 0, this.largura, this.altura);
        break;
      }
      case "traco":
        desenharTraco(this.ctx("arte"), op, this.tela);
        break;
      case "carimbo":
        desenharCarimbo(this.ctx("arte"), op);
        break;
      case "forma":
        desenharForma(this.ctx("arte"), op);
        break;
      case "balde":
        this.aplicarBalde(op.x, op.y, op.cor);
        break;
      case "regiao":
        // Pintura de região é do SVG; o React lê regioesPintadas().
        break;
    }
  }

  /** O balde precisa ver fundo + arte juntos para achar a borda. */
  private aplicarBalde(x: number, y: number, cor: string): void {
    const achatado = document.createElement("canvas");
    achatado.width = this.largura;
    achatado.height = this.altura;
    const actx = achatado.getContext("2d", { willReadFrequently: true });
    if (!actx) return;
    actx.drawImage(this.camadas.fundo, 0, 0);
    actx.drawImage(this.camadas.arte, 0, 0);
    preencherRegiao(actx, this.ctx("arte"), x, y, cor);
  }

  /** Limpa os bitmaps e reexecuta todas as operações em ordem. */
  reconstruir(): void {
    const fundo = this.ctx("fundo");
    fundo.clearRect(0, 0, this.largura, this.altura);
    fundo.fillStyle = this.corFundoInicial();
    fundo.fillRect(0, 0, this.largura, this.altura);

    const arte = this.ctx("arte");
    arte.clearRect(0, 0, this.largura, this.altura);
    this.previa(null);

    for (const op of this.operacoes) this.pintar(op);
  }

  private corFundoInicial(): string {
    // A última operação de fundo manda; antes dela, branco.
    for (let i = this.operacoes.length - 1; i >= 0; i--) {
      const op = this.operacoes[i];
      if (op.kind === "fundo") return op.cor;
    }
    return this.colorir_ ? "#FFFFFF" : this.corFundo;
  }

  // ------------------------------------------------------------------ documento

  paraDesenho(id: string, criadoEm: number): Desenho {
    return {
      id,
      criadoEm,
      atualizadoEm: Date.now(),
      largura: this.largura,
      altura: this.altura,
      operacoes: this.operacoes,
      colorir: this.colorir_,
    };
  }

  carregar(desenho: Desenho): void {
    this.operacoes = desenho.operacoes ?? [];
    this.refazer_ = [];
    this.colorir_ = desenho.colorir;
    this.reconstruir();
    this.aoMudar?.();
  }

  definirLivroColorir(slug: string | undefined): void {
    this.colorir_ = slug;
  }

  // ------------------------------------------------------------------ exportar

  /**
   * Achata tudo num PNG. `svgLinhas` é o markup do livro de colorir já com as
   * cores das regiões aplicadas — desenhado por baixo dos traços.
   */
  async exportarPNG(svgLinhas?: string, escala = 1): Promise<string> {
    const l = Math.round(this.largura * escala);
    const a = Math.round(this.altura * escala);
    const saida = document.createElement("canvas");
    saida.width = l;
    saida.height = a;
    const ctx = saida.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = this.corFundoInicial();
    ctx.fillRect(0, 0, l, a);

    if (svgLinhas) {
      const img = await imagemDeSvg(svgLinhas);
      if (img) {
        // O SVG do livro é quadrado e centralizado na área de desenho.
        const lado = Math.min(l, a);
        ctx.drawImage(img, (l - lado) / 2, (a - lado) / 2, lado, lado);
      }
    }

    ctx.drawImage(this.camadas.arte, 0, 0, l, a);
    return saida.toDataURL("image/png");
  }

  async miniatura(svgLinhas?: string, lado = 320): Promise<string> {
    const escala = lado / Math.max(this.largura, this.altura);
    return this.exportarPNG(svgLinhas, escala);
  }
}

/** SVG (string) -> imagem, via data URL: não sai da máquina, funciona offline. */
async function imagemDeSvg(svg: string): Promise<HTMLImageElement | null> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
