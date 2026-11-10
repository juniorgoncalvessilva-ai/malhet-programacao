# Gerenciamento de Estado com Zustand

O template utiliza [Zustand](https://zustand-demo.pmnd.rs/) como solução de gerenciamento de estado global, oferecendo uma alternativa simples, performática e TypeScript-friendly ao Redux.

## 🚀 Por que Zustand?

### Vantagens
- ✅ **Simples**: API minimalista e intuitiva
- ✅ **Performático**: Re-renders otimizados automaticamente
- ✅ **TypeScript**: Suporte nativo e completo
- ✅ **Sem Boilerplate**: Menos código que Redux
- ✅ **Flexível**: Não impõe padrões rígidos
- ✅ **SSR Ready**: Funciona com Next.js
- ✅ **DevTools**: Suporte ao Redux DevTools

### vs Redux
```typescript
// Redux - Muito boilerplate
const INCREMENT = 'INCREMENT';
const increment = () => ({ type: INCREMENT });
const counterReducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case INCREMENT: return { count: state.count + 1 };
    default: return state;
  }
};

// Zustand - Simples e direto
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

## 📁 Estrutura dos Stores

```
src/store/
├── index.ts              # Exports centralizados e hooks utilitários
├── types.ts              # Tipos TypeScript compartilhados
├── app-store.ts          # Estado global da aplicação
├── auth-store.ts         # Estado de autenticação
└── ui-store.ts           # Estado da interface (tema, modais, etc.)
```

## 🏪 Stores Implementados

### 1. App Store (`app-store.ts`)
Gerencia o estado principal da aplicação:

```typescript
interface AppStore {
  // Estado
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  preferences: AppPreferences;
  notifications: Notification[];
  sidebar: SidebarState;

  // Ações
  initializeApp: () => Promise<void>;
  setUser: (user: User | null) => void;
  updatePreferences: (updates: Partial<AppPreferences>) => void;
  addNotification: (notification: Notification) => void;
  // ... mais ações
}
```

**Uso:**
```typescript
import { useAppStore, useUser, usePreferences, useAuthUser } from '@/store';

function MyComponent() {
  // Seletor específico (otimizado)
  const user = useUser();
  
  // Múltiplos valores
  const { isLoading, error } = useAppStore((state) => ({
    isLoading: state.isLoading,
    error: state.error,
  }));
  
  // Ações
  const { setUser, addNotification } = useAppStore();
}
```

### 2. Auth Store (`auth-store.ts`)
Sincroniza com Clerk e gerencia autenticação:

```typescript
interface AuthStore {
  isLoading: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: UserData | null;
  session: SessionData | null;
  
  setAuth: (data: AuthData) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<UserData>) => void;
}
```

**Uso:**
```typescript
import { useAuth, useAuthActions } from '@/store';

function ProfileComponent() {
  const { user, isSignedIn } = useAuth();
  const { updateUser } = useAuthActions();
  
  if (!isSignedIn) return <LoginPrompt />;
  
  return <UserProfile user={user} onUpdate={updateUser} />;
}
```

### 3. UI Store (`ui-store.ts`)
Controla interface, tema e componentes visuais:

```typescript
interface UIStore {
  // Tema
  theme: 'light' | 'dark' | 'system';
  
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // Modais e Toasts
  modals: Modal[];
  toasts: Toast[];
  
  // Estados de loading
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;
  
  // Ações
  setTheme: (theme: ThemeType) => void;
  toggleSidebar: () => void;
  openModal: (modal: ModalConfig) => string;
  showToast: (toast: ToastConfig) => string;
  setLoading: (key: string, loading: boolean) => void;
}
```

**Uso:**
```typescript
import { useTheme, useUIActions, useLoading } from '@/store';

function Header() {
  const theme = useTheme();
  const { setTheme, toggleSidebar, showToast } = useUIActions();
  const isLoading = useLoading('api-call');
  
  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showToast({
      type: 'success',
      message: `Tema alterado para ${newTheme}`,
    });
  };
}
```

## 🔧 Configurações Avançadas

### Persistência com LocalStorage
Stores importantes persistem dados automaticamente:

```typescript
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ... store implementation
      })),
      {
        name: 'app-store',
        partialize: (state) => ({
          preferences: state.preferences,
          // Não persiste dados sensíveis
        }),
      }
    )
  )
);
```

### Immer para Immutabilidade
Usa Immer para mutações "diretas" mas imutáveis:

```typescript
// ❌ Sem Immer - complicado
addNotification: (notification) =>
  set((state) => ({
    ...state,
    notifications: [
      { ...notification, id: crypto.randomUUID() },
      ...state.notifications,
    ],
  })),

// ✅ Com Immer - simples
addNotification: (notification) =>
  set((state) => {
    state.notifications.unshift({
      ...notification,
      id: crypto.randomUUID(),
    });
  }),
```

### DevTools Integration
Configurado automaticamente em desenvolvimento:

```typescript
export const useAppStore = create<AppStore>()(
  devtools(
    // ... store config
    {
      name: 'app-store', // Nome no DevTools
    }
  )
);
```

## 🔄 Sincronização com Providers

### Store Provider
Sincroniza automaticamente com Clerk:

```typescript
// src/providers/store-provider.tsx
export function StoreProvider({ children }: StoreProviderProps) {
  const { user, isLoaded } = useUser();
  const { setAuth, clearAuth } = useAuthStore();
  
  useEffect(() => {
    if (isLoaded) {
      if (user) {
        setAuth({
          isSignedIn: true,
          userId: user.id,
          user: transformClerkUser(user),
        });
      } else {
        clearAuth();
      }
    }
  }, [user, isLoaded]);
  
  return <>{children}</>;
}
```

### Hooks de Sincronização
```typescript
// src/hooks/useStoreSync.ts
export function useMasterSync() {
  useStoreSync();      // Clerk ↔ Auth Store
  useThemeSync();      // Theme ↔ CSS Classes
  useSidebarSync();    // Sidebar ↔ Body Classes
  useScreenSizeSync(); // Window Size ↔ UI Store
}
```

## 📝 Padrões de Uso

### 1. Seletores Otimizados
```typescript
// ✅ Bom - seletor específico
const user = useUser();

// ✅ Bom - múltiplos valores relacionados
const { loading, error } = useAppStore((state) => ({
  loading: state.isLoading,
  error: state.error,
}));

// ❌ Ruim - seleciona todo o store
const store = useAppStore();
```

### 2. Ações Separadas
```typescript
// ✅ Bom - ações separadas
const { addNotification, removeNotification } = useAppActions();

// ❌ Ruim - mistura estado e ações
const { user, addNotification } = useAppStore();
```

### 3. Estados de Loading
```typescript
function DataComponent() {
  const { setLoading } = useUIActions();
  const isLoading = useLoading('fetch-data');
  
  const fetchData = async () => {
    setLoading('fetch-data', true);
    try {
      const data = await api.getData();
      // processar dados
    } finally {
      setLoading('fetch-data', false);
    }
  };
}
```

## 🧪 Debugging e DevTools

### Store Devtools Component
```typescript
import { StoreDevtools } from '@/components/Store/StoreDevtools';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <StoreDevtools /> {/* Apenas em desenvolvimento */}
    </>
  );
}
```

### Store State Viewer
```typescript
import { StoreStateViewer } from '@/components/Store/StoreDevtools';

export default function DebugPage() {
  return (
    <div>
      <h1>Debug Store State</h1>
      <StoreStateViewer />
    </div>
  );
}
```

## 🔄 Integração com APIs

### Pattern para APIs
```typescript
// Hook personalizado que usa store
export function useApiData(endpoint: string) {
  const [data, setData] = useState(null);
  const { setLoading, showToast } = useUIActions();
  
  const fetchData = async () => {
    setLoading(endpoint, true);
    try {
      const response = await fetch(endpoint);
      const result = await response.json();
      setData(result);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Erro ao carregar dados',
      });
    } finally {
      setLoading(endpoint, false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [endpoint]);
  
  return { data, refetch: fetchData };
}
```

### Notificações Automáticas
```typescript
const { addNotification } = useAppActions();

// Sucesso
const handleSuccess = (message: string) => {
  addNotification({
    type: 'success',
    title: 'Sucesso',
    message,
  });
};

// Erro
const handleError = (error: Error) => {
  addNotification({
    type: 'error',
    title: 'Erro',
    message: error.message,
  });
};
```

## 🚨 Boas Práticas

### 1. **Granularidade dos Stores**
- Um store por domínio (auth, ui, app)
- Não misture responsabilidades
- Mantenha stores pequenos e focados

### 2. **Seletores Performáticos**
```typescript
// ✅ Bom - shallow equality
const { name, email } = useAppStore((state) => ({
  name: state.user?.name,
  email: state.user?.email,
}));

// ❌ Ruim - deep equality
const user = useAppStore((state) => state.user);
```

### 3. **Ações Síncronas vs Assíncronas**
```typescript
// ✅ Síncrono - updates diretos
setUser: (user) => set({ user }),

// ✅ Assíncrono - side effects
initializeApp: async () => {
  set({ isLoading: true });
  try {
    const data = await api.init();
    set({ data, isLoading: false });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
},
```

### 4. **Não Persista Dados Sensíveis**
```typescript
persist(
  // ... store,
  {
    partialize: (state) => ({
      // ✅ Persiste preferências
      theme: state.theme,
      language: state.language,
      
      // ❌ NÃO persiste dados sensíveis
      // user: state.user,
      // session: state.session,
    }),
  }
)
```

## 🧪 Testes

### Testando Stores
```typescript
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/store';

describe('App Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: null,
      notifications: [],
    });
  });

  it('should add notification', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
    });
    
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Test message');
  });
});
```

### Mock em Testes
```typescript
// Mock do store para testes
jest.mock('@/store', () => ({
  useAppStore: () => ({
    user: { id: '1', name: 'Test User' },
    addNotification: jest.fn(),
  }),
}));
```

## 📚 Recursos Adicionais

### Links Úteis
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Zustand Recipes](https://github.com/pmndrs/zustand/wiki/Recipes)
- [Immer Guide](https://immerjs.github.io/immer/)

### Middlewares Utilizados
- **persist**: Persistência no localStorage
- **devtools**: Integração Redux DevTools
- **immer**: Mutações imutáveis

### Patterns Avançados
- **Slices**: Separar stores em partes menores
- **Subscriptions**: Reagir a mudanças específicas
- **Computed Values**: Valores derivados do estado

## 🎯 Próximos Passos

1. **Explore os stores**: Veja como são implementados
2. **Use os hooks**: Implemente em seus componentes
3. **Crie novos stores**: Para domínios específicos
4. **Teste com DevTools**: Debug o estado global
5. **Integre com APIs**: Use patterns recomendados

O Zustand oferece uma base sólida para gerenciamento de estado, mantendo a simplicidade sem sacrificar funcionalidades avançadas!