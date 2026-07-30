/**
 * Sons e vibração do Manuela Jogos.
 *
 * Os sons são SINTETIZADOS no WebAudio em vez de arquivos .mp3: zero bytes para
 * baixar, tocam na hora (sem espera de rede) e funcionam offline por construção
 * — o app precisa abrir em <3s no 4G.
 *
 * Sons vêm LIGADOS por padrão (decisão do dono: é metade da diversão), com
 * botão de mudo sempre visível no cabeçalho.
 */

export type Efeito =
  | "toque" // qualquer botão
  | "cor" // trocou de cor
  | "pincel" // trocou de ferramenta
  | "carimbo"
  | "balde"
  | "desfazer"
  | "apagar" // apagou tudo (aviso, não punição)
  | "salvar" // comemoração
  | "abrir" // entrou no jogo
  | "vazio" // "ainda não tem nada" — o não-verbal do app
  | "acerto" // resposta certa nos jogos (mais contido que salvar)
  | "erro" // resposta errada: aviso grave e suave, não punição
  | "vitoria" // fase completa
  | "passo"; // um passo da Manu no labirinto / carta virando

const CHAVE_MUDO = "manu:mudo";

let ctx: AudioContext | null = null;
let mudo = false;
let lido = false;
const ouvintes = new Set<() => void>();

/**
 * Assinatura para o React (useSyncExternalStore): o mudo é estado EXTERNO
 * (localStorage), e é assim que a interface acompanha sem quebrar hidratação.
 */
export function assinarMudo(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function estaNoNavegador(): boolean {
  return typeof window !== "undefined";
}

/** Lê a preferência de mudo (uma vez por sessão de página). */
export function estaMudo(): boolean {
  if (!estaNoNavegador()) return false;
  if (!lido) {
    try {
      mudo = window.localStorage.getItem(CHAVE_MUDO) === "1";
    } catch {
      mudo = false; // localStorage bloqueado (modo privado) — som segue ligado
    }
    lido = true;
  }
  return mudo;
}

export function definirMudo(valor: boolean): void {
  mudo = valor;
  lido = true;
  for (const ouvinte of ouvintes) ouvinte();
  if (!estaNoNavegador()) return;
  try {
    window.localStorage.setItem(CHAVE_MUDO, valor ? "1" : "0");
  } catch {
    // sem persistência é aceitável: vale para a sessão atual
  }
}

/** Snapshot para o servidor: som ligado (a preferência só existe no aparelho). */
export function mudoNoServidor(): boolean {
  return false;
}

/**
 * O navegador só permite criar/retomar áudio a partir de um gesto do usuário.
 * Chamamos isto no primeiro toque da tela.
 */
export function acordarAudio(): void {
  if (!estaNoNavegador() || estaMudo()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null; // sem WebAudio: o app funciona igual, só silencioso
  }
}

type Nota = { hz: number; inicio: number; dur: number; tipo?: OscillatorType; vol?: number };

const RECEITAS: Record<Efeito, Nota[]> = {
  // curto e agudo: confirma o toque sem cansar quem ouve o dia todo
  toque: [{ hz: 880, inicio: 0, dur: 0.07, vol: 0.16 }],
  cor: [{ hz: 1046, inicio: 0, dur: 0.06, vol: 0.14 }],
  pincel: [
    { hz: 660, inicio: 0, dur: 0.06, vol: 0.14 },
    { hz: 990, inicio: 0.05, dur: 0.07, vol: 0.12 },
  ],
  carimbo: [{ hz: 520, inicio: 0, dur: 0.09, tipo: "triangle", vol: 0.2 }],
  balde: [
    { hz: 300, inicio: 0, dur: 0.16, tipo: "sine", vol: 0.2 },
    { hz: 700, inicio: 0.06, dur: 0.14, tipo: "sine", vol: 0.12 },
  ],
  desfazer: [
    { hz: 700, inicio: 0, dur: 0.07, vol: 0.14 },
    { hz: 480, inicio: 0.06, dur: 0.09, vol: 0.14 },
  ],
  apagar: [
    { hz: 420, inicio: 0, dur: 0.1, tipo: "triangle", vol: 0.16 },
    { hz: 300, inicio: 0.09, dur: 0.14, tipo: "triangle", vol: 0.16 },
  ],
  // arpejo maior subindo: a recompensa do loop (salvou na galeria)
  salvar: [
    { hz: 523, inicio: 0, dur: 0.12, vol: 0.18 },
    { hz: 659, inicio: 0.1, dur: 0.12, vol: 0.18 },
    { hz: 784, inicio: 0.2, dur: 0.14, vol: 0.18 },
    { hz: 1046, inicio: 0.32, dur: 0.28, vol: 0.2 },
  ],
  abrir: [
    { hz: 659, inicio: 0, dur: 0.1, vol: 0.16 },
    { hz: 880, inicio: 0.09, dur: 0.18, vol: 0.16 },
  ],
  // duas notas descendo, curtinhas: o "hã-hã" de negar sem bronca
  vazio: [
    { hz: 392, inicio: 0, dur: 0.09, tipo: "triangle", vol: 0.16 },
    { hz: 311, inicio: 0.11, dur: 0.13, tipo: "triangle", vol: 0.16 },
  ],
  // arpejo curto subindo: recompensa imediata, sem roubar a cena do "salvar"
  acerto: [
    { hz: 659, inicio: 0, dur: 0.09, vol: 0.18 },
    { hz: 988, inicio: 0.07, dur: 0.14, vol: 0.18 },
  ],
  // uma nota grave e macia: "tenta de novo", nunca buzina de erro
  erro: [{ hz: 196, inicio: 0, dur: 0.2, tipo: "sine", vol: 0.16 }],
  // fanfarra da fase completa: a curva do salvar, um tom acima
  vitoria: [
    { hz: 587, inicio: 0, dur: 0.12, vol: 0.18 },
    { hz: 740, inicio: 0.1, dur: 0.12, vol: 0.18 },
    { hz: 880, inicio: 0.2, dur: 0.14, vol: 0.18 },
    { hz: 1175, inicio: 0.32, dur: 0.3, vol: 0.2 },
  ],
  passo: [{ hz: 740, inicio: 0, dur: 0.05, tipo: "triangle", vol: 0.12 }],
};

function agendar(audio: AudioContext, efeito: Efeito): void {
  const agora = audio.currentTime;
  for (const nota of RECEITAS[efeito]) {
    const osc = audio.createOscillator();
    const ganho = audio.createGain();
    osc.type = nota.tipo ?? "sine";
    osc.frequency.value = nota.hz;

    const t0 = agora + nota.inicio;
    const vol = nota.vol ?? 0.15;
    // envelope suave: sem clique no ataque nem corte seco no fim
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + nota.dur);

    osc.connect(ganho).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + nota.dur + 0.02);
  }
}

export function tocar(efeito: Efeito): void {
  if (!estaNoNavegador() || estaMudo()) return;
  acordarAudio();
  if (!ctx) return;
  if (ctx.state === "running") {
    agendar(ctx, efeito);
    return;
  }
  // O resume() é assíncrono: agendar antes dele completar perde o PRIMEIRO som
  // da sessão (silêncio justamente no toque que a criança mais espera ouvir).
  const audio = ctx;
  void audio
    .resume()
    .then(() => {
      if (audio.state === "running" && !estaMudo()) agendar(audio, efeito);
    })
    .catch(() => {
      // sem áudio: o app segue silencioso
    });
}

/** Vibração sutil. Android suporta; iOS ignora silenciosamente. */
export function vibrar(padrao: number | number[] = 12): void {
  if (!estaNoNavegador() || estaMudo()) return;
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // sem haptics — feedback visual já cobre
  }
}

/** Atalho para o par som+vibração usado nos botões. */
export function feedback(efeito: Efeito = "toque", haptico: number | number[] = 12): void {
  tocar(efeito);
  vibrar(haptico);
}
