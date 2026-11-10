'use client';

/**
 * Compatibilidade com a API do Clerk usada pelo AI Coders Starter Kit (useUser/useAuth/useClerk),
 * agora servida pelo auth-kit. Código novo deve usar `useSessao()`.
 */
import { useSessao } from './AuthProvider';

export function useUser() {
  const { usuario, carregado } = useSessao();
  const user = usuario
    ? {
        id: usuario.id,
        fullName: usuario.email.split('@')[0],
        firstName: usuario.email.split('@')[0],
        lastName: null as string | null,
        imageUrl: '',
        createdAt: null as Date | null,
        lastSignInAt: null as Date | null,
        primaryEmailAddress: { emailAddress: usuario.email },
        emailAddresses: [{ emailAddress: usuario.email }],
      }
    : null;
  return { user, isLoaded: carregado, isSignedIn: !!usuario };
}

export function useAuth() {
  const { usuario, carregado, getToken, sair } = useSessao();
  return { isSignedIn: !!usuario, isLoaded: carregado, sessionId: usuario ? 'auth-kit' : null, userId: usuario?.id ?? null, getToken, signOut: sair };
}

export function useClerk() {
  const { sair } = useSessao();
  return { signOut: sair };
}
