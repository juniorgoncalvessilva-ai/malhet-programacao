'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Botao, Painel, Pilula, Selecao } from '@/components/Obra/ui';
import { k } from '@/hooks/programacao/planejamento';
import { useApi } from '@/hooks/programacao/useApi';
import type { Local } from '@/lib/api/types';

type Previa = { abas: { nome: string; areas: number; empresas: Record<string, number>; inativas: number; locais: string[] }[]; sugerida: string | null; empresas: string[] };

/**
 * Frentes pela planilha de CWAs do empreendimento (spec 128): a planilha traz todas as áreas, mas a contratada só responde por
 * parte delas — a aba dela (ex.: "CWAs Cardan"), filtrada pela coluna Empresa. Essas áreas viram as Frentes e a WBS de execução.
 */
export function ImportarPlanilhaCwa() {
  const api = useApi();
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [aba, setAba] = useState('');
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const atual = previa?.abas.find((a) => a.nome === aba);
  const nAreas = atual ? empresas.reduce((s, e) => s + (atual.empresas[e] ?? 0), 0) : 0;

  const ler = async (f: File) => {
    const fd = new FormData(); fd.append('arquivo', f, f.name);
    try {
      const p = await api.post<Previa>('/frentes/planilha/previa', fd);
      setArquivo(f); setPrevia(p); setAba(p.sugerida ?? p.abas[0]?.nome ?? ''); setEmpresas(p.empresas);
    } catch (e) { toast.error((e as Error).message); }
  };
  const importar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    const fd = new FormData(); fd.append('arquivo', arquivo, arquivo.name); fd.append('aba', aba); fd.append('empresas', empresas.join('|'));
    try {
      const r = await api.post<Local[]>('/frentes/planilha', fd);
      toast.success(`${r.length} locais e ${r.reduce((s, l) => s + l.areas.length, 0)} áreas — já na WBS de execução`);
      setPrevia(null); setArquivo(null);
      qc.invalidateQueries({ queryKey: [...k.frentes] }); qc.invalidateQueries({ queryKey: ['wbs'] });
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  };

  return (
    <Painel titulo="Quais áreas são da contratada?" subtitulo="Envie a lista de CWAs do empreendimento (.xlsx). A aba da contratada, só com as linhas da empresa, vira as Frentes e a WBS de execução; reimportar atualiza sem duplicar.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-m-stroke-strong px-4 text-[13px] font-semibold text-m-accent">
          <FileSpreadsheet size={16} /> {arquivo ? arquivo.name : 'Escolher a lista de CWAs'}
          <input type="file" accept=".xlsx,.xlsm" className="sr-only" aria-label="Lista de CWAs" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) ler(f); }} />
        </label>
        {previa && (
          <Selecao rotulo="Aba" value={aba} onChange={(e) => { setAba(e.target.value); const a = previa.abas.find((x) => x.nome === e.target.value); setEmpresas(a ? Object.keys(a.empresas).slice(0, 1) : []); }}>
            {previa.abas.map((a) => <option key={a.nome} value={a.nome}>{a.nome} ({a.areas} áreas)</option>)}
          </Selecao>
        )}
      </div>
      {atual && (
        <div className="mt-4 flex flex-col gap-3">
          <fieldset className="flex flex-wrap items-center gap-3 text-[13px]">
            <legend className="mb-1 text-[12px] font-semibold text-m-text-secondary">Empresa (coluna Empresa da aba)</legend>
            {Object.entries(atual.empresas).map(([e, n]) => (
              <label key={e} className="flex items-center gap-1.5">
                <input type="checkbox" checked={empresas.includes(e)} aria-label={`Empresa ${e}`}
                  onChange={() => setEmpresas(empresas.includes(e) ? empresas.filter((x) => x !== e) : [...empresas, e])} />
                {e} <span className="text-m-text-muted">({n})</span>
              </label>
            ))}
          </fieldset>
          <p className="text-[12px] text-m-text-muted">
            Locais: {atual.locais.join(' · ')}{atual.inativas ? ` · ${atual.inativas} linha(s) com situação diferente de "Ativa" ficam de fora` : ''}
          </p>
          <div className="flex items-center gap-3">
            <Botao disabled={!nAreas || enviando} onClick={importar}><Upload size={16} /> {enviando ? 'Importando…' : `Importar ${nAreas} áreas`}</Botao>
            {Object.keys(atual.empresas).length > empresas.length && <Pilula tom="neutro">as outras empresas ficam de fora</Pilula>}
          </div>
        </div>
      )}
    </Painel>
  );
}
