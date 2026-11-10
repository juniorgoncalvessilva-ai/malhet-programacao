# Configuração de Autenticação Clerk - AI Coders Starter Kit

O **AI Coders Starter Kit** utiliza Clerk para autenticação moderna e segura. **IMPORTANTE: Você deve completar a configuração abaixo antes que o aplicativo funcione corretamente.**

## 1. Criar uma Conta Clerk

1. Acesse [clerk.com](https://clerk.com) e crie uma conta
2. Crie uma nova aplicação
3. Escolha seus métodos de autenticação (Email, Google, GitHub, etc.)

## 2. Variáveis de Ambiente

Crie um arquivo `.env.local` no diretório raiz e adicione suas chaves do Clerk:

```bash
# Copie do .env.local.example e substitua pelas suas chaves reais
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_sua_chave_publica_clerk_aqui
CLERK_SECRET_KEY=sk_test_sua_chave_secreta_clerk_aqui

# Opcional: Configure URLs de login/cadastro (já configuradas)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app
```
