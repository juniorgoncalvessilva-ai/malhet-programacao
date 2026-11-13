'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cartaoM } from '@/components/Mobile/ui';
import { Assinar } from '@/components/Preventivos/Assinar';
import { useApi } from '@/hooks/programacao/useApi';
import type { Escolhas, Geo } from '@/lib/lgpd';
import { idLocal } from '@/lib/offline/db';
import { enfileirar, processarFila } from '@/lib/offline/fila';
import { type ConsentimentoLgpd, type PessoaBase, type TermoLgpd, mudarPessoaBase } from '@/lib/presenca/offline';
import type { Assinatura } from '@/lib/preventivos';

type Busca = { porCodigo: (c: string) => PessoaBase | null; porNfc: (s: string | null, t: string[]) => PessoaBase | null };

/**
 * Coleta do termo LGPD no aparelho (spec 074): o colaborador lê, responde SIM ou NÃO para cada finalidade (nada vem
 * marcado) e assina com o crachá ou na tela — também para recusar. Vale na hora no aparelho e sobe pela fila.
 */
export function ColetaTermo({ obraId, pessoa, termo, limite, busca, local, onConcluir, onCancelar }: {
  obraId: number; pessoa: PessoaBase; termo: TermoLgpd; limite: number; busca: Busca; local?: () => Geo | null;
  onConcluir: (p: PessoaBase) => void; onCancelar: () => void;
}) {
  const api = useApi();
  const [esc, setEsc] = useState<Partial<Escolhas>>({});
  const [lido, setLido] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const faltam = termo.finalidades.filter((f) => typeof esc[f.chave] !== 'boolean');
  const marcar = (k: keyof Escolhas, v: boolean) => setEsc((e) => ({ ...e, [k]: v, ...(k === 'biometria' && !v ? { foto_assinatura: false } : {}) }));

  const salvar = async (a: Assinatura) => {
    const escolhas = Object.fromEntries(termo.finalidades.map((f) => [f.chave, !!esc[f.chave]])) as Escolhas;
    const id = idLocal(); const hora = new Date().toISOString();
    const geo = escolhas.localizacao ? local?.() ?? null : null;
    await enfileirar({
      id_local: id, obra_id: obraId, tipo: 'lgpd', rotulo: `Termo LGPD · ${pessoa.nome}`, criado_em: hora,
      dados: { id_local: id, colaborador_id: pessoa.id, versao: termo.versao, escolhas, assinatura: a, hora,
        geo: geo ? { lat: geo.lat, lng: geo.lng, precisao: geo.precisao } : null, dispositivo: navigator.userAgent.slice(0, 200) },
      fotos: [], estado: 'pendente', tentativas: 0,
    });
    const algum = Object.values(escolhas).some(Boolean);
    const lgpd: ConsentimentoLgpd = { ...escolhas, versao: termo.versao, situacao: algum ? 'aceito' : 'recusado' };
    // vale na hora neste aparelho; quem recusou o rosto deixa de ser reconhecido pelo rosto aqui também
    await mudarPessoaBase(obraId, pessoa.id, { lgpd, ...(escolhas.biometria ? {} : { face: null }) }).catch(() => undefined);
    if (navigator.onLine !== false) processarFila(api.post as <T>(p: string, b: unknown) => Promise<T>, obraId).catch(() => undefined);
    toast.success(algum ? `${pessoa.nome.split(' ')[0]}: aceite registrado` : `${pessoa.nome.split(' ')[0]}: recusa registrada — segue com crachá ou assinatura na tela`);
    onConcluir({ ...pessoa, lgpd, ...(escolhas.biometria ? {} : { face: null }) });
  };

  return (
    <>
      <section className={cartaoM}>
        <span className="flex items-center gap-2 text-[16px] font-semibold"><ShieldCheck size={20} className="text-m-accent" /> {termo.titulo}</span>
        <span className="text-[13px] text-m-text-muted">Versão {termo.versao} · {pessoa.nome}{pessoa.matricula ? ` · ${pessoa.matricula}` : ''}</span>
        <div onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLido(true); }}
          className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-m-stroke-subtle bg-m-surface-base p-3 text-[13.5px] leading-[20px]">
          {termo.texto}
        </div>
        {!lido && <button type="button" onClick={() => setLido(true)} className="self-start text-[13px] font-semibold text-m-accent underline">Li o termo (ou o termo foi lido para mim)</button>}
      </section>
      {lido && (
        <section className={cartaoM} aria-label="Autorizações">
          <span className="text-[13px] text-m-text-secondary">Responda cada item. <b>Não autorizar não traz prejuízo</b>: a pessoa usa crachá ou assina na tela.</span>
          {termo.finalidades.map((f) => {
            const bloqueado = f.chave === 'foto_assinatura' && esc.biometria !== true;
            return (
              <div key={f.chave} className={`flex flex-col gap-2 rounded-[14px] border-2 p-3 ${bloqueado ? 'border-m-stroke-subtle opacity-60' : 'border-m-stroke'}`}>
                <b className="text-[15px]">{f.rotulo}</b>
                <span className="text-[13px] leading-[18px] text-m-text-secondary">{f.descricao}</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={f.rotulo}>
                  {([true, false] as const).map((v) => (
                    <button key={String(v)} type="button" role="radio" aria-checked={esc[f.chave] === v} disabled={bloqueado && v}
                      onClick={() => marcar(f.chave, v)}
                      className={`h-12 rounded-full text-[15px] font-semibold ${esc[f.chave] === v ? (v ? 'bg-m-accent-strong text-m-on-accent' : 'bg-m-text-secondary text-m-surface-raised') : 'border border-m-stroke'}`}>
                      {v ? 'Sim, autorizo' : 'Não autorizo'}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
      {lido && !faltam.length && (
        assinando ? (
          <section className={cartaoM}>
            <span className="text-[15px] font-semibold">{pessoa.nome.split(' ')[0]}, assine para confirmar</span>
            <Assinar pessoa={pessoa} limite={limite} busca={busca} meios={['nfc', 'codigo', 'tela']} onAssinar={(a) => salvar(a)} />
          </section>
        ) : (
          <button type="button" onClick={() => setAssinando(true)} className="h-[52px] rounded-full bg-m-accent-strong text-[15px] font-semibold text-m-on-accent">Assinar as respostas</button>
        )
      )}
      <button type="button" onClick={onCancelar} className="mb-4 h-12 rounded-full border border-m-stroke text-[14px] font-semibold">Voltar</button>
    </>
  );
}
