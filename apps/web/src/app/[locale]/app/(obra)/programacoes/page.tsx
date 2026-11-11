'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Chip, Erro, Painel, Pilula, Selecao, Tabela, dataBR, td } from '@/components/Obra/ui';
import { k, useAcao, useProgramacoes } from '@/hooks/programacao/planejamento';
import { Link, useRouter } from '@/i18n/navigation';
import type { ProgramacaoResumo } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const hoje = () => new Date().toISOString().slice(0, 10);

export default function ProgramacoesPage() {
  const lista = useProgramacoes();
  const { pode } = useObra();
  const router = useRouter();
  const [tipo, setTipo] = useState<'SEMANAL' | 'MENSAL'>('SEMANAL');
  const [ref, setRef] = useState(hoje());
  const [copiar, setCopiar] = useState('');
  const [filtro, setFiltro] = useState<'TODAS' | 'SEMANAL' | 'MENSAL'>('TODAS');
  const criar = useAcao(
    (api, d: { tipo: string; referencia: string; copiar_de: number | null }) => api.post<ProgramacaoResumo>('/programacoes', d),
    [[...k.programacoes]],
  );
  const itens = (lista.data ?? []).filter((p) => filtro === 'TODAS' || p.tipo === filtro);
  const semanais = (lista.data ?? []).filter((p) => p.tipo === tipo);

  return (
    <>
      <Cabecalho
        eyebrow="Programação · semanal e mensal"
        titulo={lista.data?.length ? `${lista.data.length} programaç${lista.data.length > 1 ? 'ões' : 'ão'} nesta obra` : 'Nenhuma programação ainda'}
        descricao="A semanal vai da sexta de uma semana ao sábado da seguinte (9 dias), para emendar uma semana na outra. A mensal é dia a dia. Monte por Local → Área → atividade e emita no formato da obra."
      />
      {pode('planejador') && (
        <Painel titulo="Nova programação" subtitulo="Na semanal, qualquer data cai na sexta de emissão da semana.">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
            e.preventDefault();
            criar.mutate({ tipo, referencia: ref, copiar_de: copiar ? Number(copiar) : null }, {
              onSuccess: (p) => { toast.success(p.titulo); router.push(`/app/programacoes/${p.id}`); },
            });
          }}>
            <div className="flex gap-2">
              <Chip ativo={tipo === 'SEMANAL'} onClick={() => setTipo('SEMANAL')}>Semanal</Chip>
              <Chip ativo={tipo === 'MENSAL'} onClick={() => setTipo('MENSAL')}>Mensal</Chip>
            </div>
            <Campo rotulo={tipo === 'SEMANAL' ? 'Data da semana' : 'Um dia do mês'} type="date" required value={ref} onChange={(e) => setRef(e.target.value)} className="w-[180px]" />
            <Selecao rotulo="Copiar linhas de" value={copiar} onChange={(e) => setCopiar(e.target.value)} className="min-w-[260px]">
              <option value="">— começar vazia —</option>
              {semanais.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </Selecao>
            <Botao type="submit" disabled={criar.isPending}><Plus size={16} /> Criar</Botao>
          </form>
          <Erro erro={criar.error} />
        </Painel>
      )}
      <Painel
        titulo="Quais programações existem?"
        acoes={<div className="flex gap-2">{(['TODAS', 'SEMANAL', 'MENSAL'] as const).map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f === 'TODAS' ? 'Todas' : f === 'SEMANAL' ? 'Semanais' : 'Mensais'}</Chip>)}</div>}
      >
        <Tabela cabecalho={['Programação', 'Período', 'Linhas', 'Situação', '']} vazio={!itens.length && (lista.isLoading ? 'Carregando…' : 'Nenhuma ainda.')}>
          {itens.map((p) => (
            <tr key={p.id}>
              <td className={td}><Link href={`/app/programacoes/${p.id}`} className="font-semibold text-m-text-primary hover:text-m-accent">{p.titulo}</Link></td>
              <td className={td}>{dataBR(p.inicio)} a {dataBR(p.fim)}</td>
              <td className={td}>{p.linhas}</td>
              <td className={td}>
                <Pilula tom={p.status === 'concluida' ? 'sucesso' : p.status === 'emitida' ? 'acento' : 'neutro'}>{p.status === 'concluida' ? 'Concluída' : p.status === 'emitida' ? `Emitida · rev. ${p.revisao - 1}` : p.revisao ? `Reaberta · rev. ${p.revisao}` : 'Rascunho'}</Pilula>
              </td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Link href={`/app/programacoes/${p.id}`} className="mr-4 font-semibold text-m-accent">Montar</Link>
                <Link href={`/app/programacoes/${p.id}/imprimir`} className="font-semibold text-m-accent">Imprimir</Link>
              </td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
