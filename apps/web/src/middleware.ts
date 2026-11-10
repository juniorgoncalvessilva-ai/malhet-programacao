import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Só i18n. A autenticação (auth-kit) é verificada pela API em cada chamada e pelo AuthGuard no cliente.
export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/((?!api|backend|_next|_vercel|brand|.*\\..*).*)'],
};
