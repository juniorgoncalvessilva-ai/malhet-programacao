'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CloudOff, Copy, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BuscaArea } from '@/components/Auditoria/BuscaArea';
import { carimbarFoto, TirarFotos } from '@/components/Mobile/Fotos';
import { useMarcaObra } from '@/components/Obra/LogosObra';
import { CampoM, ChipsM, TextoM, cartaoM } from '@/components/Mobile/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import {
  type CampoModelo, type ModeloAuditoria, compartilharWhatsapp, useModelosAuditoria, useOpcoesAuditoria,
} from '@/lib/auditorias';
import { type DadosAuditoria, type ResultadoAuditoria, formAuditoria, pendencias, textoEnvio } from '@/lib/auditorias/fila';
import { idLocal } from '@/lib/offline/db';
import { type ItemFila, enfileirar, enviarItem, fotoParaFila, removerDaFila } from '@/lib/offline/fila';

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
 * Spec 072: funciona sem internet — o registro inteiro (com as fotos carimbadas) é gravado no aparelho antes de enviar e
 * sobe sozinho quando houver rede; o texto do WhatsApp sai do próprio aparelho (o número chega na sincronização).
 */
export function FormAuditoria({ onNovo }: { onNovo?: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const { obra } = useObra();
  const { usuario } = useSessao();
  const modelos = useModelosAuditoria();
  const opcoes = useOpcoesAuditoria();
  const marca = useMarcaObra();
  const ativos = (modelos.data ?? []).filter((m) => m.ativo);
  const [modeloId, setModeloId] = useState<number | null>(null);
  const modelo: ModeloAuditoria | undefined = ativos.find((m) => m.id === modeloId) ?? ativos.find((m) => m.padrao) ?? ativos[0];
  const [f, setF] = useState<Estado>(VAZIO);
  const [antes, setAntes] = useState<Blob[]>([]);
  const [depois, setDepois] = useState<Blob[]>([]);
  const [idl, setIdl] = useState(idLocal);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<{ reg: ResultadoAuditoria | null; texto: string; fotos: Blob[] } | null>(null);
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
    modelo_id: modelo?.id, tipo: f.tipo, tipo_registro: f.tipo_registro, data: f.data, area_id: f.area_id, area_texto: f.area_texto, // com área das Frentes o servidor usa o nome dela; aqui serve à fila e ao texto offline
    equipe_id: f.equipe_id, engenheiro: f.engenheiro || null, encarregado: f.encarregado || null, rac: f.rac || null,
    nao_conformidade: f.nao_conformidade, medida_corretiva: f.medida_corretiva || null, ver_agir: f.ver_agir == null ? null : f.ver_agir === 'sim',
    plano_responsavel: f.ver_agir === 'nao' ? f.plano_responsavel || null : null, plano_prazo: f.ver_agir === 'nao' ? f.plano_prazo || null : null,
    acompanhamento: f.acompanhamento || null, respostas: f.respostas,
  });

  const registrar = async () => {
    if (!modelo || !obra) return;
    const dados: DadosAuditoria = { ...corpo(), modelo_id: modelo.id, id_local: idl, registrado_em: new Date().toISOString() };
    const falta = pendencias(modelo.config, dados, antes.length, f.ver_agir === 'sim' ? depois.length : 0);
    if (falta.length) { toast.error(`Falta: ${falta.join(', ')}`, { duration: 7000 }); return; }
    setSalvando(true);
    try {
      // fotos com carimbo de data/hora e frente (prova para o envio); o número só existe depois de sincronizar
      const linhas = [f.area_texto ? `Frente: ${f.area_texto}` : '', `${f.tipo}${f.tipo_registro ? ` · ${f.tipo_registro}` : ''}`, obra.nome];
      const fotos: { blob: Blob; momento: string }[] = [];
      for (const [lista, momento] of [[antes, 'antes'], [f.ver_agir === 'sim' ? depois : [], 'depois']] as const) {
        for (const b of lista) fotos.push({ blob: await carimbarFoto(b, [momento === 'depois' ? 'DEPOIS · adequação' : 'ANTES · não conformidade', ...linhas]), momento });
      }
      const local = () => textoEnvio(modelo.config, { ...dados, auditor: usuario?.email ?? null }, `${obra.codigo} · ${obra.nome}`, marca.data?.nome_contratada);
      const post = api.post as <T>(p: string, b: unknown) => Promise<T>;
      const item: ItemFila = {
        id_local: idl, obra_id: obra.id, tipo: 'auditoria', rotulo: `${f.tipo ?? 'Auditoria'} · ${f.area_texto ?? ''}`.trim(), criado_em: dados.registrado_em,
        dados: dados as unknown as Record<string, unknown>, fotos: await Promise.all(fotos.map((x) => fotoParaFila(x.blob, x.momento))), estado: 'pendente', tentativas: 0,
      };
      let guardada = true;
      try { await enfileirar(item); } catch { guardada = false; } // aparelho sem IndexedDB (aba anônima): só online
      let reg: ResultadoAuditoria | null = null;
      try {
        reg = guardada ? (await enviarItem(post, item)) as ResultadoAuditoria | null
          : await post<ResultadoAuditoria>('/auditorias/registros/completo', formAuditoria(dados, fotos));
      } catch (e) {
        // o servidor recusou (cadastro mudou, área excluída…): volta ao formulário para corrigir, nada fica pela metade
        if (guardada) await removerDaFila(idl).catch(() => undefined);
        toast.error((e as Error).message, { duration: 9000 });
        return;
      }
      if (reg) { qc.invalidateQueries({ queryKey: ['auditorias'] }); qc.invalidateQueries({ queryKey: ['acoes'] }); }
      setPronto({ reg, texto: reg?.texto ?? local(), fotos: fotos.map((x) => x.blob) });
    } catch (e) { toast.error((e as Error).message, { duration: 9000 }); } finally { setSalvando(false); }
  };

  const enviar = async () => {
    if (!pronto?.texto) return;
    try {
      const como = await compartilharWhatsapp(pronto.texto, pronto.fotos);
      if (como === 'link') toast.info('WhatsApp aberto com o texto. Anexe as fotos na conversa (este navegador não envia arquivos).', { duration: 9000 });
    } catch { /* cancelou o compartilhamento */ }
  };

  const novo = () => { setF({ ...VAZIO, acompanhamento: auditor }); setAntes([]); setDepois([]); setIdl(idLocal()); setPronto(null); onNovo?.(); };

  const textos = useMemo(() => (modelo?.config.campos ?? []).filter((c) => c.tipo === 'texto' && c.ativo), [modelo]);

  if (modelos.isLoading) return <p className="text-sm text-m-text-muted">Carregando o modelo…</p>;
  if (!modelo) return <p className={cartaoM}>Nenhum modelo de auditoria ativo.</p>;

  if (pronto) return (
    <section className={`${cartaoM} items-center text-center`}>
      {pronto.reg ? <CheckCircle2 size={44} className="text-m-success" /> : <CloudOff size={44} className="text-m-warning" />}
      <h2 className="text-[18px] font-semibold">{pronto.reg ? `${pronto.reg.tipo} Nº ${pronto.reg.numero} registrada` : `${f.tipo} guardada no aparelho`}</h2>
      <p className="text-[14px] text-m-text-secondary">
        {!pronto.reg ? 'Sem internet agora. O registro e as fotos estão salvos neste celular e sobem sozinhos quando a rede voltar — o número e o plano de ação saem nessa hora. Pode seguir para a próxima.'
          : pronto.reg.status === 'plano' ? `Plano de ação aberto: ação Nº ${pronto.reg.acao?.numero} para ${pronto.reg.plano_responsavel}, prazo ${new Date(`${pronto.reg.plano_prazo}T12:00:00`).toLocaleDateString('pt-BR')}.`
          : 'Adequada na hora (VER E AGIR), com fotos de antes e depois.'}</p>
      <pre className="max-h-[40vh] w-full overflow-auto whitespace-pre-wrap rounded-[14px] bg-m-surface-base p-3 text-left text-[12.5px] leading-[18px]">{pronto.texto}</pre>
      <button type="button" onClick={enviar} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1F8F4E] text-[15px] font-semibold text-white"><Send size={18} /> Enviar no WhatsApp ({pronto.fotos.length} foto{pronto.fotos.length === 1 ? '' : 's'})</button>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(pronto.texto).then(() => toast.success('Texto copiado'))} className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-m-stroke text-[14px] font-semibold"><Copy size={16} /> Copiar texto</button>
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
