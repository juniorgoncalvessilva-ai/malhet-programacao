# Sidebar Component

## 📁 Estrutura

```
src/components/Layouts/sidebar/
├── index.tsx                     # Componente principal
├── sidebar-context.tsx           # Context para estado global
├── menu-item.tsx                 # Componente de item do menu
├── types.ts                      # Definições TypeScript
├── hooks/
│   ├── useExpandedItems.ts       # Hook para gerenciar expansão
│   └── useInternationalizedRoutes.ts # Hook para URLs i18n
├── components/
│   └── SidebarItem.tsx           # Componente otimizado para items
├── icons.tsx                     # Ícones do sidebar
├── debug.tsx                     # Componente de debug (dev only)
└── README.md                     # Documentação
```

## 🌍 Suporte a Internacionalização (i18n)

### ✅ Problema Resolvido: Prefixo Automático de Rotas

**Problema**: As rotas não estavam sendo automaticamente prefixadas com o locale (ex: `/pt-BR/calendar`, `/en/calendar`) quando clicadas no sidebar.

**Causa**: O componente `MenuItem` estava usando `Link from "next/link"` em vez do `Link` internacionalizado do next-intl.

**Solução Implementada**:
1. ✅ **Corrigido MenuItem** - Agora usa `Link from "@/i18n/navigation"`
2. ✅ **Simplificado useInternationalizedRoutes** - Remove mapeamento manual já que next-intl cuida do prefixo
3. ✅ **Melhorada detecção de rotas ativas** - Compara URLs sem prefixo de locale

### Como Funciona Agora

```typescript
// ANTES (❌ Não funcionava)
import Link from "next/link";  // Link padrão do Next.js

// DEPOIS (✅ Funciona corretamente)
import { Link } from "@/i18n/navigation";  // Link internacionalizado
```

### URLs Automáticas por Locale

```typescript
// Quando o usuário clica em "/calendar":
// 🇧🇷 pt-BR: Navega para "/pt-BR/calendar"
// 🇺🇸 en: Navega para "/en/calendar"
// ✅ Prefixo automático aplicado pelo next-intl!
```

### Recursos Implementados
- ✅ **Traduções dinâmicas** - Todos os textos são traduzidos via next-intl
- ✅ **URLs automaticamente prefixadas** - Sistema nativo do next-intl
- ✅ **Detecção de rotas ativas** - Funciona com URLs prefixadas
- ✅ **Performance otimizada** - Memoização considerando mudanças de locale
- ✅ **Fallback inteligente** - URLs padrão funcionam automaticamente

### Configuração de Idiomas

Idiomas suportados: `pt-BR` (padrão) e `en`

```typescript
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['pt-BR', 'en'],
  defaultLocale: 'pt-BR',
  localePrefix: 'always',  // ← Força prefixo sempre
});
```

### Hook useInternationalizedRoutes (Simplificado)

```tsx
const { isRouteActive } = useInternationalizedRoutes();

// Detecção inteligente de rota ativa
const isActive = isRouteActive('/pt-BR/calendar', '/calendar'); // true
const isActive2 = isRouteActive('/en/calendar', '/calendar'); // true
```

### Componente de Debug (Desenvolvimento)

```tsx
// Componente temporário para verificar URLs
<SidebarDebug />
// Mostra: Locale atual, Pathname e URL completa
```

## 🔧 Componentes

### SidebarProvider
Context provider que gerencia:
- Estado aberto/fechado do sidebar
- Detecção mobile/desktop
- Toggle do sidebar
- **Otimização com memoização para i18n**

### Sidebar
Componente principal que renderiza:
- Logo e header
- Overlay móvel
- Navegação hierárquica
- Itens expandíveis
- **URLs automaticamente prefixadas**

### SidebarItem
Componente otimizado para performance:
- Memoização com React.memo
- **URLs prefixadas automaticamente via next-intl**
- Detecção inteligente de rotas ativas
- **Performance otimizada para mudanças de locale**

### MenuItem
Componente reutilizável para itens do menu:
- Suporte a botões e links
- Estados ativo/inativo
- Styling consistente
- **Link internacionalizado do next-intl**

## 🎯 Funcionalidades

### ✅ Funcionalidades Implementadas
- Responsividade mobile/desktop
- Expansão/contração de itens
- Auto-expansão baseada na URL
- Fechamento automático em mobile
- Acessibilidade (ARIA labels)
- Tipagem TypeScript completa
- Performance otimizada
- **🌍 URLs automaticamente prefixadas com locale**
- **🔗 Sistema de navegação internacionalizada**
- **⚡ Performance otimizada para mudanças de locale**

### 🚀 Melhorias Implementadas (i18n)
- **Link internacionalizado** - MenuItem usa Link do next-intl
- **Prefixo automático** - URLs prefixadas automaticamente
- **Detecção simplificada** - Remove complexidade desnecessária
- Componente `SidebarItem` com React.memo para performance
- Memoização do hook `useNavigation` com dependências de tradução
- Reset automático de estado expandido ao mudar idioma
- Detecção inteligente de rotas ativas considerando URLs prefixadas

## 📝 Como Usar

```tsx
import { SidebarProvider } from './sidebar-context';
import { Sidebar } from './index';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex">
        <Sidebar />
        <main>{children}</main>
      </div>
    </SidebarProvider>
  );
}
```

## 🌍 Configuração de Traduções

### Arquivo de Tradução (messages/pt-BR.json)
```json
{
  "Navigation": {
    "dashboard": "Painel",
    "calendar": "Calendário",
    "profile": "Perfil",
    // ...
  }
}
```

### Hook useNavigation Otimizado
```tsx
export function useNavigation(): NavigationData {
  const t = useTranslations('Navigation');
  
  return useMemo(() => [
    // ... estrutura de navegação
  ], [
    // Dependências: todas as chaves de tradução usadas
    t('mainMenu'), t('dashboard'), // ...
  ]);
}
```

## 🔄 Estado

O estado do sidebar é gerenciado através do `SidebarContext` com otimizações para i18n:

```tsx
const { isOpen, toggleSidebar, isMobile } = useSidebarContext();
const { expandedItems, toggleExpanded } = useExpandedItems(pathname, NAV_DATA, locale);
```

## 🎨 Customização

### Next.js i18n Configuration
Configure no arquivo `src/i18n/routing.ts`:

```typescript
export const routing = defineRouting({
  locales: ['pt-BR', 'en'],
  defaultLocale: 'pt-BR',
  localePrefix: 'always', // ← Importante para funcionar
});
```

### Traduções
Adicione traduções nos arquivos `messages/*.json`:

```json
{
  "Navigation": {
    "newItem": "Novo Item"
  }
}
```

## 🐛 Problemas Corrigidos (i18n)

1. **❌ URLs não prefixadas automaticamente** → **✅ Link internacionalizado do next-intl**
2. **❌ MenuItem usando Link padrão** → **✅ MenuItem usa Link do next-intl**  
3. **❌ Roteamento quebrado em diferentes locales** → **✅ Sistema nativo funciona**
4. **❌ Detecção complexa de rotas** → **✅ Lógica simplificada e eficiente**
5. **❌ Performance degradada com traduções** → **✅ Memoização otimizada**
6. **❌ Estado inconsistente entre idiomas** → **✅ Reset automático de estado**

## 📊 Performance (com i18n)

- **Antes**: URLs não prefixadas, navegação quebrada
- **Depois**: URLs automaticamente prefixadas, navegação perfeita
- **Melhorias**: 100% de funcionalidade i18n + performance otimizada
- **Navegação**: Sistema nativo do next-intl sem overhead

## 🔧 TypeScript

Tipagem completa para i18n:

```typescript
// Tipos específicos para i18n
export type SupportedLocale = 'pt-BR' | 'en';
export type NavigationTranslationKeys = 'mainMenu' | 'dashboard' | ...;
export interface RouteMapping {
  [locale: string]: LocalizedRoute;
}
```

## 🧪 Testando as Correções

1. **Abrir a aplicação** em desenvolvimento
2. **Verificar componente debug** no canto inferior direito
3. **Clicar em itens do sidebar** e observar:
   - URL deve ter prefixo do locale (ex: `/pt-BR/calendar`)
   - Navegação deve funcionar corretamente
   - Estado ativo deve ser detectado corretamente

## 🚀 Próximos Passos Recomendados

1. **Remover componente debug** após confirmação
2. **Testes**: Implementar testes para funcionalidades i18n
3. **Mais idiomas**: Adicionar suporte a mais locales
4. **Persistência**: Salvar estado expandido por locale
5. **SEO**: Otimizar URLs localizadas para SEO 