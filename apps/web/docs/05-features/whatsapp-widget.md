# Widget WhatsApp - Botão Flutuante com Formulário

## Visão Geral

O Widget WhatsApp é um componente de botão flutuante que simula uma conversa do WhatsApp para coletar informações de contato dos visitantes da landing page. O componente coleta nome e telefone através de uma interface de chat e envia os dados para webhooks externos.

## Componentes

### 1. WhatsAppFloat Component
- **Localização**: `src/app/[locale]/landing/_components/whatsapp-float.tsx`
- **Funcionalidade**: Botão flutuante verde com modal de chat simulado
- **Integração**: Incluído automaticamente na landing page

### 2. API Backend
- **Endpoint**: `/api/whatsapp-contact`
- **Funcionalidade**: Recebe dados do formulário e encaminha para webhooks externos
- **Localização**: `src/app/api/whatsapp-contact/route.ts`

## Fluxo de Funcionamento

1. **Usuário clica no botão flutuante** verde no canto inferior direito
2. **Modal de chat abre** simulando interface do WhatsApp
3. **Conversa guiada** coleta informações:
   - Mensagem de boas-vindas
   - Coleta do nome
   - Coleta do telefone
   - Confirmação de envio
4. **Dados são enviados** para API interna
5. **API encaminha** para webhook externo (n8n, Zapier, Make.com, etc.)
6. **Webhook processa** e envia para CRM/sistema final

## Configuração

### Propriedades do Componente

```tsx
<WhatsAppFloat 
  endpoint="/api/whatsapp-contact"           // API endpoint (padrão)
  businessName="Sua Empresa"                // Nome exibido no chat
  welcomeMessage="Olá! Como podemos ajudar?" // Mensagem inicial
/>
```

### Variáveis de Ambiente

Adicione no arquivo `.env.local`:

```env
# Configuração da API WhatsApp
WHATSAPP_FORWARD_ENABLED=true
WHATSAPP_FORWARD_URL=https://seu-webhook.com/api/contatos
WHATSAPP_API_KEY=sua_chave_api_aqui
WHATSAPP_PAYLOAD_TRANSFORM=webhook
```

#### Variáveis Disponíveis

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|---------|
| `WHATSAPP_FORWARD_ENABLED` | Abilita encaminhamento para serviço externo | Não | `false` |
| `WHATSAPP_FORWARD_URL` | URL do webhook externo | Não | - |
| `WHATSAPP_API_KEY` | Chave de autenticação | Não | - |
| `WHATSAPP_CUSTOM_HEADERS` | Cabeçalhos customizados (JSON) | Não | - |
| `WHATSAPP_PAYLOAD_TRANSFORM` | Tipo de transformação do payload | Não | `default` |
| `WHATSAPP_CUSTOM_TRANSFORM` | Template de transformação customizado | Não | - |

## Tipos de Transformação de Payload

### 1. Padrão (`default`)
Envia o payload original:
```json
{
  "name": "João Silva",
  "phone": "+5511999999999",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2. Webhook (`webhook`)
Formato para serviços de webhook:
```json
{
  "event": "whatsapp_contact",
  "data": {
    "contact": {
      "name": "João Silva",
      "phone": "+5511999999999"
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "source": "landing_page"
  }
}
```

### 3. CRM (`crm`)
Formato para sistemas de CRM:
```json
{
  "lead": {
    "firstName": "João",
    "lastName": "Silva",
    "phone": "+5511999999999",
    "source": "WhatsApp Widget",
    "tags": ["whatsapp", "landing-page"]
  },
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### 4. Customizado (`custom`)
Usa template personalizado com placeholders:
- `{{name}}` - Nome do contato
- `{{phone}}` - Telefone do contato
- `{{timestamp}}` - Data/hora do envio

## Configurações para Plataformas Populares

### n8n
```env
WHATSAPP_FORWARD_ENABLED=true
WHATSAPP_FORWARD_URL=https://sua-instancia-n8n.com/webhook/lead-whatsapp
WHATSAPP_PAYLOAD_TRANSFORM=webhook
```

### Zapier
```env
WHATSAPP_FORWARD_ENABLED=true
WHATSAPP_FORWARD_URL=https://hooks.zapier.com/hooks/catch/123456/abcdef/
WHATSAPP_PAYLOAD_TRANSFORM=webhook
```

### Make.com (Integromat)
```env
WHATSAPP_FORWARD_ENABLED=true
WHATSAPP_FORWARD_URL=https://hook.eu1.make.com/abc123def456
WHATSAPP_PAYLOAD_TRANSFORM=webhook
```

### Webhook Customizado
```env
WHATSAPP_FORWARD_ENABLED=true
WHATSAPP_FORWARD_URL=https://sua-api.com/leads
WHATSAPP_API_KEY=sua_chave_secreta
WHATSAPP_PAYLOAD_TRANSFORM=custom
WHATSAPP_CUSTOM_TRANSFORM={"cliente": {"nome": "{{name}}", "telefone": "{{phone}}"}, "origem": "widget_whatsapp"}
WHATSAPP_CUSTOM_HEADERS={"Authorization": "Bearer sua_chave", "X-Source": "landing-page"}
```

## Características Técnicas

### Interface do Usuário
- **Design responsivo** adaptado para mobile e desktop
- **Modo escuro** compatível com tema da aplicação
- **Animações suaves** para melhor experiência do usuário
- **Estados de loading** durante envio dos dados
- **Validação de campos** em tempo real

### Segurança
- **Validação de entrada** para nome e telefone
- **Sanitização de dados** antes do envio
- **Logs de segurança** para monitoramento
- **Tratamento de erros** robusto
- **Rate limiting** implícito através do fluxo de conversa

### Performance
- **Lazy loading** do modal até ser necessário
- **Otimização de bundle** com imports dinâmicos
- **Cache de configurações** no servidor
- **Fallback gracioso** em caso de erro de rede

## Monitoramento e Debug

### Logs do Servidor
A API registra automaticamente:
- Tentativas de envio de contato
- Sucessos/falhas no encaminhamento
- Erros de validação
- Configurações ativas

### Teste da Configuração
Verifique se a API está configurada corretamente:

```bash
curl -X GET http://localhost:3000/api/whatsapp-contact
```

Resposta esperada:
```json
{
  "service": "WhatsApp Contact API",
  "status": "active",
  "config": {
    "forwardingEnabled": true,
    "hasForwardUrl": true,
    "hasApiKey": true
  }
}
```

## Personalização

### Modificar Mensagens
Edite as mensagens no componente `WhatsAppFloat`:

```tsx
const getCurrentMessage = () => {
  switch (currentStep) {
    case 'welcome':
      return "Bem-vindo! Como posso ajudar?";
    case 'name':
      return "Qual é o seu nome completo?";
    case 'phone':
      return `Olá ${formData.name}! Qual seu WhatsApp?`;
    // ...
  }
};
```

### Customizar Estilos
O componente usa classes Tailwind CSS que podem ser modificadas:

```tsx
// Botão flutuante
className="bg-green-500 hover:bg-green-600"

// Modal do chat
className="bg-white dark:bg-gray-800"
```

### Adicionar Campos Extras
Para coletar informações adicionais, modifique:

1. Interface `FormData` no componente
2. Estados do fluxo de conversa
3. Validação na API
4. Template de transformação

## Solução de Problemas

### Problemas Comuns

**1. Webhook não recebe dados**
- Verifique se `WHATSAPP_FORWARD_ENABLED=true`
- Confirme se a URL do webhook está correta
- Teste a URL externamente

**2. Erro de autenticação**
- Verifique se `WHATSAPP_API_KEY` está configurada
- Confirme se os headers customizados estão corretos

**3. Dados não chegam no formato esperado**
- Ajuste `WHATSAPP_PAYLOAD_TRANSFORM` para o tipo correto
- Use `custom` para formatos específicos

**4. Modal não abre**
- Verifique se não há conflitos de z-index
- Confirme se o JavaScript está carregado

### Debug Avançado
Para debug detalhado, adicione logs no componente:

```tsx
console.log('Enviando dados:', formData);
console.log('Resposta da API:', response);
```

## Integração com Analytics

Para rastrear conversões, adicione eventos de analytics:

```tsx
// No envio bem-sucedido
if (response.ok) {
  // Google Analytics
  gtag('event', 'whatsapp_contact_submitted', {
    event_category: 'engagement',
    event_label: 'landing_page'
  });
  
  // Facebook Pixel
  fbq('track', 'Lead', {
    source: 'whatsapp_widget'
  });
}
```