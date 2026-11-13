'use client';

import { Plus, Settings2, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { DetalheRegistro, corStatusRegistro } from '@/components/Auditoria/DetalheRegistro';
import { FilaAuditorias } from '@/components/Auditoria/FilaAuditorias';
import { FormAuditoria } from '@/components/Auditoria/FormAuditoria';
import { Botao, Cabecalho, Campo, Indicador, Painel, Selecao } from '@/components/Obra/ui';
import { Link } from '@/i18n/navigation';
import { useObra } from '@/lib/obra/ObraProvider';
import { dataBR, useModelosAuditoria, useRegistrosAuditoria } from '@/lib/auditorias';

const menos = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

/** Auditorias e inspeções (spec 064): registros por modelo, situação, fotos, ação gerada e envio pelo WhatsApp. */
export default function AuditoriasPage() {
  const { pode, papel } = useObra();
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(menos(0));
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const [nova, setNova] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const modelos = useModelosAuditoria();
  const tipos = [...new Set((modelos.data ?? []).flatMap((m) => m.config.tipos.map((t) => t.nome)))];
  const q = useRegistrosAuditoria(`?de=${de}&ate=${ate}${tipo ? `&tipo=${encodeURIComponent(tipo)}` : ''}${status ? `&status=${status}` : ''}`);
  const regs = q.data ?? [];
  const pode_ = pode('encarregado') || papel === 'seguranca';
  return (
    <>
      <Cabecalho eyebrow="Governança · auditorias e inspeções" titulo="Auditorias"
        acoes={<>
          {(pode('planejador') || papel === 'seguranca') && <Link href="/app/auditorias/modelos"><Botao variante="secundario"><Settings2 size={16} /> Modelos</Botao></Link>}
          <Link href="/app/acoes"><Botao variante="secundario">Plano de ação 5W2H</Botao></Link>
          {pode_ && <Botao onClick={() => setNova(true)}><Plus size={16} /> Nova auditoria</Botao>}
        </>} />
      <FilaAuditorias />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Registros no período" valor={regs.length} />
        <Indicador rotulo="Adequadas na hora (ver e agir)" valor={regs.filter((r) => r.status === 'adequada').length} />
        <Indicador rotulo="Em plano de ação" valor={regs.filter((r) => r.status === 'plano').length} />
        <Indicador rotulo="Concluídas" valor={regs.filter((r) => r.status === 'concluida').length} />
      </div>
      {nova && (
        <Painel titulo="Nova auditoria" acoes={<Botao variante="fantasma" onClick={() => setNova(false)}><X size={16} /> Fechar</Botao>}>
          <div className="mx-auto flex max-w-xl flex-col gap-3"><FormAuditoria /></div>
        </Painel>
      )}
      <Painel titulo="Registros">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{tipos.map((t) => <option key={t}>{t}</option>)}</Selecao>
          <Selecao rotulo="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option><option value="adequada">Adequada na hora</option><option value="plano">Em plano de ação</option><option value="concluida">Concluída</option><option value="rascunho">Rascunho</option>
          </Selecao>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted"><tr><th className="py-2">Nº</th><th>Data</th><th>Tipo · registro</th><th>Frente</th><th>Não conformidade</th><th>Encarregado</th><th>Situação</th></tr></thead>
          <tbody>
            {regs.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => setAberto(aberto === r.id ? null : r.id)} className="cursor-pointer border-t border-m-stroke-subtle hover:bg-m-surface-hover">
                  <td className="py-2 font-semibold">{r.numero}</td><td>{dataBR(r.data)}</td>
                  <td><b>{r.tipo}</b><span className="block text-[12px] text-m-text-muted">{r.tipo_registro}</span></td>
                  <td>{r.area_texto ?? '—'}</td><td className="max-w-[340px] truncate">{r.nao_conformidade}</td><td>{r.encarregado ?? '—'}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${corStatusRegistro(r.status)}`}>{r.status_rotulo}</span></td>
                </tr>
                {aberto === r.id && <tr><td colSpan={7} className="bg-m-surface-base p-3"><DetalheRegistro r={r} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
        {q.data && !regs.length && <p className="py-3 text-[13px] text-m-text-muted">Nenhum registro no período.</p>}
      </Painel>
    </>
  );
}
