'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Botao, Campo, Erro, Painel, Pilula, Selecao } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { type ConfigNomeEquipe, nomeEquipe, problemaDoModelo } from '@/lib/equipes/nome';

/**
 * Spec 107: o padrão de nome das equipes da empresa. "EQUIPE." é o padrão, {n} é o número automático (o maior já usado
 * + 1) e {disciplina} é digitada ao criar a equipe. Só o administrador da obra muda.
 */
export function ConfigNomeEquipe({ config, podeEditar }: { config: ConfigNomeEquipe | undefined; podeEditar: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const [modelo, setModelo] = useState(config?.modelo_nome ?? 'EQUIPE.{n}_{disciplina}');
  const [digitos, setDigitos] = useState(config?.digitos ?? 1);
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (config) { setModelo(config.modelo_nome); setDigitos(config.digitos); } }, [config]);
  const problema = problemaDoModelo(modelo);
  const exemplo = problema ? '—' : nomeEquipe(modelo, config?.proximo_numero ?? 1, config?.disciplinas[0] ?? 'FORMA', digitos);
  const salvar = async () => {
    setSalvando(true); setErro(null);
    try {
      await api.put('/equipes/config', { modelo_nome: modelo.trim(), digitos });
      await qc.invalidateQueries({ queryKey: ['equipes-config'] });
      toast.success('Padrão de nome salvo');
    } catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <Painel titulo="Como as equipes se chamam?" subtitulo="Vale para toda equipe nova: o número é automático e a disciplina é digitada na hora de criar.">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_160px]">
          <Campo rotulo="Padrão do nome" value={modelo} disabled={!podeEditar} onChange={(e) => setModelo(e.target.value)}
            placeholder="EQUIPE.{n}_{disciplina}" aria-describedby="ajuda-modelo" />
          <Selecao rotulo="Número com" value={digitos} disabled={!podeEditar} onChange={(e) => setDigitos(Number(e.target.value))}>
            <option value={1}>1 dígito (7, 10)</option>
            <option value={2}>2 dígitos (07, 10)</option>
            <option value={3}>3 dígitos (007)</option>
          </Selecao>
        </div>
        <p id="ajuda-modelo" className="mt-2 text-[12.5px] text-m-text-tertiary">
          <code className="rounded bg-m-surface-active px-1">{'{n}'}</code> = número automático ·{' '}
          <code className="rounded bg-m-surface-active px-1">{'{disciplina}'}</code> = digitada ao criar (fica em maiúsculas) · o resto fica igual.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-m-md border border-m-stroke-subtle px-3 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Próxima equipe</span>
          <b className="text-[16px] text-m-text-primary">{exemplo}</b>
          {!problema && <span className="text-[12.5px] text-m-text-tertiary">nº {config?.proximo_numero ?? 1} = maior número já usado no padrão + 1</span>}
        </div>
        {problema && <p className="mt-2 text-[13px] text-m-danger">{problema}</p>}
        {podeEditar && (
          <div className="mt-3 flex items-center gap-2">
            <Botao onClick={salvar} disabled={!!problema || salvando}>{salvando ? 'Salvando…' : 'Salvar padrão'}</Botao>
            <Erro erro={erro} />
          </div>
        )}
        {!podeEditar && <p className="mt-3 text-[12.5px] text-m-text-muted">Só o administrador da obra muda o padrão.</p>}
      </Painel>
      {!!config?.fora_do_padrao.length && (
        <Painel titulo={`${config.fora_do_padrao.length} equipe(s) fora do padrão`} subtitulo="Não contam para o número automático. Renomeie no cadastro da equipe se quiser.">
          <div className="flex flex-wrap gap-1.5">{config.fora_do_padrao.map((n) => <Pilula key={n} ponto={false} tom="neutro">{n}</Pilula>)}</div>
        </Painel>
      )}
    </div>
  );
}
