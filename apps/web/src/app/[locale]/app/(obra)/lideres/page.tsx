'use client';

import { useQuery } from '@tanstack/react-query';
import { Copy, KeyRound, Link2, Lock, MessageCircle, RefreshCw, Trash2, Unlock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BuscaEfetivo } from '@/components/Obra/BuscaEfetivo';
import { useConfirmar } from '@/components/Obra/Confirmar';
import { LinhasCarregando } from '@/components/Obra/Esqueleto';
import { MultiSelecao } from '@/components/Obra/MultiSelecao';
import { Botao, Cabecalho, Indicador, Painel, Pilula, Tabela, td } from '@/components/Obra/ui';
import { useEfetivo } from '@/hooks/programacao/planejamento';
import { useEquipes } from '@/hooks/programacao/queries';
import { useApi } from '@/hooks/programacao/useApi';
import { useObra } from '@/lib/obra/ObraProvider';
import type { Colaborador } from '@/lib/api/types';

interface Lider {
  colaborador_id?: number; nome: string; matricula: string | null; funcao?: string | null; papeis?: string[]; cadastrado?: boolean;
  equipes?: { id: number; nome: string }[]; equipes_extras?: number[]; situacao?: 'nunca_entrou' | 'senha_inicial' | 'ativo' | 'bloqueado';
  ultimo_acesso?: string | null; fora_do_efetivo?: boolean; equipe?: string;
}
interface Resposta { link: { codigo: string; ativo: boolean }; lideres: Lider[] }

const SITUACAO = { nunca_entrou: ['Nunca entrou', 'neutro'], senha_inicial: ['Senha inicial (123456)', 'atencao'], ativo: ['Com senha própria', 'sucesso'], bloqueado: ['Bloqueado', 'perigo'] } as const;

/**
 * Acesso dos líderes (spec 111): o link da obra para o grupo do WhatsApp e quem pode entrar nele — encarregados,
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
  const planejador = pode('planejador');
  const link = q.data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pt-BR/equipe/${q.data.link.codigo}` : '';
  const mensagem = `Encarregados e líderes da ${obra?.nome ?? 'obra'}: confiram quem está na sua equipe no Malhet e avisem quem saiu ou chegou.\n${link}\nEntre com a sua matrícula. Primeiro acesso: senha 123456 (em seguida você cria a sua).`;
  const opcoesEquipes = (equipes.data ?? []).filter((e) => e.ativo).map((e) => ({ valor: String(e.id), rotulo: `${e.nome}${e.encarregado_nome ? ` — Enc. ${e.encarregado_nome}` : ''}` }));
  const lideres = q.data?.lideres.filter((l) => !l.fora_do_efetivo) ?? [];
  const fora = q.data?.lideres.filter((l) => l.fora_do_efetivo) ?? [];
  const exec = async (p: Promise<unknown>, ok: string) => { try { await p; toast.success(ok); } catch (e) { toast.error((e as Error).message); } };

  return (
    <>
      <Cabecalho eyebrow="Efetivo · acesso dos líderes" titulo={q.data ? `${lideres.length} líder(es) podem conferir a equipe pelo link` : 'Acesso dos líderes'} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Líderes" valor={lideres.length} />
        <Indicador rotulo="Já criaram a senha" valor={lideres.filter((l) => l.situacao === 'ativo').length} tom="sucesso" />
        <Indicador rotulo="Nunca entraram" valor={lideres.filter((l) => l.situacao === 'nunca_entrou').length} />
        <Indicador rotulo="Bloqueados" valor={lideres.filter((l) => l.situacao === 'bloqueado').length} tom={lideres.some((l) => l.situacao === 'bloqueado') ? 'perigo' : undefined} />
      </div>

      <Painel titulo="Qual link vai para o grupo?" subtitulo="O encarregado entra com a matrícula; a primeira senha é 123456 e ele cria a dele. Só entram os líderes desta lista."
        acoes={planejador && q.data && <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={async () => {
            if (!(await confirmar({ titulo: 'Gerar um link novo?', mensagem: 'O link atual para de funcionar na hora. Use se ele foi parar fora do grupo.' }))) return;
            await exec(api.post('/lideres/link/novo'), 'Link novo gerado: envie de novo ao grupo');
          }}><RefreshCw size={16} /> Link novo</Botao>
          <Botao variante="secundario" onClick={() => exec(api.put('/lideres/link', { ativo: !q.data!.link.ativo }), q.data!.link.ativo ? 'Link desligado' : 'Link ligado')}>
            {q.data.link.ativo ? <><Lock size={16} /> Desligar link</> : <><Unlock size={16} /> Ligar link</>}</Botao>
        </div>}>
        {!q.data ? <LinhasCarregando colunas={1} linhas={1} /> : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-m-md border border-m-stroke-subtle px-3 py-2.5">
              <Link2 size={16} className="text-m-accent" aria-hidden="true" />
              <code className="min-w-0 flex-1 break-all text-[13px] text-m-text-primary">{link}</code>
              {!q.data.link.ativo && <Pilula tom="perigo">desligado</Pilula>}
              <Botao variante="secundario" onClick={() => navigator.clipboard.writeText(mensagem).then(() => toast.success('Mensagem com o link copiada'))}><Copy size={16} /> Copiar mensagem</Botao>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-m-accent-strong px-4 text-[13px] font-semibold text-m-on-accent"><MessageCircle size={16} /> Enviar no WhatsApp</a>
            </div>
            <p className="text-[12.5px] text-m-text-tertiary">Cada transferência ou inclusão feita pelo link vai para Equipes › Movimentações (por “líder + matrícula”) e avisa o Planejamento no sino.</p>
          </div>
        )}
      </Painel>

      {planejador && (
        <Painel titulo="Quem mais lidera equipe?" subtitulo="Líderes sem a função de encarregado (ex.: líder de turma, mestre): escolha a pessoa no efetivo e as equipes que ela controla.">
          <div className="flex flex-wrap items-end gap-3">
            <BuscaEfetivo rotulo="Pessoa do efetivo" className="w-full max-w-[380px]" pessoas={efetivo.data ?? []} onEscolher={(p) => setNovo(p)} />
            <MultiSelecao rotulo="Equipes que controla" largura="w-[320px]" comNa={false} valor={equipesNovo} opcoes={opcoesEquipes} onChange={setEquipesNovo} />
            <Botao disabled={!novo} onClick={async () => {
              if (!novo) return;
              await exec(api.post('/lideres', { colaborador_id: novo.id, equipes: equipesNovo.map(Number) }), `${novo.nome} pode entrar pelo link (senha 123456)`);
              setNovo(null); setEquipesNovo([]);
            }}><UserPlus size={16} /> Incluir líder</Botao>
          </div>
          {novo && <p className="mt-2 text-[13px] text-m-text-secondary">Escolhido: <b className="text-m-text-primary">{novo.nome}</b>{novo.matricula ? ` · ${novo.matricula}` : ''}{novo.funcao ? ` · ${novo.funcao}` : ''}</p>}
        </Painel>
      )}

      <Painel titulo="Quem pode entrar pelo link?" subtitulo="Encarregados, responsáveis e supervisores das equipes entram sozinhos; os cadastrados acima, pelas equipes escolhidas.">
        <Tabela cabecalho={['Líder', 'Como lidera', 'Equipes', 'Senha', 'Último acesso', '']} vazio={!q.data ? undefined : !lideres.length && 'Nenhuma equipe com encarregado ainda.'}>
          {!q.data && <LinhasCarregando colunas={6} linhas={4} />}
          {lideres.map((l) => {
            const [rot, tom] = SITUACAO[l.situacao ?? 'nunca_entrou'];
            return (
              <tr key={l.colaborador_id}>
                <td className={td}><b className="text-m-text-primary">{l.nome}</b><span className="block text-xs text-m-text-muted">{[l.matricula, l.funcao].filter(Boolean).join(' · ')}</span></td>
                <td className={td}>{l.papeis?.join(', ')}</td>
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
                      if (bloquear && !(await confirmar({ titulo: `Bloquear ${l.nome}?`, mensagem: 'Ele sai do link na hora e não entra mais até ser liberado.' }))) return;
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
