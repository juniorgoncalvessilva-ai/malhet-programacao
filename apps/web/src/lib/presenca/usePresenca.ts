'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { codigoLido } from '@/lib/presenca/leitores';
import { useObra } from '@/lib/obra/ObraProvider';
import {
  type BasePresenca, type LeituraLocal, type Meio, type PessoaBase, guardarLeitura, guardarVinculo, hojeLocal, idLocal, leiturasDoDia,
  lerBase, limparAntigas, normalizarCodigo, pendentes, salvarBase, sincronizar,
} from '@/lib/presenca/offline';

export type Resultado =
  | { tipo: 'ok'; pessoa: PessoaBase; hora: string; meio: Meio }
  | { tipo: 'repetido'; pessoa: PessoaBase; hora: string }
  | { tipo: 'desconhecido'; codigo: string; meio: Meio; nfc?: string | null };

/** Estado da presença do dia no aparelho: base offline, leituras de hoje, fila e sincronização (spec 063). */
export function usePresenca() {
  const api = useApi();
  const { obra } = useObra();
  const obraId = obra?.id ?? 0;
  const [base, setBase] = useState<BasePresenca | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [erroBase, setErroBase] = useState<string | null>(null);
  const [hoje, setHoje] = useState<LeituraLocal[]>([]);
  const [fila, setFila] = useState(0);
  const [online, setOnline] = useState(true);
  const data = hojeLocal();
  const post = api.post as <T>(p: string, b: unknown) => Promise<T>;

  const recarregar = useCallback(async () => {
    if (!obraId) return;
    setHoje(await leiturasDoDia(obraId, data));
    setFila((await pendentes(obraId)).length);
  }, [obraId, data]);

  const baixarBase = useCallback(async () => {
    if (!obraId) return;
    setBaixando(true);
    try {
      const b = await api.get<BasePresenca>('/presenca/base');
      await salvarBase(obraId, b); setBase(b); setErroBase(null);
    } catch (e) {
      setErroBase((e as Error).message);
    } finally { setBaixando(false); }
  }, [api, obraId]);

  const enviar = useCallback(async () => {
    if (!obraId) return;
    await sincronizar(post, obraId);
    await recarregar();
  }, [post, obraId, recarregar]);

  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    (async () => {
      const b = await lerBase(obraId);
      if (vivo && b) setBase(b);
      await recarregar();
      limparAntigas().catch(() => undefined);
      if (navigator.onLine !== false) { await baixarBase(); await enviar(); }
    })();
    const on = () => { setOnline(true); enviar(); baixarBase(); };
    const off = () => setOnline(false);
    setOnline(navigator.onLine !== false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const t = setInterval(() => { if (navigator.onLine !== false) enviar(); }, 20000);
    return () => { vivo = false; window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps

  // índices para achar a pessoa na hora (código/matrícula/crachá e NFC)
  const indice = useMemo(() => {
    const cod = new Map<string, PessoaBase>(); const nfc = new Map<string, PessoaBase>(); const id = new Map<number, PessoaBase>();
    for (const p of base?.pessoas ?? []) {
      id.set(p.id, p);
      for (const c of p.codigos) cod.set(normalizarCodigo(c), p);
      if (p.nfc) nfc.set(normalizarCodigo(p.nfc), p);
    }
    return { cod, nfc, id };
  }, [base]);
  const presentes = useMemo(() => new Map(hoje.map((l) => [l.colaborador_id, l])), [hoje]);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registrar = useCallback(async (p: PessoaBase, meio: Meio): Promise<Resultado> => {
    const ja = presentes.get(p.id);
    if (ja) return { tipo: 'repetido', pessoa: p, hora: ja.hora };
    const agora = new Date();
    const l: LeituraLocal = { id_local: idLocal(), obra_id: obraId, colaborador_id: p.id, nome: p.nome, data, hora: agora.toISOString(), meio, enviada: false };
    await guardarLeitura(l);
    setHoje((h) => [l, ...h]); setFila((n) => n + 1);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => { if (navigator.onLine !== false) enviar(); }, 1500); // junta leituras seguidas num envio
    return { tipo: 'ok', pessoa: p, hora: l.hora, meio };
  }, [presentes, obraId, data, enviar]);

  const porCodigo = useCallback((codigo: string, meio: Meio) => {
    const c = codigoLido(codigo);
    const p = indice.cod.get(normalizarCodigo(c));
    return p ? registrar(p, meio) : Promise.resolve<Resultado>({ tipo: 'desconhecido', codigo: c, meio });
  }, [indice, registrar]);

  const porNfc = useCallback((serial: string | null, textos: string[]) => {
    const p = (serial && indice.nfc.get(normalizarCodigo(serial))) || textos.map((t) => indice.cod.get(normalizarCodigo(t))).find(Boolean);
    return p ? registrar(p, 'nfc') : Promise.resolve<Resultado>({ tipo: 'desconhecido', codigo: serial ?? textos[0] ?? '?', meio: 'nfc', nfc: serial });
  }, [indice, registrar]);

  // crachá desconhecido (spec 065): liga à pessoa já no aparelho (funciona sem internet) e registra a presença
  const atualizarPessoa = useCallback(async (p: PessoaBase) => {
    if (!base) return;
    const nova = { ...base, pessoas: base.pessoas.some((x) => x.id === p.id) ? base.pessoas.map((x) => (x.id === p.id ? p : x)) : [...base.pessoas, p] };
    setBase(nova); await salvarBase(obraId, nova);
  }, [base, obraId]);

  const vincular = useCallback(async (p: PessoaBase, r: Extract<Resultado, { tipo: 'desconhecido' }>): Promise<Resultado> => {
    const nfc = r.meio === 'nfc' ? (r.nfc ?? null) : null;
    const codigo = nfc ? null : r.codigo;
    await guardarVinculo(obraId, { colaborador_id: p.id, codigo, nfc });
    const atual: PessoaBase = { ...p, nfc: nfc ? normalizarCodigo(nfc) : p.nfc, codigos: codigo ? [...new Set([...p.codigos, normalizarCodigo(codigo)])] : p.codigos };
    await atualizarPessoa(atual);
    const res = await registrar(atual, r.meio);
    if (navigator.onLine !== false) enviar();
    return res;
  }, [obraId, atualizarPessoa, registrar, enviar]);

  const cadastrar = useCallback(async (nome: string, funcaoChave: string, r: Extract<Resultado, { tipo: 'desconhecido' }>): Promise<Resultado> => {
    const nfc = r.meio === 'nfc' ? (r.nfc ?? null) : null;
    const p = await post<PessoaBase>('/presenca/pessoa-simplificada', { nome, funcao_chave: funcaoChave, nfc, codigo: nfc ? null : r.codigo });
    await atualizarPessoa(p);
    return registrar(p, r.meio);
  }, [post, atualizarPessoa, registrar]);

  return { vincular, cadastrar, obraId, base, baixando, erroBase, baixarBase, hoje, presentes, fila, online, enviar, registrar, porCodigo, porNfc, indice, data };
}
