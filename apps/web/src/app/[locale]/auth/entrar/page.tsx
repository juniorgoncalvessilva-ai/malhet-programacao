'use client';

import { useEffect, useState } from 'react';
import { Botao, Campo, Erro } from '@/components/Obra/ui';
import { TelaAuth } from '@/components/Malhet/TelaAuth';
import { Link, useRouter } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';

export default function EntrarPage() {
  const { entrar, usuario, carregado } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pedeMfa, setPedeMfa] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (carregado && usuario) router.replace('/app/programacoes'); }, [carregado, usuario, router]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await entrar(email, senha, pedeMfa ? codigo : undefined);
      if (r.mfa) setPedeMfa(true);
      else router.replace('/app/programacoes');
    } catch (er) { setErro(er); } finally { setEnviando(false); }
  };

  return (
    <TelaAuth
      titulo={pedeMfa ? 'Confirme que é você' : 'Entrar'}
      subtitulo={pedeMfa ? 'Digite os 6 dígitos do app autenticador ou um código de backup.' : 'Use o e-mail da empresa.'}
    >
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {!pedeMfa ? (
          <>
            <Campo rotulo="E-mail da empresa" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo rotulo="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </>
        ) : (
          <Campo rotulo="Código" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        )}
        <Erro erro={erro} />
        <Botao type="submit" disabled={enviando} className="h-11 w-full">{enviando ? 'Entrando…' : 'Continuar'}</Botao>
      </form>
      <p className="text-[13px] text-m-text-muted">
        Primeiro acesso? <Link href="/auth/cadastro" className="font-semibold text-m-accent hover:text-m-accent-hover">Criar conta</Link>
      </p>
    </TelaAuth>
  );
}
