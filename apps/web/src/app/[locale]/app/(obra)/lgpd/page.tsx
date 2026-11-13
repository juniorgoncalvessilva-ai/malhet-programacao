'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ImageIcon, MapPin, Printer, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Abas } from '@/components/Obra/Abas';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LogosObra } from '@/components/Obra/LogosObra';
import { Botao, Cabecalho, Campo, Indicador, Painel, Pilula, Selecao, Tabela, td } from '@/components/Obra/ui';
import { useApi } from '@/hooks/programacao/useApi';
import { useSessao } from '@/lib/auth/AuthProvider';
import { type Evidencia, SITUACAO, type Termo, coord, mapa, useColaboradoresLgpd, useEvidencias, useTermosLgpd } from '@/lib/lgpd';
import { useObra } from '@/lib/obra/ObraProvider';

const menos = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const dh = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const MEIO: Record<string, string> = { facial: 'Reconhecimento facial', nfc: 'Crachá NFC', qr: 'Crachá QR', codigo: 'Crachá (código)', desenho: 'Assinatura na tela', manual: 'Manual' };
const ORIGEM: Record<Evidencia['origem'], string> = { etilometro_teste: 'Etilômetro — colaborador', etilometro_inicio: 'Etilômetro — início', etilometro_fim: 'Etilômetro — encerramento', lgpd_aceite: 'Termo LGPD' };

/** LGPD e assinaturas (spec 074): consentimento de cada colaborador, relatório de assinaturas para auditoria, termo e acessos. */
export default function LgpdPage() {
  const [aba, setAba] = useState<'colaboradores' | 'relatorio' | 'termo' | 'acessos'>('relatorio');
  return (
    <>
      <Cabecalho eyebrow="Efetivo · proteção de dados" titulo="LGPD e assinaturas" />
      <Abas rotulo="LGPD" ativa={aba} onTrocar={setAba} abas={[
        { chave: 'relatorio', titulo: 'Relatório de assinaturas' }, { chave: 'colaboradores', titulo: 'Consentimento por colaborador' },
        { chave: 'termo', titulo: 'Termo' }, { chave: 'acessos', titulo: 'Registro de acessos' }]} />
      {aba === 'relatorio' && <Relatorio />}
      {aba === 'colaboradores' && <Colaboradores />}
      {aba === 'termo' && <TermoAba />}
      {aba === 'acessos' && <Acessos />}
    </>
  );
}

function Foto({ id, carregar }: { id: number; carregar: boolean }) {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const [pedir, setPedir] = useState(carregar);
  useEffect(() => { if (carregar) setPedir(true); }, [carregar]);
  useEffect(() => {
    if (!pedir || url) return;
    let u: string | null = null;
    api.blob(`/lgpd/evidencias/${id}/foto`).then((b) => { u = URL.createObjectURL(b); setUrl(u); }).catch((e) => toast.error((e as Error).message));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [pedir]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="Foto do reconhecimento facial no momento da assinatura" className="h-20 w-20 rounded-[8px] border border-m-stroke-subtle object-cover print:h-24 print:w-24" />;
  return <button type="button" onClick={() => setPedir(true)} className="flex items-center gap-1 text-[12.5px] font-semibold text-m-accent print:hidden"><ImageIcon size={14} /> ver foto</button>;
}

function Relatorio() {
  const api = useApi();
  const { obra } = useObra();
  const { usuario } = useSessao();
  const [de, setDe] = useState(menos(30));
  const [ate, setAte] = useState(menos(0));
  const [origem, setOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const [fotos, setFotos] = useState(false);
  const q = useEvidencias(`?de=${de}&ate=${ate}${origem ? `&origem=${origem}` : ''}`);
  const t = busca.trim().toLowerCase();
  const lista = (q.data ?? []).filter((e) => !t || e.nome.toLowerCase().includes(t) || (e.matricula ?? '').includes(t) || (e.documento ?? '').toLowerCase().includes(t));
  const imprimir = async () => {
    try { await api.post('/lgpd/evidencias/relatorio', { filtro: `${de}..${ate}` }); } catch { /* registra quando der */ }
    setFotos(true);
    setTimeout(() => window.print(), 1500); // tempo das fotos carregarem
  };
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Selecao rotulo="Documento" value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todos</option>
          <option value="etilometro_teste,etilometro_inicio,etilometro_fim">Etilômetro</option>
          <option value="lgpd_aceite">Termo LGPD</option>
        </Selecao>
        <Campo rotulo="Colaborador ou documento" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou matrícula" />
        <label className="flex h-10 items-center gap-2 text-[13px]"><input type="checkbox" checked={fotos} onChange={(e) => setFotos(e.target.checked)} /> Mostrar as fotos</label>
        <Botao variante="secundario" onClick={imprimir}><Printer size={16} /> Imprimir / PDF</Botao>
      </div>
      <p className="text-[12px] text-m-text-muted print:hidden">Cada foto aberta e cada impressão ficam no Registro de acessos (art. 37 da LGPD). Íntegra = o hash SHA-256 conferido agora bate com o gravado na chegada.</p>
      <div className="hidden print:flex print:items-center print:justify-between print:border-b print:pb-2">
        <LogosObra altura={44} />
        <div className="text-right text-[11px]"><b className="block text-[15px]">Relatório de assinaturas</b>{obra?.codigo} · {obra?.nome}<br />
          Período {de.split('-').reverse().join('/')} a {ate.split('-').reverse().join('/')} · gerado em {dh(new Date().toISOString())} por {usuario?.email}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
        <Indicador rotulo="Assinaturas" valor={lista.length} />
        <Indicador rotulo="Por reconhecimento facial" valor={lista.filter((e) => e.meio === 'facial').length} />
        <Indicador rotulo="Com foto" valor={lista.filter((e) => e.tem_foto).length} />
        <Indicador rotulo="Íntegras" valor={`${lista.filter((e) => e.integra).length} de ${lista.length}`} tom={lista.some((e) => e.integra === false) ? 'perigo' : 'sucesso'} />
      </div>
      <Painel titulo="Assinaturas" className="print:border-0 print:p-0">
        <Tabela cabecalho={['Data e hora', 'Colaborador', 'Documento', 'Como assinou', 'Localização', 'Foto / assinatura', 'Integridade']}
          vazio={!lista.length && (q.isLoading ? 'Carregando…' : 'Nenhuma assinatura no período.')}>
          {lista.map((e) => {
            const c = coord(e.latitude, e.longitude);
            return (
              <tr key={e.id} className="break-inside-avoid">
                <td className={td}>{dh(e.hora)}<span className="block text-[11px] text-m-text-muted">recebido {dh(e.recebido_em)}</span></td>
                <td className={td}><b className="text-m-text-primary">{e.nome}</b>{e.matricula ? <span className="block text-[12px] text-m-text-muted">{e.matricula}</span> : null}</td>
                <td className={td}>{e.documento ?? ORIGEM[e.origem]}<span className="block text-[11px] text-m-text-muted">{ORIGEM[e.origem]}</span></td>
                <td className={td}>{MEIO[e.meio] ?? e.meio}{e.distancia != null ? <span className="block text-[11px] text-m-text-muted">distância facial {e.distancia.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} (limite 0,5)</span> : null}
                  {e.dispositivo ? <span className="block max-w-[200px] truncate text-[11px] text-m-text-muted" title={e.dispositivo}>{e.dispositivo}</span> : null}</td>
                <td className={td}>{c ? <a href={mapa(e.latitude!, e.longitude!)} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-m-accent underline"><MapPin size={13} className="mt-0.5 shrink-0" />{c}</a> : <span className="text-m-text-muted">sem coordenadas</span>}
                  {e.precisao != null ? <span className="block text-[11px] text-m-text-muted">precisão ± {Math.round(e.precisao)} m</span> : null}</td>
                <td className={td}>
                  {e.tem_foto ? <Foto id={e.id} carregar={fotos} /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.desenho ? <img src={e.desenho} alt="Assinatura desenhada" className="h-10 w-auto rounded border border-m-stroke-subtle bg-white" /> : null}
                  {!e.tem_foto && !e.desenho ? <span className="text-[12px] text-m-text-muted">—</span> : null}
                  {e.observacao ? <span className="block max-w-[200px] text-[11px] text-m-warning">{e.observacao}</span> : null}
                </td>
                <td className={td}>{e.integra ? <span className="inline-flex items-center gap-1 text-m-success"><CheckCircle2 size={14} /> íntegra</span> : <span className="inline-flex items-center gap-1 text-m-danger"><ShieldAlert size={14} /> alterada</span>}
                  <span className="block font-mono text-[10px] text-m-text-muted" title={e.hash}>{e.hash.slice(0, 16)}…</span></td>
              </tr>
            );
          })}
        </Tabela>
      </Painel>
    </>
  );
}

function Colaboradores() {
  const api = useApi();
  const confirmar = useConfirmar();
  const q = useColaboradoresLgpd();
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const lista = (q.data ?? []).filter((c) => (!filtro || c.consentimento.situacao === filtro) && (!busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.matricula ?? '').includes(busca)));
  const conta = useMemo(() => { const m: Record<string, number> = {}; for (const c of q.data ?? []) m[c.consentimento.situacao] = (m[c.consentimento.situacao] ?? 0) + 1; return m; }, [q.data]);
  const sim = (v: boolean) => (v ? <span className="font-semibold text-m-success">sim</span> : <span className="text-m-text-muted">não</span>);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(['aceito', 'recusado', 'pendente', 'desatualizado', 'revogado'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFiltro(filtro === s ? '' : s)} className={`text-left ${filtro === s ? 'ring-2 ring-m-accent' : ''} rounded-m-carimbo`}>
            <Indicador rotulo={SITUACAO[s].rotulo} valor={conta[s] ?? 0} tom={SITUACAO[s].tom === 'neutro' ? undefined : SITUACAO[s].tom} />
          </button>
        ))}
      </div>
      <Painel titulo="Consentimento por colaborador" subtitulo="o aceite é colhido no celular (menu Termo LGPD) ou na hora do etilômetro"
        acoes={<Campo rotulo="" aria-label="Buscar" placeholder="Nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />}>
        <Tabela cabecalho={['Colaborador', 'Situação', 'Rosto', 'Foto', 'Localização', 'Último registro', '']} vazio={!lista.length && (q.isLoading ? 'Carregando…' : 'Ninguém com esse filtro.')}>
          {lista.map((c) => (
            <tr key={c.id}>
              <td className={td}><b className="text-m-text-primary">{c.nome}</b><span className="block text-[12px] text-m-text-muted">{[c.matricula, c.funcao].filter(Boolean).join(' · ')}</span></td>
              <td className={td}><Pilula tom={SITUACAO[c.consentimento.situacao].tom}>{SITUACAO[c.consentimento.situacao].rotulo}</Pilula></td>
              <td className={td}>{sim(c.consentimento.biometria)}</td>
              <td className={td}>{sim(c.consentimento.foto_assinatura)}</td>
              <td className={td}>{sim(c.consentimento.localizacao)}</td>
              <td className={td}>{c.ultimo ? <>{dh(c.ultimo.hora)} · termo v{c.ultimo.versao}<span className="block text-[11px] text-m-text-muted">colhido por {c.ultimo.coletado_por ?? '—'}{c.ultimo.revogado_em ? ` · revogado ${dh(c.ultimo.revogado_em)} (${c.ultimo.motivo_revogacao})` : ''}</span></> : '—'}</td>
              <td className={`${td} text-right`}>
                {c.ultimo && !c.ultimo.revogado_em && c.consentimento.situacao !== 'recusado' && (
                  <button type="button" className="text-[13px] font-semibold text-m-danger" onClick={async () => {
                    if (!(await confirmar({ titulo: `Revogar o consentimento de ${c.nome}?`, mensagem: 'Vale daqui para frente: o rosto cadastrado é apagado e não se guarda mais foto nem localização. As assinaturas já feitas continuam como prova.', acao: 'Revogar' }))) return;
                    try { const r = await api.post<{ rosto_apagado: boolean }>(`/lgpd/aceites/${c.ultimo!.id}/revogar`, { motivo: 'a pedido do colaborador' }); toast.success(r.rosto_apagado ? 'Revogado e rosto apagado' : 'Revogado'); } catch (e) { toast.error((e as Error).message); }
                  }}>Revogar</button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

function TermoAba() {
  const api = useApi();
  const { pode } = useObra();
  const q = useTermosLgpd();
  const vig = (q.data ?? []).find((t) => t.vigente);
  const [f, setF] = useState<Pick<Termo, 'titulo' | 'texto' | 'finalidades'> | null>(null);
  useEffect(() => { if (vig) setF({ titulo: vig.titulo, texto: vig.texto, finalidades: vig.finalidades }); }, [vig?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const edita = pode('admin');
  return (
    <>
      {f && vig && (
        <Painel titulo={`Termo vigente — versão ${vig.versao}`} subtitulo={`hash ${vig.hash.slice(0, 20)}… · ${vig.criado_por}`}
          acoes={edita ? <Botao onClick={async () => { try { await api.post('/lgpd/termos', f); toast.success('Nova versão publicada — os aparelhos recebem ao atualizar o efetivo'); } catch (e) { toast.error((e as Error).message); } }}>Publicar nova versão</Botao> : undefined}>
          <div className="flex flex-col gap-3">
            <Campo rotulo="Título" value={f.titulo} disabled={!edita} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-m-text-secondary">Texto (linguagem simples: finalidades, quem acessa, prazo, direitos e contato)
              <textarea value={f.texto} disabled={!edita} onChange={(e) => setF({ ...f, texto: e.target.value })} rows={16}
                className="rounded-m-md border border-m-stroke bg-m-surface-field p-3 font-[inherit] text-[13.5px] leading-[20px]" /></label>
            {f.finalidades.map((x, i) => (
              <div key={x.chave} className="grid gap-2 md:grid-cols-[220px_1fr]">
                <Campo rotulo={`Finalidade: ${x.chave}`} value={x.rotulo} disabled={!edita} onChange={(e) => setF({ ...f, finalidades: f.finalidades.map((y, j) => (j === i ? { ...y, rotulo: e.target.value } : y)) })} />
                <Campo rotulo="Explicação mostrada ao colaborador" value={x.descricao} disabled={!edita} onChange={(e) => setF({ ...f, finalidades: f.finalidades.map((y, j) => (j === i ? { ...y, descricao: e.target.value } : y)) })} />
              </div>
            ))}
            <p className="text-[12px] text-m-text-muted">Publicar cria uma nova versão; quem aceitou a anterior aparece como “termo novo a apresentar”. Recomenda-se revisar com o jurídico/DPO e manter o relatório de impacto (RIPD) do uso de biometria.</p>
          </div>
        </Painel>
      )}
      <Painel titulo="Versões">
        <Tabela cabecalho={['Versão', 'Título', 'Publicado', 'Por', 'Hash']}>
          {(q.data ?? []).map((t) => (
            <tr key={t.id}><td className={td}>{t.versao}{t.vigente ? ' (vigente)' : ''}</td><td className={td}>{t.titulo}</td><td className={td}>{dh(t.criado_em)}</td><td className={td}>{t.criado_por}</td><td className={`${td} font-mono text-[11px]`}>{t.hash.slice(0, 24)}…</td></tr>
          ))}
        </Tabela>
      </Painel>
    </>
  );
}

function Acessos() {
  const api = useApi();
  const q = useQuery({ queryKey: ['lgpd', 'acessos'], queryFn: () => api.get<{ id: number; acao: string; email: string | null; em: string; colaborador: string | null; documento: string | null }[]>('/lgpd/acessos') });
  return (
    <Painel titulo="Registro de acessos" subtitulo="quem abriu fotos de assinatura ou gerou o relatório">
      <Tabela cabecalho={['Quando', 'Quem', 'O quê']} vazio={!(q.data ?? []).length && 'Nenhum acesso registrado.'}>
        {(q.data ?? []).map((a) => (
          <tr key={a.id}><td className={td}>{dh(a.em)}</td><td className={td}>{a.email}</td>
            <td className={td}>{a.acao === 'ver_foto' ? `Abriu a foto da assinatura de ${a.colaborador ?? '—'} (${a.documento ?? ''})` : 'Gerou/imprimiu o relatório de assinaturas'}</td></tr>
        ))}
      </Tabela>
    </Painel>
  );
}
