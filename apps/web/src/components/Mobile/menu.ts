import { AlertTriangle, Bell, ClipboardCheck, Eye, Fish, House, ListChecks, Plus, ScanFace, ShieldAlert, ShieldCheck, UserRound, Wind, type LucideIcon } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

/**
 * Telas do app de campo (spec 066): o que aparece na barra de baixo e nos atalhos do Início. A visibilidade por pessoa
 * (Acessos › Celular) usa estas urls; Início e Programação ficam sempre abertos.
 */
export interface ItemMobile {
  url: string; titulo: string; icone: LucideIcon; barra?: boolean; destaque?: boolean; fixo?: boolean;
  /** papel mínimo para aparecer (pelo papel); `seguranca` libera também o papel Segurança */
  minimo?: PapelObra; seguranca?: boolean; descricao: string;
  /** Nome curto para a barra de baixo (spec 075). */
  curto?: string;
}

export const MENU_MOBILE: ItemMobile[] = [
  { url: '/m', titulo: 'Início', icone: House, barra: true, fixo: true, descricao: 'Meta do dia e atalhos' },
  { url: '/m/vigente', titulo: 'Programação', icone: Eye, barra: true, fixo: true, descricao: 'Programação vigente e detalhe da atividade' },
  { url: '/m/lancar', titulo: 'Lançar', icone: Plus, barra: true, minimo: 'encarregado', descricao: 'Lançar a produção do dia' },
  { url: '/m/presenca', titulo: 'Presença', icone: ScanFace, barra: true, destaque: true, minimo: 'encarregado', descricao: 'Ler crachá, NFC ou rosto' },
  { url: '/m/ocorrencias', titulo: 'Ocorrências', icone: AlertTriangle, barra: true, descricao: 'Registrar e ver ocorrências' },
  { url: '/m/restricoes', titulo: 'Restrições', icone: Fish, barra: true, descricao: 'Restrições do 6WLA' },
  { url: '/m/pendencias', titulo: 'Pendências', icone: ClipboardCheck, barra: true, minimo: 'encarregado', descricao: 'Dias sem lançamento' },
  { url: '/m/auditorias', titulo: 'Auditorias', icone: ShieldAlert, minimo: 'encarregado', seguranca: true, descricao: 'Auditoria de segurança e envio no WhatsApp' },
  { url: '/m/acoes', titulo: 'Ações 5W2H', curto: 'Ações', icone: ListChecks, minimo: 'encarregado', seguranca: true, descricao: 'Concluir ações com foto e verificar' },
  { url: '/m/lgpd', titulo: 'Termo LGPD', curto: 'LGPD', icone: ShieldCheck, minimo: 'encarregado', seguranca: true, descricao: 'Colher o aceite LGPD do colaborador' },
  { url: '/m/notificacoes', titulo: 'Notificações', curto: 'Alertas', icone: Bell, fixo: true, descricao: 'Alertas da obra para você' },
  { url: '/m/perfil', titulo: 'Meu perfil', curto: 'Perfil', icone: UserRound, fixo: true, descricao: 'Foto, nome e o seu menu' },
  { url: '/m/preventivos', titulo: 'Controle preventivo', curto: 'Etilômetro', icone: Wind, minimo: 'encarregado', seguranca: true, descricao: 'Etilômetro: teste, contraprova e assinatura' },
];

/** Menu padrão do sistema por perfil (o mesmo de apps/api/app/modules/perfil/domain/menu.py — vale sem internet). */
export const MENU_PADRAO: Record<PapelObra, { barra: string[]; destaque: string | null }> = {
  encarregado: { barra: ['/m', '/m/vigente', '/m/lancar', '/m/ocorrencias'], destaque: '/m/presenca' },
  planejador: { barra: ['/m', '/m/vigente', '/m/restricoes', '/m/ocorrencias'], destaque: '/m/presenca' },
  admin: { barra: ['/m', '/m/vigente', '/m/restricoes', '/m/ocorrencias'], destaque: '/m/presenca' },
  seguranca: { barra: ['/m', '/m/auditorias', '/m/acoes', '/m/lgpd'], destaque: '/m/preventivos' },
  leitor: { barra: ['/m', '/m/vigente', '/m/ocorrencias', '/m/restricoes'], destaque: null },
};
export const MAX_BARRA = 4;

/** Item do menu do celular dono de uma rota (a mais específica). */
export const itemMobileDe = (pathname: string): ItemMobile | undefined =>
  [...MENU_MOBILE].sort((a, b) => b.url.length - a.url.length).find((i) => (i.url === '/m' ? pathname === '/m' : pathname === i.url || pathname.startsWith(`${i.url}/`)));
