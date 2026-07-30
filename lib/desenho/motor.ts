import { preencherRegiao } from "./balde";
import { escalarDesenho } from "./documento";
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

/** Snapshot cobre o prefixo a cada N operações (além de antes de cada balde). */
const OPS_POR_SNAPSHOT = 12;
/** No replay completo, o snapshot fica este tanto ATRÁS do topo do histórico. */
const FOLGA_SNAPSHOT = 6;

export class Motor {
  private camadas: Camadas;
  private operacoes: Operacao[] = [];
  private refazer_: Operacao[] = [];
  private corFundo = "#FFFFFF";
  private colorir_: string | undefined;
  /**
   * Bitmap da arte após as primeiras `indice` operações. Sem ele, cada desfazer
   * re-executa o histórico inteiro — e cada balde no meio refaz um flood fill
   * de tela cheia (centenas de ms em celular). Com ele, o desfazer típico
   * re-executa só as últimas poucas operações.
   */
  private snap: { indice: number; bitmap: HTMLCanvasElement } | null = null;
  /**
   * Página de colorir em bitmap: as linhas entram na camada de FUNDO, e é
   * assim que o balde (flood fill no achatado fundo+arte) respeita os
   * contornos do desenho sem nenhum código extra.
   */
  private imagemColorir_: HTMLImageElement | null = null;
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
        this.snap = null; // bitmap antigo não serve para a nova resolução
      }
    }
    this.reconstruir();
  }

  // ------------------------------------------------------------------ snapshot

  /**
   * Congela a arte ATUAL como "prefixo pronto" do histórico.
   * `indice` diz quantas operações o bitmap representa (default: todas).
   */
  private tirarSnapshot(indice = this.operacoes.length): void {
    const bitmap = document.createElement("canvas");
    bitmap.width = this.largura;
    bitmap.height = this.altura;
    const ctx = bitmap.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.camadas.arte, 0, 0);
    this.snap = { indice, bitmap };
  }

  // ------------------------------------------------------------------ operações

  aplicar(op: Operacao): void {
    // O snapshot é tirado ANTES de aplicar: assim a operação nova (em especial
    // um balde) fica DEPOIS dele, e desfazê-la volta ao bitmap pronto em vez de
    // re-executar o flood fill.
    const distancia = this.operacoes.length - (this.snap?.indice ?? 0);
    if (this.snap === null || op.kind === "balde" || distancia >= OPS_POR_SNAPSHOT) {
      this.tirarSnapshot();
    }

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
    this.snap = null;
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
    preencherRegiao(actx, this.ctx("arte"), x, y, cor, undefined, this.imagemColorir_ !== null);
  }

  /**
   * Reexecuta o histórico. Se o snapshot cobre um prefixo válido, parte dele e
   * só re-executa a cauda; senão faz o replay completo e deixa um snapshot novo
   * um pouco ATRÁS do topo (com folga, para que uma sequência de desfazer não
   * invalide o snapshot a cada passo).
   */
  reconstruir(): void {
    // O fundo é barato: sempre re-preenchido (a última op de fundo manda).
    const fundo = this.ctx("fundo");
    fundo.clearRect(0, 0, this.largura, this.altura);
    fundo.fillStyle = this.corFundoInicial();
    fundo.fillRect(0, 0, this.largura, this.altura);
    const caixa = this.caixaImagem();
    if (caixa && this.imagemColorir_) {
      fundo.drawImage(this.imagemColorir_, caixa.x, caixa.y, caixa.l, caixa.a);
    }

    const arte = this.ctx("arte");
    arte.clearRect(0, 0, this.largura, this.altura);
    this.previa(null);

    const aproveitavel =
      this.snap !== null &&
      this.snap.indice <= this.operacoes.length &&
      this.snap.bitmap.width === this.largura &&
      this.snap.bitmap.height === this.altura;

    if (aproveitavel && this.snap) {
      arte.drawImage(this.snap.bitmap, 0, 0);
      for (let i = this.snap.indice; i < this.operacoes.length; i++) {
        this.pintar(this.operacoes[i]);
      }
      return;
    }

    this.snap = null;
    const corte = Math.max(0, this.operacoes.length - FOLGA_SNAPSHOT);
    for (let i = 0; i < this.operacoes.length; i++) {
      if (i === corte && corte > 0) this.tirarSnapshot(corte);
      this.pintar(this.operacoes[i]);
    }
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
    this.snap = null;
    this.colorir_ = desenho.colorir;
    this.reconstruir();
    this.aoMudar?.();
  }

  definirLivroColorir(slug: string | undefined): void {
    this.colorir_ = slug;
  }

  /** Define (ou remove) a imagem de linhas da página bitmap e redesenha. */
  definirImagemColorir(img: HTMLImageElement | null): void {
    this.imagemColorir_ = img;
    this.snap = null; // o fundo mudou; bitmaps antigos da arte seguem válidos, o prefixo não
    this.reconstruir();
  }

  /** Retângulo "contain, centralizado" da imagem dentro do canvas. */
  private caixaImagem(): { x: number; y: number; l: number; a: number } | null {
    const img = this.imagemColorir_;
    if (!img) return null;
    return caixaContain(img.naturalWidth, img.naturalHeight, this.largura, this.altura);
  }

  // ------------------------------------------------------------------ exportar

  /**
   * Achata tudo num PNG re-executando as operações na resolução de saída — o
   * desenho é vetorial por construção, então ampliar re-desenha nítido em vez
   * de esticar bitmap. `svgLinhas` é o livro de colorir já com as cores das
   * regiões; entra POR CIMA da arte, como na tela (o contorno nunca é coberto).
   */
  async exportarPNG(svgLinhas?: string, escala = 1): Promise<string> {
    return renderizarDesenhoPNG(this.paraDesenho("export", 0), {
      svgLinhas,
      imagemSrc: this.imagemColorir_?.src,
      escala,
    });
  }

  async miniatura(svgLinhas?: string, lado = 320): Promise<string> {
    const escala = lado / Math.max(this.largura, this.altura);
    return this.exportarPNG(svgLinhas, escala);
  }
}

/**
 * Renderiza um Desenho salvo em PNG, em qualquer escala, sem precisar de um
 * Motor montado na tela — é o que deixa o compartilhar da galeria sair em alta
 * resolução em vez de reaproveitar a miniatura de 320px.
 */
export async function renderizarDesenhoPNG(
  desenho: Desenho,
  {
    svgLinhas,
    imagemSrc,
    escala = 1,
  }: { svgLinhas?: string; imagemSrc?: string; escala?: number } = {},
): Promise<string> {
  const escalado = escala === 1 ? desenho : escalarDesenho(desenho, escala);
  const l = escalado.largura;
  const a = escalado.altura;

  const camadas = {
    fundo: document.createElement("canvas"),
    arte: document.createElement("canvas"),
    previa: document.createElement("canvas"),
  };
  const motor = new Motor(camadas);
  motor.definirLivroColorir(desenho.colorir);
  // Página bitmap: as linhas precisam estar no fundo ANTES do replay, senão
  // os baldes do histórico inundam sem barreira e o PNG sai diferente da tela.
  const imagemLinhas = imagemSrc ? await carregarImagem(imagemSrc) : null;
  if (imagemLinhas) motor.definirImagemColorir(imagemLinhas);
  // redimensionar + carregar reconstroem tudo (inclusive baldes) no espaço maior
  motor.redimensionar(l, a, 1);
  motor.carregar(escalado);

  const saida = document.createElement("canvas");
  saida.width = l;
  saida.height = a;
  const ctx = saida.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(camadas.fundo, 0, 0);
  ctx.drawImage(camadas.arte, 0, 0);

  if (imagemLinhas) {
    // linhas por cima da pintura, como o overlay multiply da tela
    const caixa = caixaContain(imagemLinhas.naturalWidth, imagemLinhas.naturalHeight, l, a);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(imagemLinhas, caixa.x, caixa.y, caixa.l, caixa.a);
    ctx.globalCompositeOperation = "source-over";
  }

  if (svgLinhas) {
    const img = await imagemDeSvg(svgLinhas);
    if (img) {
      // O SVG do livro é quadrado e centralizado na área de desenho.
      const lado = Math.min(l, a);
      ctx.drawImage(img, (l - lado) / 2, (a - lado) / 2, lado, lado);
    }
  }

  return saida.toDataURL("image/png");
}

/** SVG (string) -> imagem, via data URL: não sai da máquina, funciona offline. */
async function imagemDeSvg(svg: string): Promise<HTMLImageElement | null> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return carregarImagem(url);
}

export async function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Geometria "object-fit: contain" centralizada — a MESMA conta do overlay
 * visual, do fundo do canvas e da exportação, para nada ficar deslocado. */
export function caixaContain(
  imgL: number,
  imgA: number,
  telaL: number,
  telaA: number,
): { x: number; y: number; l: number; a: number } {
  const escala = Math.min(telaL / imgL, telaA / imgA);
  const l = imgL * escala;
  const a = imgA * escala;
  return { x: (telaL - l) / 2, y: (telaA - a) / 2, l, a };
}
