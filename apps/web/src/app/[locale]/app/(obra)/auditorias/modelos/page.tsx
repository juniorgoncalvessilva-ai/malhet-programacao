'use client';

import { ArrowDown, ArrowUp, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Painel } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { type CampoModelo, type ConfigModelo, type ModeloAuditoria, useModelosAuditoria } from '@/lib/auditorias';

const NOME_TIPO: Record<CampoModelo['tipo'], string> = {
  tipo_auditoria: 'tipo de auditoria (lista dos tipos)', frente: 'local / frente (Frentes)', data: 'data', engenheiro: 'Eng.º (equipes)',
  encarregado: 'encarregado (equipes)', rac: 'RAC (cadastro SSMA)', tipo_registro: 'tipo de registro (do tipo escolhido)',
  nao_conformidade: 'não conformidade (texto + foto)', medida_corretiva: 'medida corretiva', ver_agir: 'VER E AGIR (sim/não)',
  plano_acao: 'plano de ação (responsável + prazo)', acompanhamento: 'acompanhamento', texto: 'campo livre (texto)',
};
const cls = 'rounded-[8px] border border-m-stroke bg-m-surface-field px-2 py-1.5 text-[13px]';

/** Modelos de auditoria (spec 064): tipos e tipos de registro, campos (rótulo, emoji, obrigatório, ordem) e textos do envio. */
export default function ModelosAuditoriaPage() {
  const api = useApi();
  const confirmar = useConfirmar();
  const q = useModelosAuditoria();
  const [sel, setSel] = useState<number | 'novo' | null>(null);
  const [cfg, setCfg] = useState<ConfigModelo | null>(null);
  const [padrao, setPadrao] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const lista = q.data ?? [];
  const atual = lista.find((m) => m.id === sel);
  useEffect(() => { if (sel == null && lista.length) setSel(lista[0].id); }, [lista, sel]);
  useEffect(() => { if (atual) { setCfg(structuredClone(atual.config)); setPadrao(atual.padrao); setAtivo(atual.ativo); } }, [atual?.id, q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    if (!cfg) return;
    try {
      const m = sel === 'novo' ? await api.post<ModeloAuditoria>('/auditorias/modelos', { config: cfg, padrao, ativo })
        : await api.put<ModeloAuditoria>(`/auditorias/modelos/${sel}`, { config: cfg, padrao, ativo });
      setSel(m.id); toast.success('Modelo salvo');
    } catch (e) { toast.error((e as Error).message, { duration: 8000 }); }
  };
  const novo = async () => { setCfg({ ...(await api.get<ConfigModelo>('/auditorias/modelos/base')), nome: 'Novo modelo' }); setPadrao(false); setAtivo(true); setSel('novo'); };
  const restaurar = async () => { if (await confirmar({ titulo: 'Voltar ao modelo de Segurança de fábrica?', mensagem: 'Tipos, registros e campos voltam ao original (só salva quando clicar em Salvar).', perigo: false, acao: 'Restaurar' })) setCfg({ ...(await api.get<ConfigModelo>('/auditorias/modelos/base')), nome: cfg?.nome ?? '' }); };
  const excluir = async () => { if (atual && await confirmar({ titulo: `Excluir o modelo ${atual.nome}?`, mensagem: 'Só modelos sem registros podem ser excluídos.', acao: 'Excluir' })) { try { await api.del(`/auditorias/modelos/${atual.id}`); setSel(null); toast.success('Modelo excluído'); } catch (e) { toast.error((e as Error).message); } } };

  const mudaCampo = (i: number, m: Partial<CampoModelo>) => cfg && setCfg({ ...cfg, campos: cfg.campos.map((c, j) => (j === i ? { ...c, ...m } : c)) });
  const mover = (i: number, d: -1 | 1) => { if (!cfg) return; const c = [...cfg.campos]; const j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; setCfg({ ...cfg, campos: c }); };
  const fixo = (t: CampoModelo['tipo']) => ['tipo_auditoria', 'frente', 'data', 'nao_conformidade', 'ver_agir'].includes(t);

  return (
    <>
      <Cabecalho eyebrow="Governança · auditorias" titulo="Modelos de auditoria" acoes={<Botao onClick={novo}><Plus size={16} /> Novo modelo</Botao>} />
      <div className="flex flex-wrap gap-2">
        {lista.map((m) => (
          <button key={m.id} type="button" onClick={() => setSel(m.id)} aria-pressed={sel === m.id}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${sel === m.id ? 'border-m-accent bg-m-accent text-white' : 'border-m-stroke'} ${m.ativo ? '' : 'opacity-60'}`}>
            {m.padrao && <Star size={14} />}{m.nome} <span className="font-normal opacity-80">· {m.registros} reg.</span>
          </button>
        ))}
        {sel === 'novo' && <span className="inline-flex h-9 items-center rounded-full border border-m-accent px-3 text-[13px] font-semibold text-m-accent">Novo (não salvo)</span>}
      </div>
      {cfg && (
        <>
          <Painel titulo="Identificação e envio" acoes={<div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={restaurar}><RotateCcw size={15} /> Modelo de fábrica</Botao>
            {atual && !atual.padrao && <Botao variante="excluir" onClick={excluir}><Trash2 size={15} /> Excluir</Botao>}
            <Botao onClick={salvar}>Salvar</Botao>
          </div>}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Nome<input value={cfg.nome} onChange={(e) => setCfg({ ...cfg, nome: e.target.value })} className={cls} /></label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Setor<input value={cfg.setor ?? ''} onChange={(e) => setCfg({ ...cfg, setor: e.target.value })} className={cls} /></label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Cabeçalho do envio (WhatsApp)<input value={cfg.cabecalho} onChange={(e) => setCfg({ ...cfg, cabecalho: e.target.value })} className={cls} /></label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-m-text-secondary">Frase do rodapé<input value={cfg.rodape} onChange={(e) => setCfg({ ...cfg, rodape: e.target.value })} className={cls} /></label>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} /> Modelo padrão da obra (abre primeiro)</label>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
            </div>
          </Painel>
          <Painel titulo="Tipos de auditoria e tipos de registro" acoes={<Botao variante="secundario" onClick={() => setCfg({ ...cfg, tipos: [...cfg.tipos, { nome: 'Novo tipo', registros: ['Registro'] }] })}><Plus size={15} /> Tipo</Botao>}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {cfg.tipos.map((t, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-m-md border border-m-stroke-subtle p-3">
                  <div className="flex gap-2">
                    <input aria-label="Tipo de auditoria" value={t.nome} onChange={(e) => setCfg({ ...cfg, tipos: cfg.tipos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} className={`${cls} flex-1 font-semibold`} />
                    <button type="button" aria-label={`Tirar o tipo ${t.nome}`} onClick={() => setCfg({ ...cfg, tipos: cfg.tipos.filter((_, j) => j !== i) })} className="text-m-danger"><Trash2 size={16} /></button>
                  </div>
                  <label className="flex flex-col gap-1 text-[11.5px] text-m-text-muted">Tipos de registro (um por linha)
                    <textarea rows={6} value={t.registros.join('\n')} onChange={(e) => setCfg({ ...cfg, tipos: cfg.tipos.map((x, j) => (j === i ? { ...x, registros: e.target.value.split('\n') } : x)) })} className={cls} />
                  </label>
                </div>
              ))}
            </div>
          </Painel>
          <Painel titulo="Campos do registro (ordem do formulário e do envio)" acoes={<Botao variante="secundario" onClick={() => setCfg({ ...cfg, campos: [...cfg.campos, { chave: `texto_${Date.now()}`, rotulo: 'Novo campo', emoji: '', tipo: 'texto', obrigatorio: false, ativo: true }] })}><Plus size={15} /> Campo livre</Botao>}>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-[0.4px] text-m-text-muted"><tr><th className="py-1.5">Ordem</th><th>Emoji</th><th>Rótulo</th><th>Vem de</th><th>Obrigatório</th><th>Ativo</th><th /></tr></thead>
              <tbody>
                {cfg.campos.map((c, i) => (
                  <tr key={c.chave} className="border-t border-m-stroke-subtle">
                    <td className="py-1.5"><button type="button" aria-label="Subir" onClick={() => mover(i, -1)} className="p-1"><ArrowUp size={14} /></button><button type="button" aria-label="Descer" onClick={() => mover(i, 1)} className="p-1"><ArrowDown size={14} /></button></td>
                    <td><input aria-label="Emoji" value={c.emoji} onChange={(e) => mudaCampo(i, { emoji: e.target.value })} className={`${cls} w-14 text-center`} /></td>
                    <td><input aria-label="Rótulo" value={c.rotulo} onChange={(e) => mudaCampo(i, { rotulo: e.target.value })} className={`${cls} w-full`} /></td>
                    <td className="text-[12px] text-m-text-muted">{NOME_TIPO[c.tipo]}</td>
                    <td><input type="checkbox" aria-label="Obrigatório" disabled={fixo(c.tipo)} checked={c.obrigatorio} onChange={(e) => mudaCampo(i, { obrigatorio: e.target.checked })} /></td>
                    <td><input type="checkbox" aria-label="Ativo" disabled={fixo(c.tipo)} checked={c.ativo} onChange={(e) => mudaCampo(i, { ativo: e.target.checked })} /></td>
                    <td>{c.tipo === 'texto' && <button type="button" aria-label="Tirar o campo" onClick={() => setCfg({ ...cfg, campos: cfg.campos.filter((_, j) => j !== i) })} className="text-m-danger"><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-m-text-muted">Tipo, frente, data, não conformidade e VER E AGIR são sempre obrigatórios. A foto da não conformidade é obrigatória; VER E AGIR = SIM pede a foto do depois; NÃO pede o plano de ação (vira ação 5W2H).</p>
          </Painel>
        </>
      )}
    </>
  );
}
