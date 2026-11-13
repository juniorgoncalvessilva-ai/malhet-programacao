'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { idLocal } from '@/lib/offline/db';
import { blobDaFoto, enfileirar, fotoParaFila, registrarEnvio } from '@/lib/offline/fila';
import type { ConsentimentoLgpd, PessoaBase } from '@/lib/presenca/offline';

/**
 * LGPD (spec 074): aceite do termo e evidências das assinaturas. Tudo nasce no aparelho e sobe pela fila (spec 072):
 * `lgpd` = aceite/recusa; `evidencia` = prova de uma assinatura (foto do rosto só com aceite, coordenadas só com aceite).
 */
export type Escolhas = Record<'biometria' | 'foto_assinatura' | 'localizacao', boolean>;
export interface Geo { lat: number; lng: number; precisao: number | null; em: string }
export interface Evidencia {
  id: number; id_local: string; origem: 'etilometro_teste' | 'etilometro_inicio' | 'etilometro_fim' | 'lgpd_aceite'; origem_id_local: string;
  documento: string | null; colaborador_id: number | null; nome: string; matricula: string | null; meio: string; hora: string; distancia: number | null;
  latitude: number | null; longitude: number | null; precisao: number | null; dispositivo: string | null; tem_foto: boolean; desenho: string | null;
  observacao: string | null; hash: string; integra: boolean | null; recebido_em: string | null;
}
export interface Aceite {
  id: number; id_local: string; colaborador_id: number; nome: string; matricula: string | null; versao: number; termo_hash: string; escolhas: Escolhas;
  hora: string; assinatura: { meio: string; hora: string | null; codigo?: string } | null; tem_desenho: boolean; latitude: number | null; longitude: number | null;
  precisao: number | null; dispositivo: string | null; coletado_por: string | null; hash: string; revogado_em: string | null; revogado_por: string | null; motivo_revogacao: string | null;
}
export interface ColaboradorLgpd { id: number; nome: string; matricula: string | null; funcao: string | null; situacao_efetivo: string; consentimento: ConsentimentoLgpd; ultimo: Aceite | null }
export interface Termo { id: number; versao: number; titulo: string; texto: string; finalidades: { chave: keyof Escolhas; rotulo: string; descricao: string }[]; hash: string; vigente: boolean; criado_por: string; criado_em: string | null }

export const SITUACAO: Record<ConsentimentoLgpd['situacao'], { rotulo: string; tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro' }> = {
  aceito: { rotulo: 'Aceito', tom: 'sucesso' }, recusado: { rotulo: 'Recusado', tom: 'neutro' }, revogado: { rotulo: 'Revogado', tom: 'perigo' },
  desatualizado: { rotulo: 'Termo novo a apresentar', tom: 'atencao' }, pendente: { rotulo: 'Pendente', tom: 'atencao' },
};
export const precisaColher = (p: PessoaBase) => !p.lgpd || p.lgpd.situacao === 'pendente' || p.lgpd.situacao === 'desatualizado';

registrarEnvio('lgpd', (post, item) => post('/lgpd/aceites', item.dados));
registrarEnvio('evidencia', (post, item) => {
  const fd = new FormData();
  fd.append('dados', JSON.stringify(item.dados));
  if (item.fotos[0]) fd.append('foto', blobDaFoto(item.fotos[0]), 'rosto.jpg');
  return post('/lgpd/evidencias', fd);
});

/**
 * Guarda a evidência de uma assinatura na fila. Respeita o aceite já no aparelho: sem "foto da assinatura" a foto nem é
 * guardada; sem "localização" as coordenadas não saem do celular.
 */
export async function guardarEvidencia(obraId: number, pessoa: PessoaBase, a: {
  origem: Evidencia['origem']; origem_id_local: string; meio: string; hora: string; distancia?: number | null; desenho?: string | null;
  foto?: Blob | null; documento?: string; geo?: Geo | null;
}): Promise<void> {
  const c = pessoa.lgpd;
  const id = idLocal();
  const foto = a.foto && a.meio === 'facial' && c?.foto_assinatura ? [await fotoParaFila(a.foto, 'assinatura')] : [];
  const geo = a.geo && c?.localizacao ? { lat: a.geo.lat, lng: a.geo.lng, precisao: a.geo.precisao } : null;
  await enfileirar({
    id_local: id, obra_id: obraId, tipo: 'evidencia', rotulo: `Assinatura · ${pessoa.nome}`, criado_em: new Date().toISOString(),
    dados: { id_local: id, origem: a.origem, origem_id_local: a.origem_id_local, colaborador_id: pessoa.id, meio: a.meio, hora: a.hora,
      distancia: a.distancia ?? null, geo, dispositivo: navigator.userAgent.slice(0, 200), documento: a.documento ?? null, desenho: a.desenho ?? null },
    fotos: foto, estado: 'pendente', tentativas: 0,
  });
}

/**
 * Localização do aparelho enquanto a tela está aberta (GPS funciona sem internet). `ultima()` devolve a posição mais
 * recente (até 2 min) sem esperar — a fila do etilômetro não para por causa do GPS.
 */
export function useLocalizacao(ativo = true) {
  const ult = useRef<Geo | null>(null);
  useEffect(() => {
    if (!ativo || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { ult.current = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null, em: new Date(p.timestamp).toISOString() }; },
      () => undefined, { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [ativo]);
  return useCallback(() => (ult.current && Date.now() - new Date(ult.current.em).getTime() < 120000 ? ult.current : null), []);
}

export function useTermosLgpd() {
  const api = useApi();
  return useQuery({ queryKey: ['lgpd', 'termos'], queryFn: () => api.get<Termo[]>('/lgpd/termos') });
}
export function useColaboradoresLgpd() {
  const api = useApi();
  return useQuery({ queryKey: ['lgpd', 'colaboradores'], queryFn: () => api.get<ColaboradorLgpd[]>('/lgpd/colaboradores') });
}
export function useEvidencias(filtro: string) {
  const api = useApi();
  return useQuery({ queryKey: ['lgpd', 'evidencias', filtro], queryFn: () => api.get<Evidencia[]>(`/lgpd/evidencias${filtro}`) });
}
export const mapa = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
export const coord = (lat: number | null, lng: number | null) => (lat == null || lng == null ? null : `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
