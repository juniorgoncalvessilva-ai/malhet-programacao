'use client';

import { IdCard, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Campo, Erro, Pilula, Selecao, dataBR, fmt } from '@/components/Obra/ui';
import { FormAso, FormTurma } from '@/components/Treinamentos/Formularios';
import { EtapasProcesso } from '@/components/Efetivo/Mobilizacao';
import { useMovimentosColaborador } from '@/components/Efetivo/useMovimentos';
import { useFicha, usePessoaSeguranca, useProcessos, useTreinamentos } from '@/hooks/programacao/treinamentos';
import { useApi } from '@/hooks/programacao/useApi';
import { Link } from '@/i18n/navigation';
import type { FichaColaborador as Ficha } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { SITUACOES, TOM_SITUACAO } from '@/lib/efetivo/situacoes';
import { VALIDADE } from '@/lib/treinamentos/validade';

const CONTRATOS = ['CLT', 'Temporário', 'Experiência', 'Terceiro', 'PJ', 'Aprendiz', 'Estágio'];
const CNH = ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];
const TURNOS = ['Diurno', 'Noturno', 'Administrativo', 'Turno A', 'Turno B', 'Turno C'];

type Form = Record<string, string | boolean>;
const VAZIO: Form = {
  nome: '', empresa: 'Própria', matricula: '', cracha: '', funcao: '', situacao: 'EM_PROCESSO', dp: '', tipo_mo: '',
  admissao: '', demissao: '', mobilizacao_prevista: '', apelido: '', email_corporativo: '', centro_custo: '',
  tipo_contrato: '', turno: '', horas_dia: '', alojamento: '', folga_campo: '', fim_experiencia: '', brigadista: false,
  periculosidade: false, insalubridade: false, cnh_categoria: '', cnh_validade: '', observacoes: '',
};
const doColab = (c: Ficha): Form => Object.fromEntries(Object.keys(VAZIO).map((k) => {
  const v = (c as unknown as Record<string, unknown>)[k];
  return [k, typeof VAZIO[k] === 'boolean' ? !!v : v == null ? '' : String(v)];
}));
const paraApi = (f: Form) => Object.fromEntries(Object.entries(f).map(([k, v]) =>
  [k, typeof v === 'boolean' ? v : k === 'horas_dia' ? (v ? Number(String(v).replace(',', '.')) : null) : (String(v).trim() || null)]));

type Aba = 'dados' | 'contrato' | 'seguranca' | 'mobilizacao' | 'historico';

/**
 * Ficha do colaborador (spec 087): criar, editar e excluir; ASOs e treinamentos (spec 088), processos de mobilização e
 * histórico. Só dados operacionais — sem CPF, RG, endereço, telefone, nascimento ou saúde (LGPD).
 */
export function FichaColaborador({ id, onFechar, onCriado }: { id: number | null; onFechar: () => void; onCriado?: (id: number) => void }) {
  const { pode, editaSsma } = useObra();
  const planejar = pode('planejador');
  const api = useApi();
  const confirmar = useConfirmar();
  const ficha = useFicha(id);
  const [f, setF] = useState<Form>(VAZIO);
  const [aba, setAba] = useState<Aba>('dados');
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (ficha.data) setF(doColab(ficha.data)); }, [ficha.data]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const marca = (k: string) => (e: { target: { checked: boolean } }) => setF((x) => ({ ...x, [k]: e.target.checked }));

  const salvar = async () => {
    setSalvando(true);
    try {
      if (id) {
        await api.put(`/efetivo/colaboradores/${id}`, paraApi(f));
        toast.success('Ficha salva');
      } else {
        const r = await api.post<Ficha>('/efetivo/colaboradores', paraApi(f));
        toast.success(`${r.nome} incluído no efetivo`);
        onCriado?.(r.id);
      }
      setErro(null);
    } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  const excluir = async () => {
    if (!ficha.data) return;
    const ok = await confirmar({
      titulo: `Excluir ${ficha.data.nome} do efetivo?`,
      mensagem: 'Use só para cadastro feito por engano. Quem tem presença, assinatura ou termo LGPD não sai: mude a situação para Desmobilizado. Se a pessoa vier na próxima planilha do DP, ela volta.',
      acao: 'Excluir',
    });
    if (!ok) return;
    const nome = ficha.data.nome;
    onFechar(); // fecha antes: a ficha aberta não tenta recarregar quem já saiu
    try { await api.del(`/efetivo/colaboradores/${id}`); toast.success(`${nome} excluído do efetivo`); }
    catch (e) { toast.error((e as Error).message); }
  };

  const c = ficha.data;
  const ro = !planejar;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-[4vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Ficha do colaborador" className="flex w-[980px] max-w-full flex-col gap-4 rounded-m-lg border border-m-stroke bg-m-surface-raised p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 rounded-full bg-m-accent-subtle p-2 text-m-accent"><IdCard size={20} /></span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Ficha do colaborador</p>
              <h2 className="text-[18px] font-semibold text-m-text-primary">{id ? (c?.nome ?? '…') : 'Novo colaborador'}</h2>
              {c && <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-m-text-muted">
                <Pilula tom={TOM_SITUACAO[c.situacao]}>{c.situacao_rotulo}</Pilula>
                <span>{c.matricula ? `mat. ${c.matricula}` : 'sem matrícula'}{c.cracha && c.cracha !== c.matricula ? ` · crachá ${c.cracha}` : ''}</span>
                <span>{c.empresa}</span>
                {c.equipe && <span>· {c.encarregado_de ? `encarregado de ${c.encarregado_de}` : c.equipe}</span>}
                <span>· origem {({ efetivo: 'planilha do DP', manual: 'cadastro manual', campo: 'campo', simova: 'Simova' } as Record<string, string>)[c.origem] ?? c.origem}</span>
              </div>}
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="rounded-full p-1.5 text-m-text-muted hover:bg-m-surface-hover"><X size={18} /></button>
        </div>

        <Abas rotulo="Seções da ficha" ativa={aba} onTrocar={setAba} abas={[
          { chave: 'dados', titulo: 'Dados' }, { chave: 'contrato', titulo: 'Contrato e jornada' },
          { chave: 'seguranca', titulo: 'ASO e treinamentos', visivel: !!id }, { chave: 'mobilizacao', titulo: 'Mobilização', visivel: !!id },
          { chave: 'historico', titulo: 'Histórico', visivel: !!id },
        ]} />

        {id && ficha.isLoading && <Carregando />}

        {(aba === 'dados' || aba === 'contrato') && (!id || c) && <>
          <fieldset disabled={ro} className="grid gap-3 md:grid-cols-4">
            {aba === 'dados' && <>
              <Campo rotulo="Nome completo" required className="md:col-span-2" value={String(f.nome)} onChange={set('nome')} />
              <Campo rotulo="Apelido / nome de guerra" value={String(f.apelido)} onChange={set('apelido')} />
              <Selecao rotulo="Situação" value={String(f.situacao)} onChange={set('situacao')}>
                {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.rotulo}</option>)}
              </Selecao>
              <Campo rotulo="Empresa" value={String(f.empresa)} onChange={set('empresa')} />
              <Campo rotulo="Matrícula" value={String(f.matricula)} onChange={set('matricula')} />
              <Campo rotulo="Crachá do Simova" placeholder={f.empresa === 'Própria' ? 'vazio = matrícula' : ''} value={String(f.cracha)} onChange={set('cracha')} />
              <Campo rotulo="Função" value={String(f.funcao)} onChange={set('funcao')} />
              <Campo rotulo="DP" value={String(f.dp)} onChange={set('dp')} />
              <Selecao rotulo="Tipo de MO" value={String(f.tipo_mo)} onChange={set('tipo_mo')}>
                <option value="">—</option><option>MOD</option><option>MOI</option>
              </Selecao>
              <Campo rotulo="Centro de custo" value={String(f.centro_custo)} onChange={set('centro_custo')} />
              <Campo rotulo="E-mail corporativo" type="email" value={String(f.email_corporativo)} onChange={set('email_corporativo')} />
              <Campo rotulo="Observações" className="md:col-span-4" value={String(f.observacoes)} onChange={set('observacoes')} />
            </>}
            {aba === 'contrato' && <>
              <Selecao rotulo="Tipo de contrato" value={String(f.tipo_contrato)} onChange={set('tipo_contrato')}>
                <option value="">—</option>{CONTRATOS.map((x) => <option key={x}>{x}</option>)}
              </Selecao>
              <Campo rotulo="Admissão" type="date" value={String(f.admissao)} onChange={set('admissao')} />
              <Campo rotulo="Fim da experiência" type="date" value={String(f.fim_experiencia)} onChange={set('fim_experiencia')} />
              <Campo rotulo="Demissão" type="date" value={String(f.demissao)} onChange={set('demissao')} />
              <Campo rotulo="Mobilização prevista" type="date" value={String(f.mobilizacao_prevista)} onChange={set('mobilizacao_prevista')} />
              <Selecao rotulo="Turno" value={String(f.turno)} onChange={set('turno')}>
                <option value="">—</option>{TURNOS.map((x) => <option key={x}>{x}</option>)}
              </Selecao>
              <Campo rotulo="Horas por dia" type="number" step="0.25" min={1} max={24} value={String(f.horas_dia)} onChange={set('horas_dia')} />
              <Campo rotulo="Folga de campo" placeholder="ex.: 60×10" value={String(f.folga_campo)} onChange={set('folga_campo')} />
              <Campo rotulo="Alojamento" placeholder="alojamento, república, local…" value={String(f.alojamento)} onChange={set('alojamento')} />
              <Selecao rotulo="CNH" value={String(f.cnh_categoria)} onChange={set('cnh_categoria')}>
                <option value="">—</option>{CNH.map((x) => <option key={x}>{x}</option>)}
              </Selecao>
              <Campo rotulo="Validade da CNH" type="date" value={String(f.cnh_validade)} onChange={set('cnh_validade')} />
              <div className="flex flex-wrap items-center gap-4 pt-5 text-[13px] text-m-text-secondary md:col-span-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.brigadista} onChange={marca('brigadista')} /> Brigadista</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.periculosidade} onChange={marca('periculosidade')} /> Adicional de periculosidade</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.insalubridade} onChange={marca('insalubridade')} /> Insalubridade</label>
              </div>
            </>}
          </fieldset>
          {planejar && (
            <div className="flex flex-wrap items-center gap-2 border-t border-m-stroke-subtle pt-4">
              <Botao disabled={salvando || String(f.nome).trim().length < 3} onClick={salvar}>{salvando ? 'Salvando…' : id ? 'Salvar ficha' : 'Incluir no efetivo'}</Botao>
              {id && <Botao variante="perigo" onClick={excluir}><Trash2 size={15} /> Excluir</Botao>}
              <span className="text-[12px] text-m-text-muted">{id ? 'A próxima planilha do DP atualiza nome, função e situação pela matrícula.' : 'Sem matrícula a chave é provisória pelo nome; quando a matrícula chegar na planilha do DP, é o mesmo registro.'}</span>
              <Erro erro={erro} />
            </div>
          )}
        </>}

        {aba === 'seguranca' && id && <Seguranca id={id} podeEditar={editaSsma} />}
        {aba === 'mobilizacao' && id && <MobilizacaoDaPessoa id={id} />}
        {aba === 'historico' && id && <Historico id={id} />}
      </div>
    </div>,
    document.body,
  );
}

function Seguranca({ id, podeEditar }: { id: number; podeEditar: boolean }) {
  const p = usePessoaSeguranca(id);
  const trein = useTreinamentos();
  const api = useApi();
  const confirmar = useConfirmar();
  const [novo, setNovo] = useState<'aso' | 'trein' | null>(null);
  if (!p.data) return <Carregando />;
  const d = p.data;
  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-m-md border px-4 py-2 text-[13px] ${d.impedida ? 'border-m-danger/40 bg-m-danger-subtle' : 'border-m-success/40 bg-m-success-subtle'}`}>
        {d.impedida ? <><b>Impedida de trabalhar:</b> {d.impedimentos.join(', ')}</> : <b>Liberada: ASO em dia e nenhum treinamento impeditivo pendente.</b>}
        {!!d.pendentes.length && <span className="text-m-text-secondary"> · Pendentes: {d.pendentes.join(', ')}</span>}
        {!d.funcao_tem_exigencia && <span className="text-m-text-muted"> · A função não tem treinamentos exigidos cadastrados (Cadastros de SSMA › Exigência por função).</span>}
      </div>
      {podeEditar && (
        <div className="flex flex-wrap gap-2">
          <Botao variante={novo === 'aso' ? 'primario' : 'secundario'} onClick={() => setNovo(novo === 'aso' ? null : 'aso')}>+ ASO</Botao>
          <Botao variante={novo === 'trein' ? 'primario' : 'secundario'} onClick={() => setNovo(novo === 'trein' ? null : 'trein')}>+ Treinamento</Botao>
        </div>
      )}
      {novo === 'aso' && <FormAso colaboradorId={id} onFeito={() => setNovo(null)} onCancelar={() => setNovo(null)} />}
      {novo === 'trein' && <FormTurma treinamentos={trein.data ?? []} colaboradorId={id} onFeito={() => setNovo(null)} onCancelar={() => setNovo(null)} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold">ASOs</h3>
          {!d.asos.length && <p className="text-[13px] text-m-text-muted">Nenhum ASO registrado.</p>}
          {d.asos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 border-b border-m-row py-1.5 text-[13px]">
              <span><b>{a.tipo_rotulo}</b> · {dataBR(a.data_exame)} → {dataBR(a.valido_ate)} · {a.resultado_rotulo}</span>
              <span className="flex items-center gap-2"><Pilula tom={VALIDADE[a.situacao].tom}>{VALIDADE[a.situacao].rotulo}</Pilula>
                {podeEditar && <button type="button" aria-label="Excluir ASO" className="text-m-text-muted hover:text-m-danger"
                  onClick={() => confirmar({ titulo: `Excluir o ASO ${a.tipo_rotulo.toLowerCase()} de ${dataBR(a.data_exame)}?`, executar: () => api.del(`/treinamentos/asos/${a.id}`) })}><Trash2 size={14} /></button>}
              </span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold">Treinamentos exigidos</h3>
          {!d.exigidos.length && <p className="text-[13px] text-m-text-muted">Nenhum exigido para a função.</p>}
          {d.exigidos.map((t) => {
            const cel = d.celulas[String(t.id)];
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 border-b border-m-row py-1.5 text-[13px]">
                <span>{t.nome}{t.impeditivo && <span className="ml-1 text-[11px] font-semibold text-m-danger">impeditivo</span>}</span>
                <span className="flex items-center gap-2 text-m-text-muted">{cel?.valido_ate ? `até ${dataBR(cel.valido_ate)}` : ''}
                  <Pilula tom={VALIDADE[cel?.situacao ?? 'FALTANDO'].tom}>{VALIDADE[cel?.situacao ?? 'FALTANDO'].rotulo}</Pilula></span>
              </div>
            );
          })}
          <h3 className="mb-2 mt-4 text-[13px] font-semibold">Todos os registros</h3>
          {d.registros.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b border-m-row py-1.5 text-[13px]">
              <span>{r.treinamento} · {dataBR(r.realizado_em)}{r.valido_ate ? ` → ${dataBR(r.valido_ate)}` : ' (não vence)'}</span>
              {podeEditar && <button type="button" aria-label="Excluir registro" className="text-m-text-muted hover:text-m-danger"
                onClick={() => confirmar({ titulo: `Excluir o registro de ${r.treinamento}?`, executar: () => api.del(`/treinamentos/registros/${r.id}`) })}><Trash2 size={14} /></button>}
            </div>
          ))}
          {!d.registros.length && <p className="text-[13px] text-m-text-muted">Nenhum treinamento registrado.</p>}
        </div>
      </div>
    </div>
  );
}

function MobilizacaoDaPessoa({ id }: { id: number }) {
  const ps = useProcessos(id);
  if (!ps.data) return <Carregando />;
  if (!ps.data.length) return <p className="text-[13px] text-m-text-muted">Nenhum processo de mobilização. <Link href="/app/efetivo/mobilizacao" className="font-semibold text-m-accent">Abrir em Mobilização</Link></p>;
  return (
    <div className="flex flex-col gap-3">
      {ps.data.map((p) => (
        <div key={p.id} className="rounded-m-md border border-m-stroke-subtle p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
            <b>#{p.id} {p.funcao ?? ''}</b><Pilula tom={p.status === 'MOBILIZADO' ? 'sucesso' : p.status === 'DESISTENCIA' ? 'neutro' : 'info'}>{p.status_rotulo}</Pilula>
            <span className="text-m-text-muted">{fmt(p.dias_total, 1)} dias no total{p.requisicao ? ` · requisição ${p.requisicao}` : ''}</span>
          </div>
          <EtapasProcesso p={p} />
        </div>
      ))}
    </div>
  );
}

function Historico({ id }: { id: number }) {
  const m = useMovimentosColaborador(id);
  if (!m.data) return <Carregando />;
  if (!m.data.length) return <p className="text-[13px] text-m-text-muted">Sem movimentos.</p>;
  const rot: Record<string, string> = { ENTRADA: 'entrou no efetivo', SITUACAO: 'situação', FUNCAO: 'função', EQUIPE: 'equipe', FORA_DO_ARQUIVO: 'não veio no arquivo' };
  return (
    <div className="max-h-[50vh] overflow-auto text-[13px]">
      {m.data.map((x) => (
        <div key={x.id} className="flex flex-wrap gap-x-2 border-b border-m-row py-1.5">
          <span className="w-[130px] shrink-0 text-m-text-muted">{new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span className="text-m-text-secondary">{rot[x.tipo] ?? x.tipo}</span>
          {(x.de || x.para) && <span>{x.de ?? '—'} → <b>{x.para ?? '—'}</b></span>}
        </div>
      ))}
    </div>
  );
}

