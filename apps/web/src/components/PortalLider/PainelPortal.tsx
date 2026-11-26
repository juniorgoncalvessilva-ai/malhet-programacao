'use client';

import { BarChart3, Camera, ChevronRight, ClipboardCheck, FolderOpen, Home, LayoutGrid, LogOut, Truck, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Esqueleto } from '@/components/Obra/Esqueleto';
import { type TelaApontador, TelaDoApontador, useDadosApontador } from '@/components/PortalLider/Apontador';
import { FotosAtividade } from '@/components/PortalLider/FotosAtividade';
import { ProjetosPortal } from '@/components/PortalLider/ProjetosPortal';
import { type EquipamentosApontador, type MinhasEquipes, type PerfilPortal, portal } from '@/lib/portal/api';

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const dataLonga = () => new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

type TelaEncarregado = 'equipe' | 'fotos' | 'projetos';
type Tela = 'inicio' | TelaApontador | TelaEncarregado;
interface ItemBarra { tela: Tela; titulo: string; icone: LucideIcon }

const BARRA: Record<PerfilPortal, { esq: ItemBarra[]; destaque: ItemBarra; dir: ItemBarra[]; mais: ItemBarra[] }> = {
  apontador: {
    esq: [{ tela: 'inicio', titulo: 'Início', icone: Home }, { tela: 'equipes', titulo: 'Equipes', icone: Users }],
    destaque: { tela: 'presenca', titulo: 'Presença', icone: ClipboardCheck },
    dir: [{ tela: 'equipamentos', titulo: 'Equip.', icone: Truck }],
    mais: [{ tela: 'fotos', titulo: 'Fotos da atividade', icone: Camera }, { tela: 'producao', titulo: 'Produção', icone: BarChart3 },
      { tela: 'projetos', titulo: 'Projetos', icone: FolderOpen }],
  },
  lider: {
    esq: [{ tela: 'inicio', titulo: 'Início', icone: Home }, { tela: 'equipe', titulo: 'Equipe', icone: Users }],
    destaque: { tela: 'fotos', titulo: 'Fotos', icone: Camera },
    dir: [{ tela: 'projetos', titulo: 'Projetos', icone: FolderOpen }],
    mais: [],
  },
};

/**
 * Spec 149: o portal do encarregado e o do apontador no mesmo layout do app de campo (`/m`) — saudação, o cartão da meta do dia na
 * cor da empresa, os números que importam, "O que fazer agora", atalhos e a barra de baixo com o botão central em destaque. Cada
 * perfil tem o seu Início; as telas são as de sempre.
 */
export function PainelPortal({ perfil, dados, obra, empresa, logo, telaEquipe, onSair }: {
  perfil: PerfilPortal; dados: MinhasEquipes; obra: string | null; empresa: string; logo: string | null;
  /** A tela "Equipe" do encarregado (PortalLider). */
  telaEquipe: ReactNode; onSair: () => void;
}) {
  const [tela, setTela] = useState<Tela>('inicio');
  const [criar, setCriar] = useState(false);
  const [mais, setMais] = useState(false);
  const ap = useDadosApontador(perfil === 'apontador'); // só busca na rota do apontador
  useEffect(() => { window.scrollTo({ top: 0 }); }, [tela]);
  const ir = (t: Tela, opcoes?: { criar?: boolean }) => { setCriar(!!opcoes?.criar); setTela(t); setMais(false); };
  const b = BARRA[perfil];
  const iniciais = dados.nome.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('');

  return (
    <>
      <div className="flex flex-col gap-3.5 pb-28">
        {tela === 'inicio' ? (
          <>
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] leading-[18px] text-m-text-muted">{dataLonga()}{obra ? ` · ${obra}` : ''}</span>
                <h1 className="text-[24px] font-semibold leading-[30px]">{saudacao()}, {dados.nome.split(' ')[0]}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {logo && (/* eslint-disable-next-line @next/next/no-img-element */
                  <span className="grid h-11 place-items-center rounded-[12px] border border-m-stroke-subtle bg-white px-2"><img src={logo} alt={empresa} className="h-7 max-w-[84px] object-contain" /></span>)}
                <button type="button" onClick={() => setMais(true)} aria-label="Meu perfil e mais opções"
                  className="grid h-11 w-11 place-items-center rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent">{iniciais}</button>
              </div>
            </header>
            {perfil === 'apontador' ? <InicioApontador estado={ap} ir={ir} /> : <InicioEncarregado dados={dados} ir={ir} />}
          </>
        ) : perfil === 'apontador' && tela !== 'projetos' && tela !== 'equipe' ? (
          <TelaDoApontador key={`${tela}-${criar}`} tela={tela as TelaApontador} obra={obra} estado={ap} criarAoAbrir={criar} />
        ) : tela === 'equipe' ? (
          <><h1 className="text-[22px] font-semibold leading-7">Minha equipe</h1>{telaEquipe}</>
        ) : tela === 'fotos' ? (
          <><h1 className="text-[22px] font-semibold leading-7">Fotos da atividade</h1><FotosAtividade obra={obra} /></>
        ) : (
          <><h1 className="text-[22px] font-semibold leading-7">Projetos</h1><ProjetosPortal /></>
        )}
      </div>

      <nav aria-label="Navegação" className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[520px] -translate-x-1/2 border-t border-m-stroke-subtle bg-m-surface-raised pb-[max(env(safe-area-inset-bottom),10px)] pt-2"
        style={{ gridTemplateColumns: `repeat(${b.esq.length + b.dir.length + 2}, minmax(0, 1fr))` }}>
        {b.esq.map((i) => <BotaoBarra key={i.tela} item={i} ativo={tela === i.tela} onClick={() => ir(i.tela)} />)}
        {(() => {
          const I = b.destaque.icone; const at = tela === b.destaque.tela;
          return (
            <button type="button" onClick={() => ir(b.destaque.tela)} aria-current={at ? 'page' : undefined} aria-label={b.destaque.titulo}
              className="-mt-6 flex min-w-0 flex-col items-center gap-1 text-[10.5px] font-semibold text-m-accent">
              <span className={`grid h-14 w-14 place-items-center rounded-full bg-m-accent-strong text-m-on-accent shadow-lg ring-4 ring-m-surface-raised ${at ? 'scale-105' : ''}`}><I size={28} strokeWidth={2} aria-hidden="true" /></span>
              <span className="max-w-full truncate">{b.destaque.titulo}</span>
            </button>
          );
        })()}
        {b.dir.map((i) => <BotaoBarra key={i.tela} item={i} ativo={tela === i.tela} onClick={() => ir(i.tela)} />)}
        <button type="button" onClick={() => setMais(true)} aria-haspopup="dialog" aria-expanded={mais}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-1 text-[10.5px] ${mais || b.mais.some((m) => m.tela === tela) ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
          <LayoutGrid size={24} strokeWidth={2} aria-hidden="true" />Mais
        </button>
      </nav>

      {mais && createPortal(
        <div className="portal-lider fixed inset-0 z-50 flex justify-center font-[Figtree,system-ui,sans-serif]" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={() => setMais(false)} />
          <div className="absolute bottom-0 flex max-h-[88dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-m-surface-base px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 text-m-text-primary">
            <span className="mx-auto h-1.5 w-10 rounded-full bg-m-stroke" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-m-accent-strong text-[16px] font-semibold text-m-on-accent">{iniciais}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[16px]">{dados.nome}</b>
                <span className="truncate text-[12.5px] text-m-text-muted">{[perfil === 'apontador' ? 'Apontador' : 'Líder de equipe', dados.matricula, dados.funcao].filter(Boolean).join(' · ')}</span>
                <span className="truncate text-[12.5px] text-m-text-muted">{[obra, empresa].filter(Boolean).join(' · ')}</span>
              </div>
              <button type="button" onClick={() => setMais(false)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke"><X size={18} /></button>
            </div>
            {(b.mais.length > 0 || perfil === 'lider') && (
              <section aria-label="Todas as telas" className="grid grid-cols-3 gap-2">
                {[...b.esq, b.destaque, ...b.dir, ...b.mais].filter((i) => i.tela !== 'inicio').map((i) => {
                  const I = i.icone;
                  return (
                    <button key={i.tela} type="button" onClick={() => ir(i.tela)} className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-2 text-center text-[12.5px] font-medium leading-4">
                      <I size={24} className="text-m-accent" aria-hidden="true" />{i.titulo === 'Equip.' ? 'Equipamentos' : i.titulo}
                    </button>
                  );
                })}
              </section>
            )}
            <button type="button" onClick={onSair} className="flex h-12 items-center justify-center gap-2 rounded-full border border-m-stroke text-[14px] font-semibold text-m-text-secondary"><LogOut size={16} /> Sair</button>
            <span className="text-center text-[12px] text-m-text-muted">{empresa !== 'Malhet' && <><b>{empresa}</b> · </>}com Malhet</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function BotaoBarra({ item, ativo, onClick }: { item: ItemBarra; ativo: boolean; onClick: () => void }) {
  const I = item.icone;
  return (
    <button type="button" onClick={onClick} aria-current={ativo ? 'page' : undefined}
      className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 text-[10.5px] ${ativo ? 'font-semibold text-m-accent' : 'font-medium text-m-text-muted'}`}>
      <I size={24} strokeWidth={2} aria-hidden="true" /><span className="max-w-full truncate px-0.5">{item.titulo}</span>
    </button>
  );
}

/** Cartão da meta do dia, na cor da empresa (o mesmo do Início do app de campo). */
function Meta({ rotulo, numero, texto, rodape, progresso, carregando, memoria }: {
  rotulo: string; numero: number | null; texto: string; rodape?: string; progresso?: number; carregando?: boolean; memoria?: () => MemoriaCalculo;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-m-accent-strong p-5 text-m-on-accent">
      <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.48px] opacity-80">{rotulo}</span>
      {carregando || numero == null ? <Esqueleto className="h-14 w-40 bg-white/30" /> : (
        <>
          <div className="flex items-baseline gap-2">
            {memoria ? <Calculado chave="meta" memoria={memoria} className="text-[56px] font-semibold leading-[56px] tabular-nums decoration-white/50 hover:text-current">{String(numero)}</Calculado>
              : <span className="text-[56px] font-semibold leading-[56px] tabular-nums">{numero}</span>}
            <span className="text-[16px] opacity-90">{texto}</span>
          </div>
          {progresso != null && (
            <div className="h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso * 100)} aria-label={rotulo}>
              <div className="h-full rounded-full bg-white/80" style={{ width: `${Math.min(1, progresso) * 100}%` }} />
            </div>
          )}
          {rodape && <span className="text-[13px] leading-[18px] opacity-90">{rodape}</span>}
        </>
      )}
    </section>
  );
}

function Numero({ rotulo, valor, aviso, onClick }: { rotulo: string; valor: ReactNode; aviso?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col gap-1 rounded-[14px] border p-3.5 text-left ${aviso ? 'border-m-warning/30 bg-m-warning-subtle' : 'border-m-stroke-subtle bg-m-surface-raised'}`}>
      <span className={`text-[12px] leading-4 ${aviso ? 'text-m-warning' : 'text-m-text-muted'}`}>{rotulo}</span>
      <span className="text-[26px] font-semibold leading-8 tabular-nums">{valor}</span>
    </button>
  );
}

function Fazer({ icone: I, titulo, texto, tom = 'neutro', destaque, onClick }: {
  icone: LucideIcon; titulo: string; texto: string; tom?: 'acento' | 'atencao' | 'info' | 'sucesso' | 'neutro'; destaque?: boolean; onClick: () => void;
}) {
  const cor = { acento: 'bg-m-accent-subtle text-m-accent', atencao: 'bg-m-warning-subtle text-m-warning', info: 'bg-m-info-subtle text-m-info',
    sucesso: 'bg-m-success-subtle text-m-success', neutro: 'bg-m-surface-active text-m-text-secondary' }[tom];
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[60px] items-center gap-3 rounded-[14px] bg-m-surface-raised px-3.5 text-left ${destaque ? 'border-2 border-m-accent-strong' : 'border border-m-stroke-subtle'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${destaque ? 'bg-m-accent-strong text-m-on-accent' : cor}`}><I size={18} /></span>
      <span className="flex flex-1 flex-col"><span className={`text-[15px] leading-5 ${destaque ? 'font-semibold' : 'font-medium'}`}>{titulo}</span>
        <span className="text-[12px] leading-4 text-m-text-muted">{texto}</span></span>
      <ChevronRight size={18} className={destaque ? 'text-m-accent' : 'text-m-text-muted'} aria-hidden="true" />
    </button>
  );
}

function Atalhos({ itens }: { itens: { titulo: string; icone: LucideIcon; onClick: () => void }[] }) {
  return (
    <>
      <h2 className="mt-1 text-[13px] font-semibold leading-[18px] text-m-text-secondary">Atalhos</h2>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {itens.map(({ titulo, icone: I, onClick }) => (
          <button key={titulo} type="button" onClick={onClick} className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-m-stroke-subtle bg-m-surface-raised p-2 text-center text-[12.5px] font-medium leading-4">
            <I size={24} className="text-m-accent" aria-hidden="true" />{titulo}
          </button>
        ))}
      </div>
    </>
  );
}

// ---- Início do apontador ------------------------------------------------------------------------------------------
function InicioApontador({ estado, ir }: { estado: ReturnType<typeof useDadosApontador>; ir: (t: Tela, o?: { criar?: boolean }) => void }) {
  const { dados } = estado;
  const [eq, setEq] = useState<EquipamentosApontador | null>(null);
  useEffect(() => { portal<EquipamentosApontador>('/apontador/equipamentos').then(setEq).catch(() => undefined); }, []);
  const pessoas = dados ? [...dados.equipes.flatMap((e) => e.pessoas), ...dados.sem_equipe] : [];
  const presentes = pessoas.filter((p) => p.presenca).length;
  const semMarcar = pessoas.length - presentes;
  const apontados = eq ? eq.itens.filter((i) => i.dia).length : null;
  const faltamEq = eq ? eq.itens.length - (apontados ?? 0) : null;
  const memoria = (): MemoriaCalculo => ({
    chave: 'meta', titulo: 'Presentes hoje', valor: `${presentes} de ${pessoas.length}`, formula: 'presentes = pessoas com presença válida hoje (crachá, rosto ou apontada)', notas: [],
    passos: (dados?.equipes ?? []).map((e) => ({ descricao: e.nome, conta: `${e.presentes} de ${e.total}`, resultado: String(e.presentes), destaque: false })),
    fontes: [{ dado: 'Efetivo ativo', valor: String(pessoas.length), origem: 'Equipes + sem equipe', local: dados?.data ?? null }],
  });
  return (
    <>
      <Meta rotulo="Presença de hoje" numero={dados ? presentes : null} texto={`de ${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'}`} memoria={memoria}
        progresso={pessoas.length ? presentes / pessoas.length : 0} carregando={!dados}
        rodape={dados ? `${dados.equipes.length} equipe(s) ativa(s) · ${semMarcar} sem presença` : undefined} />
      <div className="grid grid-cols-2 gap-2.5">
        <Numero rotulo="Equipamentos apontados" valor={eq ? `${apontados}/${eq.itens.length}` : '—'} aviso={!!faltamEq} onClick={() => ir('equipamentos')} />
        <Numero rotulo="Equipes ativas" valor={dados ? dados.equipes.length : '—'} onClick={() => ir('equipes')} />
      </div>
      <h2 className="mt-0.5 text-[13px] font-semibold leading-[18px] text-m-text-secondary">O que fazer agora</h2>
      <div className="flex flex-col gap-2">
        <Fazer icone={ClipboardCheck} titulo={semMarcar ? 'Apontar a presença' : 'Presença apontada'} destaque={semMarcar > 0} tom="sucesso"
          texto={dados ? `${semMarcar} de ${pessoas.length} pessoa(s) sem presença hoje` : 'Carregando…'} onClick={() => ir('presenca')} />
        <Fazer icone={Truck} titulo={!eq || eq.itens.length === 0 ? 'Equipamentos' : faltamEq ? 'Apontar os equipamentos' : 'Equipamentos apontados'}
          tom={faltamEq ? 'atencao' : eq?.itens.length ? 'sucesso' : 'neutro'}
          texto={!eq ? 'Carregando…' : eq.itens.length ? `${faltamEq} de ${eq.itens.length} sem o dia apontado` : 'Nenhum equipamento mobilizado na obra'} onClick={() => ir('equipamentos')} />
        <Fazer icone={Camera} titulo="Registrar atividade" tom="acento" texto="Foto, frente e o que foi feito" onClick={() => ir('fotos')} />
        <Fazer icone={BarChart3} titulo="Conferir a produção" tom="info" texto="Programado × realizado da semana" onClick={() => ir('producao')} />
        <Fazer icone={UserPlus} titulo="Criar equipe" texto="Vale na hora, no padrão de nome da obra" onClick={() => ir('equipes', { criar: true })} />
      </div>
      <Atalhos itens={[{ titulo: 'Equipes', icone: Users, onClick: () => ir('equipes') }, { titulo: 'Produção', icone: BarChart3, onClick: () => ir('producao') },
        { titulo: 'Projetos', icone: FolderOpen, onClick: () => ir('projetos') }]} />
    </>
  );
}

// ---- Início do encarregado ----------------------------------------------------------------------------------------
function InicioEncarregado({ dados, ir }: { dados: MinhasEquipes; ir: (t: Tela) => void }) {
  const [registros, setRegistros] = useState<number | null>(null);
  useEffect(() => { portal<unknown[]>('/registros').then((r) => setRegistros(r.length)).catch(() => setRegistros(null)); }, []);
  const pessoas = dados.equipes.reduce((s, e) => s + e.membros.length, 0);
  const pendente = dados.pedidos.find((p) => p.situacao === 'pendente');
  const recusado = dados.pedidos[0]?.situacao === 'recusado' ? dados.pedidos[0] : undefined;
  const memoria = (): MemoriaCalculo => ({
    chave: 'meta', titulo: 'Pessoas na sua equipe', valor: String(pessoas), formula: 'pessoas = soma das pessoas cadastradas nas equipes que você lidera', notas: [],
    passos: dados.equipes.map((e) => ({ descricao: e.nome, conta: `${e.membros.length} pessoa(s)`, resultado: String(e.membros.length), destaque: false })),
    fontes: [{ dado: 'Equipes', valor: String(dados.equipes.length), origem: 'Cadastro de equipes', local: null }],
  });
  return (
    <>
      {dados.equipes.length ? (
        <Meta rotulo="Minha equipe" numero={pessoas} texto={`pessoa${pessoas === 1 ? '' : 's'} com você`} memoria={memoria}
          rodape={dados.equipes.map((e) => e.nome).join(' · ')} />
      ) : (
        <Meta rotulo="Minha equipe" numero={0} texto="equipe cadastrada" rodape={pendente ? 'Seu pedido de equipe está com o Planejamento' : 'Peça a sua equipe: aponte quem está com você'} />
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Numero rotulo="Equipes que lidera" valor={dados.equipes.length} onClick={() => ir('equipe')} />
        <Numero rotulo="Registros hoje" valor={registros ?? '—'} onClick={() => ir('fotos')} />
      </div>
      <h2 className="mt-0.5 text-[13px] font-semibold leading-[18px] text-m-text-secondary">O que fazer agora</h2>
      <div className="flex flex-col gap-2">
        {recusado && <Fazer icone={Users} titulo="Pedido de equipe recusado" tom="atencao" destaque texto={`Motivo: ${recusado.motivo ?? '—'} · faça uma nova solicitação`} onClick={() => ir('equipe')} />}
        {pendente && <Fazer icone={Users} titulo="Pedido de equipe aguardando" tom="atencao" texto={`${pendente.disciplina} · ${pendente.membros.length} pessoa(s) · o Planejamento aprova`} onClick={() => ir('equipe')} />}
        <Fazer icone={Users} titulo={dados.equipes.length ? 'Conferir a minha equipe' : 'Pedir a minha equipe'} destaque={!recusado}
          texto={dados.equipes.length ? 'Quem saiu, quem chegou: "Não está comigo" e "Trazer alguém"' : 'Aponte quem está com você; vale quando o Planejamento aprovar'} onClick={() => ir('equipe')} />
        <Fazer icone={Camera} titulo="Registrar atividade" tom="acento" texto="Foto, frente e o que foi feito" onClick={() => ir('fotos')} />
        <Fazer icone={FolderOpen} titulo="Projetos da frente" tom="info" texto="Só a revisão vigente, liberada para o campo" onClick={() => ir('projetos')} />
      </div>
      <Atalhos itens={[{ titulo: 'Equipe', icone: Users, onClick: () => ir('equipe') }, { titulo: 'Fotos', icone: Camera, onClick: () => ir('fotos') },
        { titulo: 'Projetos', icone: FolderOpen, onClick: () => ir('projetos') }]} />
    </>
  );
}
