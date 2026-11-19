'use client';

import { AlertTriangle, Check, LifeBuoy, MessageSquareText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSessao } from '@/lib/auth/AuthProvider';
import { comentarRelato, configurarRelatos, enviarFila, EVENTO_AVISO, relatarErro, type AvisoErro } from '@/lib/erros/relatar';
import { abaDeVersaoAntiga, ehVersaoVelha, tratarVersaoVelha } from '@/lib/erros/versaoNova';

/**
 * Spec 098. `CapturaErros` fica na raiz do app (inclusive login e página principal): pega erro de script, promessa sem
 * tratamento e falha da API, manda à equipe Malhet e, quando a pessoa percebeu a falha, mostra o aviso com o código e a
 * opção de contar o que estava fazendo. `RelatarProblema` é o relato feito pela própria pessoa (menu da conta).
 */
export function CapturaErros() {
  const { getToken } = useSessao();
  const [aviso, setAviso] = useState<AvisoErro | null>(null);
  useEffect(() => { configurarRelatos(getToken); }, [getToken]);
  useEffect(() => {
    const erro = (e: ErrorEvent) => {
      const relatar = () => relatarErro({ tipo: 'js', mensagem: e.message || String(e.error ?? ''), pilha: e.error?.stack });
      if (ehVersaoVelha(e.message) || ehVersaoVelha(e.error)) { void tratarVersaoVelha().then((vai) => { if (!vai) relatar(); }); return; } // deploy novo
      relatar();
    };
    const promessa = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string; name?: string; status?: number } | undefined;
      if (r && typeof r.status === 'number') return; // ApiError: a própria chamada já relatou se foi do servidor
      if (ehVersaoVelha(r ?? String(e.reason ?? ''))) { // deploy novo (specs 109/113)
        void tratarVersaoVelha().then((vai) => { if (!vai) relatarErro({ tipo: 'promessa', mensagem: r?.message ?? String(e.reason ?? ''), pilha: r?.stack }); });
        return;
      }
      relatarErro({ tipo: 'promessa', mensagem: r?.message ?? String(e.reason ?? ''), pilha: r?.stack });
    };
    const mostrar = (e: Event) => setAviso((e as CustomEvent<AvisoErro>).detail);
    const online = () => { void enviarFila(); };
    window.addEventListener('error', erro);
    window.addEventListener('unhandledrejection', promessa);
    window.addEventListener(EVENTO_AVISO, mostrar);
    window.addEventListener('online', online);
    void enviarFila(); // o que ficou guardado sem internet
    // spec 113: qualquer página (login, cadastro, link dos líderes…) — ao voltar para a aba, build novo no ar = recarrega
    // antes do clique cair num pedaço que não existe mais. Não recarrega com a pessoa digitando.
    let ultimaConferencia = 0;
    const voltou = () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaConferencia < 60_000) return;
      ultimaConferencia = Date.now();
      void abaDeVersaoAntiga().then((antiga) => {
        const el = document.activeElement;
        if (antiga && !(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) window.location.reload();
      });
    };
    document.addEventListener('visibilitychange', voltou);
    return () => {
      document.removeEventListener('visibilitychange', voltou);
      window.removeEventListener('error', erro);
      window.removeEventListener('unhandledrejection', promessa);
      window.removeEventListener(EVENTO_AVISO, mostrar);
      window.removeEventListener('online', online);
    };
  }, []);
  if (!aviso) return null;
  return createPortal(<AvisoDeErro key={aviso.idLocal} aviso={aviso} onFechar={() => setAviso(null)} />, document.body);
}

function AvisoDeErro({ aviso, onFechar }: { aviso: AvisoErro; onFechar: () => void }) {
  const [contando, setContando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // some sozinho em 12 s, a menos que a pessoa esteja escrevendo
  useEffect(() => {
    if (contando) return;
    const t = setTimeout(onFechar, enviado ? 3500 : 12000);
    return () => clearTimeout(t);
  }, [contando, enviado, onFechar]);
  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-[80] mx-auto flex max-w-[400px] flex-col gap-2.5 rounded-m-lg border border-m-stroke-subtle bg-m-surface-raised p-4 font-[Figtree,system-ui,sans-serif] text-m-text-primary shadow-m-md sm:inset-x-auto sm:bottom-6 sm:right-6 print:hidden">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-m-warning-subtle text-m-warning"><AlertTriangle size={16} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <b className="block text-[14px] leading-5">{enviado ? 'Obrigado, recebemos' : aviso.titulo}</b>
          <p className="text-[13px] leading-5 text-m-text-tertiary">
            {enviado ? 'Seu relato foi junto com o erro.' : <>A equipe Malhet já recebeu o aviso. Código <b className="font-semibold text-m-text-primary">{aviso.codigo}</b>.</>}
          </p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={16} /></button>
      </div>
      {!enviado && (contando
        ? <FormComentario idLocal={aviso.idLocal} onEnviado={() => { setContando(false); setEnviado(true); }} onCancelar={() => setContando(false)} />
        : <button type="button" onClick={() => setContando(true)} className="inline-flex h-9 items-center gap-2 self-start rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary hover:bg-m-surface-hover">
            <MessageSquareText size={15} aria-hidden="true" /> Contar o que eu estava fazendo
          </button>)}
    </div>
  );
}

/** Texto livre da pessoa: vai junto do relato já enviado. */
export function FormComentario({ idLocal, onEnviado, onCancelar, autoFoco = true }: { idLocal: string; onEnviado: () => void; onCancelar?: () => void; autoFoco?: boolean }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFoco) ref.current?.focus(); }, [autoFoco]);
  return (
    <form className="flex flex-col gap-2" onSubmit={async (e) => {
      e.preventDefault();
      if (!texto.trim()) return;
      setEnviando(true); setErro(null);
      try { await comentarRelato(idLocal, texto.trim()); onEnviado(); } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
    }}>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-m-text-secondary">
        O que você estava fazendo?
        <textarea ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000}
          placeholder="Ex.: cliquei em Emitir na programação da semana 47"
          className="rounded-m-md border border-m-stroke bg-m-surface-field px-3 py-2 text-[14px] text-m-text-primary placeholder:text-m-text-muted focus:outline-none focus:ring-2 focus:ring-m-accent" />
      </label>
      <span className="text-[11.5px] text-m-text-muted">Não escreva CPF, telefone ou outros dados pessoais.</span>
      {erro && <span className="text-[12.5px] text-m-danger">{erro}</span>}
      <div className="flex gap-2">
        <button type="submit" disabled={enviando || !texto.trim()} className="inline-flex h-9 items-center rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent disabled:opacity-50">
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
        {onCancelar && <button type="button" onClick={onCancelar} className="h-9 rounded-full px-3 text-[13px] text-m-text-secondary hover:bg-m-surface-hover">Agora não</button>}
      </div>
    </form>
  );
}

/** "Relatar um problema": a pessoa conta o que não funcionou; a tela de onde abriu vai junto. */
export function RelatarProblema({ onFechar }: { onFechar: () => void }) {
  const [texto, setTexto] = useState('');
  const [codigo, setCodigo] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 font-[Figtree,system-ui,sans-serif] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="relatar-titulo">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex w-full max-w-[440px] flex-col gap-3 rounded-m-xl border border-m-stroke-subtle bg-m-surface-raised p-5 text-m-text-primary">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-m-accent-subtle text-m-accent"><LifeBuoy size={18} aria-hidden="true" /></span>
          <div className="flex-1">
            <h2 id="relatar-titulo" className="text-[17px] font-semibold leading-6">Relatar um problema</h2>
            <p className="text-[13px] text-m-text-tertiary">Vai direto para a equipe Malhet, com a tela em que você está.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full text-m-text-muted hover:bg-m-surface-hover"><X size={16} /></button>
        </div>
        {codigo ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-[14px]"><Check size={18} className="text-m-success" aria-hidden="true" /> Recebido. Código <b>{codigo}</b>.</p>
            <p className="text-[13px] text-m-text-tertiary">Se falar com a equipe, cite o código. Sem internet, o relato fica guardado e é enviado quando o sinal voltar.</p>
            <button type="button" onClick={onFechar} className="h-10 self-start rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent">Fechar</button>
          </div>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={(e) => {
            e.preventDefault();
            const t = texto.trim();
            // a própria frase vira a mensagem: relatos diferentes não se juntam num grupo só
            const a = relatarErro({ tipo: 'manual', mensagem: t.slice(0, 200), comentario: t });
            if (a) setCodigo(a.codigo);
          }}>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-m-text-secondary">
              O que não funcionou?
              <textarea ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={1000}
                placeholder="Ex.: a foto não sobe na ocorrência; o botão Emitir não responde"
                className="rounded-m-md border border-m-stroke bg-m-surface-field px-3 py-2 text-[14px] text-m-text-primary placeholder:text-m-text-muted focus:outline-none focus:ring-2 focus:ring-m-accent" />
            </label>
            <span className="text-[11.5px] text-m-text-muted">Não escreva CPF, telefone ou outros dados pessoais.</span>
            <button type="submit" disabled={!texto.trim()} className="mt-1 h-10 self-start rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent disabled:opacity-50">Enviar relato</button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
