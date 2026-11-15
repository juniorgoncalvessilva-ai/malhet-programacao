import type { Validade } from '@/lib/api/types';

/** Situação de validade de ASO/treinamento (spec 088): rótulo e tom da pílula. */
export const VALIDADE: Record<Validade, { rotulo: string; tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro' }> = {
  VALIDO: { rotulo: 'Válido', tom: 'sucesso' },
  VENCENDO: { rotulo: 'Vencendo', tom: 'atencao' },
  VENCIDO: { rotulo: 'Vencido', tom: 'perigo' },
  FALTANDO: { rotulo: 'Faltando', tom: 'perigo' },
};
export const TIPOS_ASO = [
  ['ADMISSIONAL', 'Admissional'], ['PERIODICO', 'Periódico'], ['MUDANCA_FUNCAO', 'Mudança de função'],
  ['RETORNO', 'Retorno ao trabalho'], ['DEMISSIONAL', 'Demissional'],
] as const;
export const RESULTADOS_ASO = [['APTO', 'Apto'], ['APTO_COM_RESTRICAO', 'Apto com restrição'], ['INAPTO', 'Inapto']] as const;
export const hojeISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
