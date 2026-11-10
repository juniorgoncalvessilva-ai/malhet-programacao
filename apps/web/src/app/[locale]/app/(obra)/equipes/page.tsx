'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Pilula, Painel, Tabela, UploadForm, fmt, td } from '@/components/Obra/ui';
import { useObra } from '@/lib/obra/ObraProvider';
import { useApi } from '@/hooks/programacao/useApi';
import { chaves, useEquipes, useUpload } from '@/hooks/programacao/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { Equipe } from '@/lib/api/types';

export default function EquipesPage() {
  const { pode } = useObra();
  const equipes = useEquipes();
  const importar = useUpload('/equipes/importar', [[...chaves.equipes]]);
  const api = useApi();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Equipe | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    await api.put(`/equipes/${editando.id}`, editando);
    toast.success('Equipe atualizada');
    setEditando(null);
    qc.invalidateQueries({ queryKey: chaves.equipes });
  };

  return (
    <>
      <Cabecalho eyebrow="Equipes · frentes de trabalho" titulo="Quem trabalha em cada frente e quanto HH a equipe tem por dia" descricao="Cada equipe tem um encarregado (crachá do Simova) e a composição por função. O HH disponível é a soma da mão de obra direta × jornada." />
      <div className="flex flex-col gap-4">
        {pode('admin') && <Painel titulo="Importar aba EQUIPES da planilha auxiliar">
          <UploadForm campos={[{ nome: 'arquivo', rotulo: 'Planilha auxiliar' }]} rotulo="Importar" pendente={importar.isPending}
            onEnviar={(fd) => importar.mutate(fd, { onSuccess: (r) => toast.success(`${r.equipes} equipe(s)`), onError: (er) => toast.error(er.message) })} />
        </Painel>}
        {editando && (
          <Painel titulo={`Editar ${editando.nome}`}>
            <form onSubmit={salvar} className="grid gap-3 md:grid-cols-4">
              <Campo rotulo="Crachá do encarregado (Simova)" value={editando.encarregado_cracha ?? ''} onChange={(e) => setEditando({ ...editando, encarregado_cracha: e.target.value })} />
              <Campo rotulo="Nome do encarregado" value={editando.encarregado_nome ?? ''} onChange={(e) => setEditando({ ...editando, encarregado_nome: e.target.value })} />
              <Campo rotulo="Frente" value={editando.frente_codigo ?? ''} onChange={(e) => setEditando({ ...editando, frente_codigo: e.target.value })} />
              <Campo rotulo="Jornada (h/dia)" type="number" step="0.1" value={editando.jornada_horas} onChange={(e) => setEditando({ ...editando, jornada_horas: Number(e.target.value) })} />
              {editando.composicao.map((c, i) => (
                <Campo key={c.recurso} rotulo={`${c.recurso} (${c.tipo})`} type="number" min="0" step="1" value={c.quantidade}
                  onChange={(e) => { const comp = [...editando.composicao]; comp[i] = { ...c, quantidade: Number(e.target.value) }; setEditando({ ...editando, composicao: comp }); }} />
              ))}
              <div className="flex gap-2 md:col-span-4"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao></div>
            </form>
          </Painel>
        )}
        <Painel titulo={`Equipes (${equipes.data?.length ?? 0})`}>
          <Tabela cabecalho={['Equipe', 'Encarregado', 'Crachá', 'Composição', 'HH/dia (MOD)', '']} vazio={!equipes.data?.length}>
            {equipes.data?.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.nome}<div className="text-xs text-m-text-muted">{e.observacao}</div></td>
                <td className={td}>{e.encarregado_nome ?? '—'}</td>
                <td className={td}>{e.encarregado_cracha ?? <Pilula tom="atencao">informe</Pilula>}</td>
                <td className={td}><div className="flex flex-wrap gap-1">{e.composicao.map((c) => <Pilula key={c.recurso} ponto={false} tom={c.tipo === 'MOD' ? 'acento' : 'neutro'}>{fmt(c.quantidade, 0)} {c.recurso}</Pilula>)}</div></td>
                <td className={td}>{fmt(e.hh_disponivel_dia)}</td>
                <td className={td}>{pode('planejador') && <button className="text-m-accent" onClick={() => setEditando(e)}>Editar</button>}</td>
              </tr>
            ))}
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
