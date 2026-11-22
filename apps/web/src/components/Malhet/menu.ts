import { AlertTriangle, FolderOpen, Ruler, Images, ShieldAlert, ListChecks, ScanFace, Fingerprint, CalendarClock, Eye, Palette, BarChart3, BookOpen, Columns3, Fish, CalendarRange, ClipboardList, FileUp, GanttChart, GitFork, HardHat, IdCard, KeyRound, ListTree, MapPin, Network, Shuffle, ShieldCheck, Users, type LucideIcon, Wind, Percent, Cloud, Route, FileSignature, PanelsTopLeft, Send, TrendingUp, Trash2 } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

export interface ItemMenu {
  titulo: string; url: string; icone: LucideIcon; minimo?: PapelObra; superadmin?: boolean; ssma?: boolean;
  /** Outras palavras que levam a esta tela na busca (Ctrl+K). */
  palavras?: string;
}
export interface GrupoMenu { etapa: string; cor: string; itens: ItemMenu[]; recolhido?: boolean }

/**
 * Menu pelo ciclo da obra (spec 125): cada grupo responde a uma pergunta — o que vamos construir, quando e com quem, o que
 * está acontecendo hoje, como foi — e não por "app". No máximo 6 telas por grupo; "Configurar" (implantação da obra) fica
 * recolhido no fim. Módulo não contratado pela obra some daqui (`obras/domain/modulos.py`). Cada perfil vê só as telas dele
 * (spec 090: menu do perfil → padrão em `perfil/domain/menu_web.py`), na ordem do perfil. As urls daqui e de TELAS_WEB do
 * backend são conferidas por teste.
 */
export const MENU: GrupoMenu[] = [
  {
    etapa: 'Projeto e escopo',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Documentos (LDO e GRD)', url: '/app/documentos', icone: FolderOpen, palavras: 'projeto desenho dwg ldo grd revisão lista mestra procedimento norma' },
      { titulo: 'Take-off do projeto', url: '/app/takeoff', icone: Ruler, palavras: 'takeoff quantidade quantitativo aço ferro resumo levantamento' },
      { titulo: 'WBS de execução', url: '/app/wbs', icone: ListTree, palavras: 'eap cwa cwp iwp awp estrutura' },
      { titulo: 'Critério de avanço', url: '/app/criterios', icone: Percent, palavras: 'medição etapas cms peso' },
    ],
  },
  {
    etapa: 'Planejar',
    cor: 'var(--m-proc-planejar)',
    itens: [
      { titulo: 'Cronograma', url: '/app/cronograma', icone: GanttChart, palavras: 'p6 primavera xer prazo' },
      { titulo: 'Plano de 90 dias', url: '/app/plano', icone: CalendarClock, palavras: 'médio prazo 6 semanas pull planning lookahead' },
      { titulo: 'Restrições (6WLA)', url: '/app/restricoes', icone: Fish, palavras: 'ishikawa 6m plano de ação restrição' },
      { titulo: 'Look-ahead das equipes', url: '/app/lookahead', icone: Columns3, palavras: 'quadro gestão à vista' },
      { titulo: 'Programações', url: '/app/programacoes', icone: CalendarRange, palavras: 'semanal mensal emitir ft simova' },
      { titulo: 'PTO (planejamento)', url: '/app/pto', icone: ClipboardList, minimo: 'planejador', palavras: 'permissão de trabalho' },
    ],
  },
  {
    etapa: 'Executar',
    cor: 'var(--m-proc-executar)',
    itens: [
      { titulo: 'Programação vigente', url: '/app/vigente', icone: Eye, palavras: 'hoje lançar realizado' },
      { titulo: 'Presença do dia', url: '/app/presenca', icone: ScanFace, palavras: 'crachá nfc rosto apropriação' },
      { titulo: 'Resumo do dia (check out)', url: '/app/resumo-dia', icone: Send, palavras: 'whatsapp rdo diário' },
      { titulo: 'Book de fotos', url: '/app/fotos', icone: Images, palavras: 'relatório fotográfico' },
      { titulo: 'Auditorias', url: '/app/auditorias', icone: ShieldAlert, palavras: 'inspeção ver e agir qualidade' },
    ],
  },
  {
    etapa: 'Medir e melhorar',
    cor: 'var(--m-proc-medir)',
    itens: [
      { titulo: 'Indicadores', url: '/app/indicadores', icone: BarChart3, palavras: 'ppc kpi aderência carga capacidade' },
      { titulo: 'Desvios (Pareto)', url: '/app/desvios', icone: AlertTriangle, palavras: 'causas não cumprido' },
      { titulo: 'Aderência semanal', url: '/app/aderencia', icone: TrendingUp, palavras: 'financeiro apresentação pptx medição' },
      { titulo: 'Plano de ação 5W2H', url: '/app/acoes', icone: ListChecks, palavras: 'ação corretiva eficácia' },
    ],
  },
  {
    etapa: 'Pessoas e equipes',
    cor: 'var(--m-proc-executar)',
    itens: [
      { titulo: 'Efetivo', url: '/app/efetivo', icone: IdCard, palavras: 'colaboradores funcionários dp ficha' },
      { titulo: 'Mobilização e vagas', url: '/app/efetivo/mobilizacao', icone: Route, palavras: 'contratação vaga rh funil' },
      { titulo: 'Equipes', url: '/app/equipes', icone: Users, palavras: 'frente de trabalho encarregado movimentações' },
      { titulo: 'Organograma', url: '/app/efetivo/organograma', icone: GitFork },
      { titulo: 'Acesso dos líderes', url: '/app/lideres', icone: KeyRound, minimo: 'planejador', palavras: 'encarregado senha link portal' },
    ],
  },
  {
    etapa: 'Segurança (SSMA)',
    cor: 'var(--m-danger)',
    itens: [
      { titulo: 'ASOs e treinamentos', url: '/app/ssma/cadastros', icone: ShieldCheck, ssma: true, palavras: 'nr aso integração matriz' },
      { titulo: 'SSMA da programação', url: '/app/ssma', icone: HardHat, ssma: true, palavras: 'rac pts art ata técnico' },
      { titulo: 'Controle preventivo', url: '/app/preventivos', icone: Wind, palavras: 'etilômetro bafômetro' },
      { titulo: 'LGPD e assinaturas', url: '/app/lgpd', icone: FileSignature, ssma: true, palavras: 'termo consentimento privacidade' },
    ],
  },
  {
    etapa: 'Configurar',
    cor: 'var(--m-proc-administrar)',
    recolhido: true,
    itens: [
      { titulo: 'Importações', url: '/app/importacoes', icone: FileUp, palavras: 'pq cpu planilha take-off xer simova' },
      { titulo: 'Frentes', url: '/app/frentes', icone: MapPin, palavras: 'cwa local área tag' },
      { titulo: 'Catálogo de atividades', url: '/app/catalogo', icone: BookOpen, palavras: 'grupo tipo item oper' },
      { titulo: 'Setores da obra', url: '/app/efetivo/setores', icone: Network, palavras: 'disciplinas' },
      { titulo: 'De-para de funções', url: '/app/efetivo/funcoes', icone: Shuffle, palavras: 'função recurso cpu' },
      { titulo: 'Crachá e rosto', url: '/app/efetivo/identificacao', icone: Fingerprint, minimo: 'planejador', palavras: 'nfc qr facial identificação' },
      { titulo: 'Acessos e usuários', url: '/app/acessos', icone: KeyRound, minimo: 'admin', palavras: 'permissão login conta' },
      { titulo: 'Menus por perfil', url: '/app/menu-celular', icone: PanelsTopLeft, minimo: 'admin', palavras: 'celular barra' },
      { titulo: 'Marca da obra', url: '/app/marca', icone: Palette, minimo: 'admin', palavras: 'logo cor contratada' },
      { titulo: 'Armazenamento', url: '/app/armazenamento', icone: Cloud, minimo: 'admin', palavras: 'drive onedrive dropbox arquivos' },
      { titulo: 'Exclusões', url: '/app/exclusoes', icone: Trash2, minimo: 'admin', palavras: 'histórico excluir' },
    ],
  },
];

/** Ordena os grupos e os itens pela ordem das telas no menu do perfil (o primeiro grupo é o da primeira tela); os grupos
 *  recolhidos (Configurar) ficam sempre no fim. */
export function menuDoPerfil(grupos: GrupoMenu[], ordem: string[] | null): GrupoMenu[] {
  if (!ordem) return grupos;
  const pos = (u: string) => { const i = ordem.indexOf(u); return i < 0 ? 1e6 : i; };
  const peso = (g: GrupoMenu) => (g.recolhido ? 1e7 : 0) + Math.min(...g.itens.map((i) => pos(i.url)), 1e6);
  return grupos
    .map((g) => ({ ...g, itens: [...g.itens].sort((a, b) => pos(a.url) - pos(b.url)) }))
    .sort((a, b) => peso(a) - peso(b));
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Busca de telas (Ctrl+K): título primeiro, depois as palavras e o grupo; cada termo precisa aparecer. */
export function buscarTelas(grupos: GrupoMenu[], termo: string): { item: ItemMenu; grupo: GrupoMenu }[] {
  const termos = semAcento(termo).split(/\s+/).filter(Boolean);
  const todos = grupos.flatMap((g) => g.itens.map((item) => ({ item, grupo: g })));
  if (!termos.length) return todos;
  return todos
    .map((x) => {
      const titulo = semAcento(x.item.titulo);
      const resto = semAcento(`${x.item.palavras ?? ''} ${x.grupo.etapa}`);
      if (!termos.every((t) => titulo.includes(t) || resto.includes(t))) return null;
      return { ...x, nota: termos.reduce((s, t) => s + (titulo.startsWith(t) ? 3 : titulo.includes(t) ? 2 : 1), 0) };
    })
    .filter((x): x is { item: ItemMenu; grupo: GrupoMenu; nota: number } => !!x)
    .sort((a, b) => b.nota - a.nota)
    .map(({ item, grupo }) => ({ item, grupo }));
}

