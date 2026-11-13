'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAPEL_ROTULO } from '@/components/Mobile/BarraCampo';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Avatar } from '@/components/Perfil/Avatar';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { type Perfil, usePerfil } from '@/lib/perfil';

const campo = 'h-12 w-full rounded-[14px] border border-m-stroke bg-m-surface-field px-3.5 text-[15px] text-m-text-primary outline-none focus:border-m-accent';

/** Foto, nome de exibição e telefone da conta (spec 075) — o mesmo no celular e no web. */
export function FormPerfil() {
  const api = useApi();
  const qc = useQueryClient();
  const confirmar = useConfirmar();
  const p = usePerfil();
  const { obras, superadminReal } = useObra();
  const [f, setF] = useState({ nome_exibicao: '', telefone: '' });
  const [enviando, setEnviando] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  useEffect(() => { if (p.data) setF({ nome_exibicao: p.data.nome_exibicao ?? '', telefone: p.data.telefone ?? '' }); }, [p.data?.usuario_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const atualizar = (r: Perfil) => qc.setQueryData(['perfil', r.usuario_id], r);

  const trocarFoto = async (file: File) => {
    if (navigator.onLine === false) { toast.info('A foto do perfil precisa de internet.'); return; }
    setEnviando(true);
    try { const fd = new FormData(); fd.append('arquivo', file); atualizar(await api.put<Perfil>('/perfil/avatar', fd)); toast.success('Foto atualizada'); } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar tamanho={84} />
        <div className="flex flex-col gap-2">
          <button type="button" disabled={enviando} onClick={() => arq.current?.click()} className="flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[14px] font-semibold text-m-on-accent disabled:opacity-50">
            <Camera size={16} /> {enviando ? 'Enviando…' : p.data?.tem_avatar ? 'Trocar a foto' : 'Colocar foto'}</button>
          {p.data?.tem_avatar && <button type="button" onClick={async () => {
            if (!(await confirmar({ titulo: 'Tirar a foto do perfil?', acao: 'Tirar' }))) return;
            try { atualizar(await api.del<Perfil>('/perfil/avatar')); } catch (e) { toast.error((e as Error).message); }
          }} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-m-danger"><Trash2 size={14} /> tirar foto</button>}
          <input ref={arq} type="file" accept="image/*" className="sr-only" aria-label="Foto do perfil" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) trocarFoto(x); }} />
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Nome de exibição
        <input className={campo} value={f.nome_exibicao} maxLength={80} onChange={(e) => setF({ ...f, nome_exibicao: e.target.value })} placeholder="Como quer ser chamado" /></label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Telefone (opcional)
        <input className={campo} value={f.telefone} inputMode="tel" onChange={(e) => setF({ ...f, telefone: e.target.value })} placeholder="(27) 99999-0000" /></label>
      <div className="flex flex-col gap-0.5 text-[13px] text-m-text-secondary">
        <span>E-mail: <b className="text-m-text-primary">{p.data?.email}</b></span>
        <span>{superadminReal ? 'Super Admin · ' : ''}{obras.map((o) => `${o.codigo}: ${PAPEL_ROTULO[o.papel]}`).join(' · ')}</span>
      </div>
      <button type="button" onClick={async () => { try { atualizar(await api.put<Perfil>('/perfil', f)); toast.success('Perfil salvo'); } catch (e) { toast.error((e as Error).message); } }}
        className="h-12 self-start rounded-full bg-m-accent-strong px-6 text-[15px] font-semibold text-m-on-accent">Salvar perfil</button>
    </div>
  );
}
