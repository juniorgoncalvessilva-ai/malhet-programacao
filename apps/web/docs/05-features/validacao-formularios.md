# 📝 Sistema de Validação de Formulários

Este documento detalha o sistema completo de validação de formulários implementado no AI Coders Starter Kit, construído com **Zod** e **React Hook Form**.

## 🎯 Visão Geral

O sistema de validação oferece uma solução type-safe, performática e amigável ao usuário para todos os formulários da aplicação, com funcionalidades específicas para o mercado brasileiro.

### Tecnologias Utilizadas
- **Zod**: Schema validation e type inference
- **React Hook Form**: Gerenciamento de formulários performático
- **TypeScript**: Type safety completo
- **Tailwind CSS**: Estilos responsivos e dark mode
- **ViaCEP API**: Consulta automática de endereços brasileiros

## 🏗️ Arquitetura

### Estrutura de Pastas
```
src/
├── schemas/
│   ├── form-schemas.ts     # Schemas Zod para validação
│   └── index.ts           # Exports centralizados
├── hooks/
│   ├── useFormValidation.ts # Hook principal de validação
│   ├── useCepLookup.ts     # Hook para consulta CEP
│   └── index.ts           # Exports centralizados
├── types/
│   ├── form-types.ts      # Tipos derivados dos schemas
│   └── index.ts          # Exports centralizados
└── components/FormElements/enhanced/
    ├── ValidatedInput.tsx  # Input com validação
    ├── FormInput.tsx      # Wrapper para integração
    ├── AddressForm.tsx    # Formulário de endereço completo
    └── index.ts          # Exports centralizados
```

## 🔧 Componentes Principais

### 1. Hook useFormValidation

O hook principal que integra Zod com React Hook Form:

```typescript
const form = useFormValidation<UserRegistrationFormData>({
  schema: userRegistrationSchema,
  defaultValues: {
    name: "",
    email: "",
    phone: ""
  },
  validationConfig: {
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300
  },
  onSubmit: async (data) => {
    // Dados validados automaticamente
    console.log(data);
  },
  onError: (errors) => {
    // Tratar erros de validação
    console.log(errors);
  }
});
```

**Funcionalidades:**
- ✅ Validação em tempo real com debounce
- ✅ Estado de formulário reativo
- ✅ Métodos para manipular campos individuais
- ✅ Integração automática com schemas Zod
- ✅ Handlers otimizados para performance

### 2. Componente ValidatedInput

Input avançado com feedback visual completo:

```typescript
<ValidatedInput
  name="email"
  label="Email"
  type="email"
  placeholder="seu@email.com"
  value={value}
  onChange={onChange}
  onBlur={onBlur}
  error={error}
  validationState={validationState}
  helpText="Digite um email válido"
  showValidationIcon={true}
  showValidationStates={true}
/>
```

**Estados Visuais:**
- 🔍 **Loading**: Ícone de spinner durante validação assíncrona
- ✅ **Válido**: Borda verde + ícone de check
- ❌ **Erro**: Borda vermelha + ícone de erro + mensagem
- 📝 **Modificado**: Indicador de campo alterado
- 👆 **Tocado**: Estado de interação do usuário

### 3. Componente FormInput

Wrapper simplificado que conecta automaticamente com o contexto do formulário:

```typescript
<FormInput
  name="email"
  label="Email"
  formContext={form}
  helpText="Digite um email válido"
/>
```

### 4. Hook useCepLookup

Hook especializado para consulta automática de CEP via API ViaCEP:

```typescript
const cepLookup = useCepLookup({
  onSuccess: (addressData) => {
    // Preencher campos automaticamente
    form.setValue('street', addressData.street);
    form.setValue('city', addressData.city);
  },
  onError: (error) => {
    console.warn('CEP não encontrado:', error);
  },
  debounceMs: 800
});

// Consultar CEP
await cepLookup.lookupCep('01310-100');
```

**Funcionalidades:**
- ✅ Validação de formato CEP brasileiro
- ✅ Normalização automática de dados
- ✅ Cache para evitar consultas repetidas
- ✅ Debounce configurável
- ✅ Estados de loading/error/success
- ✅ Fallback para preenchimento manual

### 5. Componente AddressForm

Formulário completo de endereço com consulta automática de CEP:

```typescript
<AddressForm
  title="Endereço de Entrega"
  submitButtonText="Salvar Endereço"
  onSubmit={async (data) => {
    // Dados validados do endereço
    console.log(data);
  }}
  autoFillFromCep={true}
  defaultValues={{
    country: "Brasil"
  }}
/>
```

**Funcionalidades:**
- 🔍 **Consulta automática**: Digite CEP e veja o preenchimento
- 📱 **Layout responsivo**: Grid adaptativo para diferentes telas
- ✅ **Validação completa**: Todos os campos validados
- 🎨 **Feedback visual**: Indicadores de status da consulta
- 🧹 **Reset fácil**: Botão para limpar formulário

## 🇧🇷 Validações Brasileiras

### CPF (Cadastro de Pessoa Física)
```typescript
const cpfSchema = z.string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Formato: 000.000.000-00")
  .refine(validateCpfDigits, "CPF inválido");
```

### CNPJ (Cadastro Nacional de Pessoa Jurídica)
```typescript
const cnpjSchema = z.string()
  .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "Formato: 00.000.000/0000-00")
  .refine(validateCnpjDigits, "CNPJ inválido");
```

### CEP (Código de Endereçamento Postal)
```typescript
const cepSchema = z.string()
  .regex(/^\d{5}-\d{3}$/, "Formato: 00000-000");
```

### Telefone Brasileiro
```typescript
const phoneSchema = z.string()
  .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, "Formato: (11) 99999-9999");
```

## 📋 Schemas Disponíveis

### 1. Schema de Cadastro de Usuário
```typescript
const userRegistrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: phoneValidation,
  birthDate: z.date().max(new Date(), "Data não pode ser futura"),
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val, "Aceite os termos")
}).refine(data => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"]
});
```

### 2. Schema de Endereço
```typescript
const addressSchema = z.object({
  cep: cepValidation,
  street: z.string().min(5, "Logradouro muito curto"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro muito curto"),
  city: z.string().min(2, "Cidade muito curta"),
  state: z.string().length(2, "Estado deve ter 2 caracteres"),
  country: z.string().min(2, "País muito curto")
});
```

### 3. Schema de Senha Forte
```typescript
const passwordSchema = z.string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Deve conter letra maiúscula")
  .regex(/[a-z]/, "Deve conter letra minúscula")
  .regex(/\d/, "Deve conter número")
  .regex(/[^A-Za-z0-9]/, "Deve conter caractere especial");
```

## 🎨 Personalização e Temas

### Dark Mode
Todos os componentes suportam automaticamente dark mode via Tailwind CSS:

```typescript
className={cn(
  "border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark",
  hasError && "border-red-500 dark:border-red-400"
)}
```

### Estados Visuais Customizáveis
```typescript
const getInputClasses = () => {
  if (hasError) {
    return "border-red-500 focus:border-red-500 ring-red-500/20";
  }
  if (isValid) {
    return "border-green-500 focus:border-green-500 ring-green-500/20";
  }
  return "border-stroke focus:border-primary";
};
```

## 🚀 Exemplos de Uso

### Formulário Básico
```typescript
// 1. Definir schema
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória")
});

// 2. Usar hook
const form = useFormValidation({
  schema: loginSchema,
  onSubmit: async (data) => {
    await login(data);
  }
});

// 3. Renderizar formulário
<form onSubmit={form.handleSubmit}>
  <FormInput name="email" label="Email" formContext={form} />
  <FormInput name="password" label="Senha" type="password" formContext={form} />
  <button type="submit" disabled={!form.formState.isValid}>
    Entrar
  </button>
</form>
```

### Formulário com CEP Automático
```typescript
<AddressForm
  onSubmit={async (addressData) => {
    // addressData já vem validado e tipado
    await saveAddress(addressData);
  }}
  onError={(errors) => {
    // Tratar erros específicos
    console.log('Erros de validação:', errors);
  }}
  defaultValues={{
    country: "Brasil",
    state: "SP"
  }}
  autoFillFromCep={true}
/>
```

### Validação Customizada
```typescript
const customSchema = z.object({
  username: z.string()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e underscore")
    .refine(async (username) => {
      // Validação assíncrona
      const available = await checkUsernameAvailability(username);
      return available;
    }, "Nome de usuário já existe")
});
```

## 📊 Performance e Otimizações

### Debounce Inteligente
```typescript
// Validação com debounce para evitar consultas excessivas
const config = {
  validateOnChange: true,
  debounceMs: 300,  // 300ms para validação
  cepDebounceMs: 800 // 800ms para consulta CEP
};
```

### Cache de Consultas
```typescript
// Cache automático de CEPs consultados
const cepCache = new Map<string, AddressData>();

if (cepCache.has(cleanCep)) {
  return cepCache.get(cleanCep);
}
```

### Lazy Loading de Validações
```typescript
// Validações assíncronas apenas quando necessário
const asyncValidate = useCallback(
  debounce(async (value) => {
    const result = await expensiveValidation(value);
    return result;
  }, 500),
  []
);
```

## 🧪 Testes

### Testando Schemas
```typescript
import { userRegistrationSchema } from '@/schemas';

describe('userRegistrationSchema', () => {
  it('should validate correct user data', () => {
    const validData = {
      name: "João Silva",
      email: "joao@email.com",
      phone: "(11) 99999-9999",
      birthDate: new Date('1990-01-01'),
      password: "MinhaSenh@123",
      confirmPassword: "MinhaSenh@123",
      acceptTerms: true
    };

    const result = userRegistrationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
```

### Testando Hook de CEP
```typescript
import { renderHook, act } from '@testing-library/react';
import { useCepLookup } from '@/hooks/useCepLookup';

describe('useCepLookup', () => {
  it('should fetch address for valid CEP', async () => {
    const { result } = renderHook(() => useCepLookup());

    await act(async () => {
      const address = await result.current.lookupCep('01310-100');
      expect(address?.city).toBe('São Paulo');
    });
  });
});
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente
```env
# .env.local
NEXT_PUBLIC_VIACEP_API_URL=https://viacep.com.br/ws/
NEXT_PUBLIC_ENABLE_CEP_LOOKUP=true
NEXT_PUBLIC_FORM_DEBUG_MODE=false
```

### Configuração Global
```typescript
// src/config/forms.ts
export const formConfig = {
  validation: {
    debounceMs: process.env.NODE_ENV === 'development' ? 100 : 300,
    showDebugInfo: process.env.NEXT_PUBLIC_FORM_DEBUG_MODE === 'true'
  },
  cep: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_CEP_LOOKUP === 'true',
    apiUrl: process.env.NEXT_PUBLIC_VIACEP_API_URL,
    timeoutMs: 5000
  }
};
```

## 🎯 Melhores Práticas

### 1. Sempre Use TypeScript
```typescript
// ✅ Correto - tipado
const form = useFormValidation<UserFormData>({
  schema: userSchema,
  onSubmit: (data: UserFormData) => { ... }
});

// ❌ Incorreto - sem tipos
const form = useFormValidation({
  schema: userSchema,
  onSubmit: (data: any) => { ... }
});
```

### 2. Schemas Reutilizáveis
```typescript
// ✅ Correto - schemas modulares
const emailField = z.string().email("Email inválido");
const passwordField = z.string().min(8, "Mínimo 8 caracteres");

const loginSchema = z.object({
  email: emailField,
  password: passwordField
});

const registrationSchema = z.object({
  email: emailField,
  password: passwordField,
  confirmPassword: z.string()
}).refine(/* ... */);
```

### 3. Mensagens de Erro Consistentes
```typescript
// ✅ Correto - mensagens claras
const schema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome não pode exceder 50 caracteres"),
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Digite um email válido")
});
```

### 4. Acessibilidade
```typescript
<ValidatedInput
  name="email"
  label="Email"
  // ✅ ARIA apropriado
  aria-describedby={error ? `${name}-error` : undefined}
  aria-invalid={!!error}
  // ✅ Estrutura semântica
  required={isRequired}
/>
```

## 🔄 Roadmap

### Próximas Funcionalidades
- [ ] ValidatedSelect component
- [ ] ValidatedTextArea component
- [ ] FormProvider context
- [ ] Validação de upload de arquivos
- [ ] Integração com react-query para validações assíncronas
- [ ] Suporte a formulários wizard/multi-step
- [ ] Temas customizáveis via CSS variables

### Melhorias Planejadas
- [ ] Cache persistente para consultas CEP
- [ ] Suporte offline para validações
- [ ] Métricas de performance
- [ ] Tradução automática de mensagens de erro
- [ ] Integração com analytics para tracking de erros

---

## 📚 Recursos Adicionais

- [Documentação do Zod](https://zod.dev/)
- [React Hook Form Docs](https://react-hook-form.com/)
- [API ViaCEP](https://viacep.com.br/)
- [Tailwind CSS](https://tailwindcss.com/)

Para mais exemplos e documentação detalhada, acesse `/forms/validated-forms` na aplicação em execução.