'use client';

import { useState } from 'react';
import { Botao, Campo, Erro } from '@/components/Obra/ui';
import { TelaAuth } from '@/components/Malhet/TelaAuth';
import { Link } from '@/i18n/navigation';
import { useSessao } from '@/lib/auth/AuthProvider';

export default function CadastroPage() {
  const { cadastrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try { setOk(await cadastrar(email, senha)); } catch (er) { setErro(er); }
  };

  return (
    <TelaAuth titulo="Criar conta">
      {ok ? (
        <p className="rounded-m-md bg-m-accent-subtle px-4 py-3 text-sm text-m-accent">{ok}</p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="E-mail da empresa" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo rotulo="Senha (10+ caracteres, letra e número)" type="password" autoComplete="new-password" minLength={10} required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Erro erro={erro} />
          <Botao type="submit" className="h-11 w-full">Criar conta</Botao>
        </form>
      )}
      <p className="text-[13px] text-m-text-muted">
        Já tem conta? <Link href="/auth/entrar" className="font-semibold text-m-accent hover:text-m-accent-hover">Entrar</Link>
      </p>
    </TelaAuth>
  );
}
