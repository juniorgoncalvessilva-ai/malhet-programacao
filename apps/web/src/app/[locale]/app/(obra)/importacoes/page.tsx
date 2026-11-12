'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculado, nbr } from '@/components/Obra/Calculado';
import { CalendarClock, FileSpreadsheet, Search, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Tabela, UploadForm, dataBR, fmt, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { CpuDoItem, Versao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type ResultadoWbs = { atividades: number; areas_novas: number; cwps_novos: number; iwps_novos: number; fora_do_cronograma: number };
type Resultado = { versoes: Record<string, number>; contagem: Record<string, number>; avisos: string[]; wbs?: ResultadoWbs };

function useImportar(caminho: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => api.post<Resultado>(caminho, fd),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['versoes-importacao'] });
      qc.invalidateQueries({ queryKey: ['programacao'] });
      toast.success(Object.entries(r.contagem).map(([t, n]) => `${t}: ${n}`).join(' · ') || 'Importado');
      r.avisos.slice(0, 5).forEach((a) => toast.warning(a));
      if (r.wbs && r.wbs.atividades) {
        qc.invalidateQueries({ queryKey: ['wbs'] });
        toast.info(`WBS de execução atualizada pelo cronograma: ${r.wbs.areas_novas} área(s), ${r.wbs.cwps_novos} CWP e ${r.wbs.iwps_novos} IWP novos${r.wbs.fora_do_cronograma ? ` · ${r.wbs.fora_do_cronograma} fora do cronograma` : ''}`);
      }
    },
  });
}

const nomeArquivo = (fd: FormData) => {
  const f = fd.get('arquivo');
  return f instanceof File ? f.name.replace(/\.[^.]+$/, '') : '';
};

function Bloco({ titulo, icone: Icone, caminho, accept, extra }: {
  titulo: string; icone: typeof Table2; caminho: string; accept: string; extra?: Record<string, string>;
}) {
  const m = useImportar(caminho);
  return (
    <Painel titulo={<span className="inline-flex items-center gap-2"><Icone size={18} className="text-m-accent" />{titulo}</span>}>
      <UploadForm
        campos={[{ nome: 'arquivo', rotulo: 'Arquivo' }]}
        accept={accept}
        rotulo="Importar"
        pendente={m.isPending}
        onEnviar={(fd) => {
          if (!(fd.get('arquivo') instanceof File) || !(fd.get('arquivo') as File).size) { toast.error('Escolha o arquivo.'); return; }
          if (!fd.get('rotulo')) fd.set('rotulo', nomeArquivo(fd));
          Object.entries(extra ?? {}).forEach(([k, v]) => fd.set(k, v));
          m.mutate(fd);
        }}
      >
        <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
          Rótulo da versão
          <input name="rotulo" placeholder="nome do arquivo" className="h-10 rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-[13px] font-normal normal-case tracking-normal text-m-text-primary outline-none focus:border-m-accent" />
        </label>
      </UploadForm>
      <Erro erro={m.error} />
    </Painel>
  );
}

export default function ImportacoesPage() {
  const api = useApi();
  const { pode } = useObra();
  const versoes = useQuery({ queryKey: ['versoes-importacao'], queryFn: () => api.get<Versao[]>('/referencias/versoes') });
  const admin = pode('admin');

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · importações"
        cor="var(--m-proc-medir)"
        titulo="De onde vêm os dados da programação"
      />
      {admin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Bloco titulo="Cronograma (P6 .xer)" icone={CalendarClock} caminho="/importar/xer" accept=".xer" />
          <Bloco titulo="PQ do contrato (abas PQ e MC)" icone={Table2} caminho="/importar/takeoff" accept=".xlsx,.xlsm" />
          <Bloco titulo="CPU da obra (Composição de Custo Unitário)" icone={FileSpreadsheet} caminho="/importar/cpu" accept=".xls,.xlsx" />
        </div>
      ) : (
        <Painel titulo="Somente o administrador da obra importa arquivos"><p className="text-sm text-m-text-secondary">Peça ao administrador para carregar o .xer ou o take-off atualizado.</p></Painel>
      )}

      <ConsultaCpu />

      <Painel titulo="Quais versões estão valendo?">
        <Tabela cabecalho={['Tipo', 'Rótulo', 'Arquivo', 'Itens', 'Carregada em', 'Situação']} vazio={!versoes.data?.length && (versoes.isLoading ? 'Carregando…' : 'Nada importado ainda.')}>
          {versoes.data?.map((v) => (
            <tr key={v.id} className={v.vigente ? '' : 'opacity-60'}>
              <td className={td}><b className="text-m-text-primary">{v.tipo}</b></td>
              <td className={td}>{v.rotulo}</td>
              <td className={td}>{v.arquivo_origem ?? '—'}</td>
              <td className={td}>{v.qtd_itens}</td>
              <td className={td}>{dataBR(v.carregado_em)}</td>
              <td className={td}><Pilula tom={v.vigente ? 'sucesso' : 'neutro'}>{v.vigente ? 'Vigente' : 'Histórico'}</Pilula></td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

/** Rastreio: item da PQ → composição → funções e equipamentos (h/un) → quem governa e índice. */
function ConsultaCpu() {
  const api = useApi();
  const [item, setItem] = useState('');
  const [busca, setBusca] = useState('');
  const q = useQuery({ queryKey: ['cpu-item', busca], queryFn: () => api.get<CpuDoItem>(`/cpu/item?item=${encodeURIComponent(busca)}`), enabled: !!busca, retry: false });
  const d = q.data;
  const rotaMem = `/cpu/item/memoria?item=${encodeURIComponent(busca)}`;
  return (
    <Painel titulo="Como a CPU calcula um item da PQ?">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setBusca(item.trim()); }}>
        <Campo rotulo="Item da PQ" value={item} onChange={(e) => setItem(e.target.value)} placeholder="1.8.3.1.2" className="w-[200px]" />
        <Botao type="submit" variante="secundario"><Search size={16} /> Consultar</Botao>
        <Erro erro={q.error} />
      </form>
      {d && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 text-[13px] md:grid-cols-4">
            <div><div className="text-[11px] uppercase text-m-text-muted">Serviço</div><b className="text-m-text-primary">{d.item}</b> {d.descricao}</div>
            <div><div className="text-[11px] uppercase text-m-text-muted">Composição</div><b className="text-m-text-primary">{d.composicao ?? '—'}</b> {d.descricao_composicao}</div>
            <div><div className="text-[11px] uppercase text-m-text-muted">Custo CPU · PU contrato</div>{d.custo_unitario != null ? `R$ ${fmt(d.custo_unitario)}` : '—'} · {d.pu != null ? `R$ ${fmt(d.pu)}` : '—'}</div>
            <div><div className="text-[11px] uppercase text-m-text-muted">Governa · índice · HH/un</div>
              {d.recurso_governa ? <><Calculado rota={rotaMem} chave="governa" className="font-semibold text-m-text-primary">{d.recurso_governa}</Calculado> · <Calculado rota={rotaMem} chave="indice">{`${fmt(d.indice_un_dia)} ${d.unid ?? 'un'}/dia por pessoa`}</Calculado> · <Calculado rota={rotaMem} chave="hh_un">{`${fmt(d.hh_un, 3)} HH/${d.unid ?? 'un'}`}</Calculado></> : 'sem mão de obra/equipamento na CPU'}</div>
          </div>
          <Tabela cabecalho={['Função / equipamento', 'Tipo', 'h por unidade', 'Unidades por dia (1 pessoa/equip.)']} vazio={!d.recursos.length && 'Composição sem mão de obra nem equipamento (subempreitado/verba).'}>
            {d.recursos.map((r) => (
              <tr key={r.recurso + r.tipo}>
                <td className={td}>{r.recurso === d.recurso_governa ? <b className="text-m-text-primary">{r.recurso} · governa</b> : r.recurso}</td>
                <td className={td}><Pilula ponto={false} tom={r.tipo === 'MOD' ? 'acento' : 'neutro'}>{r.tipo}</Pilula></td>
                <td className={td}>{r.tipo === 'MOD' ? <Calculado rota={rotaMem} chave="hh_un">{fmt(r.coef, 4)}</Calculado> : fmt(r.coef, 4)}</td>
                <td className={td}>{r.un_dia_por_pessoa != null ? <Calculado chave="un_dia" memoria={() => ({
                  chave: 'un_dia', titulo: `${r.recurso}: unidades por dia (1 pessoa/equipamento)`, valor: `${nbr(r.un_dia_por_pessoa)} ${d.unid ?? 'un'}/dia`,
                  formula: 'unidades por dia = jornada ÷ h por unidade',
                  passos: [{ descricao: r.recurso, conta: `${nbr(d.jornada)} h ÷ ${nbr(r.coef, 4)} h/${d.unid ?? 'un'}`, resultado: `${nbr(r.un_dia_por_pessoa)} ${d.unid ?? 'un'}/dia`, destaque: true }],
                  fontes: [{ dado: 'Jornada', valor: `${nbr(d.jornada)} h`, origem: 'jornada de referência do app', local: null },
                    { dado: `h/un de ${r.recurso}`, valor: nbr(r.coef, 4), origem: 'CPU da obra (vigente)', local: 'abra o HH por unidade para ver a linha de cada insumo' }],
                  notas: [],
                })}>{fmt(r.un_dia_por_pessoa)}</Calculado> : '—'}</td>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
    </Painel>
  );
}
