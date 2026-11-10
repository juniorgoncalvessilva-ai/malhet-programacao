import { BookOpen, Building2, CalendarRange, FileUp, GanttChart, HardHat, KeyRound, MapPin, Users, type LucideIcon } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

export interface ItemMenu { titulo: string; url: string; icone: LucideIcon; minimo?: PapelObra; superadmin?: boolean; ssma?: boolean }
export interface GrupoMenu { etapa: string; cor: string; itens: ItemMenu[] }

/** Menu do app "Programação" dentro do Malhet, por etapa (cores proc-* do CorpMind). */
export const MENU: GrupoMenu[] = [
  {
    etapa: 'Programar',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Cronograma', url: '/app/cronograma', icone: GanttChart },
      { titulo: 'Programações', url: '/app/programacoes', icone: CalendarRange },
      { titulo: 'SSMA da programação', url: '/app/ssma', icone: HardHat, ssma: true },
      { titulo: 'Equipes', url: '/app/equipes', icone: Users },
    ],
  },
  {
    etapa: 'Cadastros',
    cor: 'var(--m-proc-medir)',
    itens: [
      { titulo: 'Frentes', url: '/app/frentes', icone: MapPin },
      { titulo: 'Catálogo de atividades', url: '/app/catalogo', icone: BookOpen },
      { titulo: 'Importações', url: '/app/importacoes', icone: FileUp },
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
