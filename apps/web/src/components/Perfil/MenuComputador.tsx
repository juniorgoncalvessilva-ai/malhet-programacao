'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MENU, menuDoPerfil, type GrupoMenu } from '@/components/Malhet/menu';
import { PAPEL_ROTULO } from '@/components/Mobile/BarraCampo';
import { Carregando } from '@/components/Obra/Esqueleto';
import { Botao, Chip, Painel } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useRouter } from '@/i18n/navigation';
import type { PapelObra } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { cn } from '@/lib/utils';

type Perfis = Record<PapelObra, { paginas: string[]; personalizado: boolean; permitidas: string[] }>;
const PAPEIS: PapelObra[] = ['encarregado', 'seguranca', 'planejador', 'admin', 'leitor'];
const SEMPRE = ['/app/vigente'];
const SEMPRE_ADMIN = ['/app/acessos', '/app/menu-celular'];

/**
 * Menu do computador por perfil (spec 090): o admin marca as telas da barra lateral de cada papel e a ordem dos grupos.
 * Só aparecem para marcar as telas que o papel pode usar; o que não estiver marcado não aparece para o perfil.
 */
export function MenuComputador() {
  const api = useApi();
  const router = useRouter();
  const { obra, superadminReal, simular } = useObra();
  const q = useQuery({ queryKey: ['menu-web', obra?.id, 'editor'], queryFn: () => api.get<{ perfis: Perfis }>('/menu-web') });
  const [papel, setPapel] = useState<PapelObra>('encarregado');
  const [grupos, setGrupos] = useState<GrupoMenu[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const perfil = q.data?.perfis[papel];
  useEffect(() => {
    if (!perfil) return;
    setGrupos(menuDoPerfil(MENU, perfil.paginas).map((g) => ({ ...g, itens: g.itens.filter((i) => perfil.permitidas.includes(i.url) && !obra?.telas_desligadas?.includes(i.url)) })).filter((g) => g.itens.length));
    setMarcadas(new Set(perfil.paginas));
  }, [papel, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!q.data || !perfil) return <Carregando />;
  const fixa = (u: string) => SEMPRE.includes(u) || (papel === 'admin' && SEMPRE_ADMIN.includes(u));
  const mover = (i: number, d: -1 | 1) => setGrupos((gs) => { const n = [...gs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const paginas = grupos.flatMap((g) => g.itens.filter((i) => marcadas.has(i.url) || fixa(i.url)).map((i) => i.url));
  const salvar = async () => {
    try { await api.put(`/menu-web/perfis/${papel}`, { paginas }); toast.success(`Menu do computador salvo para ${PAPEL_ROTULO[papel]}`); }
    catch (e) { toast.error((e as Error).message); }
  };
  const padrao = async () => {
    try { await api.del(`/menu-web/perfis/${papel}`); toast.success('Voltou ao padrão do sistema'); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <div className="flex flex-wrap gap-1.5">{PAPEIS.map((p) => <Chip key={p} ativo={papel === p} onClick={() => setPapel(p)}>{PAPEL_ROTULO[p]}{q.data.perfis[p]?.personalizado ? ' •' : ''}</Chip>)}</div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,620px)_1fr]">
        <Painel titulo={`Barra lateral — ${PAPEL_ROTULO[papel]}`} subtitulo={`${paginas.length} tela(s) · ${perfil.personalizado ? 'definida para esta obra' : 'padrão do sistema'}`}>
          <div className="flex flex-col gap-3">
            {grupos.map((g, gi) => (
              <div key={g.etapa} className="rounded-m-md border border-m-stroke-subtle p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.48px]" style={{ color: g.cor }}><span className="h-2 w-2 rounded-[2px]" style={{ background: g.cor }} />{g.etapa}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Subir ${g.etapa}`} disabled={gi === 0} onClick={() => mover(gi, -1)} className="rounded p-1 text-m-text-muted hover:bg-m-surface-hover disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Descer ${g.etapa}`} disabled={gi === grupos.length - 1} onClick={() => mover(gi, 1)} className="rounded p-1 text-m-text-muted hover:bg-m-surface-hover disabled:opacity-30"><ArrowDown size={14} /></button>
                  </span>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {g.itens.map((i) => {
                    const f = fixa(i.url);
                    const on = f || marcadas.has(i.url);
                    const Icone = i.icone;
                    return (
                      <label key={i.url} className={cn('flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px]', on ? 'text-m-text-primary' : 'text-m-text-muted', !f && 'cursor-pointer hover:bg-m-surface-hover')}>
                        <input type="checkbox" checked={on} disabled={f} aria-label={`${i.titulo} no menu de ${PAPEL_ROTULO[papel]}`}
                          onChange={(e) => setMarcadas((m) => { const n = new Set(m); if (e.target.checked) n.add(i.url); else n.delete(i.url); return n; })} />
                        <Icone size={15} /> {i.titulo} {f && <Lock size={12} className="text-m-text-muted" aria-label="sempre no menu" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={salvar}>Salvar para {PAPEL_ROTULO[papel]}</Botao>
            {perfil.personalizado && <Botao variante="secundario" onClick={padrao}>Voltar ao padrão do sistema</Botao>}
            {superadminReal && <Botao variante="secundario" onClick={() => { simular(papel); router.push('/app/vigente'); }}>Ver como {PAPEL_ROTULO[papel]}</Botao>}
          </div>
        </Painel>
        <Painel titulo="Como funciona">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-m-text-secondary">
            <li>Cada perfil vê na barra lateral só as telas marcadas aqui; o que não está marcado não aparece e o endereço direto volta para a Programação vigente.</li>
            <li>Só aparecem para marcar as telas que o papel pode usar (ex.: PTO e Crachá e rosto exigem Planejador; ASOs e LGPD são da Segurança).</li>
            <li>A ordem dos grupos aqui é a ordem na barra lateral do perfil.</li>
            <li>Em Acessos e usuários ainda dá para restringir mais por pessoa. A Programação vigente fica sempre, e o administrador nunca perde Acessos e Menus por perfil.</li>
          </ul>
        </Painel>
      </div>
    </>
  );
}
