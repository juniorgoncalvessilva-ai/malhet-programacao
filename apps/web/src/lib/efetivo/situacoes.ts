import type { SituacaoEfetivo } from '@/lib/api/types';

export type TomSituacao = 'sucesso' | 'info' | 'atencao' | 'neutro' | 'perigo';
export const SITUACOES: { v: SituacaoEfetivo; rotulo: string; tom: TomSituacao }[] = [
  { v: 'MOBILIZADO', rotulo: 'Mobilizado', tom: 'sucesso' },
  { v: 'AGUARDANDO_CRACHA', rotulo: 'Aguardando crachá', tom: 'info' },
  { v: 'EM_PROCESSO', rotulo: 'Em processo', tom: 'info' },
  { v: 'PREVISTO', rotulo: 'Mobilização prevista', tom: 'info' },
  { v: 'AFASTADO', rotulo: 'Afastado', tom: 'atencao' },
  { v: 'DESMOBILIZADO', rotulo: 'Desmobilizado', tom: 'neutro' },
  { v: 'DESISTENCIA', rotulo: 'Desistência', tom: 'neutro' },
];
export const TOM_SITUACAO = Object.fromEntries(SITUACOES.map((x) => [x.v, x.tom])) as Record<SituacaoEfetivo, TomSituacao>;
export const ROTULO_SITUACAO = Object.fromEntries(SITUACOES.map((x) => [x.v, x.rotulo])) as Record<SituacaoEfetivo, string>;
