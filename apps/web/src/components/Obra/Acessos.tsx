'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { MENU } from '@/components/Malhet/menu';
import { toast } from 'sonner';
import { Botao, Campo, Erro, Painel, Pilula, Selecao, Tabela, dataBR, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useSessao } from '@/lib/auth/AuthProvider';
import type { Acesso, PapelObra } from '@/lib/api/types';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { MENU_MOBILE } from '@/components/Mobile/menu';

export const PAPEIS: { valor: PapelObra; rotulo: string; descricao: string }[] = [
  { valor: 'admin', rotulo: 'Admin da obra', descricao: 'carrega versões, importa do Simova, envia a FT e dá acesso' },
  { valor: 'planejador', rotulo: 'Planejador', descricao: 'programa, aprova, mantém vínculos e equipes' },
  { valor: 'encarregado', rotulo: 'Encarregado', descricao: 'programa a própria equipe (pelo crachá)' },
  { valor: 'seguranca', rotulo: 'Segurança (SSMA)', descricao: 'consulta e preenche o SSMA da programação (técnico, RAC, PTS, ART, PTO, ATA)' },
  { valor: 'leitor', rotulo: 'Leitor', descricao: 'só consulta' },
];
const TOM: Record<PapelObra, 'acento' | 'info' | 'atencao' | 'neutro'> = { admin: 'acento', planejador: 'info', encarregado: 'atencao', seguranca: 'info', leitor: 'neutro' };
export const rotuloPapel = (p: PapelObra) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? p;

const vazio = { email: '', papel: 'planejador' as PapelObra, cracha: '', senha_inicial: '' };

/** Quem acessa uma obra e com qual papel. Usado pelo admin da obra e pelo Super Admin. */
export function AcessosDaObra({ obraId, obraNome }: { obraId: number; obraNome: string }) {
  const confirmar = useConfirmar();
  const api = useApi();
  const qc = useQueryClient();
  const { usuario } = useSessao();
  const chave = ['acessos', obraId];
  const acessos = useQuery({ queryKey: chave, queryFn: () => api.get<Acesso[]>(`/obras/${obraId}/acessos`) });
  const [form, setForm] = useState(vazio);
  const conceder = useMutation({
    mutationFn: () => api.post<{ conta_criada: boolean; senha_redefinida: boolean }>(`/obras/${obraId}/acessos`, {
      email: form.email, papel: form.papel, cracha: form.cracha || null, senha_inicial: form.senha_inicial || null,
    }),
    onSuccess: (r) => {
      toast.success(r.conta_criada ? `Conta criada e acesso liberado para ${form.email}`
        : r.senha_redefinida ? `Acesso de ${form.email} atualizado e senha redefinida: entra com a senha que você digitou`
          : `Acesso de ${form.email} atualizado — a conta já existia: entra com a senha que já tinha`, { duration: 8000 });
      setForm(vazio);
      qc.invalidateQueries({ queryKey: chave });
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
      qc.invalidateQueries({ queryKey: ['admin-obras'] });
    },
  });
  const revogar = useMutation({
    mutationFn: (id: number) => api.del(`/obras/${obraId}/acessos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: ['admin-obras'] }); },
    onError: (e) => toast.error(e.message),
  });
  const lista = acessos.data ?? [];
  const [paginas, setPaginas] = useState<{ id: number; sel: Set<string>; mob: Set<string> } | null>(null);
  const salvarPaginas = useMutation({
    mutationFn: (d: { id: number; paginas: string[] | null; paginas_mobile: string[] | null }) =>
      api.put(`/obras/${obraId}/acessos/${d.id}/paginas`, { paginas: d.paginas, paginas_mobile: d.paginas_mobile ?? [] }),
    onSuccess: () => { toast.success('Páginas salvas'); setPaginas(null); qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: ['obras-minhas'] }); },
    onError: (e) => toast.error(e.message),
  });
  const grupos = MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.superadmin && i.url !== '/app/vigente') })).filter((g) => g.itens.length);

  return (
    <Painel titulo={`Quem acessa ${obraNome}?`} subtitulo={`${lista.length} pessoa${lista.length === 1 ? '' : 's'} com acesso. O papel vale só para esta obra.`}>
      <Tabela cabecalho={['E-mail', 'Papel', 'Crachá Simova', 'Páginas', 'Desde', '']} vazio={!lista.length && (acessos.isLoading ? 'Carregando…' : 'Ninguém com acesso ainda.')}>
        {lista.map((a) => (
          <Fragment key={a.id}>
          <tr>
            <td className={td}><b className="font-semibold text-m-text-primary">{a.email}</b></td>
            <td className={td}><Pilula tom={TOM[a.papel]}>{rotuloPapel(a.papel)}</Pilula></td>
            <td className={td}>{a.cracha ?? '—'}</td>
            <td className={td}>
              <button type="button" className="text-left font-semibold text-m-accent underline" onClick={() => setPaginas(paginas?.id === a.id ? null : { id: a.id, sel: new Set(a.paginas ?? []), mob: new Set(a.paginas_mobile ?? []) })}>
                Web: {a.paginas?.length ? `${a.paginas.length} página(s)` : 'todas'}
              </button>
              <span className="block text-[12px] text-m-text-muted">Celular: {a.paginas_mobile?.length ? `${a.paginas_mobile.length} tela(s)` : 'todas (pelo papel)'}</span>
            </td>
            <td className={td}>{dataBR(a.concedido_em)}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              <Botao variante="fantasma" className="h-8 px-3" onClick={() => setForm({ email: a.email, papel: a.papel, cracha: a.cracha ?? '', senha_inicial: '' })}>Alterar</Botao>
              {a.usuario_id !== usuario?.id && (
                <Botao variante="fantasma" className="h-8 px-3 text-m-danger hover:bg-m-danger-subtle" onClick={async () => (await confirmar({ titulo: `Remover o acesso de ${a.email} a ${obraNome}?`, mensagem: 'A pessoa deixa de ver esta obra. A conta continua existindo.', acao: 'Remover acesso' })) && revogar.mutate(a.id)}>Remover</Botao>
              )}
            </td>
          </tr>
          {paginas?.id === a.id && (
            <tr>
              <td colSpan={6} className="border-b border-m-row bg-m-surface-active px-3 py-3">
                <p className="mb-2 text-[12.5px] text-m-text-secondary">Páginas que <b className="text-m-text-primary">{a.email}</b> vê nesta obra. A <b>Programação vigente</b> fica sempre aberta; nenhuma marcada = todas as que o papel permite.</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {grupos.map((g) => (
                    <div key={g.etapa} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.4px]" style={{ color: g.cor }}>{g.etapa}</span>
                      {g.itens.map((i) => (
                        <label key={i.url} className="flex items-center gap-2 text-[13px] text-m-text-primary">
                          <input type="checkbox" checked={paginas.sel.has(i.url)} onChange={() => setPaginas((p) => { if (!p) return p; const n = new Set(p.sel); if (n.has(i.url)) n.delete(i.url); else n.add(i.url); return { ...p, sel: n }; })} />
                          {i.titulo}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-m-stroke-subtle pt-3">
                  <p className="mb-2 text-[12.5px] text-m-text-secondary"><b className="text-m-text-primary">Celular (app de campo)</b>: telas e itens do menu que aparecem no celular. <b>Início</b> e <b>Programação</b> ficam sempre; nenhuma marcada = todas as que o papel permite.</p>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-4">
                    {MENU_MOBILE.filter((i) => !i.fixo).map((i) => (
                      <label key={i.url} className="flex items-start gap-2 text-[13px] text-m-text-primary">
                        <input type="checkbox" className="mt-0.5" checked={paginas.mob.has(i.url)} onChange={() => setPaginas((p) => { if (!p) return p; const n = new Set(p.mob); if (n.has(i.url)) n.delete(i.url); else n.add(i.url); return { ...p, mob: n }; })} />
                        <span><i.icone size={14} className="mr-1 inline text-m-accent" aria-hidden="true" />{i.titulo}{i.barra ? '' : ' (atalho do Início)'}<span className="block text-[11.5px] text-m-text-muted">{i.descricao}{i.minimo ? ` · papel ${i.minimo}+${i.seguranca ? ' ou segurança' : ''}` : ''}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao disabled={salvarPaginas.isPending} onClick={() => salvarPaginas.mutate({ id: a.id, paginas: paginas.sel.size ? [...paginas.sel] : null, paginas_mobile: paginas.mob.size ? [...paginas.mob] : null })}>Salvar páginas e telas</Botao>
                  <Botao variante="secundario" onClick={() => setPaginas({ ...paginas, sel: new Set(), mob: new Set() })}>Liberar todas (pelo papel)</Botao>
                  <Botao variante="secundario" onClick={() => setPaginas({ ...paginas, sel: new Set(['/app/vigente']), mob: new Set(['/m/vigente']) })}>Só a programação vigente</Botao>
                  <Botao variante="fantasma" onClick={() => setPaginas(null)}>Cancelar</Botao>
                </div>
              </td>
            </tr>
          )}
          </Fragment>
        ))}
      </Tabela>

      <form
        className="grid gap-3 border-t border-m-stroke-subtle pt-4 md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(e) => { e.preventDefault(); conceder.mutate(); }}
      >
        <Campo rotulo="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Selecao rotulo="Papel na obra" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as PapelObra })}>
          {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo} · {p.descricao}</option>)}
        </Selecao>
        <Campo rotulo={form.papel === 'encarregado' ? 'Crachá Simova (obrigatório)' : 'Crachá Simova'} value={form.cracha}
          required={form.papel === 'encarregado'} onChange={(e) => setForm({ ...form, cracha: e.target.value })} />
        <Campo rotulo="Senha (conta nova ou redefinir)" type="password" autoComplete="new-password" placeholder="10+ caracteres, letra e número"
          value={form.senha_inicial} onChange={(e) => setForm({ ...form, senha_inicial: e.target.value })} />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-4">
          <Botao type="submit" disabled={conceder.isPending}><UserPlus size={16} /> Liberar acesso</Botao>
          <span className="text-xs text-m-text-muted">E-mail sem conta: a conta é criada já confirmada com esta senha. Conta que já existe: com a senha preenchida, ela passa a valer (redefine e libera o e-mail não confirmado); em branco, a pessoa entra com a senha que já tinha. Passe a senha por um canal seguro.</span>
        </div>
        <div className="md:col-span-2 xl:col-span-4"><Erro erro={conceder.error} /></div>
      </form>
    </Painel>
  );
}
