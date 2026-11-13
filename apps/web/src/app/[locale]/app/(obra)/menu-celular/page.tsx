'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAPEL_ROTULO } from '@/components/Mobile/BarraCampo';
import { MENU_MOBILE, type ItemMobile } from '@/components/Mobile/menu';
import { Chip, Botao, Cabecalho, Painel } from '@/components/Obra/ui';
import { EditorMenu } from '@/components/Perfil/EditorMenu';
import { useApi } from '@/hooks/programacao/useApi';
import type { PapelObra } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { type MenuConfig, type RespostaMenu, useMenuMobileConfig } from '@/lib/perfil';

const NIVEL: Record<PapelObra, number> = { leitor: 0, seguranca: 0, encarregado: 1, planejador: 2, admin: 3 };
const PAPEIS: PapelObra[] = ['encarregado', 'seguranca', 'planejador', 'admin', 'leitor'];
/** Telas que o perfil vê pelo papel (sem a lista por pessoa de Acessos). */
const doPapel = (i: ItemMobile, p: PapelObra) => !!i.fixo || !i.minimo || NIVEL[p] >= NIVEL[i.minimo] || (!!i.seguranca && p === 'seguranca');

/** Menu do celular por perfil (spec 075): o admin escolhe a barra padrão de cada papel nesta obra; cada pessoa ainda pode ajustar a sua. */
export default function MenuCelularPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { obra, pode, superadminReal, simular } = useObra();
  const q = useMenuMobileConfig();
  const [papel, setPapel] = useState<PapelObra>('encarregado');
  const [m, setM] = useState<MenuConfig | null>(null);
  const perfil = q.data?.perfis[papel];
  useEffect(() => { if (perfil) setM({ barra: perfil.barra, destaque: perfil.destaque }); }, [papel, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const recarregar = () => qc.invalidateQueries({ queryKey: ['menu-mobile', obra?.id] });
  if (!pode('admin')) return <p className="text-sm text-m-text-muted">Só o administrador da obra define o menu por perfil.</p>;
  return (
    <>
      <Cabecalho eyebrow="Administrar · celular" titulo="Menu do celular por perfil" />
      <div className="flex flex-wrap gap-1.5">{PAPEIS.map((p) => <Chip key={p} ativo={papel === p} onClick={() => setPapel(p)}>{PAPEL_ROTULO[p]}{q.data?.perfis[p]?.personalizado ? ' •' : ''}</Chip>)}</div>
      <div className="grid gap-5 lg:grid-cols-[520px_1fr]">
        <Painel titulo={`Barra padrão — ${PAPEL_ROTULO[papel]}`} subtitulo={perfil?.personalizado ? 'definida para esta obra' : 'padrão do sistema'}>
          {m && <EditorMenu valor={m} onChange={setM} telas={MENU_MOBILE.filter((i) => doPapel(i, papel))} />}
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={async () => { try { await api.put<RespostaMenu['perfis']>(`/menu-mobile/perfis/${papel}`, m); recarregar(); toast.success('Menu do perfil salvo'); } catch (e) { toast.error((e as Error).message); } }}>Salvar para {PAPEL_ROTULO[papel]}</Botao>
            {perfil?.personalizado && <Botao variante="secundario" onClick={async () => { try { await api.del(`/menu-mobile/perfis/${papel}`); recarregar(); } catch (e) { toast.error((e as Error).message); } }}>Voltar ao padrão do sistema</Botao>}
            {superadminReal && <Botao variante="secundario" onClick={() => { simular(papel); window.open('/pt-BR/m', '_blank'); }}>Testar no celular como {PAPEL_ROTULO[papel]}</Botao>}
          </div>
        </Painel>
        <Painel titulo="Como funciona">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-m-text-secondary">
            <li>A barra de baixo tem até 4 atalhos e o botão do centro em destaque; o resto fica em “Mais”.</li>
            <li>Vale nesta ordem: o ajuste que a própria pessoa fez em Meu perfil → o padrão do perfil aqui → o padrão do sistema.</li>
            <li>A permissão continua valendo: tela que a pessoa não pode ver (papel ou Acessos › Celular) não aparece.</li>
          </ul>
        </Painel>
      </div>
    </>
  );
}
