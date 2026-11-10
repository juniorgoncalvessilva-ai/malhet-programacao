'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AcessosDaObra, rotuloPapel } from '@/components/Obra/Acessos';
import { Botao, Cabecalho, Campo, Erro, Indicador, Painel, Pilula, Tabela, dataBR, td, tdNum } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { ContaAdmin, ObraAdmin } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const vazio = { codigo: '', nome: '', contrato: '', cliente: '', ativa: true };

export default function AdminObrasPage() {
  const api = useApi();
  const qc = useQueryClient();
  const { superadmin, carregando } = useObra();
  const obras = useQuery({ queryKey: ['admin-obras'], queryFn: () => api.get<ObraAdmin[]>('/admin/obras'), enabled: superadmin });
  const contas = useQuery({ queryKey: ['admin-usuarios'], queryFn: () => api.get<ContaAdmin[]>('/admin/usuarios'), enabled: superadmin });
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState<number | null>(null);
  const [selecionada, setSelecionada] = useState<ObraAdmin | null>(null);

  const salvar = useMutation({
    mutationFn: () => {
      const d = { ...form, contrato: form.contrato || null, cliente: form.cliente || null };
      return editando ? api.put<ObraAdmin>(`/admin/obras/${editando}`, d) : api.post<ObraAdmin>('/admin/obras', d);
    },
    onSuccess: (o) => {
      toast.success(editando ? 'Obra atualizada' : `Obra ${o.codigo} criada. Agora libere os usuários.`);
      if (!editando) setSelecionada({ ...o, usuarios: 0 });
      setForm(vazio); setEditando(null);
      qc.invalidateQueries({ queryKey: ['admin-obras'] });
      qc.invalidateQueries({ queryKey: ['obras-minhas'] });
    },
  });
  const alternar = useMutation({
    mutationFn: (o: ObraAdmin) => api.put(`/admin/obras/${o.id}`, { ...o, ativa: !o.ativa }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-obras'] }); qc.invalidateQueries({ queryKey: ['obras-minhas'] }); },
  });

  if (!carregando && !superadmin) return <p className="text-sm text-m-text-muted">Só o Super Admin acessa esta tela.</p>;
  const lista = obras.data ?? [];
  const ativas = lista.filter((o) => o.ativa).length;

  return (
    <>
      <Cabecalho
        eyebrow="Super Admin · obras e usuários"
        cor="var(--m-proc-administrar)"
        titulo={lista.length ? `${ativas} obra${ativas === 1 ? '' : 's'} ativa${ativas === 1 ? '' : 's'} e ${contas.data?.length ?? 0} conta${contas.data?.length === 1 ? '' : 's'}` : 'Nenhuma obra cadastrada ainda'}
        descricao="Crie a obra e libere quem vai trabalhar nela. Cada obra tem os próprios cadastros do Simova, versões de referência, equipes e programação; ninguém vê dados de obra a que não tem acesso."
      >
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <Indicador rotulo="Obras ativas" valor={ativas} detalhe={`${lista.length - ativas} inativa(s)`} />
          <Indicador rotulo="Contas" valor={contas.data?.length ?? 0} detalhe="no auth-kit" />
          <Indicador rotulo="Sem obra" valor={contas.data?.filter((c) => !c.obras.length && !c.roles.includes('superadmin')).length ?? 0} detalhe="contas sem acesso" tom="atencao" />
          <Indicador rotulo="Com 2FA" valor={contas.data?.filter((c) => c.mfa_enabled).length ?? 0} detalhe="autenticador ativo" />
        </div>
      </Cabecalho>

      <div className="grid gap-4 2xl:grid-cols-[1fr_420px]">
        <Painel titulo="Quais obras existem?" subtitulo="Clique em Acessos para liberar usuários na obra.">
          <Tabela cabecalho={['Código', 'Obra', 'Contrato / cliente', 'Usuários', 'Situação', '']} direita={[3]} vazio={!lista.length && (obras.isLoading ? 'Carregando…' : 'Crie a primeira obra ao lado.')}>
            {lista.map((o) => (
              <tr key={o.id} className={selecionada?.id === o.id ? 'bg-m-accent-subtle/60' : ''}>
                <td className={td}><span className="inline-grid h-7 min-w-7 place-items-center rounded-m-sm bg-m-accent-strong px-1.5 text-[10px] font-bold text-m-on-accent">{o.codigo}</span></td>
                <td className={td}><b className="font-semibold text-m-text-primary">{o.nome}</b><div className="text-xs text-m-text-muted">desde {dataBR(o.criado_em)}</div></td>
                <td className={td}>{[o.contrato, o.cliente].filter(Boolean).join(' · ') || '—'}</td>
                <td className={tdNum}>{o.usuarios}</td>
                <td className={td}><Pilula tom={o.ativa ? 'sucesso' : 'neutro'}>{o.ativa ? 'Ativa' : 'Inativa'}</Pilula></td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <Botao variante="fantasma" className="h-8 px-3" onClick={() => setSelecionada(o)}>Acessos</Botao>
                  <Botao variante="fantasma" className="h-8 px-3" onClick={() => { setEditando(o.id); setForm({ codigo: o.codigo, nome: o.nome, contrato: o.contrato ?? '', cliente: o.cliente ?? '', ativa: o.ativa }); }}>Editar</Botao>
                  <Botao variante="fantasma" className="h-8 px-3" onClick={() => alternar.mutate(o)}>{o.ativa ? 'Desativar' : 'Reativar'}</Botao>
                </td>
              </tr>
            ))}
          </Tabela>
        </Painel>

        <Painel titulo={editando ? 'Editar obra' : 'Nova obra'} subtitulo="O código aparece no selo da obra (até 12 caracteres).">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Campo rotulo="Código" required maxLength={12} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="310" />
              <Campo rotulo="Nome da obra" required minLength={3} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Obras civis · Fase 2" />
            </div>
            <Campo rotulo="Contrato" value={form.contrato} onChange={(e) => setForm({ ...form, contrato: e.target.value })} />
            <Campo rotulo="Cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            <div className="flex gap-2">
              <Botao type="submit" disabled={salvar.isPending}><Plus size={16} /> {editando ? 'Salvar' : 'Criar obra'}</Botao>
              {editando && <Botao type="button" variante="secundario" onClick={() => { setEditando(null); setForm(vazio); }}>Cancelar</Botao>}
            </div>
            <Erro erro={salvar.error} />
          </form>
        </Painel>
      </div>

      {selecionada && <AcessosDaObra key={selecionada.id} obraId={selecionada.id} obraNome={`${selecionada.codigo} · ${selecionada.nome}`} />}

      <Painel titulo="Quem tem conta?" subtitulo="Todas as contas do auth-kit e as obras de cada uma.">
        <Tabela cabecalho={['E-mail', 'Conta', 'Obras', 'Criada em']} vazio={!contas.data?.length && 'Sem contas.'}>
          {contas.data?.map((c) => (
            <tr key={c.id}>
              <td className={td}><b className="font-semibold text-m-text-primary">{c.email}</b></td>
              <td className={td}>
                <div className="flex flex-wrap gap-1.5">
                  {c.roles.includes('superadmin') && <Pilula tom="acento">Super Admin</Pilula>}
                  <Pilula tom={c.verificado ? 'sucesso' : 'atencao'}>{c.verificado ? 'Confirmada' : 'E-mail pendente'}</Pilula>
                  {c.mfa_enabled && <Pilula tom="info">2FA</Pilula>}
                </div>
              </td>
              <td className={td}>
                <div className="flex flex-wrap gap-1.5">
                  {c.obras.length ? c.obras.map((o) => <Pilula key={o.obra} ponto={false}>{o.obra} · {rotuloPapel(o.papel)}</Pilula>) : <span className="text-m-text-muted">—</span>}
                </div>
              </td>
              <td className={td}>{dataBR(c.created_at)}</td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
