import { Building2, CalendarRange, Database, GitMerge, KeyRound, Users, type LucideIcon } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

export interface ItemMenu { titulo: string; url: string; icone: LucideIcon; minimo?: PapelObra; superadmin?: boolean }
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
  {
    etapa: 'Administrar',
    cor: 'var(--m-proc-administrar)',
    itens: [
      { titulo: 'Acessos da obra', url: '/app/acessos', icone: KeyRound, minimo: 'admin' },
      { titulo: 'Obras e usuários', url: '/app/admin/obras', icone: Building2, superadmin: true },
    ],
  },
];

export const APP_NOME = 'Programação';
