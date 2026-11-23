'use client';

import { Link } from '@/i18n/navigation';
import { Selecao } from '@/components/Obra/ui';
import { usePartes } from '@/lib/partes';

/**
 * Gerência e responsável padronizados (spec 139): a gerência é uma das partes da obra ("CONTRATADA - CARDAN") e o responsável
 * vem da lista daquela parte (Configurar › Partes e responsáveis). Escolher o responsável já preenche a gerência. Valor antigo
 * digitado à mão continua aparecendo (fica como opção), para não perder o histórico.
 */
export function GerenciaResponsavel({ gerencia, responsavel, onChange, compacto = false, soResponsavel = false }: {
  gerencia: string; responsavel: string; onChange: (v: { gerencia: string; responsavel: string }) => void; compacto?: boolean; soResponsavel?: boolean;
}) {
  const q = usePartes();
  const partes = q.data?.partes ?? [];
  const resp = (q.data?.responsaveis ?? []).filter((r) => r.ativo);
  const daGerencia = gerencia ? resp.filter((r) => r.gerencia === gerencia) : resp;
  const antigoG = gerencia && !partes.some((p) => p.gerencia === gerencia);
  const antigoR = responsavel && !resp.some((r) => r.nome === responsavel);
  const escolherResp = (nome: string) => {
    const r = resp.find((x) => x.nome === nome);
    onChange({ responsavel: nome, gerencia: r ? r.gerencia : gerencia });
  };
  const optsResp = (
    <>
      <option value="">{resp.length ? 'Escolha…' : 'cadastre em Partes e responsáveis'}</option>
      {antigoR && <option value={responsavel}>{responsavel} (antigo)</option>}
      {gerencia
        ? daGerencia.map((r) => <option key={r.id} value={r.nome}>{r.nome}{r.funcao ? ` · ${r.funcao}` : ''}</option>)
        : partes.map((p) => {
            const rs = resp.filter((r) => r.papel === p.papel);
            return rs.length ? <optgroup key={p.papel} label={p.gerencia}>{rs.map((r) => <option key={r.id} value={r.nome}>{r.nome}{r.funcao ? ` · ${r.funcao}` : ''}</option>)}</optgroup> : null;
          })}
    </>
  );
  const optsGer = (
    <>
      <option value="">Escolha…</option>
      {antigoG && <option value={gerencia}>{gerencia} (antigo)</option>}
      {partes.map((p) => <option key={p.papel} value={p.gerencia}>{p.gerencia}</option>)}
    </>
  );
  if (compacto) {
    const inp = 'h-8 w-full rounded-[8px] border border-m-stroke bg-m-surface-field px-1.5 text-[12.5px] outline-none focus:border-m-accent';
    return (
      <>
        <select aria-label="Responsável" className={inp} value={responsavel} onChange={(e) => escolherResp(e.target.value)}>{optsResp}</select>
        {!soResponsavel && <select aria-label="Gerência" className={`${inp} mt-1`} value={gerencia} onChange={(e) => onChange({ gerencia: e.target.value, responsavel })}>{optsGer}</select>}
      </>
    );
  }
  return (
    <>
      {!soResponsavel && <Selecao rotulo="Gerência" value={gerencia} onChange={(e) => onChange({ gerencia: e.target.value, responsavel: '' })}>{optsGer}</Selecao>}
      <div className="flex flex-col gap-1">
        <Selecao rotulo="Responsável" value={responsavel} onChange={(e) => escolherResp(e.target.value)}>{optsResp}</Selecao>
        {!q.isLoading && !resp.length && <Link href="/app/partes" className="text-[11px] font-semibold text-m-accent">cadastrar responsáveis</Link>}
      </div>
    </>
  );
}
