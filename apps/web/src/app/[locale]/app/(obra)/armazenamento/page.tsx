'use client';

import { useQuery } from '@tanstack/react-query';
import { Cloud, FolderTree, HardDrive, RefreshCw, Unplug } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { Botao, Cabecalho, Campo, Erro, Indicador, Painel, Pilula, dataBR } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

interface Situacao {
  provedores: { id: 'google' | 'onedrive' | 'dropbox'; nome: string; habilitado: boolean }[];
  conexao: null | { provedor: string; nome: string; conta: string | null; ativo: boolean; situacao: 'ok' | 'erro' | 'reconectar';
    mensagem: string | null; dias_no_disco: number; conectado_em: string | null; indice_em: string | null };
  pasta_da_obra: string;
  pastas: { pasta: string; descricao: string; arquivos: number }[];
  arquivos: { total: number; na_nuvem: number; aguardando: number; com_erro: number; so_no_servidor: number };
  disco: { da_obra: number; total: number; usado: number; livre: number; limite: number };
  erros: { id: number; nome: string; erro: string | null; tentativas: number; proxima: string | null }[];
}

const GB = (b: number) => `${(b / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
const MB = (b: number) => (b < 1024 ** 2 ? `${Math.ceil(b / 1024).toLocaleString('pt-BR')} KB` : b < 1024 ** 3 ? `${(b / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB` : GB(b));
const COR: Record<string, string> = { google: '#1a73e8', onedrive: '#0078d4', dropbox: '#0061fe' };

/** Armazenamento da obra (spec 082): disco do servidor como cache e o acervo no Google Drive, OneDrive ou Dropbox. */
export default function ArmazenamentoPage() {
  const api = useApi();
  const { pode } = useObra();
  const confirmar = useConfirmar();
  const params = useSearchParams();
  const q = useQuery({ queryKey: ['armazenamento'], queryFn: () => api.get<Situacao>('/armazenamento'), enabled: pode('admin'), refetchInterval: 30000 });
  const [dias, setDias] = useState('30');
  useEffect(() => { if (q.data?.conexao) setDias(String(q.data.conexao.dias_no_disco)); }, [q.data?.conexao?.dias_no_disco]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ok = params.get('ok'); const erro = params.get('erro');
    if (ok) toast.success(ok); if (erro) toast.error(erro, { duration: 12000 });
  }, [params]);
  if (!pode('admin')) return <p className="text-sm text-m-text-muted">Só o administrador da obra configura o armazenamento.</p>;
  const d = q.data;
  const conectar = async (prov: string) => {
    try { window.location.href = (await api.post<{ url: string }>(`/armazenamento/conectar/${prov}`)).url; } catch (e) { toast.error((e as Error).message); }
  };
  const c = d?.conexao;
  return (
    <>
      <Cabecalho eyebrow="Administrar · arquivos" cor="var(--m-proc-administrar)" titulo="Armazenamento"
        acoes={c && <Botao variante="secundario" onClick={() => q.refetch()}><RefreshCw size={14} /> Atualizar</Botao>} />
      {q.error && <Erro erro={q.error} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Arquivos da obra" valor={d.arquivos.total} detalhe={`${MB(d.disco.da_obra)} no disco do servidor`} />
            <Indicador rotulo="Na nuvem" valor={d.arquivos.na_nuvem} tom="sucesso" detalhe={c ? c.nome : 'conecte uma nuvem abaixo'} />
            <Indicador rotulo="Aguardando envio" valor={d.arquivos.aguardando} tom={d.arquivos.aguardando ? 'atencao' : undefined} detalhe={c ? 'a fila sobe a cada 30 s' : 'ficam no servidor até conectar'} />
            <Indicador rotulo="Com erro" valor={d.arquivos.com_erro} tom={d.arquivos.com_erro ? 'perigo' : undefined} detalhe={`${d.arquivos.so_no_servidor} sensíveis só no servidor`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Painel titulo="Nuvem da obra" subtitulo="Fotos e documentos sobem para a conta escolhida; o app só mexe na pasta dele">
              {c && (
                <div className="flex flex-col gap-3 rounded-m-lg border border-m-stroke-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[15px] font-semibold"><Cloud size={18} style={{ color: COR[c.provedor] }} /> {c.nome}</span>
                    <Pilula tom={c.situacao === 'ok' ? 'sucesso' : c.situacao === 'erro' ? 'atencao' : 'perigo'}>
                      {c.situacao === 'ok' ? (c.ativo ? 'conectado' : 'pausado') : c.situacao === 'erro' ? 'com falhas' : 'reconectar'}
                    </Pilula>
                  </div>
                  <span className="text-[13px] text-m-text-secondary">{c.conta ?? 'conta não informada'} · desde {dataBR(c.conectado_em)}{c.indice_em ? ` · índice ${dataBR(c.indice_em)}` : ''}</span>
                  {c.mensagem && <span className="rounded-[8px] bg-m-warning-subtle px-3 py-2 text-[12.5px] text-m-warning">{c.mensagem}</span>}
                  <div className="flex flex-wrap items-end gap-2">
                    <Campo rotulo="Dias do original no servidor" type="number" min={0} max={3650} value={dias} onChange={(e) => setDias(e.target.value)} className="w-[200px]" />
                    <Botao variante="secundario" onClick={async () => {
                      try { await api.put('/armazenamento', { ativo: c.ativo, dias_no_disco: Number(dias) }); toast.success('Salvo'); } catch (e) { toast.error((e as Error).message); }
                    }}>Salvar</Botao>
                    <Botao variante="secundario" onClick={async () => {
                      try { await api.put('/armazenamento', { ativo: !c.ativo, dias_no_disco: c.dias_no_disco }); } catch (e) { toast.error((e as Error).message); }
                    }}>{c.ativo ? 'Pausar envio' : 'Retomar envio'}</Botao>
                    {(c.situacao === 'reconectar') && <Botao onClick={() => conectar(c.provedor)}>Reconectar</Botao>}
                    <Botao variante="secundario" onClick={async () => {
                      if (!(await confirmar({ titulo: `Desconectar ${c.nome}?`, mensagem: 'O acervo que já está na nuvem continua lá. Novos arquivos ficam só no servidor até conectar de novo.', acao: 'Desconectar' }))) return;
                      try { await api.del('/armazenamento'); toast.success('Desconectado'); } catch (e) { toast.error((e as Error).message); }
                    }}><Unplug size={14} /> Desconectar</Botao>
                  </div>
                  <span className="text-[12px] text-m-text-muted">Depois desse prazo, o original já enviado sai do servidor (a miniatura fica) e volta da nuvem quando alguém abrir.</span>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                {d.provedores.map((p) => (
                  <button key={p.id} type="button" disabled={!p.habilitado} onClick={() => conectar(p.id)}
                    title={p.habilitado ? `Conectar ${p.nome}` : 'Falta configurar as credenciais do app no servidor (docs/deploy-coolify.md)'}
                    className="flex min-h-[72px] flex-col items-start justify-center gap-1 rounded-m-lg border border-m-stroke-subtle px-3 text-left text-[13.5px] font-semibold hover:bg-m-surface-hover disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="flex items-center gap-1.5"><Cloud size={16} style={{ color: COR[p.id] }} /> {p.nome}</span>
                    <span className="text-[11.5px] font-normal text-m-text-muted">{!p.habilitado ? 'não habilitado no servidor' : c?.provedor === p.id ? 'trocar a conta' : c ? 'trocar para este' : 'conectar'}</span>
                  </button>
                ))}
              </div>
            </Painel>

            <Painel titulo={<span className="flex items-center gap-2"><HardDrive size={17} /> Disco do servidor</span>} subtitulo="Cache rápido: originais recentes e todas as miniaturas">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><span className="text-m-text-muted">Usado (tudo)</span><br /><b className="text-[16px]">{GB(d.disco.usado)}</b> de {GB(d.disco.total)}</div>
                <div><span className="text-m-text-muted">Livre</span><br /><b className="text-[16px]">{GB(d.disco.livre)}</b></div>
                <div><span className="text-m-text-muted">Desta obra</span><br /><b className="text-[16px]">{MB(d.disco.da_obra)}</b></div>
                <div><span className="text-m-text-muted">Limite para originais</span><br /><b className="text-[16px]">{GB(d.disco.limite)}</b></div>
              </div>
              <span className="text-[12px] text-m-text-muted">Rosto, evidências LGPD e coordenadas nunca saem do servidor.</span>
            </Painel>
          </div>

          <Painel titulo={<span className="flex items-center gap-2"><FolderTree size={17} /> Acervo na nuvem</span>}
            subtitulo={<>Pasta da obra: <code className="text-[12px]">{d.pasta_da_obra}</code> · cada arquivo <code className="text-[12px]">AAAAMMDDhhmm-TIPO-descricao.ext</code> tem um <code>.md</code> com o que é e a que se liga</>}>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {d.pastas.map((p) => (
                <li key={p.pasta} className="flex items-center justify-between gap-2 rounded-[10px] border border-m-stroke-subtle px-3 py-2 text-[13px]">
                  <span className="min-w-0"><b className="font-mono text-[12.5px]">{p.pasta}/</b><br /><span className="text-m-text-muted">{p.descricao}</span></span>
                  <span className="text-[15px] font-semibold">{p.arquivos}</span>
                </li>
              ))}
            </ul>
          </Painel>

          {d.erros.length > 0 && (
            <Painel titulo="Arquivos com erro de envio" acoes={<Botao variante="secundario" onClick={async () => {
              try { const r = await api.post<{ arquivos: number }>('/armazenamento/reenviar'); toast.success(`${r.arquivos} arquivo(s) voltam para a fila`); } catch (e) { toast.error((e as Error).message); }
            }}>Tentar agora</Botao>}>
              <ul className="flex flex-col gap-1.5 text-[12.5px]">
                {d.erros.map((x) => <li key={x.id} className="flex flex-col rounded-[8px] border border-m-stroke-subtle px-3 py-2"><b className="font-mono">{x.nome}</b><span className="text-m-text-muted">{x.erro} · {x.tentativas} tentativa(s)</span></li>)}
              </ul>
            </Painel>
          )}
        </>
      )}
    </>
  );
}
