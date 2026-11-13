'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/programacao/useApi';
import { useObraOpcional } from '@/lib/obra/ObraProvider';
import { comCopia, gravarKv, lerKv } from '@/lib/offline/db';
import { blobDaFoto, registrarEnvio } from '@/lib/offline/fila';

/**
 * Controle preventivo — etilômetro (spec 073). O evento acontece no tablet/celular, com ou sem internet: a sessão
 * (aparelho, responsável, testes, contraprovas com cronômetro) fica no aparelho e cada passo vira um item da fila
 * (`abrir`, `teste`, `encerrar`), que sobe em ordem e não duplica (id_local).
 */
export interface Faixa { de: number; rotulo: string; resultado: 'aprovado' | 'reprovado'; penalidade: string }
export interface ConfigEtilometro {
  unidade: 'mg/L'; contraprova_minutos: number; faixas: Faixa[];
  recusa: { rotulo: string; resultado: 'aprovado' | 'reprovado'; penalidade: string };
}
export interface Aparelho {
  id: number; marca: string; modelo: string; numero_serie: string | null; calibracao_em: string | null; validade: string | null; ativo: boolean; vencido: boolean;
}
export interface Assinatura { meio: 'facial' | 'nfc' | 'qr' | 'codigo' | 'desenho' | 'manual'; hora: string; distancia?: number | null; desenho?: string | null; codigo?: string | null }
export interface ResumoEvento { pessoas: number; testes: number; aprovados: number; reprovados: number; recusas: number; contraprovas: number; contraprova_pendente: number }
export interface TesteServidor {
  id: number; id_local: string; colaborador_id: number | null; nome: string; matricula: string | null; funcao: string | null; tentativa: number;
  valor: number | null; recusa: boolean; resultado: 'aprovado' | 'reprovado'; faixa: string; penalidade: string | null; hora: string; leitura: string | null;
  assinatura: Assinatura | null;
}
export interface EventoEtilometro {
  id: number; numero: number; id_local: string; data: string; local: string | null; status: 'aberto' | 'encerrado';
  aparelho: Omit<Aparelho, 'ativo'>; responsavel_id: number | null; responsavel: string; iniciado_em: string; encerrado_em: string | null;
  assinatura_inicio: Assinatura; assinatura_fim: Assinatura | null; criado_por: string | null; observacao: string | null; resumo: ResumoEvento;
  config?: ConfigEtilometro; testes?: TesteServidor[]; fotos?: { id: number; momento: string }[];
  pessoas?: { chave: string; nome: string; matricula: string | null; funcao: string | null; resultado: string; faixa: string; valor: number | null; contraprova_pendente: boolean; tentativas: number }[];
}

export function useConfigEtilometro() {
  const api = useApi();
  const obraId = useObraOpcional()?.obra?.id;
  return useQuery({ queryKey: ['preventivos', 'config'], networkMode: 'always', retry: 1,
    queryFn: () => comCopia(`${obraId}:preventivos/config`, () => api.get<ConfigEtilometro>('/preventivos/etilometro/config')) });
}
export function useAparelhos() {
  const api = useApi();
  const obraId = useObraOpcional()?.obra?.id;
  return useQuery({ queryKey: ['preventivos', 'aparelhos'], networkMode: 'always', retry: 1,
    queryFn: () => comCopia(`${obraId}:preventivos/aparelhos`, () => api.get<Aparelho[]>('/preventivos/etilometro/aparelhos')) });
}
export function useEventosEtilometro(filtro = '') {
  const api = useApi();
  const obraId = useObraOpcional()?.obra?.id;
  return useQuery({ queryKey: ['preventivos', 'eventos', filtro], networkMode: 'always', retry: 1,
    queryFn: () => comCopia(`${obraId}:preventivos/eventos${filtro}`, () => api.get<EventoEtilometro[]>(`/preventivos/etilometro/eventos${filtro}`)) });
}
export function useEventoEtilometro(id: number | null) {
  const api = useApi();
  return useQuery({ queryKey: ['preventivos', 'evento', id], enabled: !!id, queryFn: () => api.get<EventoEtilometro>(`/preventivos/etilometro/eventos/${id}`) });
}

/** Mesma regra do servidor (`preventivos/domain/etilometro.py::classificar`): a faixa em que o valor cai, ou a recusa. */
export function classificar(cfg: ConfigEtilometro, valor: number | null, recusa: boolean) {
  if (recusa) return { resultado: cfg.recusa.resultado, faixa: cfg.recusa.rotulo, penalidade: cfg.recusa.penalidade, valor: null };
  const v = Math.round((valor ?? 0) * 1000) / 1000;
  const f = cfg.faixas.filter((x) => x.de <= v + 1e-9).at(-1) ?? cfg.faixas[0];
  return { resultado: f.resultado, faixa: f.rotulo, penalidade: f.penalidade, valor: v };
}
export const pedeContraprova = (tentativa: number, resultado: string, recusa: boolean) => tentativa === 1 && resultado === 'reprovado' && !recusa;
export const mgL = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} mg/L`);

// ---- sessão no aparelho ----
export interface TesteLocal {
  id_local: string; colaborador_id: number; nome: string; matricula: string | null; funcao: string | null; tentativa: 1 | 2;
  valor: number | null; recusa: boolean; resultado: 'aprovado' | 'reprovado'; faixa: string; penalidade: string; hora: string;
  leitura: string; assinatura: Assinatura['meio'] | null;
}
export interface SessaoEtilometro {
  id_local: string; obra_id: number; data: string; local: string | null; aparelho: Aparelho; responsavel: { id: number; nome: string; matricula: string | null };
  iniciado_em: string; config: ConfigEtilometro; testes: TesteLocal[];
}
const chaveSessao = (obraId: number) => `etilometro:sessao:${obraId}`;
export const lerSessao = (obraId: number) => lerKv<SessaoEtilometro>(chaveSessao(obraId));
export const salvarSessao = (obraId: number, s: SessaoEtilometro | null) => gravarKv(chaveSessao(obraId), s);

/** Quem reprovou no 1º teste e ainda não fez a contraprova, com a hora em que fica liberado. */
export function aguardandoContraprova(s: SessaoEtilometro) {
  const por = new Map<number, TesteLocal[]>();
  for (const t of s.testes) por.set(t.colaborador_id, [...(por.get(t.colaborador_id) ?? []), t]);
  return [...por.values()].filter((ts) => ts.length === 1 && pedeContraprova(1, ts[0].resultado, ts[0].recusa))
    .map((ts) => ({ teste: ts[0], libera: new Date(new Date(ts[0].hora).getTime() + s.config.contraprova_minutos * 60000) }))
    .sort((a, b) => a.libera.getTime() - b.libera.getTime());
}

// ---- envio pela fila ----
registrarEnvio('etilometro', (post, item) => {
  const d = item.dados as Record<string, unknown> & { acao: 'abrir' | 'teste' | 'encerrar'; id_local_evento?: string };
  const { acao, id_local_evento, ...corpo } = d;
  if (acao === 'abrir') {
    const fd = new FormData();
    fd.append('dados', JSON.stringify(corpo));
    fd.append('momentos', JSON.stringify(item.fotos.map((f) => f.momento)));
    item.fotos.forEach((f, i) => fd.append('fotos', blobDaFoto(f), `foto-${i + 1}.jpg`));
    return post('/preventivos/etilometro/eventos', fd);
  }
  if (acao === 'teste') return post('/preventivos/etilometro/testes', corpo);
  return post(`/preventivos/etilometro/eventos/${id_local_evento}/encerrar`, corpo);
});
