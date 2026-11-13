'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BuscaArea } from '@/components/Auditoria/BuscaArea';
import { carimbarFoto, TirarFotos, useEnviarFoto } from '@/components/Mobile/Fotos';
import { CampoM, ChipsM, TextoM, cartaoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import {
  type CampoModelo, type ModeloAuditoria, type RegistroAuditoria, compartilharWhatsapp, useModelosAuditoria, useOpcoesAuditoria,
} from '@/lib/auditorias';

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seletor = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3 text-[15px] text-m-text-primary';

interface Estado {
  tipo: string | null; tipo_registro: string | null; data: string; area_id: number | null; area_texto: string | null; equipe_id: number | null;
  engenheiro: string; encarregado: string; rac: string; nao_conformidade: string; medida_corretiva: string; ver_agir: 'sim' | 'nao' | null;
  plano_responsavel: string; plano_prazo: string; acompanhamento: string; respostas: Record<string, string>;
}
const VAZIO: Estado = {
  tipo: null, tipo_registro: null, data: hoje(), area_id: null, area_texto: null, equipe_id: null, engenheiro: '', encarregado: '', rac: '',
  nao_conformidade: '', medida_corretiva: '', ver_agir: null, plano_responsavel: '', plano_prazo: '', acompanhamento: '', respostas: {},
};

/**
 * Registro de auditoria pelo modelo (spec 064) — o mesmo no celular e no web. Campos, rótulos e emojis vêm do modelo;
 * VER E AGIR = SIM pede a foto do depois; NÃO pede o plano de ação (vira ação 5W2H). No fim, envia pelo WhatsApp.
 */
export function FormAuditoria({ onNovo }: { onNovo?: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const { obra } = useObra();
  const { usuario } = useSessao();
  const modelos = useModelosAuditoria();
  const opcoes = useOpcoesAuditoria();
  const enviarFoto = useEnviarFoto();
  const ativos = (modelos.data ?? []).filter((m) => m.ativo);
  const [modeloId, setModeloId] = useState<number | null>(null);
  const modelo: ModeloAuditoria | undefined = ativos.find((m) => m.id === modeloId) ?? ativos.find((m) => m.padrao) ?? ativos[0];
  const [f, setF] = useState<Estado>(VAZIO);
  const [antes, setAntes] = useState<Blob[]>([]);
  const [depois, setDepois] = useState<Blob[]>([]);
  const [enviadas, setEnviadas] = useState<Set<Blob>>(new Set());
  const [rid, setRid] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<{ reg: RegistroAuditoria; fotos: Blob[] } | null>(null);
  const muda = (m: Partial<Estado>) => setF((x) => ({ ...x, ...m }));
  const campo = (t: CampoModelo['tipo']) => modelo?.config.campos.find((c) => c.tipo === t && c.ativo);
  const rot = (t: CampoModelo['tipo'], padrao: string) => { const c = campo(t); return c ? `${c.emoji ? `${c.emoji} ` : ''}${c.rotulo}${c.obrigatorio ? '' : ' (opcional)'}` : padrao; };
  const tipo = modelo?.config.tipos.find((t) => t.nome === f.tipo);
  const equipes = opcoes.data?.equipes ?? [];
  const auditor = usuario?.email ?? '';

  // escolher o encarregado (pela equipe) já traz o engenheiro, o responsável do plano e quem acompanha
  const escolherEquipe = (id: number | null) => {
    const e = equipes.find((x) => x.id === id);
    muda({
      equipe_id: id, encarregado: e?.encarregado ?? '', engenheiro: e?.engenheiro ?? f.engenheiro,
      plano_responsavel: e?.encarregado ?? f.plano_responsavel,
      acompanhamento: [e?.lider, auditor].filter(Boolean).join(' / '),
    });
  };
  useEffect(() => { if (!f.acompanhamento && auditor) muda({ acompanhamento: auditor }); }, [auditor]); // eslint-disable-line react-hooks/exhaustive-deps

  const corpo = () => ({
    modelo_id: modelo?.id, tipo: f.tipo, tipo_registro: f.tipo_registro, data: f.data, area_id: f.area_id, area_texto: f.area_id ? null : f.area_texto,
    equipe_id: f.equipe_id, engenheiro: f.engenheiro || null, encarregado: f.encarregado || null, rac: f.rac || null,
    nao_conformidade: f.nao_conformidade, medida_corretiva: f.medida_corretiva || null, ver_agir: f.ver_agir == null ? null : f.ver_agir === 'sim',
    plano_responsavel: f.ver_agir === 'nao' ? f.plano_responsavel || null : null, plano_prazo: f.ver_agir === 'nao' ? f.plano_prazo || null : null,
    acompanhamento: f.acompanhamento || null, respostas: f.respostas,
  });

  const conferir = (): string | null => {
    if (!f.tipo) return `Escolha o ${campo('tipo_auditoria')?.rotulo ?? 'tipo de auditoria'}`;
    if (campo('tipo_registro')?.obrigatorio && !f.tipo_registro) return 'Escolha o tipo de registro';
    if (!f.area_id) return 'Escolha o local / frente';
    if (f.nao_conformidade.trim().length < 3) return 'Descreva a não conformidade';
    if (!antes.length) return 'Tire a foto da não conformidade';
    if (!f.ver_agir) return 'Responda o VER E AGIR';
    if (f.ver_agir === 'sim' && !depois.length) return 'VER E AGIR: tire a foto do depois (adequação)';
    if (f.ver_agir === 'nao' && (!f.plano_responsavel.trim() || !f.plano_prazo)) return 'Plano de ação: responsável e prazo';
    return null;
  };

  const registrar = async () => {
    const erro = conferir();
    if (erro) { toast.error(erro); return; }
    setSalvando(true);
    try {
      const reg = rid ? await api.put<RegistroAuditoria>(`/auditorias/registros/${rid}`, corpo()) : await api.post<RegistroAuditoria>('/auditorias/registros', corpo());
      setRid(reg.id);
      // fotos com carimbo de data/hora, frente e o registro (prova para o envio)
      const linhas = [f.area_texto ? `Frente: ${f.area_texto}` : '', `${f.tipo} Nº ${reg.numero}${f.tipo_registro ? ` · ${f.tipo_registro}` : ''}`, obra?.nome ?? ''];
      const carimbadas: Blob[] = [];
      for (const [lista, momento] of [[antes, 'antes'], [f.ver_agir === 'sim' ? depois : [], 'depois']] as const) {
        for (const b of lista) {
          const c = await carimbarFoto(b, [momento === 'depois' ? 'DEPOIS · adequação' : 'ANTES · não conformidade', ...linhas]);
          carimbadas.push(c);
          if (!enviadas.has(b)) { await enviarFoto('auditoria', reg.id, c, { legenda: momento }); setEnviadas((s) => new Set(s).add(b)); }
        }
      }
      const fim = await api.post<RegistroAuditoria>(`/auditorias/registros/${reg.id}/finalizar`, {});
      qc.invalidateQueries({ queryKey: ['auditorias'] }); qc.invalidateQueries({ queryKey: ['acoes'] });
      setPronto({ reg: fim, fotos: carimbadas });
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); } finally { setSalvando(false); }
  };

  const enviar = async () => {
    if (!pronto?.reg.texto) return;
    try {
      const como = await compartilharWhatsapp(pronto.reg.texto, pronto.fotos);
      if (como === 'link') toast.info('WhatsApp aberto com o texto. Anexe as fotos na conversa (este navegador não envia arquivos).', { duration: 9000 });
    } catch { /* cancelou o compartilhamento */ }
  };

  const novo = () => { setF({ ...VAZIO, acompanhamento: auditor }); setAntes([]); setDepois([]); setEnviadas(new Set()); setRid(null); setPronto(null); onNovo?.(); };

  const textos = useMemo(() => (modelo?.config.campos ?? []).filter((c) => c.tipo === 'texto' && c.ativo), [modelo]);

  if (modelos.isLoading) return <p className="text-sm text-m-text-muted">Carregando o modelo…</p>;
  if (!modelo) return <p className={cartaoM}>Nenhum modelo de auditoria ativo.</p>;

  if (pronto) return (
    <section className={`${cartaoM} items-center text-center`}>
      <CheckCircle2 size={44} className="text-m-success" />
      <h2 className="text-[18px] font-semibold">{pronto.reg.tipo} Nº {pronto.reg.numero} registrada</h2>
      <p className="text-[14px] text-m-text-secondary">{pronto.reg.status === 'plano' ? `Plano de ação aberto: ação Nº ${pronto.reg.acao?.numero} para ${pronto.reg.plano_responsavel}, prazo ${new Date(`${pronto.reg.plano_prazo}T12:00:00`).toLocaleDateString('pt-BR')}.` : 'Adequada na hora (VER E AGIR), com fotos de antes e depois.'}</p>
      <pre className="max-h-[40vh] w-full overflow-auto whitespace-pre-wrap rounded-[14px] bg-m-surface-base p-3 text-left text-[12.5px] leading-[18px]">{pronto.reg.texto}</pre>
      <button type="button" onClick={enviar} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1F8F4E] text-[15px] font-semibold text-white"><Send size={18} /> Enviar no WhatsApp ({pronto.fotos.length} foto{pronto.fotos.length === 1 ? '' : 's'})</button>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(pronto.reg.texto ?? '').then(() => toast.success('Texto copiado'))} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-m-stroke text-[14px] font-semibold"><Copy size={16} /> Copiar texto</button>
        <button type="button" onClick={novo} className="h-12 rounded-full border border-m-stroke text-[14px] font-semibold text-m-accent">Nova auditoria</button>
      </div>
    </section>
  );

  return (
    <>
      {ativos.length > 1 && (
        <section className={cartaoM}>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Modelo
            <select value={modelo.id} onChange={(e) => { setModeloId(Number(e.target.value)); muda({ tipo: null, tipo_registro: null }); }} className={seletor}>
              {ativos.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.padrao ? ' (padrão)' : ''}</option>)}
            </select>
          </label>
        </section>
      )}
      <section className={cartaoM}>
        <ChipsM rotulo={rot('tipo_auditoria', 'Tipo de auditoria')} valor={f.tipo} onChange={(v) => muda({ tipo: v, tipo_registro: null })}
          opcoes={modelo.config.tipos.map((t) => ({ valor: t.nome, rotulo: t.nome }))} />
        {tipo && campo('tipo_registro') && (
          <ChipsM rotulo={rot('tipo_registro', 'Tipo de registro')} valor={f.tipo_registro} onChange={(v) => muda({ tipo_registro: v })}
            opcoes={tipo.registros.map((r) => ({ valor: r, rotulo: r }))} />
        )}
      </section>
      <section className={cartaoM}>
        <BuscaArea rotulo={rot('frente', 'Local / Frente')} valor={f.area_id} onEscolher={(id, t) => muda({ area_id: id, area_texto: t })} />
        <CampoM rotulo={rot('data', 'Data')} type="date" value={f.data} max={hoje()} onChange={(e) => muda({ data: e.target.value })} />
        {campo('encarregado') && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rot('encarregado', 'Encarregado responsável')}
            <select value={f.equipe_id ?? ''} onChange={(e) => escolherEquipe(e.target.value ? Number(e.target.value) : null)} className={seletor}>
              <option value="">— escolha pela equipe —</option>
              {equipes.filter((e) => e.encarregado).map((e) => <option key={e.id} value={e.id}>{e.encarregado} — {e.nome}</option>)}
            </select>
          </label>
        )}
        {campo('engenheiro') && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rot('engenheiro', 'Eng.º responsável')}
            <input list="lista-engenheiros" value={f.engenheiro} onChange={(e) => muda({ engenheiro: e.target.value })} className={seletor} placeholder="Responsável da equipe" />
            <datalist id="lista-engenheiros">{(opcoes.data?.engenheiros ?? []).map((n) => <option key={n} value={n} />)}</datalist>
          </label>
        )}
        {campo('rac') && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">{rot('rac', 'RAC')}
            <select value={f.rac} onChange={(e) => muda({ rac: e.target.value })} className={seletor}>
              <option value="">— sem RAC —</option>
              {(opcoes.data?.racs ?? []).map((r) => <option key={r.codigo} value={r.descricao ? `${r.codigo} · ${r.descricao}` : r.codigo}>{r.codigo}{r.descricao ? ` · ${r.descricao}` : ''}</option>)}
            </select>
          </label>
        )}
      </section>
      <section className={cartaoM}>
        <TextoM rotulo={rot('nao_conformidade', 'Não conformidade')} value={f.nao_conformidade} onChange={(e) => muda({ nao_conformidade: e.target.value })} placeholder="O que foi encontrado" />
        <TirarFotos fotos={antes} onChange={setAntes} rotulo="Foto da não conformidade (antes)" dica="Obrigatória · sai com data, hora e frente" carimbo={[f.area_texto ?? '', obra?.nome ?? '']} />
        {campo('medida_corretiva') && <TextoM rotulo={rot('medida_corretiva', 'Medida corretiva')} rows={2} value={f.medida_corretiva} onChange={(e) => muda({ medida_corretiva: e.target.value })} placeholder="O que deve ser feito" />}
      </section>
      <section className={cartaoM}>
        <ChipsM rotulo={rot('ver_agir', 'VER E AGIR')} valor={f.ver_agir} onChange={(v) => muda({ ver_agir: v })}
          opcoes={[{ valor: 'sim', rotulo: 'SIM · corrigido na hora' }, { valor: 'nao', rotulo: 'NÃO · plano de ação' }]} />
        {f.ver_agir === 'sim' && <TirarFotos fotos={depois} onChange={setDepois} rotulo="Foto do depois (adequação)" dica="Obrigatória quando corrige na hora" carimbo={[f.area_texto ?? '', obra?.nome ?? '']} />}
        {f.ver_agir === 'nao' && (
          <div className="flex flex-col gap-3 rounded-[14px] border border-m-warning/40 bg-m-warning-subtle p-3">
            <span className="text-[13px] font-semibold text-m-warning">{rot('plano_acao', 'Plano de ação')}</span>
            <CampoM rotulo="Responsável (encarregado)" value={f.plano_responsavel} onChange={(e) => muda({ plano_responsavel: e.target.value })} />
            <CampoM rotulo="Prazo de conclusão" type="date" min={f.data} value={f.plano_prazo} onChange={(e) => muda({ plano_prazo: e.target.value })} />
            <span className="text-[12px] text-m-text-secondary">Vira uma ação 5W2H; a foto da adequação entra quando a ação for concluída.</span>
          </div>
        )}
        {campo('acompanhamento') && <CampoM rotulo={rot('acompanhamento', 'Responsável pelo acompanhamento')} value={f.acompanhamento} onChange={(e) => muda({ acompanhamento: e.target.value })} />}
        {textos.map((c) => <CampoM key={c.chave} rotulo={`${c.emoji ? `${c.emoji} ` : ''}${c.rotulo}${c.obrigatorio ? '' : ' (opcional)'}`} value={f.respostas[c.chave] ?? ''} onChange={(e) => muda({ respostas: { ...f.respostas, [c.chave]: e.target.value } })} />)}
      </section>
      <button type="button" disabled={salvando} onClick={registrar} className="mb-4 h-[52px] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent disabled:opacity-50">
        {salvando ? 'Registrando…' : 'Registrar e preparar o envio'}
      </button>
    </>
  );
}
