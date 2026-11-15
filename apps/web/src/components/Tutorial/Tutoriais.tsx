'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMarcaObra } from '@/components/Obra/LogosObra';
import { useApi } from '@/hooks/programacao/useApi';
import { useSessao } from '@/lib/auth/AuthProvider';
import { useObra } from '@/lib/obra/ObraProvider';
import { nomeDe, usePerfil } from '@/lib/perfil';
import { useBarraMobile } from '@/lib/perfil';
import { Tour, type Passo } from './Tour';

/**
 * Tutorial do primeiro acesso (spec 097): abre sozinho uma vez por conta (computador e celular, cada um o seu) e pode ser
 * revisto pelo menu da conta. O conteúdo segue o perfil da pessoa na obra: cada um vê o caminho do próprio trabalho.
 */
type Chave = 'computador' | 'celular';
const EVENTO = 'malhet:tutorial';
const PAPEL: Record<string, string> = { admin: 'Admin da obra', planejador: 'Planejador', encarregado: 'Encarregado', leitor: 'Leitor', seguranca: 'Segurança (SSMA)' };

/** Reabre o tutorial da tela atual (menu da conta › Ver o tutorial). */
export const abrirTutorial = () => window.dispatchEvent(new Event(EVENTO));

const visto = (uid: string | undefined, chave: Chave) => { try { return localStorage.getItem(`malhet.tutorial.${chave}.${uid}`) === '1'; } catch { return false; } };

function useTutorial(chave: Chave) {
  const { usuario } = useSessao();
  const { obra, simulando } = useObra();
  const perfil = usePerfil();
  const api = useApi();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const pendente = !!perfil.data?.tutoriais_pendentes?.includes(chave) && !visto(usuario?.id, chave);
  useEffect(() => {
    if (!pendente || !obra || simulando) return;
    const t = setTimeout(() => setAberto(true), 700); // deixa a tela montar antes de apontar para ela
    return () => clearTimeout(t);
  }, [pendente, obra, simulando]);
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  const fim = useCallback((concluido: boolean) => {
    setAberto(false);
    try { localStorage.setItem(`malhet.tutorial.${chave}.${usuario?.id}`, '1'); } catch { /* sem storage */ }
    if (pendente) {
      api.put(`/perfil/tutoriais/${chave}`, { concluido }).then((p) => qc.setQueryData(['perfil', usuario?.id], p)).catch(() => undefined);
    }
  }, [api, chave, pendente, qc, usuario?.id]);
  return { aberto, fim, nome: nomeDe(perfil.data, usuario?.email) };
}

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-m-text-primary">{children}</b>;

/** Computador: obra, menu do perfil, vigente, o caminho do papel, memória de cálculo, avisos e a conta. */
export function TutorialComputador() {
  const { aberto, fim, nome } = useTutorial('computador');
  const { obra, papel, superadmin, podeVer } = useObra();
  const marca = useMarcaObra();
  const empresa = marca.data?.nome_contratada?.trim();
  const passos = useMemo<Passo[]>(() => {
    if (!aberto) return [];
    const largo = window.matchMedia('(min-width: 1024px)').matches;
    const ve = (url: string) => podeVer(url);
    const p: Passo[] = [
      { titulo: `Boas-vindas${nome ? `, ${nome}` : ''}`,
        texto: <>Este é o sistema {empresa ? <>da <B>{empresa}</B></> : 'da sua obra'} para programar, executar e medir a obra. Em um minuto mostramos onde fica cada coisa. Dá para pular e rever quando quiser no menu da sua conta.</> },
      { alvo: 'obra', titulo: 'Sua obra',
        texto: <>Tudo o que aparece é da obra <B>{obra?.nome}</B>: programação, equipes, fotos e indicadores. Se você trabalha em mais de uma, troque aqui.</> },
      largo
        ? { alvo: 'menu', titulo: 'Seu menu', texto: <>Mostra só as telas do seu perfil{papel && !superadmin ? <> (<B>{PAPEL[papel]}</B>)</> : ''}, em grupos — Planejamento, Campo e qualidade, Segurança, Efetivo. O que não faz parte do seu trabalho não aparece.</> }
        : { alvo: 'abrir-menu', titulo: 'Seu menu', texto: <>Toque aqui para abrir o menu. Ele mostra só as telas do seu perfil{papel && !superadmin ? <> (<B>{PAPEL[papel]}</B>)</> : ''}.</> },
      { alvo: largo ? 'menu:/app/vigente' : undefined, titulo: 'Programação vigente',
        texto: <>O que a obra vai executar agora, já emitido e valendo. Fica aberta para todos: é o ponto de partida do dia.</> },
    ];
    if (superadmin || papel === 'admin' || papel === 'planejador') {
      p.push({ alvo: largo && ve('/app/programacoes') ? 'menu:/app/programacoes' : undefined, titulo: 'Como nasce a programação',
        texto: <>O caminho é <B>Importações</B> (cronograma, PQ e CPU) → <B>Frentes</B> → <B>Catálogo</B> → <B>Programações</B>: monte a semana, emita, imprima e envie ao Simova. Restrições e o plano de 90 dias ajudam a liberar o que vem depois.</> });
    } else if (papel === 'encarregado') {
      p.push({ titulo: 'No campo, use o celular',
        texto: <>Abra o Malhet no celular para <B>lançar a produção</B>, registrar <B>ocorrência com foto</B> e marcar a <B>presença</B> da equipe. Funciona até sem internet e envia sozinho quando o sinal voltar.</> });
    } else if (papel === 'seguranca') {
      p.push({ alvo: largo && ve('/app/ssma/cadastros') ? 'menu:/app/ssma/cadastros' : undefined, titulo: 'Segurança (SSMA)',
        texto: <>ASOs e treinamentos, o SSMA de cada atividade da programação, o controle preventivo (etilômetro) e as assinaturas da LGPD ficam no grupo <B>Segurança</B>.</> });
    } else {
      p.push({ alvo: largo && ve('/app/indicadores') ? 'menu:/app/indicadores' : undefined, titulo: 'Acompanhar a obra',
        texto: <>Indicadores (PPC, aderência), desvios com causa e o look-ahead das equipes mostram como a obra está indo, semana a semana.</> });
    }
    p.push(
      { titulo: 'Todo número tem a conta',
        texto: <>Número calculado — capacidade, HH, PPC, quantidades — aparece <span className="underline decoration-dotted underline-offset-[3px]">sublinhado</span>. Clique nele e veja a conta feita e de onde veio cada valor (arquivo e linha).</> },
      { alvo: 'sino', titulo: 'Avisos', texto: <>Restrição vencendo, vaga aberta, ação para você: o sino avisa o que precisa da sua atenção.</> },
      { alvo: 'conta', titulo: 'Sua conta',
        texto: <>Seu perfil e foto, sair e, aqui, <B>Ver o tutorial</B> de novo e <B>Relatar um problema</B>. Se algo falhar, o Malhet já avisa a equipe sozinho — e você pode contar o que estava fazendo.</> },
      { titulo: 'Pronto para começar', texto: <>Bom trabalho. Se travar em algo, use <B>Relatar um problema</B> no menu da sua conta: a equipe recebe com a tela em que você estava.</> },
    );
    return p;
  }, [aberto, nome, empresa, obra?.nome, papel, superadmin, podeVer]);
  return <Tour passos={passos} aberto={aberto} onFim={fim} />;
}

/** Celular: atalhos da barra, o botão do meio, o trabalho sem internet e o "Mais". */
export function TutorialCelular() {
  const { aberto, fim, nome } = useTutorial('celular');
  const { obra } = useObra();
  const { destaque } = useBarraMobile();
  const passos = useMemo<Passo[]>(() => {
    if (!aberto) return [];
    const p: Passo[] = [
      { titulo: `Boas-vindas${nome ? `, ${nome}` : ''}`, texto: <>Este é o Malhet de campo da obra <B>{obra?.nome}</B>. Quatro toques e você já sabe usar.</> },
      { alvo: 'barra', titulo: 'Seus atalhos', texto: <>Aqui embaixo ficam as telas que você mais usa. Dá para trocar em <B>Mais › Meu menu</B>.</> },
    ];
    if (destaque) p.push({ alvo: 'destaque', titulo: destaque.titulo, texto: <>O botão do meio é a ação principal do seu dia. Um toque e você já está nela.</> });
    p.push(
      { titulo: 'Sem sinal, sem problema', texto: <>O que você registra — produção, foto, presença, auditoria — fica guardado no celular e é enviado sozinho quando a internet voltar.</> },
      { alvo: 'mais', titulo: 'Mais', texto: <>Todas as telas liberadas para você, avisos, seu perfil, trocar de obra, <B>Ver o tutorial</B> e <B>Relatar um problema</B>.</> },
      { titulo: 'Pronto', texto: <>Bom trabalho. Se algo não funcionar, o app avisa a equipe sozinho — e em <B>Mais › Relatar um problema</B> você conta o que aconteceu.</> },
    );
    return p;
  }, [aberto, nome, obra?.nome, destaque]);
  return <Tour passos={passos} aberto={aberto} onFim={fim} />;
}
