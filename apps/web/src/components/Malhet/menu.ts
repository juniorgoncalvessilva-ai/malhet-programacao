import { AlertTriangle, FolderOpen, Images, ShieldAlert, ListChecks, ScanFace, Fingerprint, CalendarClock, Eye, Palette, BarChart3, BookOpen, Columns3, Fish, CalendarRange, ClipboardList, FileUp, GanttChart, GitFork, HardHat, IdCard, KeyRound, ListTree, MapPin, Network, Shuffle, ShieldCheck, Users, type LucideIcon, Wind, Percent, Cloud, Route, FileSignature, PanelsTopLeft, Send, TrendingUp, Trash2 } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

export interface ItemMenu { titulo: string; url: string; icone: LucideIcon; minimo?: PapelObra; superadmin?: boolean; ssma?: boolean }
export interface GrupoMenu { etapa: string; cor: string; itens: ItemMenu[] }

/**
 * Menu do app "Programação" dentro do Malhet, por área de trabalho (cores proc-* do CorpMind). Cada perfil vê só as telas
 * atreladas a ele (spec 090: menu do perfil na obra → padrão do sistema em `perfil/domain/menu_web.py`); os grupos aparecem
 * na ordem do menu do perfil. As urls daqui e de TELAS_WEB do backend são conferidas por teste.
 */
export const MENU: GrupoMenu[] = [
  {
    etapa: 'Planejamento',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Programação vigente', url: '/app/vigente', icone: Eye },
      { titulo: 'Cronograma', url: '/app/cronograma', icone: GanttChart },
      { titulo: 'WBS de execução', url: '/app/wbs', icone: ListTree },
      { titulo: 'Critério de avanço', url: '/app/criterios', icone: Percent },
      { titulo: 'Plano de 90 dias', url: '/app/plano', icone: CalendarClock },
      { titulo: 'Documentos (LDO e GRD)', url: '/app/documentos', icone: FolderOpen },
      { titulo: 'Programações', url: '/app/programacoes', icone: CalendarRange },
      { titulo: 'Look-ahead das equipes', url: '/app/lookahead', icone: Columns3 },
      { titulo: 'Restrições (6WLA)', url: '/app/restricoes', icone: Fish },
      { titulo: 'PTO (planejamento)', url: '/app/pto', icone: ClipboardList, minimo: 'planejador' },
      { titulo: 'Desvios (Pareto)', url: '/app/desvios', icone: AlertTriangle },
      { titulo: 'Indicadores', url: '/app/indicadores', icone: BarChart3 },
      { titulo: 'Aderência semanal', url: '/app/aderencia', icone: TrendingUp },
    ],
  },
  {
    etapa: 'Campo e qualidade',
    cor: 'var(--m-proc-executar)',
    itens: [
      { titulo: 'Resumo do dia (check out)', url: '/app/resumo-dia', icone: Send },
      { titulo: 'Book de fotos', url: '/app/fotos', icone: Images },
      { titulo: 'Auditorias', url: '/app/auditorias', icone: ShieldAlert },
      { titulo: 'Plano de ação 5W2H', url: '/app/acoes', icone: ListChecks },
    ],
  },
  {
    etapa: 'Segurança (SSMA)',
    cor: 'var(--m-danger)',
    itens: [
      { titulo: 'ASOs e treinamentos', url: '/app/ssma/cadastros', icone: ShieldCheck, ssma: true },
      { titulo: 'SSMA da programação', url: '/app/ssma', icone: HardHat, ssma: true },
      { titulo: 'Controle preventivo', url: '/app/preventivos', icone: Wind },
      { titulo: 'LGPD e assinaturas', url: '/app/lgpd', icone: FileSignature, ssma: true },
    ],
  },
  {
    etapa: 'Efetivo e mobilização',
    cor: 'var(--m-proc-medir)',
    itens: [
      { titulo: 'Efetivo', url: '/app/efetivo', icone: IdCard },
      { titulo: 'Mobilização e vagas', url: '/app/efetivo/mobilizacao', icone: Route },
      { titulo: 'Presença do dia', url: '/app/presenca', icone: ScanFace },
      { titulo: 'Crachá e rosto', url: '/app/efetivo/identificacao', icone: Fingerprint, minimo: 'planejador' },
      { titulo: 'Equipes', url: '/app/equipes', icone: Users },
      { titulo: 'Acesso dos líderes', url: '/app/lideres', icone: KeyRound, minimo: 'planejador' },
      { titulo: 'Setores da obra', url: '/app/efetivo/setores', icone: Network },
      { titulo: 'Organograma', url: '/app/efetivo/organograma', icone: GitFork },
      { titulo: 'De-para de funções', url: '/app/efetivo/funcoes', icone: Shuffle },
    ],
  },
  {
    etapa: 'Cadastros',
    cor: 'var(--m-text-muted)',
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
      { titulo: 'Acessos e usuários', url: '/app/acessos', icone: KeyRound, minimo: 'admin' },
      { titulo: 'Menus por perfil', url: '/app/menu-celular', icone: PanelsTopLeft, minimo: 'admin' },
      { titulo: 'Marca da obra', url: '/app/marca', icone: Palette, minimo: 'admin' },
      { titulo: 'Armazenamento', url: '/app/armazenamento', icone: Cloud, minimo: 'admin' },
      { titulo: 'Exclusões', url: '/app/exclusoes', icone: Trash2, minimo: 'admin' },
    ],
  },
];

/** Ordena os grupos e os itens pela ordem das telas no menu do perfil (o primeiro grupo é o da primeira tela). */
export function menuDoPerfil(grupos: GrupoMenu[], ordem: string[] | null): GrupoMenu[] {
  if (!ordem) return grupos;
  const pos = (u: string) => { const i = ordem.indexOf(u); return i < 0 ? 1e6 : i; };
  return grupos
    .map((g) => ({ ...g, itens: [...g.itens].sort((a, b) => pos(a.url) - pos(b.url)) }))
    .sort((a, b) => Math.min(...a.itens.map((i) => pos(i.url)), 1e6) - Math.min(...b.itens.map((i) => pos(i.url)), 1e6));
}

