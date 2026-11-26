'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Copy, KeyRound, Link2, Lock, MessageCircle, Trash2, Unlock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { PedidosEquipe } from '@/components/Obra/PedidosEquipe';
import { Botao, Cabecalho, Indicador, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import type { Colaborador } from '@/lib/api/types';

interface Lider {
  colaborador_id?: number; nome: string; matricula: string | null; funcao?: string | null; papeis?: string[]; cadastrado?: boolean;
  equipes?: { id: number; nome: string }[]; equipes_extras?: number[]; situacao?: 'nunca_entrou' | 'senha_inicial' | 'ativo' | 'bloqueado';
  ultimo_acesso?: string | null; fora_do_efetivo?: boolean; equipe?: string; perfil?: 'lider' | 'apontador';
}
interface FuncoesApontador { padrao: boolean; funcoes: string[]; disponiveis: { funcao: string; pessoas: number; apontador: boolean }[] }
interface Resposta { endereco: string; endereco_empresa: string; endereco_apontador: string; endereco_apontador_empresa: string; lideres: Lider[] }

const SITUACAO = { nunca_entrou: ['Nunca entrou', 'neutro'], senha_inicial: ['Senha inicial (123456)', 'atencao'], ativo: ['Com senha própria', 'sucesso'], bloqueado: ['Bloqueado', 'perigo'] } as const;

/**
 * Acesso dos líderes (specs 111 e 115): o endereço fixo dos encarregados (`/encarregado`) e quem pode entrar — encarregados,
 * responsáveis e supervisores das equipes (automático) e líderes sem a função de encarregado, cadastrados aqui.
 */
export default function LideresPage() {
  const api = useApi();
  const { pode, obra } = useObra();
  const confirmar = useConfirmar();
  const efetivo = useEfetivo();
  const equipes = useEquipes();
  const q = useQuery({ queryKey: ['lideres'], queryFn: () => api.get<Resposta>('/lideres') });
  const [novo, setNovo] = useState<Colaborador | null>(null);
  const [equipesNovo, setEquipesNovo] = useState<string[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [equipesEdit, setEquipesEdit] = useState<string[]>([]);
  const [novoAp, setNovoAp] = useState<Colaborador | null>(null);
  // spec 148: as funções do efetivo que entram como apontador (a obra escolhe; sem escolha, APONTADOR)
  const funcoesAp = useQuery({ queryKey: ['lideres', 'apontador', 'funcoes'], queryFn: () => api.get<FuncoesApontador>('/lideres/apontador/funcoes') });
  const [funcoesSel, setFuncoesSel] = useState<string[] | null>(null);
  const selecionadas = funcoesSel ?? funcoesAp.data?.funcoes ?? [];
  const planejador = pode('planejador');
  // spec 117: endereço da obra e da empresa, montados sozinhos pelo nome da contratada e o código da obra
  const origem = `${typeof window !== 'undefined' ? window.location.origin : ''}/pt-BR`;
  const link = `${origem}${q.data?.endereco ?? '/encarregado'}`;
  const linkEmpresa = `${origem}${q.data?.endereco_empresa ?? '/encarregado'}`;
  const mensagem = `Encarregados e líderes da ${obra?.nome ?? 'obra'}: confiram quem está na sua equipe e avisem quem saiu ou chegou.\n${link}\nEntre com a sua matrícula. Primeiro acesso: senha 123456 (em seguida você cria a sua).`;
  const opcoesEquipes = (equipes.data ?? []).filter((e) => e.ativo).map((e) => ({ valor: String(e.id), rotulo: `${e.nome}${e.encarregado_nome ? ` — Enc. ${e.encarregado_nome}` : ''}` }));
  // spec 147: o apontador entra pela rota dele, com a mesma regra de endereço
  const linkAp = `${origem}${q.data?.endereco_apontador ?? '/apontador'}`;
  const linkApEmpresa = `${origem}${q.data?.endereco_apontador_empresa ?? '/apontador'}`;
  const mensagemAp = `Apontadores da ${obra?.nome ?? 'obra'}: presença das equipes, equipamentos, fotos e produção pelo celular.\n${linkAp}\nEntre com a sua matrícula. Primeiro acesso: senha 123456 (em seguida você cria a sua). Ao abrir, instale o app na tela de início.`;
  const apontadores = q.data?.lideres.filter((l) => !l.fora_do_efetivo && l.perfil === 'apontador') ?? [];
  const lideres = q.data?.lideres.filter((l) => !l.fora_do_efetivo) ?? [];
  const fora = q.data?.lideres.filter((l) => l.fora_do_efetivo) ?? [];
  const exec = async (p: Promise<unknown>, ok: string) => { try { await p; toast.success(ok); return true; } catch (e) { toast.error((e as Error).message); return false; } };

  return (
    <>
      <Cabecalho eyebrow="Efetivo · acesso dos líderes" titulo={q.data ? `${lideres.length} líder(es) podem conferir a equipe pelo endereço dos encarregados` : 'Acesso dos líderes'} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Líderes" valor={lideres.length} />
        <Indicador rotulo="Já criaram a senha" valor={lideres.filter((l) => l.situacao === 'ativo').length} tom="sucesso" />
        <Indicador rotulo="Nunca entraram" valor={lideres.filter((l) => l.situacao === 'nunca_entrou').length} />
        <Indicador rotulo="Bloqueados" valor={lideres.filter((l) => l.situacao === 'bloqueado').length} tom={lideres.some((l) => l.situacao === 'bloqueado') ? 'perigo' : undefined} />
      </div>

      <Painel titulo="Onde o encarregado entra?" subtitulo="Endereço desta obra, com a marca da empresa desde a abertura: ele entra com a matrícula; o primeiro acesso é ali mesmo (senha 123456 e ele cria a dele). O endereço sai sozinho do nome da contratada (Marca da obra) e do código da obra. Entram os líderes desta lista e quem tem função de liderança no efetivo (encarregado, líder, mestre, supervisor) — sem equipe, ele pede a dele e você aprova aqui.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-m-md border border-m-stroke-subtle px-3 py-2.5">
            <Link2 size={16} className="text-m-accent" aria-hidden="true" />
            <code className="min-w-0 flex-1 break-all text-[13px] text-m-text-primary">{link}</code>
            <Botao variante="secundario" onClick={() => navigator.clipboard.writeText(mensagem).then(() => toast.success('Mensagem com o endereço copiada'))}><Copy size={16} /> Copiar mensagem</Botao>
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent"><MessageCircle size={16} /> Enviar no WhatsApp</a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-m-text-tertiary">
            <span>Endereço da empresa (todas as obras dela; a obra sai da matrícula):</span>
            <code className="break-all text-m-text-secondary">{linkEmpresa}</code>
            <button type="button" className="font-semibold text-m-accent underline" onClick={() => navigator.clipboard.writeText(linkEmpresa).then(() => toast.success('Endereço da empresa copiado'))}>copiar</button>
          </div>
          <p className="text-[12.5px] text-m-text-tertiary">Para tirar alguém, bloqueie na lista abaixo. Cada transferência ou inclusão feita ali vai para Equipes › Movimentações (por “líder + matrícula”) e avisa o Planejamento no sino. Os links enviados antes (/equipe/… e /encarregado) continuam funcionando: levam a este endereço.</p>
        </div>
      </Painel>

      <Painel titulo="Onde o apontador entra?" subtitulo="Endereço do apontador desta obra: a mesma regra do encarregado (matrícula; primeiro acesso com 123456). O apontador cria equipes, aponta a presença de todo o efetivo e o dia dos equipamentos, registra as fotos das atividades e confere a produção. Entram quem tem uma das funções escolhidas abaixo (qualquer função do efetivo; o padrão é APONTADOR) e quem você cadastrar como apontador, qualquer que seja a função. No celular, a tela oferece instalar o app, que abre direto neste login.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-m-md border border-m-stroke-subtle px-3 py-2.5">
            <ClipboardCheck size={16} className="text-m-accent" aria-hidden="true" />
            <code className="min-w-0 flex-1 break-all text-[13px] text-m-text-primary">{linkAp}</code>
            <Botao variante="secundario" onClick={() => navigator.clipboard.writeText(mensagemAp).then(() => toast.success('Mensagem do apontador copiada'))}><Copy size={16} /> Copiar mensagem</Botao>
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagemAp)}`} target="_blank" rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent"><MessageCircle size={16} /> Enviar no WhatsApp</a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-m-text-tertiary">
            <span>Endereço da empresa:</span><code className="break-all text-m-text-secondary">{linkApEmpresa}</code>
            <span className="ml-auto">{apontadores.length} apontador(es): {apontadores.map((a) => a.nome).join(', ') || '—'}</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-m-text-muted">Funções que entram como apontador</span>
            <MultiSelecao rotulo="Funções que entram como apontador" largura="w-[360px]" comNa={false} valor={selecionadas}
              opcoes={[...(funcoesAp.data?.disponiveis ?? []).map((d) => ({ valor: d.funcao, rotulo: `${d.funcao} (${d.pessoas})` })),
                ...selecionadas.filter((f) => !funcoesAp.data?.disponiveis.some((d) => d.funcao === f)).map((f) => ({ valor: f, rotulo: `${f} (ninguém hoje)` }))]}
              disabled={!planejador} onChange={setFuncoesSel} />
            </div>
            {planejador && <Botao disabled={funcoesSel === null} onClick={async () => {
              if (await exec(api.put('/lideres/apontador/funcoes', { funcoes: funcoesSel ?? [] }), 'Funções de apontador salvas')) setFuncoesSel(null);
            }}>Salvar funções</Botao>}
            {planejador && !funcoesAp.data?.padrao && <button type="button" className="text-[12.5px] font-semibold text-m-accent underline" onClick={async () => {
              if (await exec(api.put('/lideres/apontador/funcoes', { funcoes: null }), 'Voltou ao padrão (função APONTADOR)')) setFuncoesSel(null);
            }}>voltar ao padrão</button>}
            <span className="text-[12.5px] text-m-text-tertiary">{funcoesAp.data?.padrao ? 'Padrão: quem tem a função APONTADOR. Escolha qualquer função do efetivo.' : 'Quem tem uma destas funções entra pela rota do apontador.'}</span>
          </div>
          {planejador && (
            <div className="flex flex-wrap items-end gap-3">
              <BuscaEfetivo rotulo="Cadastrar apontador (pessoa do efetivo)" className="w-full max-w-[380px]" pessoas={efetivo.data ?? []} onEscolher={(p) => setNovoAp(p)} />
              <Botao disabled={!novoAp} onClick={async () => {
                if (!novoAp) return;
                await exec(api.post('/lideres', { colaborador_id: novoAp.id, perfil: 'apontador' }), `${novoAp.nome} pode entrar no endereço do apontador (senha 123456)`);
                setNovoAp(null);
              }}><UserPlus size={16} /> Incluir apontador</Botao>
              {novoAp && <span className="text-[13px] text-m-text-secondary">Escolhido: <b className="text-m-text-primary">{novoAp.nome}</b>{novoAp.matricula ? ` · ${novoAp.matricula}` : ''}</span>}
            </div>
          )}
        </div>
      </Painel>

      <PedidosEquipe podeDecidir={planejador} />

      {planejador && (
        <Painel titulo="Quem mais lidera equipe?" subtitulo="Líderes sem a função de encarregado (ex.: líder de turma, mestre): escolha a pessoa no efetivo e as equipes que ela controla.">
          <div className="flex flex-wrap items-end gap-3">
            <BuscaEfetivo rotulo="Pessoa do efetivo" className="w-full max-w-[380px]" pessoas={efetivo.data ?? []} onEscolher={(p) => setNovo(p)} />
            <MultiSelecao rotulo="Equipes que controla" largura="w-[320px]" comNa={false} valor={equipesNovo} opcoes={opcoesEquipes} onChange={setEquipesNovo} />
            <Botao disabled={!novo} onClick={async () => {
              if (!novo) return;
              await exec(api.post('/lideres', { colaborador_id: novo.id, equipes: equipesNovo.map(Number) }), `${novo.nome} pode entrar no endereço dos encarregados (senha 123456)`);
              setNovo(null); setEquipesNovo([]);
            }}><UserPlus size={16} /> Incluir líder</Botao>
          </div>
          {novo && <p className="mt-2 text-[13px] text-m-text-secondary">Escolhido: <b className="text-m-text-primary">{novo.nome}</b>{novo.matricula ? ` · ${novo.matricula}` : ''}{novo.funcao ? ` · ${novo.funcao}` : ''}</p>}
        </Painel>
      )}

      <Painel titulo="Quem pode entrar?" subtitulo="Encarregados, responsáveis e supervisores das equipes entram sozinhos; os cadastrados acima, pelas equipes escolhidas.">
        <Tabela cabecalho={['Líder', 'Como lidera', 'Equipes', 'Senha', 'Último acesso', '']} vazio={!q.data ? undefined : !lideres.length && 'Nenhuma equipe com encarregado ainda.'}>
          {!q.data && <LinhasCarregando colunas={6} linhas={4} />}
          {lideres.map((l) => {
            const [rot, tom] = SITUACAO[l.situacao ?? 'nunca_entrou'];
            return (
              <tr key={l.colaborador_id}>
                <td className={td}><b className="text-m-text-primary">{l.nome}</b><span className="block text-xs text-m-text-muted">{[l.matricula, l.funcao].filter(Boolean).join(' · ')}</span></td>
                <td className={td}>{l.perfil === 'apontador' ? <Pilula tom="info">apontador</Pilula> : null} {l.papeis?.filter((x) => x !== 'apontador').join(', ')}</td>
                <td className={td}>{editando === l.colaborador_id
                  ? <div className="flex items-center gap-2"><MultiSelecao rotulo="Equipes" largura="w-[280px]" comNa={false} valor={equipesEdit} opcoes={opcoesEquipes} onChange={setEquipesEdit} />
                      <Botao onClick={async () => { await exec(api.put(`/lideres/${l.colaborador_id}`, { equipes: equipesEdit.map(Number) }), 'Equipes do líder salvas'); setEditando(null); }}>Salvar</Botao></div>
                  : <span>{l.equipes?.map((e) => e.nome).join(', ') || '—'}{l.cadastrado && planejador && <button type="button" className="ml-2 text-xs font-semibold text-m-accent underline" onClick={() => { setEditando(l.colaborador_id!); setEquipesEdit((l.equipes_extras ?? []).map(String)); }}>editar</button>}</span>}</td>
                <td className={td}><Pilula tom={tom}>{rot}</Pilula></td>
                <td className={`${td} whitespace-nowrap`}>{l.ultimo_acesso ? new Date(l.ultimo_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                <td className={`${td} whitespace-nowrap text-right`}>{planejador && <div className="inline-flex gap-1">
                  <button type="button" title="Voltar a senha para 123456" aria-label={`Redefinir a senha de ${l.nome}`} className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-text-primary"
                    onClick={async () => { if (await confirmar({ titulo: `Voltar a senha de ${l.nome} para 123456?`, mensagem: 'A sessão aberta no celular dele cai; no próximo acesso ele cria outra senha.' })) await exec(api.post(`/lideres/${l.colaborador_id}/redefinir`), 'Senha voltou para 123456'); }}><KeyRound size={16} /></button>
                  <button type="button" title={l.situacao === 'bloqueado' ? 'Liberar' : 'Bloquear'} aria-label={`${l.situacao === 'bloqueado' ? 'Liberar' : 'Bloquear'} ${l.nome}`} className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-text-primary"
                    onClick={async () => {
                      const bloquear = l.situacao !== 'bloqueado';
                      if (bloquear && !(await confirmar({ titulo: `Bloquear ${l.nome}?`, mensagem: 'Ele sai na hora e não entra mais até ser liberado.' }))) return;
                      await exec(api.put(`/lideres/${l.colaborador_id}`, { ativo: !bloquear }), bloquear ? 'Bloqueado' : 'Liberado');
                    }}>{l.situacao === 'bloqueado' ? <Unlock size={16} /> : <Lock size={16} />}</button>
                  {l.cadastrado && <button type="button" title="Tirar da lista de líderes" aria-label={`Tirar ${l.nome} dos líderes`} className="rounded-full p-2 text-m-text-muted hover:bg-m-surface-hover hover:text-m-danger"
                    onClick={async () => { if (await confirmar({ titulo: `Tirar ${l.nome} dos líderes?`, mensagem: 'Se ele também for encarregado/responsável de alguma equipe, continua entrando por ela (bloqueie para impedir).' })) await exec(api.del(`/lideres/${l.colaborador_id}`), 'Tirado dos líderes'); }}><Trash2 size={16} /></button>}
                </div>}</td>
              </tr>
            );
          })}
        </Tabela>
        {!!fora.length && <p className="mt-3 text-[13px] text-m-warning">{fora.length} encarregado(s) de equipe fora do efetivo não conseguem entrar (a matrícula não está no efetivo): {fora.slice(0, 6).map((f) => `${f.nome} (${f.equipe})`).join(', ')}{fora.length > 6 ? '…' : ''}.</p>}
      </Painel>
    </>
  );
}
