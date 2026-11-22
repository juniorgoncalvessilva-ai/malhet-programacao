'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSearch, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao, CARREGANDO, Chip, Indicador, Painel, Pilula, Tabela, td, tdNum } from '@/components/Obra/ui';
import { Link } from '@/i18n/navigation';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';

type Sit = 'lido' | 'a_ler' | 'sem_quantidade' | 'sem_desenho' | 'sem_arquivo';
type Projeto = {
  documento_id: number; codigo: string; titulo: string; tipo: string; pacote: string | null; revisao_id: number | null; revisao: string | null;
  arquivo: string | null; situacao: Sit; quantidades: number; aceitas: number; obs: string | null; lido_em: string | null;
};
type Resposta = { projetos: Projeto[]; totais: Record<Sit, number> };
const SIT: Record<Sit, { rotulo: string; tom: 'sucesso' | 'atencao' | 'neutro' | 'info' | 'perigo' }> = {
  lido: { rotulo: 'Lido', tom: 'sucesso' }, a_ler: { rotulo: 'A ler', tom: 'info' }, sem_quantidade: { rotulo: 'Sem quantidade', tom: 'atencao' },
  sem_desenho: { rotulo: 'Sem desenho', tom: 'neutro' }, sem_arquivo: { rotulo: 'Sem arquivo', tom: 'neutro' },
};

/**
 * Os projetos da obra no take-off (spec 131): o levantamento parte da existência do projeto — cada documento com a revisão que vale
 * e a situação (lido, a ler, sem quantidade, sem desenho, sem arquivo). Ao abrir, o planejador já dispara a leitura do que falta
 * (em lotes), inclusive dos projetos que chegaram antes do take-off existir; DWG/DXF e PDF com texto são lidos.
 */
export function ProjetosTakeoff() {
  const api = useApi();
  const qc = useQueryClient();
  const { pode } = useObra();
  const planejador = pode('planejador');
  const q = useQuery({ queryKey: ['documentos', 'takeoff', 'projetos'], queryFn: () => api.get<Resposta>('/documentos/takeoff/projetos') });
  const [lendo, setLendo] = useState(false);
  const [filtro, setFiltro] = useState<Sit | ''>('');
  const automatico = useRef(false);
  const t = q.data?.totais;

  const levantar = async (refazer = false) => {
    setLendo(true);
    let lidos = 0, qtd = 0;
    try {
      for (let volta = 0; volta < 40; volta++) {
        const r = await api.post<{ lidos: number; quantidades: number; restantes: number; erros: string[] }>(`/documentos/takeoff/levantar${refazer && volta === 0 ? '?refazer=true' : ''}`);
        lidos += r.lidos; qtd += r.quantidades;
        r.erros.forEach((e) => toast.error(e));
        if (!r.restantes || !r.lidos) break;
      }
      if (lidos) toast.success(`${lidos} projeto(s) lido(s) · ${qtd} quantidades`);
    } catch (e) { toast.error((e as Error).message); } finally {
      setLendo(false);
      qc.invalidateQueries({ queryKey: ['documentos', 'takeoff'] });
    }
  };
  const lerUm = async (p: Projeto) => {
    try { const r = await api.post<{ quantidades: number }>(`/documentos/revisoes/${p.revisao_id}/takeoff`); toast.success(`${p.codigo}: ${r.quantidades} quantidades`); }
    catch (e) { toast.error((e as Error).message); } finally { qc.invalidateQueries({ queryKey: ['documentos', 'takeoff'] }); }
  };
  // a existência do projeto basta: o que ainda não foi lido é lido ao abrir a tela
  useEffect(() => {
    if (planejador && t && t.a_ler > 0 && !automatico.current) { automatico.current = true; void levantar(); }
  }, [planejador, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (q.data?.projetos ?? []).filter((p) => !filtro || p.situacao === filtro);
  return (
    <Painel titulo="Quais projetos já foram lidos?" subtitulo="Todo projeto da obra entra aqui. DWG/DXF e PDF com texto são lidos sozinhos: tabela de ferros, resumo de aço (conferido pela NBR 7480), listas de materiais, anotações com unidade, camadas e blocos."
      acoes={planejador && <div className="flex flex-wrap gap-2">
        <Botao disabled={lendo} onClick={() => levantar()}><FileSearch size={16} /> {lendo ? 'Lendo os projetos…' : `Levantar ${t?.a_ler ? `${t.a_ler} a ler` : 'quantidades'}`}</Botao>
        <Botao variante="secundario" disabled={lendo} onClick={() => levantar(true)}><RefreshCw size={15} /> Ler tudo de novo</Botao>
      </div>}>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Indicador rotulo="Lidos" valor={t?.lido ?? '—'} tom="sucesso" detalhe="com quantidades" />
        <Indicador rotulo="A ler" valor={t?.a_ler ?? '—'} tom={t?.a_ler ? 'info' : undefined} detalhe={lendo ? 'lendo agora…' : 'DWG/DXF ou PDF'} />
        <Indicador rotulo="Sem quantidade" valor={t?.sem_quantidade ?? '—'} tom={t?.sem_quantidade ? 'atencao' : undefined} detalhe="lido, sem quadro" />
        <Indicador rotulo="Sem desenho" valor={t?.sem_desenho ?? '—'} detalhe="imagem ou planilha" />
        <Indicador rotulo="Sem arquivo" valor={t?.sem_arquivo ?? '—'} detalhe="só na LDO" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip ativo={!filtro} onClick={() => setFiltro('')}>Todos</Chip>
        {(Object.keys(SIT) as Sit[]).map((k) => (t?.[k] ? <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{SIT[k].rotulo} ({t[k]})</Chip> : null))}
      </div>
      <Tabela cabecalho={['Projeto', 'Revisão', 'Arquivo', 'Situação', 'Quantidades', '']} direita={[4]}
        vazio={q.isLoading ? CARREGANDO : !lista.length && 'Nenhum projeto ainda: envie os DWG/PDF em Documentos ou importe a LDO.'}>
        {lista.slice(0, 200).map((p) => (
          <tr key={p.documento_id}>
            <td className={td}><Link href={`/app/takeoff?doc=${p.documento_id}`} className="font-semibold text-m-text-primary hover:text-m-accent">{p.codigo}</Link>
              <div className="max-w-[520px] truncate text-[11px] text-m-text-muted">{p.titulo}</div></td>
            <td className={td}>{p.revisao ?? '—'}</td>
            <td className={td}>{p.arquivo ?? '—'}</td>
            <td className={td}><Pilula tom={SIT[p.situacao].tom}>{SIT[p.situacao].rotulo}</Pilula>{p.obs && <div className="mt-1 max-w-[320px] text-[11px] text-m-text-muted">{p.obs}</div>}</td>
            <td className={tdNum}>{p.quantidades || '—'}{p.aceitas > 0 && <div className="text-[11px] text-m-success">{p.aceitas} aceita(s)</div>}</td>
            <td className={`${td} text-right`}>{planejador && p.revisao_id && (p.situacao === 'a_ler' || p.situacao === 'lido' || p.situacao === 'sem_quantidade') &&
              <button type="button" className="font-semibold text-m-accent" onClick={() => lerUm(p)}>{p.situacao === 'a_ler' ? 'Ler' : 'Ler de novo'}</button>}</td>
          </tr>
        ))}
      </Tabela>
      {lista.length > 200 && <p className="mt-2 text-[12px] text-m-text-muted">Mostrando 200 de {lista.length}: use os filtros.</p>}
    </Painel>
  );
}
