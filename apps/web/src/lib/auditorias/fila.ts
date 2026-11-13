'use client';

import type { ConfigModelo, RegistroAuditoria } from '@/lib/auditorias';
import { blobDaFoto, registrarEnvio } from '@/lib/offline/fila';

/**
 * Auditoria sem internet (spec 072): o que vai na fila, como sobe (`POST /auditorias/registros/completo`, tudo ou nada,
 * idempotente pelo id_local) e as mesmas regras do servidor rodando no aparelho — conferir o modelo e montar o texto do
 * WhatsApp — para a pessoa registrar e enviar sem esperar a rede.
 */
export interface DadosAuditoria {
  id_local: string; registrado_em: string; modelo_id: number | null; tipo: string | null; tipo_registro: string | null; data: string;
  area_id: number | null; area_texto: string | null; local?: string | null; equipe_id: number | null; engenheiro: string | null;
  encarregado: string | null; rac: string | null; nao_conformidade: string; medida_corretiva: string | null; ver_agir: boolean | null;
  plano_responsavel: string | null; plano_prazo: string | null; acompanhamento: string | null; respostas: Record<string, string>;
}
export type ResultadoAuditoria = RegistroAuditoria & { texto: string; repetido: boolean };

/** Corpo do envio único: dados (JSON), momento de cada foto e as fotos. */
export function formAuditoria(d: DadosAuditoria, fotos: { blob: Blob; momento: string }[]): FormData {
  const fd = new FormData();
  fd.append('dados', JSON.stringify({ ...d, local: undefined })); // local é só para o texto no aparelho
  fd.append('momentos', JSON.stringify(fotos.map((f) => f.momento)));
  fotos.forEach((f, i) => fd.append('fotos', f.blob, `foto-${i + 1}.jpg`));
  return fd;
}

registrarEnvio('auditoria', (post, item) => post<ResultadoAuditoria>('/auditorias/registros/completo',
  formAuditoria(item.dados as unknown as DadosAuditoria, item.fotos.map((f) => ({ blob: blobDaFoto(f), momento: f.momento })))));

/** O que falta para o modelo aceitar (mesma regra de `auditorias/domain/auditoria.py::pendencias`). */
export function pendencias(cfg: ConfigModelo, r: DadosAuditoria, antes: number, depois: number): string[] {
  const falta: string[] = [];
  const ativos = Object.fromEntries(cfg.campos.filter((c) => c.ativo).map((c) => [c.tipo, c]));
  const tipo = cfg.tipos.find((t) => t.nome === r.tipo);
  if (!tipo) falta.push('tipo de auditoria');
  else if (ativos.tipo_registro?.obrigatorio && !tipo.registros.includes(r.tipo_registro ?? '')) falta.push('tipo de registro');
  if (!r.area_id && !r.area_texto) falta.push('local / frente');
  if (!r.data) falta.push('data');
  for (const [k, rot] of [['engenheiro', 'Eng.º responsável'], ['encarregado', 'encarregado responsável'], ['rac', 'RAC'],
    ['medida_corretiva', 'medida corretiva'], ['acompanhamento', 'responsável pelo acompanhamento']] as const) {
    if (ativos[k]?.obrigatorio && !(r[k] ?? '').trim()) falta.push(rot);
  }
  if ((r.nao_conformidade ?? '').trim().length < 3) falta.push('descrição da não conformidade');
  for (const c of cfg.campos) if (c.tipo === 'texto' && c.ativo && c.obrigatorio && !String(r.respostas?.[c.chave] ?? '').trim()) falta.push(c.rotulo);
  if (r.ver_agir == null) falta.push('VER E AGIR (sim ou não)');
  if (antes < 1) falta.push('foto da não conformidade');
  if (r.ver_agir === true && depois < 1) falta.push('foto do depois (adequação)');
  if (r.ver_agir === false) {
    if (!(r.plano_responsavel ?? '').trim()) falta.push('responsável do plano de ação');
    if (!r.plano_prazo) falta.push('prazo do plano de ação');
  }
  return falta;
}

const dBR = (v: string | null | undefined) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '—');

/** Texto do WhatsApp (mesma regra de `texto_envio`). Sem internet o número ainda não existe: sai "Nº a definir". */
export function textoEnvio(cfg: ConfigModelo, r: Partial<DadosAuditoria> & { numero?: number | null; local?: string | null; auditor?: string | null },
  obra?: string | null, contratada?: string | null): string {
  const l: string[] = [];
  if (cfg.cabecalho) l.push(`*${cfg.cabecalho}*`);
  if (contratada) l.push(`*Empresa:* ${contratada}`);
  if (obra) l.push(`*Obra:* ${obra}`);
  if (l.length) l.push('');
  for (const c of cfg.campos) {
    if (!c.ativo) continue;
    const e = c.emoji ? `${c.emoji} ` : '';
    const rot = `${e}*${c.rotulo}:*`;
    const t = c.tipo;
    if (t === 'tipo_auditoria') l.push(`${e}*${r.tipo || '—'}*${r.numero ? ` · Nº ${r.numero}` : ' · Nº a definir (registrado sem internet)'}`);
    else if (t === 'frente') l.push(`${rot} ${[r.local, r.area_texto].filter(Boolean).join(' / ') || '—'}`);
    else if (t === 'data') l.push(`${rot} ${dBR(r.data)}`);
    else if (t === 'engenheiro' || t === 'encarregado' || t === 'rac' || t === 'tipo_registro' || t === 'acompanhamento') {
      if (t === 'rac' && !r.rac) continue;
      l.push(`${rot} ${r[t] || '—'}`);
    } else if (t === 'nao_conformidade' || t === 'medida_corretiva') l.push(`${rot} ${r[t] || '—'}`);
    else if (t === 'ver_agir') l.push(`${rot} ${r.ver_agir ? 'SIM — corrigido na hora (fotos de antes e depois)' : r.ver_agir === false ? 'NÃO — segue plano de ação' : '—'}`);
    else if (t === 'plano_acao') {
      if (r.ver_agir === false) l.push(rot, `• Responsável: ${r.plano_responsavel || '—'}`, `• Prazo: ${dBR(r.plano_prazo)}`);
    } else if (t === 'texto') {
      const v = r.respostas?.[c.chave];
      if (v) l.push(`${rot} ${v}`);
    }
    l.push('');
  }
  while (l.length && !l[l.length - 1]) l.pop();
  if (r.auditor) l.push('', `_Registrado por ${r.auditor}_`);
  if (cfg.rodape) l.push('', `"${cfg.rodape}"`);
  return l.join('\n');
}
