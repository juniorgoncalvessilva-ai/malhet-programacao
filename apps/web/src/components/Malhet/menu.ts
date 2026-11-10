import { CalendarRange, Database, GitMerge, Users, type LucideIcon } from 'lucide-react';

export interface ItemMenu { titulo: string; url: string; icone: LucideIcon; admin?: boolean }
export interface GrupoMenu { etapa: string; cor: string; itens: ItemMenu[] }

/** Menu do app "Programação" dentro do Malhet, por etapa (cores proc-* do CorpMind). */
export const MENU: GrupoMenu[] = [
  {
    etapa: 'Planejar',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Programação semanal', url: '/app/programacao', icone: CalendarRange },
      { titulo: 'Equipes', url: '/app/equipes', icone: Users },
    ],
  },
  {
    etapa: 'Referências',
    cor: 'var(--m-proc-medir)',
    itens: [
      { titulo: 'Versões e vínculos', url: '/app/referencias', icone: GitMerge },
      { titulo: 'Cadastros Simova', url: '/app/cadastros', icone: Database },
    ],
  },
];

export const APP_NOME = 'Programação';
export const OBRA = {
  sigla: process.env.NEXT_PUBLIC_OBRA_SIGLA ?? '310',
  nome: process.env.NEXT_PUBLIC_OBRA_NOME ?? 'Obra 310 · Obras civis',
  contrato: process.env.NEXT_PUBLIC_OBRA_CONTRATO ?? 'Programa Tamanduá · Fase 2',
};
