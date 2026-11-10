# Diagramas Mermaid da Aplicação

## 📋 Visão Geral

Este documento contém todos os diagramas Mermaid da aplicação organizados por categoria. Estes diagramas ajudam a visualizar a arquitetura, fluxos e relacionamentos entre os componentes da aplicação.

## 🏗️ Arquitetura da Aplicação

### Diagrama de Arquitetura Geral
```mermaid
graph TB
    subgraph "Frontend - Next.js 15"
        A[App Router] --> B[Páginas]
        A --> C[Componentes]
        A --> D[Hooks]
        
        B --> B1[Dashboard]
        B --> B2[Auth]
        B --> B3[Profile]
        B --> B4[Tables]
        
        C --> C1[UI Components]
        C --> C2[Layout Components]
        C --> C3[Chart Components]
        C --> C4[Form Components]
    end
    
    subgraph "Styling & Theme"
        E[Tailwind CSS]
        F[next-themes]
        G[CSS Variables]
    end
    
    subgraph "Internacionalização"
        H[next-intl]
        I[Messages PT-BR]
        J[Messages EN]
    end
    
    subgraph "Autenticação"
        K[Clerk Provider]
        L[Auth Guard]
        M[OAuth Providers]
    end
    
    subgraph "Data & Services"
        N[Chart Services]
        O[User Services]
        P[API Client]
    end
    
    A --> E
    A --> H
    A --> K
    A --> N
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style K fill:#10b981,stroke:#059669,color:#fff
    style H fill:#f59e0b,stroke:#d97706,color:#fff
    style E fill:#8b5cf6,stroke:#7c3aed,color:#fff
```

### Fluxo de Roteamento
```mermaid
flowchart TD
    A[Usuário acessa URL] --> B{Middleware}
    B --> C{Locale detectado?}
    C -->|Não| D[Detectar locale do navegador]
    C -->|Sim| E{Usuário autenticado?}
    D --> E
    E -->|Não| F{Rota pública?}
    E -->|Sim| G[Carregar página]
    F -->|Sim| G
    F -->|Não| H[Redirecionar para login]
    G --> I[Renderizar componente]
    H --> J[Página de login]
    J --> K[Após autenticação] --> L[Redirecionar para rota original]
    
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style F fill:#f59e0b,stroke:#d97706,color:#fff
```

## 🔐 Autenticação

### Fluxo de Autenticação
```mermaid
sequenceDiagram
    participant U as Usuário
    participant M as Middleware
    participant C as Clerk
    participant A as App
    participant G as Auth Guard
    
    U->>A: Acessa rota protegida
    A->>M: Intercepta request
    M->>C: Verifica token
    
    alt Token válido
        C->>M: Token OK
        M->>A: Permitir acesso
        A->>G: Componente protegido
        G->>U: Renderiza página
    else Token inválido/ausente
        C->>M: Token inválido
        M->>U: Redireciona para /auth/sign-in
        U->>C: Faz login
        C->>U: Retorna token
        U->>A: Acessa rota novamente
        A->>U: Sucesso
    end
```

### OAuth Flow
```mermaid
sequenceDiagram
    participant U as Usuário
    participant C as Clerk
    participant O as OAuth Provider
    participant A as App
    
    U->>C: Clica "Login com Google"
    C->>O: Redireciona para OAuth
    O->>U: Solicita permissões
    U->>O: Autoriza
    O->>C: Retorna código
    C->>O: Troca código por token
    O->>C: Retorna user data
    C->>A: Callback com usuário
    A->>U: Login completo
```

### Diagrama de Proteção de Rotas
```mermaid
flowchart TD
    A[Request] --> B{Middleware}
    B --> C{Rota pública?}
    C -->|Sim| D[Permitir acesso]
    C -->|Não| E{Token válido?}
    E -->|Sim| F[Verificar permissões]
    E -->|Não| G[Redirecionar login]
    F --> H{Permissão OK?}
    H -->|Sim| I[Acessar página]
    H -->|Não| J[Access Denied]
    G --> K[Página de login]
    K --> L[Após auth] --> M[Redirect original]
    
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style H fill:#f59e0b,stroke:#d97706,color:#fff
    style G fill:#ef4444,stroke:#dc2626,color:#fff
```

## 🌍 Internacionalização

### Fluxo de Internacionalização
```mermaid
flowchart TD
    A[Request] --> B{Middleware i18n}
    B --> C{Locale na URL?}
    C -->|Não| D[Detectar locale navegador]
    C -->|Sim| E[Extrair locale]
    D --> F[Redirecionar com locale]
    E --> G{Locale suportado?}
    F --> G
    G -->|Não| H[Usar locale padrão pt-BR]
    G -->|Sim| I[Carregar mensagens]
    H --> I
    I --> J[Definir locale no contexto]
    J --> K[Renderizar página]
    K --> L[Aplicar traduções]
    
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style G fill:#f59e0b,stroke:#d97706,color:#fff
    style I fill:#10b981,stroke:#059669,color:#fff
```

### Estrutura de Mensagens
```mermaid
graph LR
    A[messages/] --> B[pt-BR.json]
    A --> C[en.json]
    
    B --> D[navigation]
    B --> E[auth]
    B --> F[common]
    B --> G[dashboard]
    
    C --> H[navigation]
    C --> I[auth]
    C --> J[common]
    C --> K[dashboard]
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style B fill:#10b981,stroke:#059669,color:#fff
    style C fill:#ef4444,stroke:#dc2626,color:#fff
```

## 🎨 Componentes

### Hierarquia de Componentes
```mermaid
graph TD
    A[App Layout] --> B[Header]
    A --> C[Sidebar]
    A --> D[Main Content]
    
    B --> B1[Logo]
    B --> B2[Navigation]
    B --> B3[User Info]
    B --> B4[Theme Toggle]
    B --> B5[Language Switcher]
    
    C --> C1[Menu Items]
    C --> C2[Sidebar Context]
    
    D --> D1[Page Component]
    D1 --> D2[Auth Guard]
    D2 --> D3[Page Content]
    
    D3 --> E[UI Components]
    E --> E1[Charts]
    E --> E2[Tables]
    E --> E3[Forms]
    E --> E4[Cards]
    E --> E5[Badge]
    E --> E6[Spinner]
    E --> E7[Toast]
    
    style A fill:#3b82f6,stroke:#1e40af,color:#fff
    style D2 fill:#10b981,stroke:#059669,color:#fff
    style E fill:#f59e0b,stroke:#d97706,color:#fff
```

### Arquitetura de Componentes
```mermaid
graph LR
    A[Primitivos UI] --> B[Componentes Base]
    B --> C[Componentes Compostos]
    C --> D[Layouts]
    D --> E[Páginas]
    
    A1[Button] --> A
    A2[Input] --> A
    A3[Card] --> A
    A4[Badge] --> A
    A5[Spinner] --> A
    A6[Toast] --> A
    
    B1[Form Elements] --> B
    B2[Chart Base] --> B
    B3[Table Base] --> B
    
    C1[Contact Form] --> C
    C2[Chart Widgets] --> C
    C3[Data Tables] --> C
    
    D1[Header] --> D
    D2[Sidebar] --> D
    D3[Auth Guard] --> D
    
    style A fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style B fill:#3b82f6,stroke:#1e40af,color:#fff
    style C fill:#10b981,stroke:#059669,color:#fff
    style D fill:#f59e0b,stroke:#d97706,color:#fff
    style E fill:#ef4444,stroke:#dc2626,color:#fff
```

## 📊 Fluxo de Dados

### Fluxo de Data Fetching
```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant S as Server Action
    participant DB as Database
    participant Clerk as Clerk
    
    U->>C: Interage com form
    C->>S: Chama server action
    S->>Clerk: Verifica auth
    Clerk->>S: Usuário autenticado
    S->>DB: Atualiza dados
    DB->>S: Confirma update
    S->>S: revalidatePath()
    S->>C: Retorna resultado
    C->>U: Atualiza UI
```

### Data Flow Patterns
```mermaid
graph TD
    A[User Input] --> B{Client vs Server?}
    B -->|Client| C[useState/useReducer]
    B -->|Server| D[Server Actions]
    
    C --> E[Local State]
    D --> F[Database]
    F --> G[Revalidation]
    G --> H[Fresh Data]
    
    E --> I[UI Update]
    H --> I
    
    style D fill:#10b981,stroke:#059669,color:#fff
    style C fill:#3b82f6,stroke:#1e40af,color:#fff
    style F fill:#f59e0b,stroke:#d97706,color:#fff
```

## 🚀 Deploy

### Fluxo de Deploy
```mermaid
gitGraph
    commit id: "Feature Start"
    branch feature/new-component
    checkout feature/new-component
    commit id: "Add component"
    commit id: "Add tests"
    checkout main
    merge feature/new-component
    commit id: "Deploy trigger"
    commit id: "Production" type: HIGHLIGHT
```

### Pipeline de CI/CD
```mermaid
flowchart TD
    A[Push to main] --> B[GitHub Actions]
    B --> C[Install Dependencies]
    C --> D[Run Tests]
    D --> E[Type Check]
    E --> F[Linting]
    F --> G{All checks pass?}
    G -->|No| H[❌ Build Failed]
    G -->|Yes| I[Build App]
    I --> J[Deploy to Vercel]
    J --> K[✅ Production]
    
    K --> L[Health Check]
    L --> M[Notify Team]
    
    style G fill:#f59e0b,stroke:#d97706,color:#fff
    style H fill:#ef4444,stroke:#dc2626,color:#fff
    style K fill:#10b981,stroke:#059669,color:#fff
```

## 📱 User Journey

### Jornada do Usuário
```mermaid
journey
    title Jornada do Usuário no Dashboard
    section Acesso
      Visita o site: 5: User
      Detecta idioma: 3: System
      Redireciona para login: 2: System
    section Autenticação
      Escolhe OAuth: 4: User
      Autoriza no Google: 5: User
      Retorna autenticado: 5: User, System
    section Dashboard
      Visualiza métricas: 5: User
      Interage com gráficos: 4: User
      Navega entre páginas: 4: User
    section Configurações
      Acessa perfil: 3: User
      Altera idioma: 5: User
      Salva configurações: 4: User
```

### Estados da Aplicação
```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Unauthenticated: No token
    Loading --> Authenticated: Valid token
    
    Unauthenticated --> SignIn: Navigate to login
    SignIn --> Authenticating: Submit credentials
    Authenticating --> Authenticated: Success
    Authenticating --> SignIn: Error
    
    Authenticated --> Dashboard: Default route
    Dashboard --> Profile: Navigate
    Dashboard --> Settings: Navigate
    Dashboard --> Tables: Navigate
    Dashboard --> Charts: Navigate
    
    Profile --> Dashboard: Back
    Settings --> Dashboard: Back
    Tables --> Dashboard: Back
    Charts --> Dashboard: Back
    
    Authenticated --> [*]: Sign out
```

## 🔄 Lifecycle Diagrams

### Component Lifecycle
```mermaid
sequenceDiagram
    participant B as Browser
    participant R as Router
    participant M as Middleware
    participant C as Component
    participant S as State
    
    B->>R: Navigate to page
    R->>M: Check authentication
    M->>R: Authorized
    R->>C: Mount component
    C->>S: Initialize state
    S->>C: State ready
    C->>B: Render UI
    
    Note over B,C: User interactions
    B->>C: User input
    C->>S: Update state
    S->>C: State changed
    C->>B: Re-render
    
    B->>R: Navigate away
    R->>C: Unmount component
    C->>S: Cleanup
```

### Theme Switch Flow
```mermaid
sequenceDiagram
    participant U as User
    participant T as ThemeToggle
    participant P as ThemeProvider
    participant D as Document
    participant S as Storage
    
    U->>T: Click theme toggle
    T->>P: setTheme('dark')
    P->>D: Add class='dark'
    P->>S: Save to localStorage
    D->>U: Apply dark styles
    
    Note over U: Page reload
    P->>S: Read from localStorage
    S->>P: theme='dark'
    P->>D: Apply saved theme
```

## 📋 Como Usar os Diagramas

### Visualização
- **GitHub/GitLab**: Os diagramas são renderizados automaticamente
- **VSCode**: Use a extensão "Mermaid Preview"
- **Online**: Cole o código no [Mermaid Live Editor](https://mermaid.live/)

### Edição
1. Copie o código do diagrama
2. Cole no editor Mermaid
3. Edite conforme necessário
4. Atualize a documentação

### Sintaxe Mermaid
- **Flowchart**: `flowchart TD` ou `graph TD`
- **Sequence**: `sequenceDiagram`
- **GitGraph**: `gitGraph`
- **Journey**: `journey`
- **State**: `stateDiagram-v2`

### Cores Personalizadas
```
style NodeId fill:#3b82f6,stroke:#1e40af,color:#fff
```
- **Azul**: `#3b82f6` (Primary)
- **Verde**: `#10b981` (Success)
- **Amarelo**: `#f59e0b` (Warning)
- **Vermelho**: `#ef4444` (Error)
- **Roxo**: `#8b5cf6` (Secondary)