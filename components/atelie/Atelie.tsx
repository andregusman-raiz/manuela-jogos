"use client";

import Link from "next/link";
import { daMascote } from "@/lib/identidade";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TelaDesenho } from "./TelaDesenho";
import { BarraCores, GradeCoresExtras } from "./BarraCores";
import { BarraFerramentas } from "./BarraFerramentas";
import { LivroColorir } from "./LivroColorir";
import { SeletorColorir } from "./SeletorColorir";
import { Galeria } from "./Galeria";
import { Bandeja } from "@/components/ui-kids/Bandeja";
import { BotaoSegurar } from "@/components/ui-kids/BotaoSegurar";
import { Confete } from "@/components/ui-kids/Confete";
import { Mascote } from "@/components/ui-kids/Mascote";
import { PortaoParental } from "@/components/ui-kids/PortaoParental";
import { Icone } from "@/components/ui-kids/Icone";
import { Motor, carregarImagem, renderizarDesenhoPNG } from "@/lib/desenho/motor";
import { regioesDeOperacoes } from "@/lib/desenho/documento";
import { marcarDescobriuMais } from "@/lib/descoberta";
import {
  FERRAMENTA_INICIAL,
  PINCEIS_BASICOS,
  PINCEIS_ESPECIAIS,
  SIMETRIAS,
} from "@/lib/desenho/ferramentas";
import type { Ferramenta } from "@/lib/desenho/ferramentas";
import { CARIMBOS, FORMAS } from "@/lib/desenho/formas";
import { ESPESSURAS, FUNDOS } from "@/lib/cores";
import { buscarPagina } from "@/lib/colorir/paginas";
import { buscarImagem } from "@/lib/colorir/imagens";
import { paginaParaSvg } from "@/lib/colorir/tipos";
import type { Pagina, PaginaImagem } from "@/lib/colorir/tipos";
import {
  carregarRascunho,
  guardarNaGaleria,
  listarGaleria,
  salvarRascunho,
} from "@/lib/armazenamento";
import type { Desenho } from "@/lib/desenho/tipos";
import { compartilharPng } from "@/lib/compartilhar";
import {
  assinarMudo,
  definirMudo,
  estaMudo,
  feedback,
  mudoNoServidor,
  tocar,
} from "@/lib/som";

type Gaveta = "pinceis" | "mais" | "carimbos" | "formas" | "espelho" | "fundos" | "cores" | null;

/** Item da gaveta "mais coisas". */
function BotaoGaveta({
  rotulo,
  emoji,
  icone,
  onClick,
  inativo = false,
}: {
  rotulo: string;
  emoji?: string;
  icone?: React.ReactNode;
  onClick: () => void;
  inativo?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={inativo}
      onPointerDown={() => {
        if (!inativo) feedback("toque");
      }}
      onClick={onClick}
      className={`bolha aspect-square min-h-16 w-full bg-manu-nuvem text-3xl ring-2 ring-manu-cacau/10 ${
        inativo ? "opacity-35" : ""
      }`}
    >
      {icone ?? emoji}
    </button>
  );
}

/**
 * Ateliê da Manu — o primeiro jogo do Manuela Jogos.
 *
 * Estrutura da tela, de cima para baixo: cabeçalho fino, canvas ocupando o resto,
 * fita de cores e barra de ferramentas. Tudo o que se toca fica na metade de
 * baixo, no alcance do polegar de quem segura o celular com as duas mãos.
 */
export function Atelie() {
  const [ferramenta, setFerramenta] = useState<Ferramenta>(FERRAMENTA_INICIAL);
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [pagina, setPagina] = useState<Pagina | undefined>(undefined);
  const [paginaImg, setPaginaImg] = useState<PaginaImagem | undefined>(undefined);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [desenhosSalvos, setDesenhosSalvos] = useState<Desenho[]>([]);
  const [portao, setPortao] = useState<Desenho | "atual" | null>(null);
  const [confete, setConfete] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Sobe a cada tentativa de guardar sem desenho: a estrela balança o "não". */
  const [negacao, setNegacao] = useState(0);
  // O mudo vive no localStorage (estado externo): useSyncExternalStore evita
  // divergência entre o que o servidor renderiza e o que o aparelho lembra.
  const mudo = useSyncExternalStore(assinarMudo, estaMudo, mudoNoServidor);
  /**
   * O motor é imperativo (canvas), então espelhamos em estado o que a interface
   * precisa saber dele: se dá para desfazer e quais regiões já foram pintadas.
   */
  const [estado, setEstado] = useState({
    podeDesfazer: false,
    podeRefazer: false,
    regioes: {} as Record<string, string>,
  });

  const motorRef = useRef<Motor | null>(null);
  /** 0 = ainda não marcado; o carimbo nasce no primeiro uso, nunca no render. */
  const criadoEm = useRef<number>(0);
  const timerSalvar = useRef<number | null>(null);
  /**
   * Identidade do desenho na galeria + se mudou desde o último guardar.
   * É o que impede a galeria de encher de cópias: guardar de novo ATUALIZA o
   * mesmo item, e trocar de página não re-salva o que já está salvo.
   */
  const idGaleria = useRef<string | null>(null);
  const sujo = useRef(false);

  const marcarCriacao = useCallback(() => {
    if (criadoEm.current === 0) criadoEm.current = Date.now();
    return criadoEm.current;
  }, []);

  /** Rascunho sempre carrega o vínculo com a galeria (sobrevive ao reload). */
  const rascunhoAtual = useCallback(
    (m: Motor) => ({
      ...m.paraDesenho("rascunho", marcarCriacao()),
      galeriaId: idGaleria.current ?? undefined,
    }),
    [marcarCriacao],
  );

  // ----------------------------------------------------------------- motor

  /** Resolve o slug salvo (região SVG ou imagem bitmap) e prepara o motor. */
  const aplicarPaginaColorir = useCallback((m: Motor, slug: string | undefined) => {
    const regiao = buscarPagina(slug);
    const imagem = regiao ? undefined : buscarImagem(slug);
    setPagina(regiao);
    setPaginaImg(imagem);
    if (imagem) {
      void carregarImagem(imagem.src).then((img) => {
        // se a criança já trocou de página, não sobrescreve
        if (motorRef.current === m) m.definirImagemColorir(img);
      });
    } else {
      m.definirImagemColorir(null);
    }
  }, []);

  const aoMotorPronto = useCallback((m: Motor) => {
    motorRef.current = m;
    m.aoMudar = () =>
      setEstado({
        podeDesfazer: m.podeDesfazer,
        podeRefazer: m.podeRefazer,
        regioes: m.regioesPintadas(),
      });

    // retoma exatamente o desenho de onde a criança parou
    void carregarRascunho().then((rascunho) => {
      if (!rascunho || rascunho.operacoes.length === 0) return;
      criadoEm.current = rascunho.criadoEm;
      idGaleria.current = rascunho.galeriaId ?? null;
      // não sabemos se o rascunho diverge do item da galeria; assumir que sim
      // é seguro (o pior caso é um guardar atualizar com o mesmo conteúdo)
      sujo.current = true;
      m.carregar(rascunho);
      aplicarPaginaColorir(m, rascunho.colorir);
    });
  }, [aplicarPaginaColorir]);

  const svgDaPagina = useCallback((): string | undefined => {
    const m = motorRef.current;
    if (!m || !pagina) return undefined;
    return paginaParaSvg(pagina, m.regioesPintadas());
  }, [pagina]);

  /** Autosave: cada operação reagenda a gravação do rascunho. */
  const aoOperar = useCallback(() => {
    const m = motorRef.current;
    if (!m) return;
    sujo.current = true;
    if (timerSalvar.current !== null) window.clearTimeout(timerSalvar.current);
    timerSalvar.current = window.setTimeout(() => {
      void salvarRascunho(rascunhoAtual(m));
    }, 400);
  }, [rascunhoAtual]);

  useEffect(() => {
    return () => {
      if (timerSalvar.current !== null) window.clearTimeout(timerSalvar.current);
    };
  }, []);

  // Salva também ao esconder a aba: fechar o navegador no meio não perde nada.
  useEffect(() => {
    const salvarAgora = () => {
      const m = motorRef.current;
      // grava mesmo vazio: apagar tudo e fechar precisa continuar vazio ao voltar
      if (m) void salvarRascunho(rascunhoAtual(m));
    };
    document.addEventListener("visibilitychange", salvarAgora);
    window.addEventListener("pagehide", salvarAgora);
    return () => {
      document.removeEventListener("visibilitychange", salvarAgora);
      window.removeEventListener("pagehide", salvarAgora);
    };
  }, [rascunhoAtual]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 1800);
  };

  // ----------------------------------------------------------------- ações

  const guardar = useCallback(async () => {
    const m = motorRef.current;
    if (!m || m.vazio) {
      // sem texto: o app responde como brinquedo — som de "hã-hã" + balanço
      tocar("vazio");
      setNegacao((n) => n + 1);
      return;
    }

    // Guardar sem mudança nova não duplica: só comemora de novo.
    if (!sujo.current && idGaleria.current) {
      tocar("salvar");
      setConfete((c) => c + 1);
      mostrarAviso("Já está guardado! ⭐");
      return;
    }

    const svg = svgDaPagina();
    const miniatura = await m.miniatura(svg, 320);
    idGaleria.current = await guardarNaGaleria(
      { ...m.paraDesenho("novo", marcarCriacao()), miniatura },
      idGaleria.current ?? undefined,
    );
    sujo.current = false;
    void salvarRascunho(rascunhoAtual(m)); // persiste o vínculo com a galeria
    tocar("salvar");
    setConfete((c) => c + 1);
    mostrarAviso("Guardado! ⭐");
  }, [marcarCriacao, rascunhoAtual, svgDaPagina]);

  const trocarPagina = useCallback(
    async (slug: string | undefined) => {
      const m = motorRef.current;
      setSeletorAberto(false);
      if (!m) return;

      // Nada se perde ao trocar de desenho: o que estava na tela vai para a
      // galeria antes de limpar — mas só se tiver algo NOVO (o que já está
      // guardado não vira segunda cópia).
      if (!m.vazio && (sujo.current || !idGaleria.current)) {
        const svg = svgDaPagina();
        const miniatura = await m.miniatura(svg, 320);
        await guardarNaGaleria(
          { ...m.paraDesenho("novo", marcarCriacao()), miniatura },
          idGaleria.current ?? undefined,
        );
      }

      m.limparTudo();
      m.definirLivroColorir(slug);
      aplicarPaginaColorir(m, slug);
      criadoEm.current = Date.now();
      idGaleria.current = null;
      sujo.current = false;
      // colorir combina com o balde na mão; papel em branco, com o pincel
      setFerramenta((f) => ({ ...f, modo: slug ? "balde" : "pincel" }));
      void salvarRascunho(rascunhoAtual(m));
      tocar("abrir");
    },
    [aplicarPaginaColorir, marcarCriacao, rascunhoAtual, svgDaPagina],
  );

  const abrirDaGaleria = useCallback(
    (desenho: Desenho) => {
      const m = motorRef.current;
      if (!m) return;
      criadoEm.current = desenho.criadoEm;
      // continuar um desenho guardado EDITA o original, não cria cópia
      idGaleria.current = desenho.id;
      sujo.current = false;
      m.carregar(desenho);
      aplicarPaginaColorir(m, desenho.colorir);
      setGaleriaAberta(false);
      void salvarRascunho(rascunhoAtual(m));
      tocar("abrir");
    },
    [aplicarPaginaColorir, rascunhoAtual],
  );

  const compartilharLiberado = useCallback(async () => {
    const m = motorRef.current;
    const alvo = portao;
    setPortao(null);
    if (!m || !alvo) return;

    let dataUrl: string;
    if (alvo === "atual") {
      dataUrl = await m.exportarPNG(svgDaPagina(), 2);
    } else {
      // Desenho da galeria: re-renderiza das operações em alta resolução.
      // A miniatura de 320px é só para a grade — no WhatsApp da família tem de
      // chegar a versão nítida.
      const paginaSalva = buscarPagina(alvo.colorir);
      const svg = paginaSalva
        ? paginaParaSvg(paginaSalva, regioesDeOperacoes(alvo.operacoes))
        : undefined;
      dataUrl = await renderizarDesenhoPNG(alvo, {
        svgLinhas: svg,
        imagemSrc: buscarImagem(alvo.colorir)?.src,
        escala: 2,
      });
    }

    const r = await compartilharPng(dataUrl);
    if (r === "baixado") mostrarAviso("Salvo nas suas fotos 📥");
    if (r === "falhou") mostrarAviso("Não conseguimos enviar agora");
  }, [portao, svgDaPagina]);

  const { podeDesfazer, podeRefazer, regioes } = estado;
  const usarBalde = ferramenta.modo === "balde";

  // Ações do motor em callbacks estáveis: o motor é imperativo e mora num ref,
  // que só pode ser tocado fora do render.
  // Desfazer/refazer TAMBÉM regravam o rascunho: sem isso, desfazer e fechar o
  // app fazia o traço desfeito reaparecer na próxima abertura.
  const desfazer = useCallback(() => {
    motorRef.current?.desfazer();
    aoOperar();
  }, [aoOperar]);
  const refazer = useCallback(() => {
    motorRef.current?.refazer();
    aoOperar();
  }, [aoOperar]);
  const apagarTudo = useCallback(() => {
    motorRef.current?.limparTudo();
    tocar("apagar");
    aoOperar();
    setGaveta(null);
  }, [aoOperar]);
  const trocarFundo = useCallback(
    (cor: string) => {
      motorRef.current?.aplicar({ kind: "fundo", cor });
      aoOperar();
      setGaveta(null);
    },
    [aoOperar],
  );
  const pintarRegiao = useCallback(
    (regiao: string) => {
      motorRef.current?.aplicar({ kind: "regiao", regiao, cor: ferramenta.cor });
      tocar("balde");
      aoOperar();
    },
    [aoOperar, ferramenta.cor],
  );
  const abrirCarimbos = useCallback(() => setGaveta("carimbos"), []);
  const abrirFormas = useCallback(() => setGaveta("formas"), []);
  const abrirEspelho = useCallback(() => setGaveta("espelho"), []);
  const abrirFundos = useCallback(() => setGaveta("fundos"), []);
  const recarregarGaleria = useCallback(async () => {
    setDesenhosSalvos(await listarGaleria());
  }, []);
  const abrirGaleria = useCallback(async () => {
    setGaveta(null);
    setDesenhosSalvos(await listarGaleria());
    setGaleriaAberta(true);
  }, []);

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] deitado:h-12">
        <Link
          href="/"
          aria-label="voltar para os jogos"
          onPointerDown={() => feedback("toque")}
          className="bolha h-14 min-h-14 w-14 min-w-14 overflow-hidden bg-manu-rosa/40 ring-2 ring-manu-rosa"
        >
          <Mascote pose="rosto" tamanho={56} className="h-14 w-14 object-cover" />
        </Link>

        <h1 className="hidden font-titulo text-xl text-manu-cacau sm:block">{`Ateliê ${daMascote()}`}</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="escolher desenho para colorir"
            onPointerDown={() => feedback("toque")}
            onClick={() => setSeletorAberto(true)}
            className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
          >
            <Icone nome="livro" tamanho={30} />
          </button>
          <button
            type="button"
            aria-label={mudo ? "ligar o som" : "desligar o som"}
            onClick={() => {
              definirMudo(!mudo);
              if (mudo) tocar("toque"); // acabou de LIGAR o som: confirma sonoramente
            }}
            className="bolha min-h-14 min-w-14 bg-manu-papel ring-2 ring-manu-cacau/10"
          >
            <Icone nome={mudo ? "mudo" : "som"} tamanho={30} />
          </button>
          <button
            type="button"
            aria-label="guardar meu desenho"
            onPointerDown={() => feedback("toque")}
            onClick={() => void guardar()}
            className={`bolha min-h-14 min-w-14 bg-manu-sol ring-2 ring-manu-sol-forte ${
              negacao > 0 ? "anima-nao" : ""
            }`}
            // key força a animação a recomeçar a cada tentativa em vazio
            key={`estrela-${negacao}`}
          >
            <Icone nome="estrela" tamanho={30} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col deitado:flex-row">
      <TelaDesenho
        ferramenta={ferramenta}
        aoMotorPronto={aoMotorPronto}
        aoOperar={aoOperar}
        colorirClicavel={Boolean(pagina) && usarBalde}
        camadaColorir={
          paginaImg ? (
            // As linhas em si são a camada canvas "linhas" do motor (papel
            // recortado em alpha) — aqui fica só o rótulo para leitor de tela.
            // O antigo <img> com mix-blend-mode foi aposentado: no Safari do
            // iPhone o blend falha sobre canvas e a folha branca cobria a
            // pintura — o balde pintava e a criança não via a tinta.
            <span
              role="img"
              aria-label={`desenho para colorir: ${paginaImg.nome}`}
              className="absolute inset-0"
            />
          ) : pagina ? (
            <LivroColorir
              pagina={pagina}
              cores={regioes}
              clicavel={Boolean(pagina) && usarBalde}
              aoTocarRegiao={pintarRegiao}
            />
          ) : null
        }
      />

      <BarraCores
        cor={ferramenta.cor}
        aoEscolher={(hex) => setFerramenta((f) => ({ ...f, cor: hex }))}
        aoAbrirExtras={() => setGaveta("cores")}
      />
      </div>

      <BarraFerramentas
        ferramenta={ferramenta}
        podeDesfazer={podeDesfazer}
        aoTrocarModo={(modo) =>
          setFerramenta((f) => ({
            ...f,
            modo,
            pincel: modo === "pincel" && f.pincel === "borracha" ? "pincel" : f.pincel,
          }))
        }
        aoUsarBorracha={() => setFerramenta((f) => ({ ...f, modo: "pincel", pincel: "borracha" }))}
        aoAbrirPinceis={() => setGaveta("pinceis")}
        aoAbrirMais={() => {
          marcarDescobriuMais();
          setGaveta("mais");
        }}
        aoDesfazer={desfazer}
      />

      {/* ------------------------------------------------------------ gavetas */}

      <Bandeja aberta={gaveta === "cores"} onFechar={() => setGaveta(null)} titulo="Todas as cores">
        <GradeCoresExtras
          cor={ferramenta.cor}
          aoEscolher={(hex) => {
            setFerramenta((f) => ({ ...f, cor: hex }));
            setGaveta(null);
          }}
        />
      </Bandeja>

      <Bandeja aberta={gaveta === "pinceis"} onFechar={() => setGaveta(null)} titulo="Pincéis">
        <div className="w-full space-y-3">
          <div className="flex flex-wrap justify-center gap-3">
            {[...PINCEIS_BASICOS, ...PINCEIS_ESPECIAIS].map((p) => (
              <button
                key={p.tipo}
                type="button"
                aria-label={p.nome}
                aria-pressed={ferramenta.pincel === p.tipo}
                onPointerDown={() => feedback("pincel")}
                onClick={() => {
                  setFerramenta((f) => ({ ...f, modo: "pincel", pincel: p.tipo }));
                  setGaveta(null);
                }}
                className={`bolha min-h-16 min-w-16 text-3xl ${
                  ferramenta.pincel === p.tipo
                    ? "bg-manu-papel ring-4 ring-manu-rosa-forte"
                    : "bg-manu-nuvem ring-2 ring-manu-cacau/10"
                }`}
              >
                {p.emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 border-t border-manu-cacau/10 pt-3">
            {ESPESSURAS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`espessura ${e}`}
                aria-pressed={ferramenta.espessura === e}
                onPointerDown={() => feedback("toque")}
                onClick={() => {
                  setFerramenta((f) => ({ ...f, espessura: e }));
                  setGaveta(null);
                }}
                className={`grid h-16 w-16 place-items-center rounded-full ${
                  ferramenta.espessura === e
                    ? "bg-manu-papel ring-4 ring-manu-rosa-forte"
                    : "bg-manu-nuvem ring-2 ring-manu-cacau/10"
                }`}
              >
                <span
                  className="block rounded-full bg-manu-cacau"
                  style={{ width: Math.min(40, e), height: Math.min(40, e) }}
                />
              </button>
            ))}
          </div>
        </div>
      </Bandeja>

      <Bandeja aberta={gaveta === "carimbos"} onFechar={() => setGaveta(null)} titulo="Carimbos">
        {CARIMBOS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`carimbo ${c}`}
            aria-pressed={ferramenta.modo === "carimbo" && ferramenta.carimbo === c}
            onPointerDown={() => feedback("carimbo")}
            onClick={() => {
              setFerramenta((f) => ({ ...f, modo: "carimbo", carimbo: c }));
              setGaveta(null);
            }}
            className="bolha min-h-16 min-w-16 bg-manu-nuvem text-3xl ring-2 ring-manu-cacau/10"
          >
            {c}
          </button>
        ))}
      </Bandeja>

      <Bandeja aberta={gaveta === "formas"} onFechar={() => setGaveta(null)} titulo="Formas">
        {FORMAS.map((f) => (
          <button
            key={f.tipo}
            type="button"
            aria-label={f.nome}
            aria-pressed={ferramenta.modo === "forma" && ferramenta.forma === f.tipo}
            onPointerDown={() => feedback("pincel")}
            onClick={() => {
              setFerramenta((atual) => ({ ...atual, modo: "forma", forma: f.tipo }));
              setGaveta(null);
            }}
            className="bolha min-h-16 min-w-16 bg-manu-nuvem text-3xl ring-2 ring-manu-cacau/10"
          >
            {f.emoji}
          </button>
        ))}
      </Bandeja>

      <Bandeja
        aberta={gaveta === "espelho"}
        onFechar={() => setGaveta(null)}
        titulo="Espelho mágico"
      >
        {SIMETRIAS.map((s) => (
          <button
            key={s.valor}
            type="button"
            aria-label={s.nome}
            aria-pressed={ferramenta.simetria === s.valor}
            onPointerDown={() => feedback("pincel")}
            onClick={() => {
              setFerramenta((f) => ({ ...f, simetria: s.valor }));
              setGaveta(null);
            }}
            className={`bolha min-h-16 min-w-16 text-3xl ${
              ferramenta.simetria === s.valor
                ? "bg-manu-papel ring-4 ring-manu-rosa-forte"
                : "bg-manu-nuvem ring-2 ring-manu-cacau/10"
            }`}
          >
            {s.emoji}
          </button>
        ))}
      </Bandeja>

      <Bandeja aberta={gaveta === "fundos"} onFechar={() => setGaveta(null)} titulo="Cor do papel">
        {FUNDOS.map((f) => (
          <button
            key={f.hex}
            type="button"
            aria-label={`papel ${f.nome}`}
            onPointerDown={() => feedback("balde")}
            onClick={() => trocarFundo(f.hex)}
            className="h-16 w-16 rounded-full ring-2 ring-manu-cacau/20"
            style={{ backgroundColor: f.hex }}
          />
        ))}
      </Bandeja>

      <Bandeja aberta={gaveta === "mais"} onFechar={() => setGaveta(null)} titulo="Mais coisas">
        <div className="grid w-full grid-cols-4 gap-3">
          <BotaoGaveta rotulo="carimbos" emoji="🌟" onClick={abrirCarimbos} />
          <BotaoGaveta rotulo="formas" emoji="⭕" onClick={abrirFormas} />
          <BotaoGaveta rotulo="espelho mágico" emoji="🦋" onClick={abrirEspelho} />
          <BotaoGaveta rotulo="cor do papel" emoji="🎨" onClick={abrirFundos} />
          <BotaoGaveta
            rotulo="meus desenhos"
            icone={<Icone nome="galeria" />}
            onClick={() => void abrirGaleria()}
          />
          <BotaoGaveta
            rotulo="refazer"
            icone={<Icone nome="refazer" />}
            onClick={refazer}
            inativo={!podeRefazer}
          />

          <BotaoSegurar
            rotulo="segure para apagar tudo"
            duracao={2000}
            className="aspect-square min-h-16 w-full !bg-manu-rosa/30 text-3xl"
            onConfirmar={apagarTudo}
          >
            <Icone nome="lixeira" />
          </BotaoSegurar>

          <button
            type="button"
            aria-label="enviar este desenho para um adulto"
            onPointerDown={() => feedback("toque")}
            onClick={() => {
              setGaveta(null);
              setPortao("atual");
            }}
            className="bolha aspect-square min-h-16 w-full bg-manu-ceu-claro ring-2 ring-manu-cacau/10"
          >
            <Icone nome="enviar" />
          </button>
        </div>
      </Bandeja>

      {/* ------------------------------------------------------------ telas cheias */}

      <SeletorColorir
        aberto={seletorAberto}
        slugAtual={pagina?.slug}
        aoEscolher={(slug) => void trocarPagina(slug)}
        aoFechar={() => setSeletorAberto(false)}
      />

      <Galeria
        aberta={galeriaAberta}
        desenhos={desenhosSalvos}
        aoFechar={() => setGaleriaAberta(false)}
        aoAbrir={abrirDaGaleria}
        aoCompartilhar={(d) => setPortao(d)}
        aoRecarregar={() => void recarregarGaleria()}
      />

      <PortaoParental
        aberto={portao !== null}
        onLiberado={() => void compartilharLiberado()}
        onCancelar={() => setPortao(null)}
      />

      <Confete gatilho={confete} />

      {aviso ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[55] flex justify-center px-4">
          <p className="anima-entrada flex items-center gap-2 rounded-full bg-manu-cacau/90 px-5 py-3 font-titulo text-lg text-manu-nuvem">
            {aviso}
          </p>
        </div>
      ) : null}
    </main>
  );
}
