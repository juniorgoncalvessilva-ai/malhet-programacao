import { AlertTriangle, Images, ShieldAlert, ListChecks, ScanFace, Fingerprint, CalendarClock, Eye, Palette, BarChart3, BookOpen, Columns3, Fish, CalendarRange, ClipboardList, FileUp, GanttChart, GitFork, HardHat, IdCard, KeyRound, ListTree, MapPin, Network, Shuffle, ShieldCheck, Users, type LucideIcon, Wind } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

export interface ItemMenu { titulo: string; url: string; icone: LucideIcon; minimo?: PapelObra; superadmin?: boolean; ssma?: boolean }
export interface GrupoMenu { etapa: string; cor: string; itens: ItemMenu[] }

/** Menu do app "Programação" dentro do Malhet, por etapa (cores proc-* do CorpMind). */
export const MENU: GrupoMenu[] = [
  {
    etapa: 'Programar',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Programação vigente', url: '/app/vigente', icone: Eye },
      { titulo: 'Cronograma', url: '/app/cronograma', icone: GanttChart },
      { titulo: 'WBS de execução', url: '/app/wbs', icone: ListTree },
      { titulo: 'Plano de 90 dias', url: '/app/plano', icone: CalendarClock },
      { titulo: 'Programações', url: '/app/programacoes', icone: CalendarRange },
      { titulo: 'Look-ahead das equipes', url: '/app/lookahead', icone: Columns3 },
      { titulo: 'Restrições (6WLA)', url: '/app/restricoes', icone: Fish },
      { titulo: 'PTO (planejamento)', url: '/app/pto', icone: ClipboardList, minimo: 'planejador' },
      { titulo: 'SSMA da programação', url: '/app/ssma', icone: HardHat, ssma: true },
      { titulo: 'Desvios (Pareto)', url: '/app/desvios', icone: AlertTriangle },
      { titulo: 'Book de fotos', url: '/app/fotos', icone: Images },
      { titulo: 'Auditorias', url: '/app/auditorias', icone: ShieldAlert },
      { titulo: 'Plano de ação 5W2H', url: '/app/acoes', icone: ListChecks },
      { titulo: 'Controle preventivo', url: '/app/preventivos', icone: Wind },
      { titulo: 'Indicadores', url: '/app/indicadores', icone: BarChart3 },
    ],
  },
  {
    etapa: 'Efetivo',
    cor: 'var(--m-proc-executar)',
    itens: [
      { titulo: 'Efetivo e mobilização', url: '/app/efetivo', icone: IdCard },
      { titulo: 'Presença do dia', url: '/app/presenca', icone: ScanFace },
      { titulo: 'LGPD e assinaturas', url: '/app/lgpd', icone: ShieldCheck, ssma: true },
      { titulo: 'Crachá e rosto', url: '/app/efetivo/identificacao', icone: Fingerprint, minimo: 'planejador' },
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
      { titulo: 'Acessos e usuários', url: '/app/acessos', icone: KeyRound, minimo: 'admin' },
      { titulo: 'Marca da obra', url: '/app/marca', icone: Palette, minimo: 'admin' },
    ],
  },
];

export const APP_NOME = 'Programação';
