'use client';

import { ArrowRightLeft, Camera, FolderOpen, LogOut, Search, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { definirLogoCarimbo } from '@/components/Mobile/Fotos';
import { FotosAtividade } from '@/components/PortalLider/FotosAtividade';
import { ProjetosPortal } from '@/components/PortalLider/ProjetosPortal';
import { Folha } from '@/components/PortalLider/Folha';
import { API_URL } from '@/lib/api/client';
import { type Achado, type Destino, type EquipePortal, type Membro, type MinhasEquipes, type ObraParaEscolher, type PedidoEquipe, type PerfilPortal, type RotaPortal, type Sessao, enderecoDoPerfil, guardarObra, guardarRota, guardarToken, lerObra, lerRota, lerToken, portal, raizDoPerfil, usarPerfil } from '@/lib/portal/api';
import { Apontador } from '@/components/PortalLider/Apontador';
import { OfertaInstalar } from '@/components/Mobile/OfertaInstalar';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const campo = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[16px] text-m-text-primary outline-none focus:border-m-accent-strong focus:ring-2 focus:ring-m-accent/30';
const primario = 'h-12 w-full rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent disabled:opacity-40';
const secundario = 'h-11 rounded-full border border-m-stroke px-4 text-[14px] font-semibold text-m-text-secondary';

export interface MarcaPortal { cor: string | null; contratada: string | null; contratante: string | null; logos: string[]; versao: number }
export interface InfoPortal { obra: string | null; marca: MarcaPortal; rota?: RotaPortal }
/** Spec 117: `/encarregado/<empresa>[/<obra>]` resolvido antes do login. */
interface RotaResolvida extends InfoPortal { obra_id: number | null; marca_obra_id: number; rota: RotaPortal }

/** Troca o endereço da barra sem recarregar (mantém o idioma: /pt-BR/encarregado/...). */
function fixarEndereco(endereco: string) {
  const idioma = window.location.pathname.split('/')[1];
  const alvo = `/${idioma}${endereco}`;
  if (window.location.pathname !== alvo) window.history.replaceState(null, '', alvo + window.location.search.replace(/[?&]obra=\d+/, ''));
}

const PADRAO = '#284E4F';
/** Texto que se lê sobre a cor da empresa: branco em cor escura, quase preto em cor clara. */
function textoSobre(cor: string) {
  const h = cor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0B0D12' : '#FFFFFF';
}

/**
 * Portal do encarregado (specs 111, 113 e 115): endereço fixo `/encarregado` (sem link por obra). Ele entra com a
 * matrícula e a senha — o primeiro acesso é ali mesmo (123456 e ele cria a dele) —, confere a equipe, informa quem foi
 * para outro encarregado, traz quem está com ele ou pede a equipe. A obra sai da matrícula; com ela, a tela veste a marca
 * da empresa (logo, cor nas faixas de cima e de baixo, botões, abertura, aba e barra do navegador). O aparelho lembra a
 * obra para abrir já com a marca na próxima vez.
 */
export function PortalLider({ obraInicial, rota, perfil = 'lider' }: { obraInicial?: number | null; rota?: { empresa: string; obra?: string }; perfil?: PerfilPortal }) {
  usarPerfil(perfil); // spec 147: encarregado e apontador guardam a sessão e o endereço separados no aparelho
  const apontador = perfil === 'apontador';
  const [obra, setObra] = useState<number | null>(obraInicial ?? null);
  const [info, setInfo] = useState<InfoPortal | null>(null);
  // spec 117: endereço da empresa/obra — a marca vem antes do login e o login fica restrito a ela
  const [marcaObra, setMarcaObra] = useState<number | null>(null); // obra de onde vêm cor e logo (empresa sem obra)
  const [empresaRota, setEmpresaRota] = useState<string | null>(rota && !rota.obra ? rota.empresa : null);
  const [naoAchou, setNaoAchou] = useState(false);
  // aparelho com a sessão de outra obra abrindo o endereço desta: vale o endereço (pede o login desta obra)
  const obraDaRota = useRef<number | null>(null);
  const sessaoDe = useRef<number | null>(null);
  const [etapa, setEtapa] = useState<'entrar' | 'senha' | 'equipe'>('entrar');
  const [dados, setDados] = useState<MinhasEquipes | null>(null);
  const [abrindo, setAbrindo] = useState(true); // abertura com a logo da empresa
  const [aba, setAba] = useState<'equipe' | 'fotos' | 'projetos'>('equipe'); // spec 121: fotos da atividade

  const usarObra = useCallback((id: number) => { guardarObra(id); setObra(id); }, []);
  const carregar = useCallback(async () => {
    try {
      // apontador: a mesma conferência da sessão, pela rota dele (só abre com o perfil de apontador)
      const d = apontador
        ? { ...(await portal<MinhasEquipes>('/apontador/equipes')), equipes: [], destinos: [], pedidos: [] } as MinhasEquipes
        : await portal<MinhasEquipes>('/equipes');
      if (obraDaRota.current && d.obra_id !== obraDaRota.current) { guardarToken(null); setEtapa('entrar'); return; }
      sessaoDe.current = d.obra_id;
      setDados(d); setEtapa('equipe'); usarObra(d.obra_id);
    } catch (e) {
      if ((e as { campo?: string }).campo === 'sessao') { guardarToken(null); setEtapa('entrar'); } else toast.error((e as Error).message);
    }
  }, [usarObra, apontador]);

  useEffect(() => {
    const fim = () => setTimeout(() => setAbrindo(false), 650); // tempo de ver a marca, sem atrasar o uso
    if (rota) {
      // o endereço diz a empresa (e a obra): veste a marca antes de qualquer coisa
      const caminho = `/rota/${encodeURIComponent(rota.empresa)}${rota.obra ? `/${encodeURIComponent(rota.obra)}` : ''}`;
      portal<RotaResolvida>(caminho).then((r) => {
        setInfo(r); setMarcaObra(r.marca_obra_id); fixarEndereco(enderecoDoPerfil(r.rota.endereco));
        if (r.obra_id) {
          obraDaRota.current = r.obra_id; setObra(r.obra_id); setEmpresaRota(null);
          if (sessaoDe.current && sessaoDe.current !== r.obra_id) { guardarToken(null); sessaoDe.current = null; setDados(null); setEtapa('entrar'); }
        } else setEmpresaRota(r.rota.empresa);
      }).catch(() => setNaoAchou(true));
    } else {
      // `/encarregado` puro: o aparelho que já entrou volta sozinho para o endereço da empresa/obra dele
      const lembrada = lerRota();
      if (lembrada) fixarEndereco(lembrada);
      if (obra == null) { const o = lerObra(); if (o) setObra(o); }
    }
    if (lerToken()) void carregar().finally(fim); else fim();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (obra == null) return;
    portal<InfoPortal>(`/marca/${obra}`).then((r) => {
      setInfo(r); setMarcaObra(obra);
      if (r.rota) { const e = enderecoDoPerfil(r.rota.endereco); guardarRota(e); fixarEndereco(e); } // herda o endereço da obra dele
    }).catch(() => undefined);
  }, [obra]);

  const sair = () => { guardarToken(null); setDados(null); setEtapa('entrar'); };
  const cor = info?.marca.cor || PADRAO;
  const deOnde = marcaObra ?? obra;
  const logo = deOnde && info?.marca.logos.includes('contratada') ? `${API_URL}/portal/marca/${deOnde}/logo/contratada?v=${info.marca.versao}` : null;
  useEffect(() => { definirLogoCarimbo(logo); }, [logo]); // spec 121: a logo da empresa no carimbo das fotos
  // aba e barra do navegador do celular com a marca da empresa
  useEffect(() => {
    document.title = `${info?.marca.contratada || 'Malhet'} · ${apontador ? 'Apontador' : 'Minha equipe'}`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = cor;
    if (!logo) return;
    const trocar = () => document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((l) => {
      if (!l.href.endsWith(logo)) l.href = logo;
    });
    trocar();
    const obs = new MutationObserver(trocar); // o Next ainda pode pôr o favicon padrão depois
    obs.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    return () => obs.disconnect();
  }, [info, cor, logo, apontador]);
  // spec 147: instalar o app do apontador abre direto nesta tela de login da rota (manifesto com o endereço dela)
  useEffect(() => {
    if (!apontador) return;
    const inicio = window.location.pathname;
    const q = new URLSearchParams({ inicio, nome: info?.marca.contratada || 'Malhet', cor: (info?.marca.cor || PADRAO).replace('#', '') });
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.href = `/api/manifest?${q}`;
    let titulo = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!titulo) { titulo = document.createElement('meta'); titulo.name = 'apple-mobile-web-app-title'; document.head.appendChild(titulo); }
    titulo.content = 'Apontador';
  }, [apontador, info]);
  const sobre = textoSobre(cor);
  const empresa = info?.marca.contratada || 'Malhet';
  // a cor da empresa vira o acento da tela inteira (botões, foco, seleção), como o app faz dentro da obra
  const tokens = `.portal-lider{--m-accent:${cor};--m-accent-strong:${cor};--m-accent-hover:color-mix(in srgb,${cor} 80%,black);--m-accent-subtle:color-mix(in srgb,${cor} 12%,white);--m-on-accent:${sobre}}`;
  const Marca = ({ grande }: { grande?: boolean }) => logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} alt={empresa} className={grande ? 'max-h-24 max-w-[70vw] object-contain' : 'h-9 max-w-[150px] object-contain'} />
    : <span className={grande ? 'text-[28px] font-semibold' : 'text-[17px] font-semibold'}>{empresa}</span>;

  return (
    <main className="portal-lider flex min-h-dvh flex-col bg-m-surface-base font-[Figtree,system-ui,sans-serif] text-m-text-primary">
      <style>{tokens}</style>
      {abrindo && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-m-surface-raised transition-opacity" role="status" aria-label={`Abrindo ${empresa}`}>
          <Marca grande />
          <span className="h-1 w-24 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${cor} 20%, white)` }}>
            <span className="block h-1 w-1/2 animate-pulse rounded-full" style={{ background: cor }} />
          </span>
        </div>
      )}
      <header className="pt-[env(safe-area-inset-top)]" style={{ background: cor, color: sobre }}>
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-3 px-4 py-3">
          <span className={`flex min-h-[44px] items-center ${logo ? 'rounded-[10px] bg-white px-2 py-1' : ''}`}><Marca /></span>
          <span className="min-w-0 flex-1 truncate text-right text-[12.5px] font-semibold opacity-90">{info?.obra ?? ''}</span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-4 px-4 pb-6 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold leading-8">{dados ? `Olá, ${dados.nome.split(' ')[0]}` : apontador ? 'Apontador' : 'Minha equipe'}</h1>
            {dados && <p className="text-[13px] text-m-text-tertiary">{[dados.matricula, dados.funcao].filter(Boolean).join(' · ')}</p>}
          </div>
          {dados && <button type="button" onClick={sair} className="flex h-10 items-center gap-1.5 rounded-full border border-m-stroke px-3 text-[13px] font-semibold text-m-text-secondary"><LogOut size={15} aria-hidden="true" /> Sair</button>}
        </div>
        {naoAchou && <Aviso texto="Endereço não encontrado. Confira o link com o Planejamento ou entre pelo endereço geral." />}
        {naoAchou && <a href={`/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'pt-BR'}${raizDoPerfil(perfil)}`} className={`${secundario} flex items-center justify-center`}>Ir para o endereço geral</a>}
        {apontador && etapa === 'entrar' && <OfertaInstalar titulo={`Instale o app do apontador${info?.marca.contratada ? ` da ${info.marca.contratada}` : ''}`} icone={logo} />}
        {naoAchou ? null : etapa === 'entrar' ? <Entrar perfil={perfil} obraFixa={rota?.obra ? obra : null} empresa={empresaRota} onEntrou={(r) => { if (r.obra_id) usarObra(r.obra_id); if (r.trocar_senha) setEtapa('senha'); else void carregar(); }} />
            : etapa === 'senha' ? <CriarSenha onPronto={() => void carregar()} />
              : dados && apontador ? <Apontador obra={info?.obra ?? null} />
              : dados ? (
                <>
                  <div role="tablist" aria-label="O que fazer" className="grid grid-cols-3 gap-1 rounded-full border border-m-stroke bg-m-surface-raised p-1">
                    {([['equipe', 'Equipe', Users], ['fotos', 'Fotos', Camera], ['projetos', 'Projetos', FolderOpen]] as const).map(([k, rotulo, I]) => (
                      <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                        className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold ${aba === k ? 'bg-m-accent-strong text-m-on-accent' : 'text-m-text-secondary'}`}>
                        <I size={16} aria-hidden="true" />{rotulo}
                      </button>
                    ))}
                  </div>
                  {aba === 'equipe' ? <Equipes dados={dados} recarregar={carregar} /> : aba === 'fotos' ? <FotosAtividade obra={info?.obra ?? null} /> : <ProjetosPortal />}
                </>
              ) : <Esqueleto className="h-40 w-full" />}
      </div>
      <footer className="pb-[max(env(safe-area-inset-bottom),12px)] pt-3 text-center text-[12px]" style={{ background: cor, color: sobre }}>
        <span className="font-semibold">{empresa}</span>{info?.marca.contratante ? ` · ${info.marca.contratante}` : ''} <span className="opacity-75">· com Malhet</span>
      </footer>
    </main>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <p role="alert" className="rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4 text-[15px]">{texto}</p>;
}

function Entrar({ onEntrou, obraFixa, empresa, perfil }: { onEntrou: (r: Sessao) => void; obraFixa?: number | null; empresa?: string | null; perfil: PerfilPortal }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [obras, setObras] = useState<ObraParaEscolher[] | null>(null); // matrícula em mais de uma obra
  const enviar = async (obraId?: number) => {
    setEnviando(true); setErro('');
    try {
      const r = await portal<Sessao>('/entrar', { method: 'POST', body: { matricula, senha, obra_id: obraId ?? obraFixa ?? null, empresa: empresa ?? null, perfil } });
      if (r.escolher) { setObras(r.escolher); return; }
      guardarToken(r.token ?? null);
      onEntrou(r);
    } catch (er) { setErro((er as Error).message); } finally { setEnviando(false); }
  };
  const entrar = (e: React.FormEvent) => { e.preventDefault(); void enviar(); };
  if (obras) {
    return (
      <section className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
        <h2 className="text-[18px] font-semibold">Em qual obra você está?</h2>
        <p className="text-[14px] text-m-text-tertiary">Sua matrícula está em mais de uma obra.</p>
        {obras.map((o) => (
          <button key={o.obra_id} type="button" disabled={enviando} onClick={() => void enviar(o.obra_id)}
            className="flex min-h-[56px] flex-col items-start justify-center rounded-[14px] border border-m-stroke px-4 text-left disabled:opacity-50">
            <span className="text-[15px] font-semibold">{o.obra}</span>{o.empresa && <span className="text-[12.5px] text-m-text-muted">{o.empresa}</span>}
          </button>
        ))}
        {erro && <p role="alert" className="text-[14px] text-m-danger">{erro}</p>}
        <button type="button" className={secundario} onClick={() => setObras(null)}>Voltar</button>
      </section>
    );
  }
  return (
    <form onSubmit={entrar} className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
      <p className="text-[15px] text-m-text-secondary">{perfil === 'apontador'
        ? 'Aponte a presença das equipes, o dia dos equipamentos, as fotos das atividades e confira a produção.'
        : 'Confira quem está na sua equipe e avise quem saiu ou chegou.'}</p>
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Matrícula
        <input className={campo} inputMode="numeric" name="matricula" autoComplete="off" required value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="ex.: 115532" />
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

function CriarSenha({ onPronto }: { onPronto: () => void }) {
  const [nova, setNova] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const r = await portal<Sessao>('/senha', { method: 'POST', body: { nova, repetida } });
      guardarToken(r.token ?? null);
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

function Equipes({ dados, recarregar }: { dados: MinhasEquipes; recarregar: () => Promise<void> }) {
  const [sel, setSel] = useState(dados.equipes[0]?.id ?? 0);
  const [saindo, setSaindo] = useState<Membro | null>(null);
  const [trazendo, setTrazendo] = useState(false);
  const [formando, setFormando] = useState(false);
  const equipe = dados.equipes.find((e) => e.id === sel) ?? dados.equipes[0];
  const pendente = dados.pedidos.find((p) => p.situacao === 'pendente');
  // spec 114: sem equipe (ou pedindo outra) — monta a equipe e manda para aprovação
  if (!equipe || formando || pendente) {
    return (
      <>
        <Reivindicar dados={dados} onEnviado={recarregar} />
        {equipe && !pendente && <button type="button" onClick={() => setFormando(false)} className={secundario}>Voltar para a minha equipe</button>}
      </>
    );
  }
  const recusado = dados.pedidos[0]?.situacao === 'recusado' ? dados.pedidos[0] : undefined;
  return (
    <>
      {recusado && (
        <div role="alert" className="flex flex-col gap-1.5 rounded-[12px] border border-m-danger bg-m-danger-subtle px-3 py-2.5 text-[13.5px] text-m-danger">
          <b>Seu pedido de equipe ({recusado.disciplina}) foi recusado</b>
          <span>Motivo: {recusado.motivo}</span>
          <button type="button" className="w-fit font-semibold text-m-text-primary underline" onClick={() => setFormando(true)}>Fazer uma nova solicitação</button>
        </div>
      )}
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
          <div className="flex-1"><b className="text-[16px]">{equipe.nome}</b><span className="block text-[12.5px] text-m-text-muted">{equipe.membros.length} pessoa(s) cadastrada(s)</span></div>
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
      <button type="button" onClick={() => setFormando(true)} className="text-[13.5px] font-semibold text-m-accent underline">Formar outra equipe (vai para aprovação)</button>
      {saindo && <Transferir equipe={equipe} membro={saindo} destinos={dados.destinos} onFechar={() => setSaindo(null)} onFeito={async () => { setSaindo(null); await recarregar(); }} />}
      {trazendo && <Trazer equipe={equipe} onFechar={() => setTrazendo(false)} onFeito={async () => { await recarregar(); }} />}
    </>
  );
}

function Transferir({ equipe, membro, destinos, onFechar, onFeito }: {
  equipe: EquipePortal; membro: Membro; destinos: Destino[]; onFechar: () => void; onFeito: () => Promise<void>;
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
      await portal('/transferir', { method: 'POST', body: { equipe_id: equipe.id, cracha: membro.cracha, para_equipe_id: para === 'nao-sei' ? null : para } });
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

function Trazer({ equipe, onFechar, onFeito }: { equipe: EquipePortal; onFechar: () => void; onFeito: () => Promise<void> }) {
  const [q, setQ] = useState('');
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setAchados(null); return; }
    const h = setTimeout(() => {
      portal<Achado[]>(`/buscar?q=${encodeURIComponent(t)}`).then(setAchados).catch((e) => toast.error((e as Error).message));
    }, 300);
    return () => clearTimeout(h);
  }, [q]);
  const trazer = async (a: Achado) => {
    setEnviando(a.cracha);
    try {
      const r = await portal<{ saiu_de: string[] }>('/incluir', { method: 'POST', body: { equipe_id: equipe.id, cracha: a.cracha } });
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

/**
 * Reivindicar equipe (spec 114): o líder sem equipe aponta quem está com ele (matrícula ou nome) e a disciplina; a equipe
 * só nasce quando o Planejamento ou o administrador aprova — assim a informação é validada antes de valer.
 */
function Reivindicar({ dados, onEnviado }: { dados: MinhasEquipes; onEnviado: () => Promise<void> }) {
  const pendente = dados.pedidos.find((p) => p.situacao === 'pendente');
  const ultimo: PedidoEquipe | undefined = dados.pedidos[0];
  // recusado: a nova solicitação já começa com o pedido anterior, para corrigir e mandar de novo
  const recusado = !pendente && ultimo?.situacao === 'recusado' ? ultimo : undefined;
  const base = pendente ?? recusado;
  const [editando, setEditando] = useState(!pendente);
  const [disciplina, setDisciplina] = useState(base?.disciplina ?? '');
  const [escolhidos, setEscolhidos] = useState<Achado[]>(base?.membros.map((m) => ({ ...m })) ?? []);
  const [observacao, setObservacao] = useState(pendente?.observacao ?? '');
  const [q, setQ] = useState('');
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setAchados(null); return; }
    const h = setTimeout(() => { portal<Achado[]>(`/buscar?q=${encodeURIComponent(t)}`).then(setAchados).catch((e) => toast.error((e as Error).message)); }, 300);
    return () => clearTimeout(h);
  }, [q]);
  const enviar = async () => {
    setEnviando(true);
    try {
      await portal('/pedidos', { method: 'POST', body: { disciplina, membros: escolhidos.map((a) => a.cracha), observacao: observacao || null } });
      toast.success('Pedido enviado. O Planejamento confere e aprova a sua equipe.');
      setEditando(false);
      await onEnviado();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  const cancelar = async () => {
    if (!pendente) return;
    try { await portal(`/pedidos/${pendente.id}`, { method: 'DELETE' }); toast.success('Pedido cancelado'); await onEnviado(); } catch (e) { toast.error((e as Error).message); }
  };

  if (pendente && !editando) {
    return (
      <section className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
        <span className="w-fit rounded-full bg-m-warning-subtle px-3 py-1 text-[12.5px] font-semibold text-m-warning">Aguardando aprovação do Planejamento</span>
        <h2 className="text-[18px] font-semibold">Equipe de {pendente.disciplina}</h2>
        <ul className="flex flex-col">{pendente.membros.map((m) => (
          <li key={m.cracha} className="border-b border-m-stroke-subtle py-2 last:border-b-0"><span className="block text-[15px]">{m.nome}</span>
            <span className="text-[12.5px] text-m-text-muted">{[m.matricula, m.funcao].filter(Boolean).join(' · ')}{m.equipe ? ` · hoje na ${m.equipe}` : ''}</span></li>
        ))}</ul>
        <p className="text-[13px] text-m-text-tertiary">Quando aprovarem, as pessoas passam para a sua equipe e saem da equipe em que estão hoje.</p>
        <div className="flex gap-2"><button type="button" className={secundario} onClick={() => setEditando(true)}>Corrigir o pedido</button>
          <button type="button" className={`${secundario} text-m-danger`} onClick={cancelar}>Cancelar pedido</button></div>
      </section>
    );
  }
  const ja = new Set(escolhidos.map((a) => a.cracha));
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-m-stroke-subtle bg-m-surface-raised p-4">
      <h2 className="text-[18px] font-semibold">{dados.equipes.length ? 'Formar outra equipe' : 'Você ainda não tem equipe cadastrada'}</h2>
      <p className="text-[14px] text-m-text-tertiary">Aponte quem está trabalhando com você. A equipe passa a valer quando o Planejamento aprovar.</p>
      {recusado && (
        <div role="alert" className="flex flex-col gap-1 rounded-[12px] border border-m-danger bg-m-danger-subtle px-3 py-2.5 text-[13.5px] text-m-danger">
          <b className="text-[14.5px]">Seu pedido foi recusado{recusado.decidido_em ? ` em ${new Date(recusado.decidido_em).toLocaleDateString('pt-BR')}` : ''}</b>
          <span>Motivo: {recusado.motivo}</span>
          <span className="text-m-text-primary">Faça uma nova solicitação: o pedido anterior já está abaixo — corrija o que foi apontado e envie de novo.</span>
        </div>
      )}
      <label className="flex flex-col gap-1 text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Disciplina
        <input className={campo} value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="FORMA, CONCRETO, ARMAÇÃO…" />
      </label>
      <label className="flex items-center gap-2 rounded-[14px] border-2 border-m-accent-strong px-3">
        <Search size={18} className="text-m-text-muted" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula ou nome de quem está com você" aria-label="Buscar colaborador"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] outline-none focus:ring-0" />
      </label>
      {achados && (
        <ul className="flex max-h-[40dvh] flex-col overflow-y-auto">
          {achados.map((a) => (
            <li key={a.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle py-2">
              <div className="min-w-0 flex-1"><span className="block truncate text-[15px]">{a.nome}</span>
                <span className="block text-[12.5px] text-m-text-muted">{[a.matricula, a.funcao].filter(Boolean).join(' · ')}{a.equipe ? ` · hoje na ${a.equipe}` : ' · sem equipe'}</span></div>
              {ja.has(a.cracha) ? <span className="text-[13px] text-m-text-muted">incluído</span>
                : <button type="button" className={secundario} onClick={() => { setEscolhidos([...escolhidos, a]); setQ(''); setAchados(null); }}>Incluir</button>}
            </li>
          ))}
          {!achados.length && <li className="py-2 text-[14px] text-m-text-muted">Ninguém no efetivo com esse nome ou matrícula.</li>}
        </ul>
      )}
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Na equipe ({escolhidos.length})</span>
        {escolhidos.map((a) => (
          <div key={a.cracha} className="flex items-center gap-3 border-b border-m-stroke-subtle py-2 last:border-b-0">
            <div className="min-w-0 flex-1"><span className="block truncate text-[15px]">{a.nome}</span><span className="text-[12.5px] text-m-text-muted">{a.matricula ?? a.cracha}</span></div>
            <button type="button" aria-label={`Tirar ${a.nome}`} onClick={() => setEscolhidos(escolhidos.filter((x) => x.cracha !== a.cracha))} className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={16} /></button>
          </div>
        ))}
        {!escolhidos.length && <span className="py-2 text-[14px] text-m-text-muted">Busque acima e inclua as pessoas.</span>}
      </div>
      <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} maxLength={500} placeholder="Observação para o Planejamento (opcional)"
        className="rounded-[14px] border border-m-stroke bg-m-surface-field p-3 text-[15px] outline-none focus:border-m-accent-strong" />
      <button type="button" className={primario} disabled={enviando || !escolhidos.length || disciplina.trim().length < 2} onClick={enviar}>
        {enviando ? 'Enviando…' : pendente ? 'Atualizar o pedido' : recusado ? 'Enviar nova solicitação' : 'Enviar para aprovação'}</button>
      {pendente && <button type="button" className={secundario} onClick={() => setEditando(false)}>Voltar</button>}
    </section>
  );
}
