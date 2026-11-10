'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileSpreadsheet, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Cabecalho, Erro, Painel, Pilula, Tabela, UploadForm, dataBR, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import type { Versao } from '@/lib/api/types';
import { useObra } from '@/lib/obra/ObraProvider';

type Resultado = { versoes: Record<string, number>; contagem: Record<string, number>; avisos: string[] };

function useImportar(caminho: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fd: FormData) => api.post<Resultado>(caminho, fd),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['versoes-importacao'] });
      qc.invalidateQueries({ queryKey: ['programacao'] });
      toast.success(Object.entries(r.contagem).map(([t, n]) => `${t}: ${n}`).join(' · ') || 'Importado');
      r.avisos.slice(0, 5).forEach((a) => toast.warning(a));
    },
  });
}

const nomeArquivo = (fd: FormData) => {
  const f = fd.get('arquivo');
  return f instanceof File ? f.name.replace(/\.[^.]+$/, '') : '';
};

function Bloco({ titulo, subtitulo, icone: Icone, caminho, accept, extra }: {
  titulo: string; subtitulo: string; icone: typeof Table2; caminho: string; accept: string; extra?: Record<string, string>;
}) {
  const m = useImportar(caminho);
  return (
    <Painel titulo={<span className="inline-flex items-center gap-2"><Icone size={18} className="text-m-accent" />{titulo}</span>} subtitulo={subtitulo}>
      <UploadForm
        campos={[{ nome: 'arquivo', rotulo: 'Arquivo' }]}
        accept={accept}
        rotulo="Importar"
        pendente={m.isPending}
        onEnviar={(fd) => {
          if (!(fd.get('arquivo') instanceof File) || !(fd.get('arquivo') as File).size) { toast.error('Escolha o arquivo.'); return; }
          if (!fd.get('rotulo')) fd.set('rotulo', nomeArquivo(fd));
          Object.entries(extra ?? {}).forEach(([k, v]) => fd.set(k, v));
          m.mutate(fd);
        }}
      >
        <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">
          Rótulo da versão
          <input name="rotulo" placeholder="nome do arquivo" className="h-10 rounded-m-md border border-m-stroke bg-m-surface-field px-3 text-[13px] font-normal normal-case tracking-normal text-m-text-primary outline-none focus:border-m-accent" />
        </label>
      </UploadForm>
      <Erro erro={m.error} />
    </Painel>
  );
}

export default function ImportacoesPage() {
  const api = useApi();
  const { pode } = useObra();
  const versoes = useQuery({ queryKey: ['versoes-importacao'], queryFn: () => api.get<Versao[]>('/referencias/versoes') });
  const admin = pode('admin');

  return (
    <>
      <Cabecalho
        eyebrow="Cadastros · importações"
        cor="var(--m-proc-medir)"
        titulo="De onde vêm os dados da programação"
        descricao="Cronograma direto do Primavera (.xer), quantidades do take-off (PQ CONTRATO + MC FRENTES por TAG) e, se quiser, CPU e índices da planilha auxiliar. Cada importação vira uma nova versão vigente; as anteriores ficam no histórico."
      />
      {admin ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Bloco titulo="Cronograma (P6 .xer)" subtitulo="Atividades, datas e WBS (CWA). A tela de montar filtra as atividades pela área escolhida." icone={CalendarClock} caminho="/importar/xer" accept=".xer" />
          <Bloco titulo="Take-off da obra" subtitulo="Itens da PQ do contrato e quantidade de cada item por TAG da frente." icone={Table2} caminho="/importar/takeoff" accept=".xlsx,.xlsm" />
          <Bloco titulo="Planilha auxiliar (CPU e índices)" subtitulo="Abas RECURSOS e ÍNDICES da Programacao_auxiliar_v5 — usadas para produção esperada e HH." icone={FileSpreadsheet} caminho="/referencias/versoes/carregar" accept=".xlsx,.xlsm" extra={{ tipos: 'CPU,INDICES' }} />
        </div>
      ) : (
        <Painel titulo="Somente o administrador da obra importa arquivos"><p className="text-sm text-m-text-secondary">Peça ao administrador para carregar o .xer ou o take-off atualizado.</p></Painel>
      )}

      <Painel titulo="Quais versões estão valendo?">
        <Tabela cabecalho={['Tipo', 'Rótulo', 'Arquivo', 'Itens', 'Carregada em', 'Situação']} vazio={!versoes.data?.length && (versoes.isLoading ? 'Carregando…' : 'Nada importado ainda.')}>
          {versoes.data?.map((v) => (
            <tr key={v.id} className={v.vigente ? '' : 'opacity-60'}>
              <td className={td}><b className="text-m-text-primary">{v.tipo}</b></td>
              <td className={td}>{v.rotulo}</td>
              <td className={td}>{v.arquivo_origem ?? '—'}</td>
              <td className={td}>{v.qtd_itens}</td>
              <td className={td}>{dataBR(v.carregado_em)}</td>
              <td className={td}><Pilula tom={v.vigente ? 'sucesso' : 'neutro'}>{v.vigente ? 'Vigente' : 'Histórico'}</Pilula></td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}
