'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, Download, MessageCircle, RotateCcw, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Calculado, type MemoriaCalculo } from '@/components/Obra/Calculado';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Cabecalho, Erro, Painel, Pilula } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { compartilhar, copiarTexto, linkWhatsapp, longoParaLink, podeCompartilharFotos } from '@/lib/resumo/whatsapp';

/**
 * Resumo do dia — check out (spec 101): o que aconteceu na obra num dia, por frente, na hierarquia da programação
 * (Local → Área → CWP). Seis quadrantes na ordem pedida (atividades, ocorrências, restrições, auditorias, equipes,
 * fotos); o texto de cada um sai pronto do servidor e a pessoa escolhe o que vai, pode editar, copia ou manda no WhatsApp
 * — no celular, junto com as fotos.
 */
type Secao = 'atividades' | 'ocorrencias' | 'restricoes' | 'auditorias' | 'equipes' | 'fotos';
const SECOES: Secao[] = ['atividades', 'ocorrencias', 'restricoes', 'auditorias', 'equipes', 'fotos'];
const NOME: Record<Secao, string> = { atividades: 'Atividades', ocorrencias: 'Ocorrências', restricoes: 'Restrições', auditorias: 'Auditorias', equipes: 'Equipes', fotos: 'Fotos' };
const MAX_FOTOS = 30;

interface Grupo<T> { local: string | null; area: string | null; area_id: number | null; itens?: T[]; cwps?: { texto: string | null; itens: T[] }[] }
interface Atividade { linha_id: number; codigo: string; atividade: string; unidade: string | null; realizado: number | null; previsto: number | null; equipe: string | null; encarregado: string | null; fotos: number }
interface Ocorrencia { id: number; causa: string | null; descricao: string; atividade: string | null; acao: string | null; responsavel: string | null; status: string; qtd_nao_cumprida: number | null }
interface Restricao { id: number; numero: number; acao: string; atividade: string | null; responsavel: string | null; prazo_br: string | null; status: string; impeditivo: boolean | null; marcador: 'nova' | 'concluida' | 'atrasada' | 'pendente' }
interface Auditoria { id: number; numero: number; tipo: string | null; tipo_registro: string | null; nao_conformidade: string | null; medida_corretiva: string | null; ver_agir: boolean | null; acao_numero: number | null; encarregado: string | null; auditor: string | null }
interface Equipe { equipe_id: number; nome: string; encarregado: string | null; setor: string | null; presentes: number; total: number; funcoes: string[]; atividades: string[] }
interface GrupoFoto { descricao: string; tipo: string; n: number; ids: number[] }
interface Resumo {
  data: string; obra: string; programacao: { id: number; titulo: string } | null;
  atividades: { total: number; grupos: Grupo<Atividade>[] }; ocorrencias: { total: number; grupos: Grupo<Ocorrencia>[] };
  restricoes: { total: number; grupos: Grupo<Restricao>[] }; auditorias: { total: number; grupos: Grupo<Auditoria>[] };
  equipes: { itens: Equipe[]; presentes: number; sem_equipe: number };
  fotos: { total: number; grupos: Grupo<GrupoFoto>[]; lista: { id: number; tipo: string; legenda: string | null; area: string; descricao: string | null }[] };
  textos: Record<'cabecalho' | Secao, string>;
}

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const somarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dataBR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
const fmt = (v: number | null) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const contagem = (r: Resumo, s: Secao) => (s === 'equipes' ? r.equipes.itens.length : r[s].total);

/** Local → Área (→ CWP) nas cores da programação (local vermelho, área azul, spec 059). */
function Frentes<T>({ grupos, item }: { grupos: Grupo<T>[]; item: (x: T, i: number) => ReactNode }) {
  let local: string | null | undefined;
  return (
    <div className="flex flex-col overflow-hidden rounded-m-md border border-m-stroke-subtle">
      {grupos.map((g, gi) => {
        const novoLocal = g.local !== local;
        local = g.local;
        const blocos = g.cwps ?? [{ texto: null, itens: g.itens ?? [] }];
        return (
          <div key={`${g.local}-${g.area}-${gi}`}>
            {novoLocal && <div className="bg-[#FF0000] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.3px] text-white">{g.local ?? 'Sem frente'}</div>}
            {g.area && <div className="bg-[#173761] px-3 py-1 text-[12px] font-semibold text-white">{g.area}</div>}
            {blocos.map((b, bi) => (
              <div key={bi}>
                {b.texto && <div className="border-b border-m-stroke-subtle bg-m-info-subtle px-5 py-0.5 text-[11.5px] font-semibold text-m-info">CWP {b.texto}</div>}
                <ul className="divide-y divide-m-stroke-subtle">
                  {b.itens.map((x, i) => <li key={i} className={`px-3 py-2 text-[13px] leading-[19px] ${i % 2 ? 'bg-[#C5D9F1]/25' : ''}`}>{item(x, i)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AcoesSecao({ texto, nome }: { texto: string; nome: string }) {
  if (!texto) return null;
  return (
    <span className="flex gap-1.5 print:hidden">
      <Botao variante="secundario" className="h-8 px-3 text-[12.5px]" onClick={async () => { await copiarTexto(texto); toast.success(`${nome}: texto copiado`); }}><Copy size={14} /> Copiar</Botao>
      <a href={linkWhatsapp(texto)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-m-stroke px-3 text-[12.5px] font-semibold text-m-text-secondary hover:bg-m-surface-hover"><MessageCircle size={14} /> WhatsApp</a>
    </span>
  );
}

function Miniatura({ id, marcada, onTrocar, titulo }: { id: number; marcada: boolean; onTrocar: () => void; titulo: string }) {
  const api = useApi();
  const q = useQuery({ queryKey: ['foto', id, 'mini'], staleTime: Infinity, queryFn: async () => URL.createObjectURL(await api.blob(`/fotos/${id}/arquivo?mini=true`)) });
  return (
    <label className={`relative block aspect-square cursor-pointer overflow-hidden rounded-m-md border-2 ${marcada ? 'border-m-accent' : 'border-transparent opacity-60'}`} title={titulo}>
      {q.data ? <img src={q.data} alt={titulo} className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-m-surface-hover" />}
      <input type="checkbox" checked={marcada} onChange={onTrocar} aria-label={`Enviar a foto: ${titulo}`} className="absolute left-1.5 top-1.5 h-4 w-4 accent-[var(--m-accent)]" />
    </label>
  );
}

const vazio = <p className="text-[13px] text-m-text-muted">Nada registrado neste dia.</p>;

export function ResumoDia({ compacto = false }: { compacto?: boolean }) {
  const api = useApi();
  const [data, setData] = useState(hojeIso());
  const [qtd, setQtd] = useState(true);
  const [escolhidas, setEscolhidas] = useState<Set<Secao>>(new Set(SECOES));
  const [editado, setEditado] = useState<string | null>(null);
  const [semFotos, setSemFotos] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [comFotos, setComFotos] = useState(false);
  useEffect(() => { setComFotos(podeCompartilharFotos()); }, []);
  const q = useQuery({ queryKey: ['resumo-dia', data, qtd], queryFn: () => api.get<Resumo>(`/campo/resumo-dia?data=${data}&qtd=${qtd}`) });
  const r = q.data;
  useEffect(() => { setEditado(null); setSemFotos(new Set()); }, [data, qtd]);

  const composto = useMemo(() => (r ? [r.textos.cabecalho, ...SECOES.filter((s) => escolhidas.has(s) && r.textos[s]).map((s) => r.textos[s])].join('\n\n') : ''), [r, escolhidas]);
  const texto = editado ?? composto;
  const fotosSel = (r?.fotos.lista ?? []).filter((f) => !semFotos.has(f.id)).slice(0, MAX_FOTOS);
  const trocarSecao = (s: Secao) => { const n = new Set(escolhidas); n.has(s) ? n.delete(s) : n.add(s); setEscolhidas(n); setEditado(null); };

  const baixarFotos = async () => {
    for (const f of fotosSel) {
      const b = await api.blob(`/fotos/${f.id}/arquivo`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `checkout-${data}-${f.id}.jpg`; a.click(); URL.revokeObjectURL(a.href);
    }
  };
  const enviarComFotos = async () => {
    setEnviando(true);
    try {
      const arquivos = escolhidas.has('fotos') ? await Promise.all(fotosSel.map(async (f) => {
        const b = await api.blob(`/fotos/${f.id}/arquivo`);
        return new File([b], `checkout-${data}-${f.id}.${b.type.split('/')[1] || 'jpg'}`, { type: b.type || 'image/jpeg' });
      })) : [];
      // o texto vai junto; se o app não aceitar texto com fotos, ele já está copiado para colar
      await copiarTexto(texto);
      const res = await compartilhar(texto, arquivos);
      if (res === 'ok') toast.success(arquivos.length ? `Texto e ${arquivos.length} foto(s) compartilhados` : 'Texto compartilhado');
    } catch (e) { toast.error(`Não foi possível compartilhar: ${(e as Error).message}. O texto foi copiado.`); } finally { setEnviando(false); }
  };

  const memPresentes = (): MemoriaCalculo => ({
    chave: 'presentes', titulo: 'Presentes no dia', valor: String(r?.equipes.presentes ?? 0), formula: 'pessoas com leitura de presença no dia (cada pessoa conta uma vez)',
    passos: (r?.equipes.itens ?? []).map((e) => ({ descricao: e.nome, conta: `${e.presentes} de ${e.total} da equipe`, resultado: String(e.presentes), destaque: false })),
    fontes: [{ dado: 'Leituras de presença', valor: data, origem: 'Presença do dia (crachá, NFC, rosto)', local: '/app/presenca' }],
    notas: r?.equipes.sem_equipe ? [`${r.equipes.sem_equipe} presente(s) sem equipe também contam no total.`] : [],
  });

  const titulo = r ? `Check out de ${dataBR(data)}: ${r.atividades.total} atividade${r.atividades.total === 1 ? '' : 's'}, ${r.ocorrencias.total} ocorrência${r.ocorrencias.total === 1 ? '' : 's'}` : 'Resumo do dia';
  const seletorData = (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))} className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke text-m-text-secondary hover:bg-m-surface-hover"><ChevronLeft size={17} /></button>
      <input type="date" aria-label="Dia do resumo" value={data} max={hojeIso()} onChange={(e) => e.target.value && setData(e.target.value)}
        className="h-10 rounded-full border border-m-stroke bg-m-surface-field px-3 text-[13.5px] text-m-text-primary" />
      <button type="button" aria-label="Próximo dia" disabled={data >= hojeIso()} onClick={() => setData(somarDias(data, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-m-stroke text-m-text-secondary hover:bg-m-surface-hover disabled:opacity-40"><ChevronRight size={17} /></button>
    </div>
  );

  return (
    <>
      {compacto
        ? <div className="flex flex-col gap-2"><h1 className="text-[24px] font-semibold leading-[30px]">Resumo do dia</h1>{seletorData}</div>
        : <Cabecalho eyebrow="Campo · resumo do dia (check out)" cor="var(--m-proc-executar)" titulo={titulo} acoes={seletorData} />}
      <Erro erro={q.error} />
      {q.isLoading && <Carregando />}
      {r && (
        <>
          <Painel titulo="O que vai para os setores?" subtitulo={r.programacao ? `Programação do dia: ${r.programacao.titulo}` : 'Nenhuma programação emitida cobre este dia.'}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {SECOES.map((s) => {
                  const n = contagem(r, s);
                  return (
                    <label key={s} className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] ${escolhidas.has(s) ? 'bg-m-accent-strong font-semibold text-m-on-accent' : 'border border-m-stroke text-m-text-secondary'}`}>
                      <input type="checkbox" className="sr-only" checked={escolhidas.has(s)} onChange={() => trocarSecao(s)} />{NOME[s]} · {n}
                    </label>
                  );
                })}
                <label className="ml-1 flex items-center gap-1.5 text-[13px] text-m-text-secondary"><input type="checkbox" checked={qtd} onChange={(e) => setQtd(e.target.checked)} /> com quantidades</label>
              </div>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-muted">
                Texto para envio {editado !== null && <span className="text-m-warning">(editado)</span>}
                <textarea value={texto} onChange={(e) => setEditado(e.target.value)} rows={compacto ? 10 : 14} spellCheck
                  className="rounded-m-md border border-m-stroke bg-m-surface-field px-3 py-2 font-mono text-[12.5px] leading-[18px] text-m-text-primary" />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Botao onClick={async () => { await copiarTexto(texto); toast.success('Texto copiado — é só colar no WhatsApp ou no e-mail'); }}><Copy size={16} /> Copiar texto</Botao>
                <a href={linkWhatsapp(texto)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1FA855] px-4 text-sm font-semibold text-white hover:brightness-95"><MessageCircle size={16} /> Enviar no WhatsApp</a>
                {comFotos && <Botao variante="secundario" disabled={enviando} onClick={enviarComFotos}><Share2 size={16} /> {enviando ? 'Preparando…' : `Compartilhar com ${escolhidas.has('fotos') ? fotosSel.length : 0} foto(s)`}</Botao>}
                {!comFotos && escolhidas.has('fotos') && fotosSel.length > 0 && <Botao variante="secundario" onClick={baixarFotos}><Download size={16} /> Baixar {fotosSel.length} foto(s)</Botao>}
                {editado !== null && <Botao variante="fantasma" onClick={() => setEditado(null)}><RotateCcw size={15} /> Voltar ao texto gerado</Botao>}
              </div>
              <p className="text-[12px] text-m-text-muted">
                {longoParaLink(texto) ? 'Texto longo: o link do WhatsApp pode cortar o final — prefira Copiar texto e colar na conversa. ' : ''}
                {comFotos ? 'Compartilhar abre o WhatsApp (ou outro app) com o texto e as fotos marcadas abaixo.' : 'No computador: envie o texto e arraste as fotos baixadas para a conversa. No celular, o botão Compartilhar manda tudo junto.'}
              </p>
            </div>
          </Painel>

          <Painel titulo={`O que foi executado? · ${r.atividades.total}`} subtitulo="Atividades com realizado lançado ou foto no dia, na ordem da programação" acoes={<AcoesSecao texto={r.textos.atividades} nome="Atividades" />}>
            {r.atividades.total ? <Frentes grupos={r.atividades.grupos} item={(x: Atividade) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span><b className="text-m-text-primary">{x.codigo}</b> <span className="text-m-text-primary">{x.atividade}</span>
                  {x.equipe && <span className="text-m-text-muted"> · {x.equipe}{x.encarregado ? ` (Enc. ${x.encarregado})` : ''}</span>}</span>
                <span className="whitespace-nowrap text-[12.5px] text-m-text-secondary">{x.realizado != null && <b className="text-m-text-primary">{fmt(x.realizado)} {x.unidade ?? ''}</b>}{x.previsto ? ` de ${fmt(x.previsto)} previsto` : ''}{x.fotos ? ` · ${x.fotos} foto${x.fotos > 1 ? 's' : ''}` : ''}</span>
              </div>
            )} /> : vazio}
          </Painel>

          <Painel titulo={`O que atrapalhou? · ${r.ocorrencias.total}`} subtitulo="Ocorrências registradas no dia, na frente da atividade impactada" acoes={<AcoesSecao texto={r.textos.ocorrencias} nome="Ocorrências" />}>
            {r.ocorrencias.total ? <Frentes grupos={r.ocorrencias.grupos} item={(x: Ocorrencia) => (
              <div className="flex flex-col gap-0.5">
                <span>{x.causa && <b className="text-m-text-primary">{x.causa}: </b>}<span className="text-m-text-primary">{x.descricao}</span> <Pilula tom={x.status === 'Concluído' ? 'sucesso' : 'atencao'}>{x.status}</Pilula></span>
                {x.atividade && <span className="text-[12px] text-m-text-muted">Atividade: {x.atividade}</span>}
                {x.acao && <span className="text-[12px] text-m-text-secondary">Ação: {x.acao}{x.responsavel ? ` (${x.responsavel})` : ''}</span>}
              </div>
            )} /> : vazio}
          </Painel>

          <Painel titulo={`O que está travando? · ${r.restricoes.total}`} subtitulo="Restrições abertas ou concluídas no dia e as pendentes das frentes trabalhadas" acoes={<AcoesSecao texto={r.textos.restricoes} nome="Restrições" />}>
            {r.restricoes.total ? <Frentes grupos={r.restricoes.grupos} item={(x: Restricao) => (
              <div className="flex flex-col gap-0.5">
                <span><b className="text-m-text-primary">Nº {x.numero}</b> <span className="text-m-text-primary">{x.acao}</span>{' '}
                  <Pilula tom={x.marcador === 'concluida' ? 'sucesso' : x.marcador === 'atrasada' ? 'perigo' : x.marcador === 'nova' ? 'info' : 'neutro'}>{{ nova: 'nova', concluida: 'concluída hoje', atrasada: 'atrasada', pendente: 'pendente' }[x.marcador]}</Pilula>
                  {x.impeditivo && <> <Pilula tom="perigo">impeditiva</Pilula></>}</span>
                <span className="text-[12px] text-m-text-muted">{[x.atividade, x.responsavel, x.prazo_br && `prazo ${x.prazo_br}`, x.status].filter(Boolean).join(' · ')}</span>
              </div>
            )} /> : vazio}
          </Painel>

          <Painel titulo={`O que a segurança viu? · ${r.auditorias.total}`} subtitulo="Auditorias enviadas no dia" acoes={<AcoesSecao texto={r.textos.auditorias} nome="Auditorias" />}>
            {r.auditorias.total ? <Frentes grupos={r.auditorias.grupos} item={(x: Auditoria) => (
              <div className="flex flex-col gap-0.5">
                <span><b className="text-m-text-primary">{x.tipo ?? 'Auditoria'} Nº {x.numero}</b>{x.tipo_registro ? <span className="text-m-text-primary"> · {x.tipo_registro}</span> : null}{' '}
                  {x.ver_agir === true && <Pilula tom="sucesso">resolvido na hora</Pilula>}{x.ver_agir === false && <Pilula tom="atencao">ação aberta{x.acao_numero ? ` A-${x.acao_numero}` : ''}</Pilula>}</span>
                {x.nao_conformidade && <span className="text-[12.5px] text-m-text-secondary">{x.nao_conformidade}</span>}
                {x.medida_corretiva && <span className="text-[12px] text-m-text-muted">Medida: {x.medida_corretiva}</span>}
              </div>
            )} /> : vazio}
          </Painel>

          <Painel titulo={`Quem estava em cada frente? · ${r.equipes.itens.length}`}
            subtitulo={<>Presença do dia e as atividades executadas por equipe — <Calculado chave="presentes" memoria={memPresentes}>{`${r.equipes.presentes} presentes`}</Calculado></>}
            acoes={<AcoesSecao texto={r.textos.equipes} nome="Equipes" />}>
            {r.equipes.itens.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {r.equipes.itens.map((e) => (
                  <li key={e.equipe_id} className="flex flex-col gap-1 rounded-m-md border border-m-stroke-subtle p-3 text-[13px]">
                    <span className="flex items-baseline justify-between gap-2"><b className="text-m-text-primary">{e.nome}</b>
                      <span className="whitespace-nowrap text-[12.5px] text-m-text-secondary"><b className="text-m-text-primary">{e.presentes}</b>/{e.total} presentes</span></span>
                    {e.encarregado && <span className="text-[12px] text-m-text-muted">Enc. {e.encarregado}{e.setor ? ` · ${e.setor}` : ''}</span>}
                    {e.funcoes.length > 0 && <span className="text-[12px] text-m-text-secondary">{e.funcoes.join(', ')}</span>}
                    {e.atividades.length > 0
                      ? <ul className="mt-1 flex flex-col gap-0.5 border-t border-m-stroke-subtle pt-1.5">{e.atividades.map((a) => <li key={a} className="text-[12.5px] text-m-text-primary">▸ {a}</li>)}</ul>
                      : <span className="text-[12px] text-m-warning">sem atividade executada lançada</span>}
                  </li>
                ))}
              </ul>
            ) : vazio}
          </Painel>

          <Painel titulo={`Como ficou? · ${r.fotos.total} foto${r.fotos.total === 1 ? '' : 's'}`} subtitulo={`Marque as fotos que vão no envio (até ${MAX_FOTOS})`} acoes={<AcoesSecao texto={r.textos.fotos} nome="Fotos" />}>
            {r.fotos.total ? (
              <div className="flex flex-col gap-3">
                <Frentes grupos={r.fotos.grupos} item={(g: GrupoFoto) => (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-m-text-primary">{g.descricao} <span className="text-m-text-muted">({g.n} foto{g.n > 1 ? 's' : ''})</span></span>
                    <div className={`grid gap-1.5 ${compacto ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8'}`}>
                      {g.ids.map((id) => <Miniatura key={id} id={id} titulo={g.descricao} marcada={!semFotos.has(id)}
                        onTrocar={() => { const n = new Set(semFotos); n.has(id) ? n.delete(id) : n.add(id); setSemFotos(n); }} />)}
                    </div>
                  </div>
                )} />
              </div>
            ) : vazio}
          </Painel>
        </>
      )}
    </>
  );
}
