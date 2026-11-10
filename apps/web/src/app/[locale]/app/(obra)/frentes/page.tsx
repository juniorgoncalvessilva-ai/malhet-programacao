'use client';

import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { k, useAcao, useFrentes2 } from '@/hooks/programacao/planejamento';
import type { Area, Local } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

const MODELO = `CODIGO\tDESCRICAO
1\tOBRA GERAL
004.00\tCMD – GERAL
2\tCANTEIRO PRINCIPAL
024.00\tCA-1600AA-01 – Canteiro Central Vale`;

type AreaForm = { id?: number; local_id: string; cwa: string; codigo: string; descricao: string; ativo: boolean };

export default function FrentesPage() {
  const frentes = useFrentes2();
  const { pode } = useObra();
  const inv = [[...k.frentes], ['programacao']];
  const [texto, setTexto] = useState('');
  const [local, setLocal] = useState<{ id?: number; codigo: string; descricao: string; ativo: boolean } | null>(null);
  const [area, setArea] = useState<AreaForm | null>(null);

  const importar = useAcao((a, t: string) => a.post<Local[]>('/frentes/importar', { texto: t }), inv);
  const salvarLocal = useAcao((a, d: NonNullable<typeof local>) =>
    d.id ? a.put(`/frentes/locais/${d.id}`, d) : a.post('/frentes/locais', d), inv);
  const salvarArea = useAcao((a, d: AreaForm) => {
    const corpo = { local_id: Number(d.local_id), cwa: d.cwa, codigo: d.codigo || null, descricao: d.descricao, ativo: d.ativo };
    return d.id ? a.put(`/frentes/areas/${d.id}`, corpo) : a.post('/frentes/areas', corpo);
  }, inv);
  const excluirArea = useAcao((a, id: number) => a.del(`/frentes/areas/${id}`), inv);
  const excluirLocal = useAcao((a, id: number) => a.del(`/frentes/locais/${id}`), inv);

  const lista = frentes.data ?? [];
  const nAreas = lista.reduce((s, l) => s + l.areas.length, 0);
  const editarArea = (a: Area) => setArea({ id: a.id, local_id: String(a.local_id), cwa: a.cwa, codigo: a.codigo, descricao: a.descricao, ativo: a.ativo });

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · frentes"
        cor="var(--m-proc-medir)"
        titulo={lista.length ? `${lista.length} locais e ${nAreas} áreas` : 'Nenhuma frente cadastrada'}
        descricao="Dois níveis, como na programação impressa: Local (1, 2, S2…) → Área (CWA + TAG). CWA repetido ganha sufixo (.1, .2) para o Simova diferenciar. Mudou aqui, muda em todas as programações abertas e na exportação para o Simova."
      />

      {pode('admin') && (
        <Painel titulo="Colar a lista de frentes" subtitulo="Copie do Excel as colunas CODIGO e DESCRICAO e cole aqui. Código sem ponto = Local; com ponto = Área do local acima. Reimportar atualiza sem duplicar.">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={MODELO} rows={7}
            className="w-full rounded-m-md border border-m-stroke bg-m-surface-field p-3 font-mono text-[12px] text-m-text-primary outline-none focus:border-m-accent" />
          <div className="flex items-center gap-3">
            <Botao disabled={!texto.trim() || importar.isPending} onClick={() => importar.mutate(texto, {
              onSuccess: (r) => { toast.success(`${r.length} locais, ${r.reduce((s, l) => s + l.areas.length, 0)} áreas`); setTexto(''); },
            })}><Upload size={16} /> Importar lista</Botao>
            <Erro erro={importar.error} />
          </div>
        </Painel>
      )}

      {(local || area) && (
        <Painel titulo={local ? (local.id ? 'Editar local' : 'Novo local') : area?.id ? 'Editar área' : 'Nova área'}>
          {local && (
            <form className="grid gap-3 md:grid-cols-[140px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); salvarLocal.mutate(local, { onSuccess: () => { toast.success('Local salvo'); setLocal(null); } }); }}>
              <Campo rotulo="Código" required value={local.codigo} onChange={(e) => setLocal({ ...local, codigo: e.target.value })} />
              <Campo rotulo="Descrição" required value={local.descricao} onChange={(e) => setLocal({ ...local, descricao: e.target.value })} />
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setLocal(null)}>Cancelar</Botao></div>
              <div className="md:col-span-3"><Erro erro={salvarLocal.error} /></div>
            </form>
          )}
          {area && (
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_120px_140px_2fr]" onSubmit={(e) => { e.preventDefault(); salvarArea.mutate(area, { onSuccess: () => { toast.success('Área salva'); setArea(null); } }); }}>
              <Selecao rotulo="Local" required value={area.local_id} onChange={(e) => setArea({ ...area, local_id: e.target.value })}>
                <option value="">Escolha…</option>
                {lista.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.descricao}</option>)}
              </Selecao>
              <Campo rotulo="CWA" required placeholder="004.00" value={area.cwa} onChange={(e) => setArea({ ...area, cwa: e.target.value })} />
              <Campo rotulo="Código Simova" placeholder="automático" value={area.codigo} onChange={(e) => setArea({ ...area, codigo: e.target.value })} />
              <Campo rotulo="Descrição (com a TAG)" required placeholder="ED-1800AA-01 – Galpão de Resíduos Classe II – CMD" value={area.descricao} onChange={(e) => setArea({ ...area, descricao: e.target.value })} />
              <label className="flex items-center gap-2 text-[13px] text-m-text-secondary"><input type="checkbox" checked={area.ativo} onChange={(e) => setArea({ ...area, ativo: e.target.checked })} /> Ativa</label>
              <div className="flex items-end gap-2 xl:col-span-3"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setArea(null)}>Cancelar</Botao><Erro erro={salvarArea.error} /></div>
            </form>
          )}
        </Painel>
      )}

      <Painel
        titulo="Quais frentes a obra tem?"
        acoes={pode('planejador') && <>
          <Botao variante="secundario" onClick={() => { setArea(null); setLocal({ codigo: '', descricao: '', ativo: true }); }}><Plus size={16} /> Local</Botao>
          <Botao onClick={() => { setLocal(null); setArea({ local_id: lista[0] ? String(lista[0].id) : '', cwa: '', codigo: '', descricao: '', ativo: true }); }}><Plus size={16} /> Área</Botao>
        </>}
      >
        <Tabela cabecalho={['Código Simova', 'CWA', 'Descrição', 'TAG (take-off)', 'Situação', '']} vazio={!lista.length && (frentes.isLoading ? 'Carregando…' : 'Cole a lista acima ou crie o primeiro local.')}>
          {lista.map((l) => (
            <Fragment key={`l${l.id}`}>
              <tr>
                <td colSpan={6} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-on-accent">
                  {l.codigo} · {l.descricao}
                  {pode('planejador') && <>
                    <button type="button" aria-label={`Editar local ${l.codigo}`} className="ml-3 align-middle opacity-80 hover:opacity-100" onClick={() => { setArea(null); setLocal({ id: l.id, codigo: l.codigo, descricao: l.descricao, ativo: l.ativo }); }}><Pencil size={13} /></button>
                    {!l.areas.length && <button type="button" aria-label={`Excluir local ${l.codigo}`} className="ml-2 align-middle opacity-80 hover:opacity-100" onClick={() => excluirLocal.mutate(l.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={13} /></button>}
                  </>}
                </td>
              </tr>
              {l.areas.map((a) => (
                <tr key={a.id} className={a.ativo ? '' : 'opacity-50'}>
                  <td className={td}><b className="text-m-text-primary">{a.codigo}</b></td>
                  <td className={td}>{a.cwa}</td>
                  <td className={td}>{a.descricao}</td>
                  <td className={td}>{a.tag ?? <span className="text-m-text-muted">—</span>}</td>
                  <td className={td}><Pilula tom={a.ativo ? 'sucesso' : 'neutro'}>{a.ativo ? 'Ativa' : 'Inativa'}</Pilula></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {pode('planejador') && <>
                      <button type="button" aria-label={`Editar área ${a.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => { setLocal(null); editarArea(a); }}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Excluir área ${a.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={() => excluirArea.mutate(a.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>
                    </>}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
