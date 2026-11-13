'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import {
  type BasePresenca, type LeituraLocal, type Meio, type PessoaBase, guardarLeitura, hojeLocal, idLocal, leiturasDoDia,
  lerBase, limparAntigas, normalizarCodigo, pendentes, salvarBase, sincronizar,
} from '@/lib/presenca/offline';

export type Resultado =
  | { tipo: 'ok'; pessoa: PessoaBase; hora: string; meio: Meio }
  | { tipo: 'repetido'; pessoa: PessoaBase; hora: string }
  | { tipo: 'desconhecido'; codigo: string; meio: Meio };

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
    const p = indice.cod.get(normalizarCodigo(codigo));
    return p ? registrar(p, meio) : Promise.resolve<Resultado>({ tipo: 'desconhecido', codigo, meio });
  }, [indice, registrar]);

  const porNfc = useCallback((serial: string | null, textos: string[]) => {
    const p = (serial && indice.nfc.get(normalizarCodigo(serial))) || textos.map((t) => indice.cod.get(normalizarCodigo(t))).find(Boolean);
    return p ? registrar(p, 'nfc') : Promise.resolve<Resultado>({ tipo: 'desconhecido', codigo: serial ?? textos[0] ?? '?', meio: 'nfc' });
  }, [indice, registrar]);

  return { obraId, base, baixando, erroBase, baixarBase, hoje, presentes, fila, online, enviar, registrar, porCodigo, porNfc, indice, data };
}
