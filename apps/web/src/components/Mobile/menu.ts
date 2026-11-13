import { AlertTriangle, ClipboardCheck, Eye, Fish, House, ListChecks, Plus, ScanFace, ShieldAlert, Wind, type LucideIcon } from 'lucide-react';
import type { PapelObra } from '@/lib/api/types';

/**
 * Telas do app de campo (spec 066): o que aparece na barra de baixo e nos atalhos do Início. A visibilidade por pessoa
 * (Acessos › Celular) usa estas urls; Início e Programação ficam sempre abertos.
 */
export interface ItemMobile {
  url: string; titulo: string; icone: LucideIcon; barra?: boolean; destaque?: boolean; fixo?: boolean;
  /** papel mínimo para aparecer (pelo papel); `seguranca` libera também o papel Segurança */
  minimo?: PapelObra; seguranca?: boolean; descricao: string;
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
  { url: '/m/acoes', titulo: 'Ações 5W2H', icone: ListChecks, minimo: 'encarregado', seguranca: true, descricao: 'Concluir ações com foto e verificar' },
  { url: '/m/preventivos', titulo: 'Controle preventivo', icone: Wind, minimo: 'encarregado', seguranca: true, descricao: 'Etilômetro: teste, contraprova e assinatura' },
];

/** Item do menu do celular dono de uma rota (a mais específica). */
export const itemMobileDe = (pathname: string): ItemMobile | undefined =>
  [...MENU_MOBILE].sort((a, b) => b.url.length - a.url.length).find((i) => (i.url === '/m' ? pathname === '/m' : pathname === i.url || pathname.startsWith(`${i.url}/`)));
