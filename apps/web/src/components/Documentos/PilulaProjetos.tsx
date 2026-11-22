'use client';

import { FileStack } from 'lucide-react';
import { Calculado } from '@/components/Obra/Calculado';
import { TOM_STATUS, type SituacaoFrente } from '@/lib/documentos/ativos';

const COR: Record<string, string> = {
  sucesso: 'bg-m-success-subtle text-m-success', info: 'bg-m-info-subtle text-m-info', atencao: 'bg-m-warning-subtle text-m-warning',
  perigo: 'bg-m-danger-subtle text-m-danger', neutro: 'bg-m-surface-active text-m-text-secondary',
};

/** Situação dos projetos da frente (controle de projetos por ativo, spec 133): status do ativo + projetos com revisão vigente. */
export function PilulaProjetos({ s }: { s?: SituacaoFrente }) {
  if (!s) return null;
  const titulo = s.ativos.map((a) => `${a.texto}: ${a.status_texto ?? s.rotulo}`).join('\n') + (s.confirmada ? '' : '\n(frente só sugerida pelo nome)');
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-[6px] px-1.5 py-px align-middle text-[10.5px] font-semibold ${COR[TOM_STATUS[s.status]]}`} title={titulo}>
      <FileStack size={11} strokeWidth={1.75} /> {s.rotulo}{!s.confirmada && '?'}
      {s.total > 0 && <> · <Calculado chave="projetos" memoria={() => s.memoria}>{s.vigentes}/{s.total}</Calculado> vigentes</>}
    </span>
  );
}
