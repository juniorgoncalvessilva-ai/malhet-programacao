import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  '/',
  '/(pt-BR|en)',
  '/(pt-BR|en)/auth/sign-in(.*)',
  '/(pt-BR|en)/auth/sign-up(.*)',
  '/api/webhooks(.*)',
]);


// Dev sem Clerk: AUTH_DISABLED=true pula a proteção das páginas (a API também deve estar com AUTH_DISABLED=true).
const authDisabled = process.env.AUTH_DISABLED === 'true';

const semClerk = (req: NextRequest) => (req.nextUrl.pathname.startsWith('/api') ? undefined : handleI18nRouting(req));

const comClerk = clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;
  
  // Verificar se é uma rota de API
  const isApiRoute = pathname.startsWith('/api');
  
  if (isApiRoute) {
    // Para rotas de API, apenas verificar autenticação se for uma rota protegida
    if (pathname.startsWith('/api/protected')) {
      await auth.protect();
    }
    // Não aplicar middleware de internacionalização para APIs
    return;
  }
  
  // Executar middleware de internacionalização PRIMEIRO
  const intlResponse = handleI18nRouting(req);
  
  // Se o middleware intl retorna um redirecionamento, retorne-o imediatamente
  if (intlResponse && (intlResponse.status === 307 || intlResponse.status === 302)) {
    return intlResponse;
  }
  
  // Verificar autenticação para rotas protegidas (páginas)
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  return intlResponse;
});

export default authDisabled ? semClerk : comClerk;


export const config = {
  // Matcher otimizado para next-intl com Clerk
  matcher: [
    // Inclui a rota raiz para redirecionamento de locale
    '/',
    // Corresponde a todas as rotas exceto arquivos estáticos e internos do Next.js
    '/((?!_next|_vercel|.*\\..*).*)' 
  ]
};