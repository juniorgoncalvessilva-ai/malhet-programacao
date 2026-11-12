'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Cabecalho, Campo, Erro, Pilula, Painel, Tabela, UploadForm, td } from '@/components/Obra/ui';
import { useObra } from '@/lib/obra/ObraProvider';
import { useApi } from '@/hooks/programacao/useApi';
import { chaves, useFrentes, useGrupos, useOpers, useUpload } from '@/hooks/programacao/queries';
import { useQueryClient } from '@tanstack/react-query';

export default function CadastrosPage() {
  const { pode } = useObra();
  const frentes = useFrentes();
  const grupos = useGrupos();
  const [grupo, setGrupo] = useState('');
  const opers = useOpers(grupo || undefined);
  const importar = useUpload('/simova/importar/cadastros', [[...chaves.frentes], [...chaves.grupos], ['opers']]);
  const api = useApi();
  const qc = useQueryClient();
  const [nova, setNova] = useState({ codigo: '', descricao: '', unidade_medida: '' });
  const [erro, setErro] = useState<unknown>(null);

  const criarOper = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.post('/cadastros/opers', { ...nova, grupo_codigo: grupo, unidade_medida: nova.unidade_medida || null });
      toast.success('OPER criada — pendente de envio ao Simova');
      setNova({ codigo: '', descricao: '', unidade_medida: '' });
      qc.invalidateQueries({ queryKey: ['opers'] });
    } catch (er) { setErro(er); }
  };

  return (
    <>
      <Cabecalho eyebrow="Cadastros Simova" cor="var(--m-proc-medir)" titulo="Frentes, grupos e OPERs que o Simova reconhece" />
      <div className="flex flex-col gap-4">
        {pode('admin') && <Painel
          titulo="Importar do Simova"
          acoes={<Botao variante="secundario" onClick={async () => {
            const n = await api.download('/simova/exportar/opers-pendentes', 'OPER_pendentes.xlsx');
            toast.success(`${n} OPER(s) pendente(s) exportada(s)`);
          }}>Exportar OPERs novas p/ Simova</Botao>}
        >
          <UploadForm
            campos={[{ nome: 'oper', rotulo: 'OPER.xlsx' }, { nome: 'frente', rotulo: 'FRENTE.xlsx' }]}
            rotulo="Importar"
            pendente={importar.isPending}
            onEnviar={(fd) => importar.mutate(fd, {
              onSuccess: (r) => { toast.success(`Importado: ${JSON.stringify(r.contagem)}`); (r.avisos as string[]).forEach((a) => toast.warning(a)); },
              onError: (e) => toast.error(e.message),
            })}
          />
        </Painel>}

        <div className="grid gap-6 xl:grid-cols-3">
          <Painel titulo={`Grupos (${grupos.data?.length ?? 0})`}>
            <Tabela cabecalho={['Código', 'Descrição', 'UM']}>
              {grupos.data?.map((g) => (
                <tr key={g.id} className={grupo === g.codigo ? 'bg-m-accent-subtle' : ''} onClick={() => setGrupo(g.codigo)} style={{ cursor: 'pointer' }}>
                  <td className={td}>{g.codigo} {g.codigo_duplicado && <Pilula tom="perigo">duplicado</Pilula>}</td>
                  <td className={td}>{g.descricao}</td>
                  <td className={td}>{g.unidade_medida}</td>
                </tr>
              ))}
            </Tabela>
          </Painel>
          <Painel titulo={grupo ? `OPERs do grupo ${grupo}` : 'OPERs (todas)'} className="xl:col-span-2">
            <Tabela cabecalho={['Código', 'Descrição', 'UM', 'Origem']} vazio={!opers.data?.length}>
              {opers.data?.map((o) => (
                <tr key={o.id}>
                  <td className={td}>{o.grupo_codigo}/{o.codigo}</td>
                  <td className={td}>{o.descricao}</td>
                  <td className={td}>{o.unidade_medida}</td>
                  <td className={td}><Pilula tom={o.origem === 'app' ? 'info' : 'neutro'}>{o.origem}</Pilula>{o.pendente_envio_simova && <Pilula tom="atencao">enviar</Pilula>}</td>
                </tr>
              ))}
            </Tabela>
            {grupo && pode('planejador') && (
              <form onSubmit={criarOper} className="mt-4 grid gap-3 border-t border-m-stroke-subtle pt-4 md:grid-cols-4 ">
                <Campo rotulo="Código" required value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} />
                <Campo rotulo="Descrição" required className="md:col-span-2" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
                <Campo rotulo="Unidade (cód.)" value={nova.unidade_medida} onChange={(e) => setNova({ ...nova, unidade_medida: e.target.value })} />
                <div className="md:col-span-4"><Botao type="submit">Nova OPER padrão no grupo {grupo}</Botao></div>
                <div className="md:col-span-4"><Erro erro={erro} /></div>
              </form>
            )}
          </Painel>
        </div>

        <Painel titulo={`Frentes (${frentes.data?.length ?? 0})`}>
          <div className="flex flex-wrap gap-2">
            {frentes.data?.map((f) => <Pilula key={f.codigo}>{f.codigo} · {f.descricao}</Pilula>)}
          </div>
        </Painel>
      </div>
    </>
  );
}
