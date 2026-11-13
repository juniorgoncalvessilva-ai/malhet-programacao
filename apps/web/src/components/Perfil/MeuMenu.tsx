'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MENU_MOBILE, MENU_PADRAO } from '@/components/Mobile/menu';
import { cartaoM } from '@/components/Mobile/ui';
import { EditorMenu } from '@/components/Perfil/EditorMenu';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import { type MenuConfig, type RespostaMenu, useMenuMobileConfig } from '@/lib/perfil';

/** O meu menu de baixo do celular (spec 075): ajuste pessoal por obra, ou volta ao padrão do perfil. */
export function MeuMenu() {
  const api = useApi();
  const qc = useQueryClient();
  const { obra, podeVerMobile, simulando } = useObra();
  const q = useMenuMobileConfig();
  const [m, setM] = useState<MenuConfig | null>(null);
  useEffect(() => { if (q.data) setM({ barra: q.data.meu.barra, destaque: q.data.meu.destaque }); else if (obra && !q.isLoading) setM(MENU_PADRAO[obra.papel]); }, [q.data, q.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const telas = MENU_MOBILE.filter((i) => podeVerMobile(i.url));
  const gravar = (r: RespostaMenu) => qc.setQueryData(['menu-mobile', obra?.id, simulando], r);
  const origem = { pessoal: 'o seu ajuste', perfil: 'o padrão do seu perfil nesta obra', padrao: 'o padrão do sistema para o seu perfil' }[q.data?.meu.origem ?? 'padrao'];
  return (
    <section id="menu" className={cartaoM} aria-label="Meu menu do celular">
      <span className="text-[16px] font-semibold">Meu menu de baixo</span>
      <span className="text-[12.5px] text-m-text-muted">Agora vale {origem}.{simulando ? ' (testando como outro perfil: salvar fica desligado)' : ''}</span>
      {m && <EditorMenu valor={m} onChange={setM} telas={telas} />}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!q.data || q.data.meu.origem !== 'pessoal' || !!simulando} onClick={async () => {
          try { gravar(await api.del<RespostaMenu>('/menu-mobile/meu')); toast.success('Voltou ao padrão do perfil'); } catch (e) { toast.error((e as Error).message); }
        }} className="h-12 rounded-full border border-m-stroke text-[14px] font-semibold disabled:opacity-40">Usar o padrão</button>
        <button type="button" disabled={!m || !!simulando} onClick={async () => {
          if (navigator.onLine === false) { toast.info('Precisa de internet para salvar o menu.'); return; }
          try { gravar(await api.put<RespostaMenu>('/menu-mobile/meu', m)); toast.success('Menu salvo'); } catch (e) { toast.error((e as Error).message); }
        }} className="h-12 rounded-full bg-m-accent-strong text-[14px] font-semibold text-m-on-accent disabled:opacity-40">Salvar meu menu</button>
      </div>
    </section>
  );
}
