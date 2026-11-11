'use client';

import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { k, useAcao, useFrentes2 } from '@/hooks/programacao/planejamento';
import type { Area, Local } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';
import { useConfirmar } from '@/components/Obra/Confirmar';

const MODELO = `CWA\tAtivo\tDESCRICAO CWA\tLocal
1\t-\tOBRA GERAL\tGeral
004.02\tED-1800AA-04\tPrédio administrativo\tNovo CMD
004.09\tED-1800AA-03\tPátio de caçambas\tNovo CMD
011.02\tED-1600AA-02\tGalpão do Armazém de Preparação de Materiais\tNova Oficina`;

type AreaForm = { id?: number; local_id: string; cwa: string; codigo: string; ativo_codigo: string; descricao: string; ativo: boolean };

export default function FrentesPage() {
  const confirmar = useConfirmar();
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
    const corpo = { local_id: Number(d.local_id), cwa: d.cwa, codigo: d.codigo || null, ativo_codigo: d.ativo_codigo || null, descricao: d.descricao, ativo: d.ativo };
    return d.id ? a.put(`/frentes/areas/${d.id}`, corpo) : a.post('/frentes/areas', corpo);
  }, inv);
  const excluirArea = useAcao((a, id: number) => a.del(`/frentes/areas/${id}`), inv);
  const excluirLocal = useAcao((a, id: number) => a.del(`/frentes/locais/${id}`), inv);

  const lista = frentes.data ?? [];
  const nAreas = lista.reduce((s, l) => s + l.areas.length, 0);
  const editarArea = (a: Area) => setArea({ id: a.id, local_id: String(a.local_id), cwa: a.cwa, codigo: a.codigo, ativo_codigo: a.ativo_codigo ?? '', descricao: a.descricao, ativo: a.ativo });

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · frentes"
        cor="var(--m-proc-medir)"
        titulo={lista.length ? `${lista.length} locais e ${nAreas} áreas` : 'Nenhuma frente cadastrada'}
        descricao="Dois níveis, como na lista da obra: Local (Novo CMD, Nova Oficina…) → Área (CWA, Ativo e descrição). O Ativo vira a TAG que casa as quantidades do take-off. CWA repetido ganha sufixo (.1, .2) para o Simova diferenciar. Mudou aqui, muda em todas as programações abertas e na exportação para o Simova."
      />

      {pode('admin') && (
        <Painel titulo="Colar a lista de frentes" subtitulo="Copie do Excel as colunas CWA | Ativo | DESCRICAO CWA | Local (com ou sem o cabeçalho) e cole aqui. Cada linha é uma área; o Local agrupa as áreas e é criado pelo nome (código L1, L2…, editável). Ativo “-” = sem ativo. Reimportar atualiza sem duplicar (casa pelo CWA + Ativo). O formato antigo CODIGO | DESCRICAO continua aceito.">
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
              <Campo rotulo="Código Simova" placeholder="automático (L1, L2…)" value={local.codigo} onChange={(e) => setLocal({ ...local, codigo: e.target.value })} />
              <Campo rotulo="Local (nome)" required placeholder="Nova Oficina" value={local.descricao} onChange={(e) => setLocal({ ...local, descricao: e.target.value })} />
              <div className="flex items-end gap-2"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setLocal(null)}>Cancelar</Botao></div>
              <div className="md:col-span-3"><Erro erro={salvarLocal.error} /></div>
            </form>
          )}
          {area && (
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_110px_150px_150px_2fr]" onSubmit={(e) => { e.preventDefault(); salvarArea.mutate(area, { onSuccess: () => { toast.success('Área salva'); setArea(null); } }); }}>
              <Selecao rotulo="Local" required value={area.local_id} onChange={(e) => setArea({ ...area, local_id: e.target.value })}>
                <option value="">Escolha…</option>
                {lista.map((l) => <option key={l.id} value={l.id}>{l.descricao} ({l.codigo})</option>)}
              </Selecao>
              <Campo rotulo="CWA" required placeholder="004.00" value={area.cwa} onChange={(e) => setArea({ ...area, cwa: e.target.value })} />
              <Campo rotulo="Código Simova" placeholder="automático" value={area.codigo} onChange={(e) => setArea({ ...area, codigo: e.target.value })} />
              <Campo rotulo="Ativo" placeholder="ED-1800AA-01 (ou vazio)" value={area.ativo_codigo} onChange={(e) => setArea({ ...area, ativo_codigo: e.target.value })} />
              <Campo rotulo="Descrição CWA" required placeholder="Galpão de resíduos classe II" value={area.descricao} onChange={(e) => setArea({ ...area, descricao: e.target.value })} />
              <label className="flex items-center gap-2 text-[13px] text-m-text-secondary"><input type="checkbox" checked={area.ativo} onChange={(e) => setArea({ ...area, ativo: e.target.checked })} /> Ativa</label>
              <div className="flex items-end gap-2 xl:col-span-4"><Botao type="submit">Salvar</Botao><Botao type="button" variante="secundario" onClick={() => setArea(null)}>Cancelar</Botao><Erro erro={salvarArea.error} /></div>
            </form>
          )}
        </Painel>
      )}

      <Painel
        titulo="Quais frentes a obra tem?"
        acoes={pode('planejador') && <>
          <Botao variante="secundario" onClick={() => { setArea(null); setLocal({ codigo: '', descricao: '', ativo: true }); }}><Plus size={16} /> Local</Botao>
          <Botao onClick={() => { setLocal(null); setArea({ local_id: lista[0] ? String(lista[0].id) : '', cwa: '', codigo: '', ativo_codigo: '', descricao: '', ativo: true }); }}><Plus size={16} /> Área</Botao>
        </>}
      >
        <Tabela cabecalho={['Código Simova', 'CWA', 'Ativo', 'Descrição CWA', 'TAG (take-off)', 'Situação', '']} vazio={!lista.length && (frentes.isLoading ? 'Carregando…' : 'Cole a lista acima ou crie o primeiro local.')}>
          {lista.map((l) => (
            <Fragment key={`l${l.id}`}>
              <tr>
                <td colSpan={7} className="bg-m-accent-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.4px] text-m-on-accent">
                  {l.descricao} <span className="font-semibold opacity-75">· {l.codigo} · {l.areas.length} área(s)</span>
                  {pode('planejador') && <>
                    <button type="button" aria-label={`Editar local ${l.codigo}`} className="ml-3 align-middle opacity-80 hover:opacity-100" onClick={() => { setArea(null); setLocal({ id: l.id, codigo: l.codigo, descricao: l.descricao, ativo: l.ativo }); }}><Pencil size={13} /></button>
                    {!l.areas.length && <button type="button" aria-label={`Excluir local ${l.codigo}`} className="ml-2 align-middle opacity-80 hover:opacity-100" onClick={async () => (await confirmar({ titulo: `Excluir o local ${l.codigo} · ${l.descricao}?`, mensagem: 'O local está vazio (sem áreas).' })) && excluirLocal.mutate(l.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={13} /></button>}
                  </>}
                </td>
              </tr>
              {l.areas.map((a) => (
                <tr key={a.id} className={a.ativo ? '' : 'opacity-50'}>
                  <td className={td}><b className="text-m-text-primary">{a.codigo}</b></td>
                  <td className={td}>{a.cwa}</td>
                  <td className={`${td} whitespace-nowrap`}>{a.ativo_codigo ?? <span className="text-m-text-muted">—</span>}</td>
                  <td className={td}>{a.descricao}</td>
                  <td className={td}>{a.tag ?? <span className="text-m-text-muted">—</span>}</td>
                  <td className={td}><Pilula tom={a.ativo ? 'sucesso' : 'neutro'}>{a.ativo ? 'Ativa' : 'Inativa'}</Pilula></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {pode('planejador') && <>
                      <button type="button" aria-label={`Editar área ${a.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-accent" onClick={() => { setLocal(null); editarArea(a); }}><Pencil size={15} /></button>
                      <button type="button" aria-label={`Excluir área ${a.codigo}`} className="p-1.5 text-m-text-muted hover:text-m-danger" onClick={async () => (await confirmar({ titulo: `Excluir a área ${a.codigo}?`, mensagem: <>{a.descricao}<br />Área usada em programação não pode ser excluída: inative-a.</> })) && excluirArea.mutate(a.id, { onError: (e) => toast.error(e.message) })}><Trash2 size={15} /></button>
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
