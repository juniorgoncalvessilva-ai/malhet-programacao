'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { codigoLido } from '@/lib/presenca/leitores';
import { type BasePresenca, type PessoaBase, lerBase, normalizarCodigo, salvarBase } from '@/lib/presenca/offline';

/**
 * Base de pessoas no aparelho (a mesma da presença, spec 063): quem é quem pelo crachá, NFC ou rosto, sem internet.
 * Usada pelo etilômetro (spec 073). Abre a cópia guardada na hora e atualiza do servidor quando há rede.
 */
export function useBasePessoas() {
  const api = useApi();
  const obraId = useObra().obra?.id ?? 0;
  const [base, setBase] = useState<BasePresenca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const baixar = useCallback(async () => {
    if (!obraId || navigator.onLine === false) return;
    setBaixando(true);
    try { const b = await api.get<BasePresenca>('/presenca/base'); await salvarBase(obraId, b); setBase(b); setErro(null); } catch (e) { setErro((e as Error).message); } finally { setBaixando(false); }
  }, [api, obraId]);

  useEffect(() => {
    if (!obraId) return;
    let vivo = true;
    lerBase(obraId).then((b) => { if (vivo && b) setBase(b); }).catch(() => undefined).finally(() => { baixar(); });
    return () => { vivo = false; };
  }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const indice = useMemo(() => {
    const cod = new Map<string, PessoaBase>(); const nfc = new Map<string, PessoaBase>(); const id = new Map<number, PessoaBase>();
    for (const p of base?.pessoas ?? []) {
      id.set(p.id, p);
      for (const c of p.codigos) cod.set(normalizarCodigo(c), p);
      if (p.nfc) nfc.set(normalizarCodigo(p.nfc), p);
    }
    return { cod, nfc, id };
  }, [base]);

  /** Pessoa do crachá lido (QR/código/matrícula ou NFC); null se o crachá não está cadastrado. */
  const porCodigo = useCallback((codigo: string) => indice.cod.get(normalizarCodigo(codigoLido(codigo))) ?? null, [indice]);
  const porNfc = useCallback((serial: string | null, textos: string[]) =>
    (serial && indice.nfc.get(normalizarCodigo(serial))) || textos.map((t) => indice.cod.get(normalizarCodigo(codigoLido(t)))).find(Boolean) || null, [indice]);

  return { base, erro, baixando, baixar, indice, porCodigo, porNfc };
}
