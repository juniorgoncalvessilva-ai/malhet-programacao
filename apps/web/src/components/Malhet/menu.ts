import { AlertTriangle, BarChart3, BookOpen, Building2, CalendarRange, ClipboardList, FileUp, GanttChart, GitFork, HardHat, IdCard, KeyRound, ListTree, MapPin, Network, Shuffle, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
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
      { titulo: 'WBS de execução', url: '/app/wbs', icone: ListTree },
      { titulo: 'Programações', url: '/app/programacoes', icone: CalendarRange },
      { titulo: 'PTO (planejamento)', url: '/app/pto', icone: ClipboardList, minimo: 'planejador' },
      { titulo: 'SSMA da programação', url: '/app/ssma', icone: HardHat, ssma: true },
      { titulo: 'Desvios (Pareto)', url: '/app/desvios', icone: AlertTriangle },
      { titulo: 'Indicadores', url: '/app/indicadores', icone: BarChart3 },
    ],
  },
  {
    etapa: 'Efetivo',
    cor: 'var(--m-proc-executar)',
    itens: [
      { titulo: 'Efetivo e mobilização', url: '/app/efetivo', icone: IdCard },
      { titulo: 'Equipes', url: '/app/equipes', icone: Users },
      { titulo: 'Setores da obra', url: '/app/efetivo/setores', icone: Network },
      { titulo: 'Organograma', url: '/app/efetivo/organograma', icone: GitFork },
      { titulo: 'De-para de funções', url: '/app/efetivo/funcoes', icone: Shuffle },
    ],
  },
  {
    etapa: 'Cadastros',
    cor: 'var(--m-proc-medir)',
    itens: [
      { titulo: 'Frentes', url: '/app/frentes', icone: MapPin },
      { titulo: 'Catálogo de atividades', url: '/app/catalogo', icone: BookOpen },
      { titulo: 'Importações', url: '/app/importacoes', icone: FileUp },
      { titulo: 'Cadastros de SSMA', url: '/app/ssma/cadastros', icone: ShieldCheck, ssma: true },
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
