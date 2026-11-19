'use client';

import { ArrowRightLeft, LogOut, Search, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { type Achado, type Destino, type EquipePortal, type Membro, type MinhasEquipes, type Sessao, guardarToken, lerToken, portal } from '@/lib/portal/api';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const campo = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[16px] text-m-text-primary outline-none focus:border-m-accent-strong focus:ring-2 focus:ring-m-accent/30';
const primario = 'h-12 w-full rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent disabled:opacity-40';
const secundario = 'h-11 rounded-full border border-m-stroke px-4 text-[14px] font-semibold text-m-text-secondary';

/**
 * Portal do líder (spec 111): o encarregado abre o link da obra (grupo do WhatsApp), entra com a matrícula e a senha
 * (a primeira é 123456 e ele cria a dele), confere a equipe que está no Malhet, informa quem foi para outro encarregado
 * e traz quem está com ele pela matrícula ou pelo nome. Cada mudança vai para o histórico e avisa o Planejamento.
 */
export function PortalLider({ codigo }: { codigo: string }) {
  const [obra, setObra] = useState<string | null>(null);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'entrar' | 'senha' | 'equipe'>('entrar');
  const [dados, setDados] = useState<MinhasEquipes | null>(null);

  const carregar = useCallback(async () => {
    try { setDados(await portal<MinhasEquipes>(codigo, '/equipes')); setEtapa('equipe'); } catch (e) {
      const st = (e as { status?: number; campo?: string }).campo;
      if (st === 'sessao') { guardarToken(codigo, null); setEtapa('entrar'); } else toast.error((e as Error).message);
    }
  }, [codigo]);

  useEffect(() => {
    portal<{ obra: string }>(codigo, '').then((r) => setObra(r.obra)).catch((e) => setErroLink((e as Error).message));
    if (lerToken(codigo)) void carregar();
  }, [codigo, carregar]);

  const sair = () => { guardarToken(codigo, null); setDados(null); setEtapa('entrar'); };

  return (
    <main className="min-h-dvh bg-m-surface font-[Figtree,system-ui,sans-serif] text-m-text-primary">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.48px] text-m-text-muted">
              <span className="h-2 w-2 rounded-[2px] bg-m-accent" aria-hidden="true" />{obra ?? 'Malhet'}
            </span>
            <h1 className="text-[24px] font-semibold leading-8">{dados ? `Olá, ${dados.nome.split(' ')[0]}` : 'Minha equipe'}</h1>
            {dados && <p className="text-[13px] text-m-text-tertiary">{[dados.matricula, dados.funcao].filter(Boolean).join(' · ')}</p>}
          </div>
          {dados && <button type="button" onClick={sair} className="flex h-10 items-center gap-1.5 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary"><LogOut size={15} aria-hidden="true" /> Sair</button>}
        </header>
        {erroLink ? <Aviso texto={erroLink} />
          : etapa === 'entrar' ? <Entrar codigo={codigo} onEntrou={(r) => { if (r.trocar_senha) setEtapa('senha'); else void carregar(); }} />
            : etapa === 'senha' ? <CriarSenha codigo={codigo} onPronto={() => void carregar()} />
              : dados ? <Equipes codigo={codigo} dados={dados} recarregar={carregar} /> : <Esqueleto className="h-40 w-full" />}
        <p className="pt-2 text-center text-[12px] text-m-text-muted">Malhet · as mudanças vão para o Planejamento da obra</p>
      </div>
    </main>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <p role="alert" className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4 text-[15px]">{texto}</p>;
}

function Entrar({ codigo, onEntrou }: { codigo: string; onEntrou: (r: Sessao) => void }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const r = await portal<Sessao>(codigo, '/entrar', { method: 'POST', body: { matricula, senha } });
      guardarToken(codigo, r.token);
      onEntrou(r);
    } catch (er) { setErro((er as Error).message); } finally { setEnviando(false); }
  };
  return (
    <form onSubmit={entrar} className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
      <p className="text-[15px] text-m-text-secondary">Confira quem está na sua equipe no Malhet e avise quem saiu ou chegou.</p>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Matrícula
        <input className={campo} inputMode="numeric" autoComplete="username" required value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="ex.: 115532" />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Senha
        <input className={campo} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      <p className="text-[13px] text-m-text-tertiary">Primeiro acesso: a senha é <b className="text-m-text-primary">123456</b> e em seguida você cria a sua.</p>
      {erro && <p role="alert" className="text-[14px] text-m-danger">{erro}</p>}
      <button type="submit" className={primario} disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}

function CriarSenha({ codigo, onPronto }: { codigo: string; onPronto: () => void }) {
  const [nova, setNova] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const r = await portal<Sessao>(codigo, '/senha', { method: 'POST', body: { nova, repetida } });
      guardarToken(codigo, r.token);
      toast.success('Senha criada');
      onPronto();
    } catch (er) { setErro((er as Error).message); } finally { setEnviando(false); }
  };
  return (
    <form onSubmit={salvar} className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
      <h2 className="text-[18px] font-semibold">Crie a sua senha</h2>
      <p className="text-[14px] text-m-text-tertiary">De 6 a 20 caracteres, diferente de 123456. Se esquecer, o Planejamento volta para 123456.</p>
      <input className={campo} type="password" autoComplete="new-password" aria-label="Nova senha" placeholder="Nova senha" required value={nova} onChange={(e) => setNova(e.target.value)} />
      <input className={campo} type="password" autoComplete="new-password" aria-label="Repita a senha" placeholder="Repita a senha" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      {erro && <p role="alert" className="text-[14px] text-m-danger">{erro}</p>}
      <button type="submit" className={primario} disabled={enviando}>{enviando ? 'Salvando…' : 'Criar senha e continuar'}</button>
    </form>
  );
}

function Equipes({ codigo, dados, recarregar }: { codigo: string; dados: MinhasEquipes; recarregar: () => Promise<void> }) {
  const [sel, setSel] = useState(dados.equipes[0]?.id ?? 0);
  const [saindo, setSaindo] = useState<Membro | null>(null);
  const [trazendo, setTrazendo] = useState(false);
  const equipe = dados.equipes.find((e) => e.id === sel) ?? dados.equipes[0];
  if (!equipe) return <Aviso texto="Você ainda não lidera nenhuma equipe no Malhet. Fale com o Planejamento da obra." />;
  return (
    <>
      {dados.equipes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Suas equipes">
          {dados.equipes.map((e) => (
            <button key={e.id} type="button" role="tab" aria-selected={e.id === equipe.id} onClick={() => setSel(e.id)}
              className={`h-10 rounded-full border px-4 text-[14px] font-semibold ${e.id === equipe.id ? 'border-m-accent-strong bg-m-accent-strong text-m-on-accent' : 'border-m-stroke text-m-text-secondary'}`}>{e.nome}</button>
          ))}
        </div>
      )}
      <section className="flex flex-col rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised">
        <div className="flex items-center gap-2 border-b border-m-stroke-subtle px-4 py-3">
          <Users size={18} className="text-m-accent" aria-hidden="true" />
          <div className="flex-1"><b className="text-[16px]">{equipe.nome}</b><span className="block text-[12.5px] text-m-text-muted">{equipe.membros.length} pessoa(s) no Malhet</span></div>
        </div>
        <ul className="flex flex-col">
          {equipe.membros.map((m) => (
            <li key={m.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle px-4 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{m.nome}</span>
                <span className="block text-[12.5px] text-m-text-muted">{[m.matricula ?? m.cracha, m.funcao].filter(Boolean).join(' · ')}</span></div>
              <button type="button" onClick={() => setSaindo(m)} className="h-10 shrink-0 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary">Não está comigo</button>
            </li>
          ))}
          {!equipe.membros.length && <li className="px-4 py-4 text-[14px] text-m-text-muted">Ninguém na equipe ainda. Traga quem está com você.</li>}
        </ul>
      </section>
      <button type="button" onClick={() => setTrazendo(true)} className={`${primario} flex items-center justify-center gap-2`}><UserPlus size={18} aria-hidden="true" /> Trazer alguém para a equipe</button>
      {saindo && <Transferir codigo={codigo} equipe={equipe} membro={saindo} destinos={dados.destinos} onFechar={() => setSaindo(null)} onFeito={async () => { setSaindo(null); await recarregar(); }} />}
      {trazendo && <Trazer codigo={codigo} equipe={equipe} onFechar={() => setTrazendo(false)} onFeito={async () => { await recarregar(); }} />}
    </>
  );
}

function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 font-[Figtree,system-ui,sans-serif]" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex max-h-[90dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-raised p-4 pb-[max(env(safe-area-inset-bottom),16px)] text-m-text-primary">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[18px] font-semibold leading-6">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Transferir({ codigo, equipe, membro, destinos, onFechar, onFeito }: {
  codigo: string; equipe: EquipePortal; membro: Membro; destinos: Destino[]; onFechar: () => void; onFeito: () => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [para, setPara] = useState<number | 'nao-sei' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const lista = useMemo(() => {
    const t = semAcento(busca.trim());
    return t ? destinos.filter((d) => semAcento(`${d.encarregado} ${d.nome}`).includes(t)) : destinos;
  }, [busca, destinos]);
  const enviar = async () => {
    setEnviando(true);
    try {
      await portal(codigo, '/transferir', { method: 'POST', body: { equipe_id: equipe.id, cracha: membro.cracha, para_equipe_id: para === 'nao-sei' ? null : para } });
      const d = destinos.find((x) => x.id === para);
      toast.success(d ? `${membro.nome.split(' ')[0]} foi para a equipe de ${d.encarregado}` : `${membro.nome.split(' ')[0]} saiu da sua equipe`);
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Folha titulo={`Para onde foi ${membro.nome.split(' ')[0]}?`} onFechar={onFechar}>
      <p className="text-[14px] text-m-text-tertiary">{membro.nome} não está mais com você. Escolha o encarregado que está com ele agora.</p>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do encarregado ou equipe" aria-label="Buscar encarregado"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      <ul className="flex max-h-[42dvh] flex-col overflow-y-auto">
        {lista.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => setPara(d.id)} aria-pressed={para === d.id}
              className={`flex min-h-[56px] w-full flex-col items-start justify-center rounded-[12px] px-3 text-left ${para === d.id ? 'bg-m-accent-subtle ring-2 ring-m-accent-strong' : ''}`}>
              <span className="text-[15px] font-medium">{d.encarregado}</span><span className="text-[12.5px] text-m-text-muted">{d.nome}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="px-3 py-3 text-[14px] text-m-text-muted">Nenhum encarregado com esse nome.</li>}
      </ul>
      <button type="button" onClick={() => setPara('nao-sei')} aria-pressed={para === 'nao-sei'}
        className={`h-12 rounded-[12px] border px-3 text-left text-[15px] ${para === 'nao-sei' ? 'border-m-accent-strong bg-m-accent-subtle font-semibold' : 'border-m-stroke'}`}>Não sei para onde foi / saiu da obra</button>
      <button type="button" className={`${primario} flex items-center justify-center gap-2`} disabled={para === null || enviando} onClick={enviar}>
        <ArrowRightLeft size={18} aria-hidden="true" /> {enviando ? 'Enviando…' : 'Informar'}
      </button>
    </Folha>
  );
}

function Trazer({ codigo, equipe, onFechar, onFeito }: { codigo: string; equipe: EquipePortal; onFechar: () => void; onFeito: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setAchados(null); return; }
    const h = setTimeout(() => {
      portal<Achado[]>(codigo, `/buscar?q=${encodeURIComponent(t)}`).then(setAchados).catch((e) => toast.error((e as Error).message));
    }, 300);
    return () => clearTimeout(h);
  }, [q, codigo]);
  const trazer = async (a: Achado) => {
    setEnviando(a.cracha);
    try {
      const r = await portal<{ saiu_de: string[] }>(codigo, '/incluir', { method: 'POST', body: { equipe_id: equipe.id, cracha: a.cracha } });
      toast.success(`${a.nome.split(' ')[0]} está na sua equipe${r.saiu_de.length ? ` (saiu da ${r.saiu_de.join(', ')})` : ''}`);
      setQ(''); setAchados(null);
      await onFeito();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(null); }
  };
  const naEquipe = new Set(equipe.membros.map((m) => m.cracha));
  return (
    <Folha titulo={`Trazer para a ${equipe.nome}`} onFechar={onFechar}>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula ou nome" aria-label="Matrícula ou nome do colaborador"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      <ul className="flex flex-col">
        {achados?.map((a) => (
          <li key={a.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle py-2.5">
            <div className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{a.nome}</span>
              <span className="block text-[12.5px] text-m-text-muted">{[a.matricula, a.funcao].filter(Boolean).join(' · ')}{a.equipe ? ` · hoje na ${a.equipe}` : ' · sem equipe'}</span></div>
            {naEquipe.has(a.cracha)
              ? <span className="text-[13px] text-m-text-muted">já está</span>
              : <button type="button" className={secundario} disabled={enviando === a.cracha} onClick={() => trazer(a)}>{enviando === a.cracha ? '…' : 'Trazer'}</button>}
          </li>
        ))}
        {achados && !achados.length && <li className="py-3 text-[14px] text-m-text-muted">Ninguém no efetivo com esse nome ou matrícula. Avise o Planejamento.</li>}
      </ul>
    </Folha>
  );
}
