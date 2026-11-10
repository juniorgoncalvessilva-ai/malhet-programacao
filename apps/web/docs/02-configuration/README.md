# ⚙️ Configuration

Esta seção contém todos os guias de configuração e personalização do sistema.

## 📋 Documentos Disponíveis

### [configuracao-central.md](./configuracao-central.md)
- Sistema de configuração centralizada
- Como personalizar informações da empresa
- Gerenciamento de variáveis de ambiente
- Configuração de temas e branding

### [configuracoes.md](./configuracoes.md)
- Configurações gerais do projeto
- Variáveis de ambiente necessárias
- Configuração de ferramentas de desenvolvimento
- Otimizações de build e produção

### [analytics.md](./analytics.md)
- Configuração de Google Analytics
- Integração com Google Tag Manager
- Setup do Meta Pixel (Facebook)
- Configuração do LogRocket
- Hooks e helpers para analytics

### [autenticacao.md](./autenticacao.md)
- Configuração completa da autenticação Clerk
- Variáveis de ambiente do Clerk
- Configuração de provedores OAuth
- Customização de páginas de autenticação

### [clerk-supabase-integracao.md](./clerk-supabase-integracao.md)
- Integração Clerk + Supabase para desenvolvimento local
- Configuração de templates JWT
- Políticas RLS e autenticação
- Solução de problemas e debug

### [webhooks-clerk.md](./webhooks-clerk.md)
- Configuração de webhooks do Clerk
- Sincronização de dados usuário
- Eventos suportados
- Configuração local com ngrok
- Troubleshooting e boas práticas

## 🎯 Ordem Recomendada

1. **Configurações gerais** - Configure o ambiente básico
2. **Configuração central** - Personalize informações da empresa
3. **Clerk Setup** - Configure a autenticação
4. **Integração Clerk + Supabase** - Configure autenticação com banco de dados
5. **Webhooks Clerk** - Configure sincronização de dados
6. **Analytics** - Configure ferramentas de monitoramento (opcional)

## 🔧 Configurações Essenciais

### Variáveis de Ambiente
```bash
# Configurações Essenciais
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Analytics (opcional)
NEXT_PUBLIC_GA_ENABLED=true
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ENABLED=true
NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX
NEXT_PUBLIC_META_PIXEL_ENABLED=true
NEXT_PUBLIC_META_PIXEL_ID=XXXXXXXXXXXXXXX
NEXT_PUBLIC_LOGROCKET_ENABLED=true
NEXT_PUBLIC_LOGROCKET_APP_ID=xxxxxx/xxxxxxx

# Feature Flags
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_ENABLE_I18N=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_FORM_VALIDATION=true
NEXT_PUBLIC_ENABLE_CEP_LOOKUP=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_MAINTENANCE_MODE=false
```

### Arquivos de Configuração Principais
- `next.config.mjs` - Configuração do Next.js
- `tailwind.config.ts` - Configuração do Tailwind CSS
- `tsconfig.json` - Configuração do TypeScript
- `src/config/app.ts` - Configuração central da aplicação
- `src/config/index.ts` - Export de configurações
- `src/i18n/routing.ts` - Configuração de internacionalização
- `supabase/config.toml` - Configuração do Supabase local

## 💡 Dicas de Configuração

- Sempre use variáveis de ambiente para dados sensíveis
- Mantenha configurações específicas do ambiente separadas
- Documente mudanças nas configurações
- Teste configurações em ambientes diferentes

## 🔗 Próximos Passos

Após configurar o sistema:
- **[Development](../03-development/)** - Comece o desenvolvimento
- **[Features](../05-features/)** - Configure funcionalidades específicas
- **[Deployment](../06-deployment/)** - Prepare para produção