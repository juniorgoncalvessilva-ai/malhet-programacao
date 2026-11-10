# 📊 Gerenciamento de Estado com Zustand

## Visão Geral

Este projeto utiliza **Zustand** como solução principal de gerenciamento de estado global, fornecendo uma alternativa leve e amigável ao TypeScript para Redux ou Context API na gestão de estado em toda a aplicação.

## 🎯 Quando Usar Estado Global

### ✅ Use Estado Global Para:

1. **Autenticação e Perfil do Usuário**
   - Informações do usuário atual
   - Status de autenticação
   - Preferências e configurações do usuário

2. **Estado da UI Entre Componentes**
   - Tema (claro/escuro/sistema)
   - Estado aberto/recolhido da sidebar
   - Gerenciamento de modais
   - Notificações toast
   - Estados de carregamento para múltiplos componentes

3. **Configuração da Aplicação**
   - Configurações de idioma/locale
   - Feature flags
   - Configurações de API

4. **Comunicação Entre Componentes**
   - Dados que múltiplos componentes não relacionados precisam
   - Estado que persiste entre mudanças de rota
   - Notificações e alertas

5. **Dados em Tempo Real**
   - Conexões WebSocket
   - [Sistema de notificações em tempo real](/docs/05-features/real-time-notifications.md)
   - Recursos colaborativos

### ❌ Evite Estado Global Para:

1. **Estado de Formulário**
   - Use estado local com `useState` ou bibliotecas de formulário como `react-hook-form`
   - Só mova para global se os dados do formulário precisarem persistir entre rotas

2. **Estado de UI Específico do Componente**
   - Estados aberto/fechado de dropdown
   - Estados de carregamento locais
   - Toggles internos do componente

3. **Dados Temporários ou Efêmeros**
   - Estados de animação
   - Efeitos de hover
   - Estados de foco

4. **Estado do Servidor**
   - Use React Query, SWR ou similar para cache de dados do servidor
   - Só armazene no estado global se precisar transformar ou combinar dados do servidor

## 🏗️ Arquitetura do Store

### Stores Disponíveis

```typescript
// Core stores e hooks
import { 
  // App Store - Usuário, preferências, notificações
  useUser, usePreferences, useNotifications, useAppActions,
  
  // UI Store - Tema, sidebar, modais, toasts  
  useTheme, useSetTheme, useSidebarOpen, useToggleSidebar,
  useShowToast, useUIActions,
  
  // Auth Store - Autenticação
  useIsSignedIn, useAuthUser, useAuthLoading,
  
  // Locale Store - Idioma/i18n
  useLocale, useSetLocale, useLocaleActions
} from '@/store';
```

### Estrutura do Store

```
src/store/
├── index.ts           # Exportações principais e inicialização
├── app-store.ts       # Dados da aplicação e preferências
├── ui-store.ts        # Estado da UI e interações
├── auth-store.ts      # Estado de autenticação
├── locale-store.ts    # Idioma e localização
└── types.ts           # Definições TypeScript
```

## 🚀 Exemplos de Uso

### Uso Básico do Store

```typescript
import { useTheme, useSetTheme, useShowToast } from '@/store';

function MeuComponente() {
  const temaAtual = useTheme();
  const setTema = useSetTheme();
  const mostrarToast = useShowToast();

  const handleToggleTema = () => {
    const novoTema = temaAtual === 'light' ? 'dark' : 'light';
    setTema(novoTema);
    mostrarToast({
      type: 'success',
      message: `Alterado para tema ${novoTema}`
    });
  };

  return (
    <button onClick={handleToggleTema}>
      Tema atual: {temaAtual}
    </button>
  );
}
```

### Atualizações Complexas de Estado

```typescript
import { useAppActions, useUser } from '@/store';

function PreferenciasUsuario() {
  const usuario = useUser();
  const { updatePreferences, addNotification } = useAppActions();

  const handleSalvarPreferencias = async (novasPrefs) => {
    try {
      await updatePreferences(novasPrefs);
      addNotification({
        type: 'success',
        title: 'Configurações Salvas',
        message: 'Suas preferências foram atualizadas'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Falha ao Salvar',
        message: 'Não foi possível salvar as preferências'
      });
    }
  };

  return (
    <div>
      <h2>Bem-vindo, {usuario?.fullName}</h2>
      {/* Formulário de preferências */}
    </div>
  );
}
```

### Gerenciamento de Locale/Idioma

```typescript
import { useLocaleSync } from '@/hooks/useLocaleSync';
import { useLocale } from '@/store';

function SeletorIdioma() {
  const localeAtual = useLocale();
  const { setLocale, availableLocales } = useLocaleSync();

  return (
    <select 
      value={localeAtual} 
      onChange={(e) => setLocale(e.target.value)}
    >
      {availableLocales.map(locale => (
        <option key={locale} value={locale}>
          {locale === 'pt-BR' ? 'Português' : 'English'}
        </option>
      ))}
    </select>
  );
}
```

## 🔧 Padrões Avançados

### Seletores Customizados (Otimizados)

```typescript
import { useUIStore } from '@/store/ui-store';
import { useMemo } from 'react';

// ✅ Bom: Seletor otimizado com memoização
function useSidebarOtimizada() {
  return useUIStore(
    useMemo(
      () => (state) => ({
        isOpen: state.sidebarOpen,
        isCollapsed: state.sidebarCollapsed,
        isPinned: state.sidebarPinned
      }),
      []
    )
  );
}

// ❌ Ruim: Cria novo objeto a cada render
function useSidebarRuim() {
  return useUIStore((state) => ({
    isOpen: state.sidebarOpen,
    isCollapsed: state.sidebarCollapsed,
    isPinned: state.sidebarPinned
  }));
}
```

### Sincronização de Store

```typescript
// Sincronização de tema com next-themes
import { useThemeSync } from '@/hooks/useThemeSync';

function App() {
  // Sincroniza automaticamente o tema Zustand com next-themes
  const { theme, setTheme } = useThemeSync();
  
  return <div className={theme}>...</div>;
}
```

## 📡 Integração com Bibliotecas Externas

### Autenticação Clerk

```typescript
// Sincronização automática no ZustandProvider
import { useStoreSync } from '@/hooks/useStoreSync';

function AuthSync() {
  useStoreSync(); // Sincroniza usuário Clerk com store auth Zustand
  return null;
}
```

### Internacionalização Next.js

```typescript
// Sincronização automática de locale
import { useLocaleSync } from '@/hooks/useLocaleSync';

function LocaleSync() {
  useLocaleSync(); // Sincroniza next-intl com store locale Zustand
  return null;
}
```

## 🛠️ Melhores Práticas

### 1. Use Seletores Individuais

```typescript
// ✅ Bom: Seletores individuais para melhor performance
const tema = useTheme();
const isCarregando = useLoading();

// ❌ Evite: Seletores de objeto que causam re-renders desnecessários
const { tema, isCarregando } = useUIState();
```

### 2. Memoize Seletores Complexos

```typescript
// ✅ Bom: Seletor memoizado para estado derivado
const notificacoesFiltradas = useAppStore(
  useMemo(
    () => (state) => state.notifications.filter(n => !n.read),
    []
  )
);
```

### 3. Use Actions ao Invés de setState Direto

```typescript
// ✅ Bom: Use métodos de ação
const mostrarToast = useShowToast();
mostrarToast({ type: 'success', message: 'Feito!' });

// ❌ Evite: Mutação direta do estado
useUIStore.setState({ 
  toasts: [...useUIStore.getState().toasts, novoToast] 
});
```

### 4. Organize Estado Relacionado

```typescript
// ✅ Bom: Agrupe estado relacionado no mesmo store
interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  // Estado de UI relacionado junto
}

// ❌ Evite: Dividir estado relacionado entre stores
```

## 🔍 Debugging

### Integração com DevTools

Zustand integra automaticamente com Redux DevTools para debugging:

```typescript
// DevTools são habilitadas em desenvolvimento
import { useUIStore } from '@/store/ui-store';

// Visualize mudanças de estado na extensão Redux DevTools do navegador
```

### Inspeção do Estado do Store

```typescript
// Acesse o estado atual para debugging
const estadoAtual = useUIStore.getState();
console.log('Estado atual da UI:', estadoAtual);
```

## 📦 Persistência

### Persistência Automática

```typescript
// Certo estado é automaticamente persistido
const estadoPersistido = {
  theme: state.theme,                    // Preferências da UI
  sidebarCollapsed: state.sidebarCollapsed,
  locale: state.locale,                  // Preferência de idioma
  userPreferences: state.preferences     // Configurações do usuário
};
```

### Persistência Customizada

```typescript
// Adicione persistência customizada ao store
export const useCustomStore = create(
  persist(
    (set) => ({
      dadosCustomizados: null,
      setDadosCustomizados: (dados) => set({ dadosCustomizados: dados })
    }),
    {
      name: 'custom-store',
      partialize: (state) => ({ dadosCustomizados: state.dadosCustomizados })
    }
  )
);
```

## 🧪 Testes

### Testando Componentes com Stores

```typescript
import { renderWithProviders } from '@/test-utils';
import { useUIStore } from '@/store/ui-store';

test('componente atualiza quando tema muda', () => {
  const { getByText } = renderWithProviders(<MeuComponente />);
  
  // Aciona atualização do store
  act(() => {
    useUIStore.getState().setTheme('dark');
  });
  
  expect(getByText(/tema escuro/i)).toBeInTheDocument();
});
```

### Mockando Stores

```typescript
// Mock do store para testes
jest.mock('@/store', () => ({
  useTheme: () => 'light',
  useSetTheme: () => jest.fn(),
  useShowToast: () => jest.fn()
}));
```

## 🚨 Armadilhas Comuns

### 1. Performance de Seletor de Objeto

```typescript
// ❌ Ruim: Cria novo objeto a cada render
const estado = useStore(state => ({ a: state.a, b: state.b }));

// ✅ Bom: Use seletores individuais
const a = useStore(state => state.a);
const b = useStore(state => state.b);
```

### 2. Actions Assíncronas

```typescript
// ✅ Bom: Tratamento adequado de ação assíncrona
const adicionarNotificacaoAsync = async (mensagem: string) => {
  set(state => ({ isLoading: true }));
  try {
    await api.sendNotification(mensagem);
    set(state => ({ 
      notifications: [...state.notifications, novaNotificacao],
      isLoading: false 
    }));
  } catch (error) {
    set(state => ({ error, isLoading: false }));
  }
};
```

### 3. Inicialização do Store

```typescript
// ✅ Bom: Use ZustandProvider para inicialização
function App() {
  return (
    <ZustandProvider>
      <SeuApp />
    </ZustandProvider>
  );
}
```

## 📚 Referências

- [Documentação Zustand](https://github.com/pmndrs/zustand)
- [Melhores Práticas de Performance React](https://react.dev/learn/render-and-commit)
- [TypeScript com Zustand](https://github.com/pmndrs/zustand#typescript)
- [Exemplos de Gerenciamento de Estado](/src/components/StateManagement/Zustand.tsx)