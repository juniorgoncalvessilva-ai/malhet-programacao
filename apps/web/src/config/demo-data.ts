/**
 * Dados de demonstração centralizados para a aplicação
 * Use estes dados quando precisar exibir informações fictícias
 */

export interface DemoUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  company?: string;
  role?: string;
}

export interface DemoNotification {
  id: string;
  type: 'message' | 'alert' | 'reminder' | 'update';
  title: string;
  message: string;
  time: string;
  unread: boolean;
  user?: {
    name: string;
    avatar?: string;
  };
  action?: {
    label: string;
    url: string;
  };
}

// Usuários de demonstração
export const demoUsers: DemoUser[] = [
  {
    id: '1',
    name: 'David Johnson',
    username: 'davidjohnson24',
    email: 'david.johnson@example.com',
    phone: '+55 (11) 99999-0001',
    bio: 'Desenvolvedor full-stack apaixonado por tecnologia e inovação. Especializado em React, Node.js e arquiteturas modernas.',
    location: 'São Paulo, SP',
    website: 'https://davidjohnson.dev',
    company: 'AI Coders',
    role: 'Senior Developer'
  },
  {
    id: '2',
    name: 'Ana Silva',
    username: 'anasilva',
    email: 'ana.silva@example.com',
    phone: '+55 (11) 99999-0002',
    bio: 'UI/UX Designer focada em criar experiências digitais excepcionais.',
    location: 'Rio de Janeiro, RJ',
    company: 'AI Coders',
    role: 'Lead Designer'
  },
  {
    id: '3',
    name: 'Carlos Santos',
    username: 'carlossantos',
    email: 'carlos.santos@example.com',
    phone: '+55 (11) 99999-0003',
    bio: 'Product Manager com experiência em metodologias ágeis e gestão de produtos digitais.',
    location: 'Belo Horizonte, MG',
    company: 'AI Coders',
    role: 'Product Manager'
  },
  {
    id: '4',
    name: 'Maria Oliveira',
    username: 'mariaoliveira',
    email: 'maria.oliveira@example.com',
    phone: '+55 (11) 99999-0004',
    bio: 'Engenheira de dados especializada em machine learning e análise de big data.',
    location: 'Brasília, DF',
    company: 'AI Coders',
    role: 'Data Engineer'
  }
];

// Notificações de demonstração
export const demoNotifications: DemoNotification[] = [
  {
    id: '1',
    type: 'message',
    title: 'Nova mensagem',
    message: 'Você recebeu uma nova mensagem',
    time: '5 min',
    unread: true,
    user: {
      name: 'Ana Silva',
      avatar: '/images/user/user-02.png'
    }
  },
  {
    id: '2',
    type: 'alert',
    title: 'Atualização do sistema',
    message: 'Uma nova versão está disponível',
    time: '15 min',
    unread: true,
    action: {
      label: 'Atualizar agora',
      url: '/settings/updates'
    }
  },
  {
    id: '3',
    type: 'reminder',
    title: 'Reunião agendada',
    message: 'Reunião de equipe em 30 minutos',
    time: '25 min',
    unread: false,
    user: {
      name: 'Carlos Santos'
    }
  },
  {
    id: '4',
    type: 'update',
    title: 'Backup concluído',
    message: 'Backup dos dados foi realizado com sucesso',
    time: '1h',
    unread: false
  },
  {
    id: '5',
    type: 'message',
    title: 'Comentário em projeto',
    message: 'Maria comentou no seu projeto',
    time: '2h',
    unread: false,
    user: {
      name: 'Maria Oliveira',
      avatar: '/images/user/user-03.png'
    }
  }
];

// Getter functions para fácil acesso
export function getDemoUser(id?: string): DemoUser {
  if (id) {
    return demoUsers.find(user => user.id === id) || demoUsers[0];
  }
  return demoUsers[0]; // Retorna o primeiro usuário por padrão
}

export function getDemoUsers(): DemoUser[] {
  return demoUsers;
}

export function getDemoNotifications(): DemoNotification[] {
  return demoNotifications;
}

export function getUnreadNotificationsCount(): number {
  return demoNotifications.filter(notification => notification.unread).length;
}

// Dados de demonstração para formulários
export const demoFormData = {
  personalInfo: {
    name: getDemoUser().name,
    email: getDemoUser().email,
    phone: getDemoUser().phone,
    username: getDemoUser().username,
    bio: getDemoUser().bio,
    location: getDemoUser().location,
    website: getDemoUser().website
  },
  
  address: {
    cep: '01310-100',
    street: 'Avenida Paulista',
    number: '1578',
    complement: 'Conj. 1201',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    country: 'Brasil'
  },
  
  contact: {
    name: 'João Silva',
    email: 'joao.silva@example.com',
    subject: 'Dúvida sobre funcionalidades',
    message: 'Gostaria de saber mais informações sobre as funcionalidades disponíveis na plataforma.'
  }
};

// Dados de demonstração para charts
export const demoChartData = {
  visitors: {
    seriesName: 'Visitantes',
    data: [
      { name: 'Jan', value: 400 },
      { name: 'Fev', value: 300 },
      { name: 'Mar', value: 450 },
      { name: 'Abr', value: 500 },
      { name: 'Mai', value: 350 },
      { name: 'Jun', value: 600 }
    ]
  },
  
  revenue: {
    seriesName: 'Receita',
    data: [
      { name: 'Q1', value: 12000 },
      { name: 'Q2', value: 15000 },
      { name: 'Q3', value: 18000 },
      { name: 'Q4', value: 22000 }
    ]
  }
};