'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { Cabecalho, Chip, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

interface Permissao { usuario_id: string; email: string; papel: string; habilitado: boolean; desde: string | null; por: string | null }
interface Registro { id: number; tipo: 'auditoria' | 'foto' | 'permissao'; referencia: string | null; resumo: string; motivo: string | null; por: string; em: string; dados: Record<string, unknown> | null }

const TIPO = { auditoria: ['Auditoria', 'perigo'], foto: ['Foto do book', 'atencao'], permissao: ['Permissão', 'neutro'] } as const;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Exclusões (spec 112): o super admin habilita profissionais da empresa a excluir auditorias feitas e fotos do book;
 * o histórico guarda todo o processo — o que saiu (com a cópia dos dados), quem, quando, por quê e quem habilitou quem.
 */
export default function ExclusoesPage() {
  const api = useApi();
  const { superadmin } = useObra();
  const confirmar = useConfirmar();
  const [tipo, setTipo] = useState<'' | Registro['tipo']>('');
  const [aberto, setAberto] = useState<number | null>(null);
  const perms = useQuery({ queryKey: ['exclusoes-permissoes'], queryFn: () => api.get<Permissao[]>('/exclusoes/permissoes'), enabled: superadmin });
  const hist = useQuery({ queryKey: ['exclusoes-historico', tipo], queryFn: () => api.get<Registro[]>(`/exclusoes/historico${tipo ? `?tipo=${tipo}` : ''}`) });
  const habilitados = perms.data?.filter((p) => p.habilitado).length ?? 0;
  const alternar = async (p: Permissao) => {
    if (!p.habilitado && !(await confirmar({ titulo: `Habilitar ${p.email} a excluir?`, mensagem: 'Poderá excluir auditorias já feitas e fotos do book desta obra (sempre com motivo, que fica no histórico).', acao: 'Habilitar' }))) return;
    try {
      await api.put(`/exclusoes/permissoes/${encodeURIComponent(p.usuario_id)}`, { habilitado: !p.habilitado });
      toast.success(p.habilitado ? `${p.email} não exclui mais` : `${p.email} pode excluir`);
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <Cabecalho eyebrow="Administrar · exclusões" titulo={hist.data ? `${hist.data.filter((x) => x.tipo !== 'permissao').length} exclusão(ões) registradas nesta obra` : 'Exclusões'} />
      {superadmin && (
        <Painel titulo="Quem pode excluir auditorias e fotos do book?" subtitulo={`Além do super admin. ${habilitados} profissional(is) habilitado(s) nesta obra.`}>
          <Tabela cabecalho={['Profissional', 'Perfil na obra', 'Pode excluir', 'Desde', '']} vazio={perms.data && !perms.data.length && 'Ninguém com acesso a esta obra ainda.'}>
            {!perms.data && <LinhasCarregando colunas={5} linhas={3} />}
            {perms.data?.map((p) => (
              <tr key={p.usuario_id}>
                <td className={`${td} text-m-text-primary`}>{p.email}</td>
                <td className={td}>{p.papel}</td>
                <td className={td}>{p.habilitado ? <Pilula tom="perigo">pode excluir</Pilula> : <span className="text-m-text-muted">não</span>}</td>
                <td className={td}>{p.desde ? `${quando(p.desde)} · por ${p.por}` : '—'}</td>
                <td className={`${td} text-right`}><button type="button" onClick={() => alternar(p)}
                  className={`h-9 rounded-full border px-3 text-[13px] font-semibold ${p.habilitado ? 'border-m-stroke text-m-text-secondary' : 'border-m-danger/40 text-m-danger'}`}>{p.habilitado ? 'Desabilitar' : 'Habilitar'}</button></td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      )}
      <Painel titulo="O que foi excluído, por quem e por quê?" subtitulo="Cada linha guarda a cópia do que saiu. Habilitar e desabilitar também ficam aqui."
        acoes={<div className="flex flex-wrap gap-2">{(['', 'auditoria', 'foto', 'permissao'] as const).map((t) => <Chip key={t || 'todos'} ativo={tipo === t} onClick={() => setTipo(t)}>{t ? TIPO[t][0] : 'Tudo'}</Chip>)}</div>}>
        <Tabela cabecalho={['', 'Quando', 'O quê', 'Item', 'Motivo', 'Por']} vazio={hist.data && !hist.data.length && 'Nada excluído ainda.'}>
          {!hist.data && <LinhasCarregando colunas={6} linhas={4} />}
          {hist.data?.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className={td}>{r.dados && <button type="button" aria-label="Ver o que foi excluído" onClick={() => setAberto(aberto === r.id ? null : r.id)} className="text-m-text-muted">{aberto === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{quando(r.em)}</td>
                <td className={td}><Pilula tom={TIPO[r.tipo][1]}>{TIPO[r.tipo][0]}</Pilula></td>
                <td className={`${td} text-m-text-primary`}>{r.resumo}</td>
                <td className={td}>{r.motivo ?? '—'}</td>
                <td className={td}>{r.por}</td>
              </tr>
              {aberto === r.id && r.dados && (
                <tr><td colSpan={6} className="bg-m-surface-active px-4 py-3">
                  <dl className="grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    {Object.entries(r.dados).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                      <div key={k} className="flex gap-2"><dt className="w-40 shrink-0 text-m-text-muted">{k.replace(/_/g, ' ')}</dt>
                        <dd className="min-w-0 break-words text-m-text-primary">{typeof v === 'object' ? (Array.isArray(v) ? `${v.length} item(ns)` : JSON.stringify(v)) : String(v)}</dd></div>
                    ))}
                  </dl>
                </td></tr>
              )}
            </Fragment>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
