# 🎨 Components

Esta seção contém documentação sobre componentes de UI, design system e temas.

## 📋 Documentos Disponíveis

### [componentes.md](./componentes.md)
- Biblioteca completa de componentes
- Exemplos de uso e props
- Componentes de formulário
- Componentes de navegação
- Componentes de feedback

### [tema-estilos.md](./tema-estilos.md)
- Sistema de temas (claro/escuro)
- Configuração de cores e tipografia
- Responsive design
- Customização de estilos
- Guia de design system

## 🧩 Categorias de Componentes

### 📝 FormElements
- **Checkboxes** - 5 variações diferentes
- **DatePicker** - 2 tipos de seletores de data
- **InputGroup** - Grupos de inputs com labels
- **MultiSelect** - Seleção múltipla avançada
- **SelectGroup** - Grupos de seleção
- **Switchers** - 4 tipos de switches/toggles
- **Textarea** - Áreas de texto expansíveis

### 🧭 Layouts
- **Header** - Cabeçalho com notificações, tema e perfil
- **Sidebar** - Navegação lateral responsiva
- **Footer** - Rodapé da aplicação
- **AuthGuard** - Proteção de rotas

### 💬 UI Base
- **Alert** - Sistema de alertas
- **Badge** - Badges com múltiplas variantes
- **Button** - Botões customizados
- **Dialog** - Modais e diálogos
- **Dropdown** - Menus dropdown
- **Loading States** - Estados de carregamento (spinner, skeleton, empty, error)
- **Toast** - Sistema de notificações toast

### 📊 Charts
- **CampaignVisitors** - Gráfico de visitantes
- **PaymentsOverview** - Visão geral de pagamentos
- **UsedDevices** - Dispositivos utilizados
- **WeeksProfit** - Lucro semanal

### 📄 LandingPage
- **Hero** - Seção principal
- **Features** - Showcase de recursos
- **Pricing** - Tabela de preços
- **Testimonials** - Depoimentos de clientes

### 🔗 Integrações
- **WhatsApp** - Widget de contato flutuante
- **Notification** - Sistema real-time de notificações

## 🎨 Design System

### Cores
```css
/* Primary Colors */
--primary: 59 130 246; /* #3b82f6 - blue-500 */
--primary-foreground: 248 250 252;

/* Secondary Colors */
--secondary: 148 163 184;
--secondary-foreground: 15 23 42;

/* Status Colors */
--success: 34 197 94;
--warning: 251 191 36;
--error: 239 68 68;
--info: 59 130 246;
```

### Tipografia
- **Font Family**: Satoshi (custom), fallback sans-serif
- **Headings**: h1-h6 com escalas definidas
- **Body**: Tamanhos 14px (sm), 16px (base), 18px (lg)
- **Code**: JetBrains Mono, monospace

### Espaçamentos
- **Base**: 4px (0.25rem)
- **Escala**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Containers**: max-width responsivo

## 🔧 Como Usar Componentes

### Arquitetura Baseada em Radix UI
Os componentes base utilizam Radix UI para acessibilidade e comportamento, com estilização customizada via Tailwind CSS.

### Importação
```tsx
// Componentes UI base
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/alert';  // Usa index.tsx
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';  // Usa index.tsx

// Componentes de formulário
import { InputGroup } from '@/components/FormElements/InputGroup';
import { DatePickerOne } from '@/components/FormElements/DatePicker/DatePickerOne';
import { MultiSelect } from '@/components/FormElements/MultiSelect';

// Componentes de layout
import { NotificationComponent } from '@/components/Layouts/header/notification';
```

### Exemplos de Uso
```tsx
// Button com variantes
<Button 
  variant="primary" 
  size="small" 
  shape="rounded" 
  className="w-full"
  label="Botão Principal"
/>

// Alert com ícone
<Alert variant="success" title="Sucesso!">
  Operação realizada com sucesso.
</Alert>

// Badge com variante
<Badge variant="outline" className="ml-2">
  Novo
</Badge>

// InputGroup com validação
<InputGroup
  label="Email"
  type="email"
  placeholder="Digite seu email"
  required
  error={errors.email?.message}
/>
```

## 💡 Diretrizes de Desenvolvimento

### Princípios
- **Composição** - Prefira composição sobre configuração
- **Acessibilidade** - Utilize Radix UI primitives para garantir acessibilidade
- **Reutilização** - Componentes devem ser reutilizáveis e extensíveis
- **Consistência** - Siga o design system estabelecido
- **Performance** - Otimize re-renders com React.memo quando necessário

### Padrões
- **Variantes** - Use className variants para diferentes estilos
- **Props Interface** - Defina interfaces TypeScript claras
- **Forwarding Refs** - Implemente forwardRef para componentes wrapper
- **Slot Pattern** - Use children como slots quando apropriado

### Estrutura
```tsx
// Estrutura recomendada para componentes
interface ComponentProps {
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

export const Component = forwardRef<HTMLElement, ComponentProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => {
    return (
      <element
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </element>
    );
  }
);
```

## 🔗 Próximos Passos

Para trabalhar com componentes:
- **[Features](../05-features/)** - Integre funcionalidades
- **[Development](../03-development/)** - Práticas de desenvolvimento
- Explore componentes existentes antes de criar novos