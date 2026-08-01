/**
 * Ludo da Manu — motor puro (SPEC-jogos-tabuleiro §1, v1.1).
 *
 * Modelo: volta de 52 casas globais; cada peão guarda só o PRÓPRIO progresso:
 * -1 base | 0..50 volta (global = (SAIDA[cor]+progresso) % 52; a casa
 * SAIDA[cor]+51 é deliberadamente pulada) | 51..55 coluna final (sem posição
 * global) | 56 chegou. 56 passos do começo ao fim.
 *
 * O motor NÃO tem rng: o dado é sempre injetado (`rolar(estado, d6)`) — a UI
 * usa o LCG seeded de `lib/dado.ts` e os testes injetam sequências.
 */

export type CorLudo = 0 | 1 | 2 | 3;
export type DadoLudo = 1 | 2 | 3 | 4 | 5 | 6;
export type NivelLudo = 1 | 2;

export interface PeaoLudo {
  cor: CorLudo;
  indice: number;
  progresso: number;
}

export interface EstadoLudo {
  nivel: NivelLudo;
  jogadores: number;
  peoes: PeaoLudo[];
  vez: CorLudo;
  /** Em "mover": o dado a gastar. Em "rolar": o último dado exibível (ou null). */
  dado: DadoLudo | null;
  seisSeguidos: number;
  situacao: "rolar" | "mover" | "fim";
  vencedor: CorLudo | null;
}

export const SAIDA: readonly number[] = [0, 13, 26, 39];
export const ESTRELAS: readonly number[] = SAIDA.map((s) => (s + 8) % 52);
export const CHEGADA = 56;

export function criarPartida(jogadores: 2 | 3 | 4, nivel: NivelLudo): EstadoLudo {
  const peoes: PeaoLudo[] = [];
  const porJogador = nivel === 1 ? 2 : 4;
  for (let c = 0; c < jogadores; c++) {
    for (let i = 0; i < porJogador; i++) {
      // nível 1: o primeiro peão de cada cor já começa na saída (menos frustração)
      peoes.push({ cor: c as CorLudo, indice: i, progresso: nivel === 1 && i === 0 ? 0 : -1 });
    }
  }
  return {
    nivel,
    jogadores,
    peoes,
    vez: 0,
    dado: null,
    seisSeguidos: 0,
    situacao: "rolar",
    vencedor: null,
  };
}

export function posicaoGlobal(peao: PeaoLudo): number | null {
  if (peao.progresso < 0 || peao.progresso > 50) return null;
  return (SAIDA[peao.cor] + peao.progresso) % 52;
}

export function casaSegura(global: number): boolean {
  return SAIDA.includes(global) || ESTRELAS.includes(global);
}

/** Nível 2: ≥2 peões da MESMA cor adversária proíbem POUSO em casa não-segura. */
function pousoProibido(estado: EstadoLudo, global: number, cor: CorLudo): boolean {
  if (estado.nivel !== 2 || casaSegura(global)) return false;
  const contagem = [0, 0, 0, 0];
  for (const p of estado.peoes) {
    if (p.cor !== cor && posicaoGlobal(p) === global) contagem[p.cor]++;
  }
  return contagem.some((n) => n >= 2);
}

function podeMover(estado: EstadoLudo, peao: PeaoLudo, d6: DadoLudo): boolean {
  if (peao.progresso === CHEGADA) return false;
  if (peao.progresso === -1) {
    return d6 === 6; // a saída é casa segura: nunca há bloqueio nela
  }
  const alvo = peao.progresso + d6;
  if (alvo > CHEGADA) return false; // chegada exata
  if (alvo <= 50) {
    const destino = (SAIDA[peao.cor] + alvo) % 52;
    if (pousoProibido(estado, destino, peao.cor)) return false;
  }
  return true;
}

function legaisCom(estado: EstadoLudo, d6: DadoLudo): number[] {
  const legais: number[] = [];
  estado.peoes.forEach((p, i) => {
    if (p.cor === estado.vez && podeMover(estado, p, d6)) legais.push(i);
  });
  return legais;
}

export function jogadasLegais(estado: EstadoLudo): number[] {
  if (estado.situacao !== "mover" || estado.dado === null) return [];
  return legaisCom(estado, estado.dado);
}

function proximaVez(estado: EstadoLudo): CorLudo {
  return ((estado.vez + 1) % estado.jogadores) as CorLudo;
}

/**
 * Máquina de turno (ordem FECHADA pelo juiz — SPEC §1.2):
 * 1. nível 2 + 3º seis → descarta o movimento e passa a vez (nunca expõe "mover");
 * 2. sem jogada legal → passa a vez SEMPRE (mesmo com 6);
 * 3. senão → "mover" (seisSeguidos acompanha o 6).
 */
export function rolar(estado: EstadoLudo, d6: DadoLudo): EstadoLudo {
  if (estado.situacao !== "rolar") return estado;
  if (estado.nivel === 2 && d6 === 6 && estado.seisSeguidos === 2) {
    return { ...estado, dado: d6, seisSeguidos: 0, vez: proximaVez(estado) };
  }
  if (legaisCom(estado, d6).length === 0) {
    return { ...estado, dado: d6, seisSeguidos: 0, vez: proximaVez(estado) };
  }
  return {
    ...estado,
    dado: d6,
    situacao: "mover",
    seisSeguidos: d6 === 6 ? estado.seisSeguidos + 1 : 0,
  };
}

export function mover(estado: EstadoLudo, indicePeao: number): EstadoLudo {
  if (estado.situacao !== "mover" || estado.dado === null) return estado;
  if (!jogadasLegais(estado).includes(indicePeao)) return estado;

  const d6 = estado.dado;
  const peoes = estado.peoes.map((p) => ({ ...p }));
  const peao = peoes[indicePeao];
  peao.progresso = peao.progresso === -1 ? 0 : peao.progresso + d6;

  // captura: TODOS os adversários da casa não-segura voltam à base (SPEC §1.1)
  const g = posicaoGlobal(peao);
  if (g !== null && !casaSegura(g)) {
    for (const outro of peoes) {
      if (outro.cor !== peao.cor && posicaoGlobal(outro) === g) {
        outro.progresso = -1;
      }
    }
  }

  const venceu = peoes.filter((p) => p.cor === peao.cor).every((p) => p.progresso === CHEGADA);
  if (venceu) {
    return { ...estado, peoes, dado: null, situacao: "fim", vencedor: peao.cor };
  }
  const repete = d6 === 6;
  return {
    ...estado,
    peoes,
    dado: null,
    situacao: "rolar",
    vez: repete ? estado.vez : proximaVez(estado),
    seisSeguidos: repete ? estado.seisSeguidos : 0,
  };
}
