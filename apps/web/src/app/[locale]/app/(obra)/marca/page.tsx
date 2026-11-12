'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ImageUp, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LogosObra, useLogo, useMarcaObra } from '@/components/Obra/LogosObra';
import { SeletorCor } from '@/components/Obra/SeletorCor';
import { Botao, Cabecalho, Campo, Painel } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

const QUAIS = [
  { qual: 'contratante', titulo: 'Logo do contratante (cliente)' },
  { qual: 'contratada', titulo: 'Logo da contratada' },
] as const;

/** Marca da obra: logos da contratada e do contratante (documentos) e a cor do cliente (tela e documentos). */
export default function MarcaPage() {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const { obra, pode } = useObra();
  const m = useMarcaObra();
  const [cor, setCor] = useState<string | null>(null);
  const [nomes, setNomes] = useState({ nome_contratada: '', nome_contratante: '' });
  useEffect(() => { setNomes({ nome_contratada: m.data?.nome_contratada ?? '', nome_contratante: m.data?.nome_contratante ?? '' }); }, [m.data?.nome_contratada, m.data?.nome_contratante]);
  const [enviando, setEnviando] = useState<string | null>(null);
  useEffect(() => { setCor(m.data?.cor ?? null); }, [m.data?.cor]);
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['marca-obra'] }); qc.invalidateQueries({ queryKey: ['obras-minhas'] }); };
  if (!pode('admin')) return <p className="text-sm text-m-text-muted">Só o admin da obra muda a marca.</p>;

  const enviar = async (qual: string, arq: File | undefined) => {
    if (!arq) return;
    setEnviando(qual);
    const fd = new FormData();
    fd.append('arquivo', arq);
    try { await api.post(`/obra/marca/logo/${qual}`, fd); toast.success('Logo salva: já entra nos documentos'); atualizar(); }
    catch (e) { toast.error((e as Error).message); } finally { setEnviando(null); }
  };

  return (
    <>
      <Cabecalho eyebrow="Administrar · marca da obra" cor="var(--m-proc-administrar)" titulo={`Marca de ${obra?.nome ?? 'obra'}`} />
      <Painel titulo="Como sai nos documentos">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-m-md border border-m-stroke-subtle bg-white p-4 text-black">
          <div><div className="text-[13px] font-bold uppercase">{obra?.nome}</div><div className="text-[15px] font-bold">PROGRAMAÇÃO SEMANAL · exemplo</div></div>
          <LogosObra altura={40} />
        </div>
        <div className="h-8 rounded-m-sm bg-m-accent-strong px-3 text-[12px] font-semibold leading-8 text-m-on-accent">Cabeçalho das tabelas na cor da obra</div>
      </Painel>
      <Painel titulo="Nomes (aba do navegador: Contratada | Obra)">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); api.put('/obra/marca/nomes', nomes).then(() => { toast.success('Nomes salvos'); atualizar(); }).catch((er) => toast.error(er.message)); }}>
          <Campo rotulo="Contratada" value={nomes.nome_contratada} maxLength={80} onChange={(e) => setNomes({ ...nomes, nome_contratada: e.target.value })} className="min-w-[260px]" />
          <Campo rotulo="Contratante (cliente)" value={nomes.nome_contratante} maxLength={80} onChange={(e) => setNomes({ ...nomes, nome_contratante: e.target.value })} className="min-w-[260px]" />
          <Botao type="submit"><Save size={16} /> Salvar nomes</Botao>
        </form>
        <p className="text-[12.5px] text-m-text-muted">A aba mostra “{nomes.nome_contratada || 'Malhet'} | {obra?.nome}” e o ícone da logo da contratada (sem logo, o do Malhet).</p>
      </Painel>
      <div className="grid gap-4 lg:grid-cols-2">
        {QUAIS.map(({ qual, titulo }) => <SlotLogo key={qual} qual={qual} titulo={titulo} existe={!!m.data?.[qual]} versao={m.data?.versao ?? 0} enviando={enviando === qual}
          onEnviar={(f) => enviar(qual, f)}
          onExcluir={async () => (await confirmar({ titulo: `Tirar a ${titulo.toLowerCase()}?`, mensagem: 'Os documentos voltam a usar a outra logo ou a do Malhet.' }))
            && api.del(`/obra/marca/logo/${qual}`).then(() => { toast.success('Logo retirada'); atualizar(); }).catch((e) => toast.error(e.message))} />)}
      </div>
      <Painel titulo="Cor do cliente">
        <div className="flex flex-wrap items-end gap-4">
          <SeletorCor rotulo="Cor no lugar do verde Malhet" valor={cor} padrao="#284E4F" onChange={setCor} />
          <Botao onClick={() => api.put('/obra/marca/cor', { cor }).then(() => { toast.success(cor ? 'Cor da obra salva' : 'Voltou ao verde Malhet'); atualizar(); }).catch((e) => toast.error(e.message))}><Save size={16} /> Salvar cor</Botao>
        </div>
      </Painel>
    </>
  );
}

function SlotLogo({ qual, titulo, existe, versao, enviando, onEnviar, onExcluir }: {
  qual: 'contratada' | 'contratante'; titulo: string; existe: boolean; versao: number; enviando: boolean; onEnviar: (f?: File) => void; onExcluir: () => void;
}) {
  const logo = useLogo(qual, existe, versao);
  return (
    <Painel titulo={titulo} acoes={existe && <Botao variante="fantasma" onClick={onExcluir}><Trash2 size={15} /> Tirar</Botao>}>
      <div className="grid h-28 place-items-center rounded-m-md border border-dashed border-m-stroke-strong bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo.data ? <img src={logo.data} alt={titulo} className="max-h-24 max-w-[80%] object-contain" /> : <span className="text-[13px] text-m-text-muted">Sem logo: o documento usa a outra ou a do Malhet</span>}
      </div>
      <label className={`inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-m-stroke px-4 text-[13.5px] font-semibold text-m-accent ${enviando ? 'pointer-events-none opacity-60' : ''}`}>
        <ImageUp size={16} /> {enviando ? 'Enviando…' : existe ? 'Trocar a logo' : 'Enviar logo (PNG ou JPG)'}
        <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { onEnviar(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </Painel>
  );
}
