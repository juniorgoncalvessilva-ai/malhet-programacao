"use client";

import { useUser, SignInButton, SignOutButton } from '@clerk/nextjs';
import { useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp?: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  preferences: {
    theme: string;
    language: string;
    notifications: boolean;
  };
  stats: {
    totalLogins: number;
    accountAge: number;
    lastActivity: string;
  };
}

interface DashboardData {
  metrics: {
    totalViews: number;
    totalClicks: number;
    conversionRate: string;
    revenue: string;
  };
  recentActivity: Array<{
    id: number;
    action: string;
    timestamp: string;
    type: string;
  }>;
  quickStats: {
    activeProjects: number;
    pendingTasks: number;
    completedGoals: number;
    teamMembers: number;
  };
}

export default function APIDemoPage() {
  const { isSignedIn, user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const fetchUserProfile = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const response = await fetch('/api/protected/user-profile');
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setUserProfile(result.data);
        setSuccess(result.message);
      } else {
        setError(result.error || 'Erro ao carregar perfil');
      }
    } catch (err) {
      setError('Erro de conexão com a API');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const response = await fetch('/api/protected/dashboard-data');
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
        setSuccess(result.message);
      } else {
        setError(result.error || 'Erro ao carregar dados do dashboard');
      }
    } catch (err) {
      setError('Erro de conexão com a API');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const response = await fetch('/api/protected/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme: 'dark',
          language: 'pt-BR',
          notifications: true
        })
      });
      
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setSuccess(result.message);
        // Recarregar perfil após atualização
        await fetchUserProfile();
      } else {
        setError(result.error || 'Erro ao atualizar preferências');
      }
    } catch (err) {
      setError('Erro de conexão com a API');
    } finally {
      setLoading(false);
    }
  };

  const createNewProject = async () => {
    setLoading(true);
    clearMessages();
    
    try {
      const response = await fetch('/api/protected/dashboard-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Projeto de Demonstração',
          description: 'Este é um projeto criado através da API protegida'
        })
      });
      
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setSuccess(`${result.message} ID: ${result.data.id}`);
      } else {
        setError(result.error || 'Erro ao criar projeto');
      }
    } catch (err) {
      setError('Erro de conexão com a API');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb pageName="Demonstração de API Protegida" />
      
      <div className="mt-8 space-y-8">
        {/* Seção de Autenticação */}
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-boxdark">
          <h2 className="mb-4 text-xl font-semibold">Status de Autenticação</h2>
          
          {isSignedIn ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <img 
                  src={user.imageUrl} 
                  alt="Avatar" 
                  className="h-12 w-12 rounded-full"
                />
                <div>
                  <p className="font-medium">{user.fullName || 'Usuário'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                  ✓ Autenticado
                </span>
                <SignOutButton>
                  <button className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500">
                    Sair
                  </button>
                </SignOutButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                  ✗ Não autenticado
                </span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Você precisa fazer login para acessar os endpoints protegidos.
              </p>
              
              <SignInButton mode="modal">
                <button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90">
                  Fazer Login
                </button>
              </SignInButton>
            </div>
          )}
        </div>

        {/* Mensagens de Feedback */}
        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Erro
                    </h3>
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {success && (
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Sucesso
                    </h3>
                    <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                      {success}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seção de Testes de API */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Teste de Perfil do Usuário */}
          <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-boxdark">
            <h3 className="mb-4 text-lg font-semibold">Endpoint de Perfil</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              GET /api/protected/user-profile
            </p>
            
            <div className="space-y-3">
              <button
                onClick={fetchUserProfile}
                disabled={!isSignedIn || loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:bg-gray-400"
              >
                {loading ? 'Carregando...' : 'Buscar Perfil'}
              </button>
              
              <button
                onClick={updatePreferences}
                disabled={!isSignedIn || loading}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:bg-gray-400"
              >
                {loading ? 'Atualizando...' : 'Atualizar Preferências'}
              </button>
            </div>

            {userProfile && (
              <div className="mt-4 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                <h4 className="font-medium">Dados do Perfil:</h4>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Nome:</strong> {userProfile.name}</p>
                  <p><strong>Email:</strong> {userProfile.email}</p>
                  <p><strong>Tema:</strong> {userProfile.preferences.theme}</p>
                  <p><strong>Total de Logins:</strong> {userProfile.stats.totalLogins}</p>
                  <p><strong>Idade da Conta:</strong> {userProfile.stats.accountAge} dias</p>
                </div>
              </div>
            )}
          </div>

          {/* Teste de Dados do Dashboard */}
          <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-boxdark">
            <h3 className="mb-4 text-lg font-semibold">Endpoint de Dashboard</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              GET /api/protected/dashboard-data
            </p>
            
            <div className="space-y-3">
              <button
                onClick={fetchDashboardData}
                disabled={!isSignedIn || loading}
                className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-gray-400"
              >
                {loading ? 'Carregando...' : 'Buscar Dashboard'}
              </button>
              
              <button
                onClick={createNewProject}
                disabled={!isSignedIn || loading}
                className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:bg-gray-400"
              >
                {loading ? 'Criando...' : 'Criar Projeto'}
              </button>
            </div>

            {dashboardData && (
              <div className="mt-4 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                <h4 className="font-medium">Métricas:</h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Views:</strong> {dashboardData.metrics.totalViews}</p>
                  <p><strong>Clicks:</strong> {dashboardData.metrics.totalClicks}</p>
                  <p><strong>Conversão:</strong> {dashboardData.metrics.conversionRate}</p>
                  <p><strong>Receita:</strong> {dashboardData.metrics.revenue}</p>
                </div>
                
                <div className="mt-3">
                  <h5 className="font-medium">Stats Rápidas:</h5>
                  <div className="mt-1 text-sm">
                    <p>Projetos Ativos: {dashboardData.quickStats.activeProjects}</p>
                    <p>Tarefas Pendentes: {dashboardData.quickStats.pendingTasks}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Como Funcionam as APIs Autenticadas */}
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-semibold">🔒 Como Funcionam as APIs Autenticadas</h3>
          
          <div className="space-y-4 text-sm">
            <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">🛡️ Sistema de Proteção</h4>
              <p className="text-blue-700 dark:text-blue-300 mb-2">
                Todas as APIs em <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/api/protected/*</code> são automaticamente protegidas pelo middleware do Clerk.
              </p>
              <ul className="list-disc list-inside text-blue-600 dark:text-blue-400 space-y-1">
                <li>✅ <strong>Middleware automático:</strong> Intercepta todas as requisições</li>
                <li>✅ <strong>Token JWT:</strong> Valida automaticamente o token de autenticação</li>
                <li>✅ <strong>Erro 401:</strong> Retorna &quot;Não autorizado&quot; se não estiver logado</li>
                <li>✅ <strong>userId garantido:</strong> Sempre disponível nas rotas protegidas</li>
              </ul>
            </div>

            <div className="rounded-md bg-purple-50 p-4 dark:bg-purple-900/20">
              <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">🔄 Fluxo de Autenticação</h4>
              <div className="text-purple-700 dark:text-purple-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded">
                    <strong>1. Requisição</strong><br/>
                    Frontend faz chamada para API protegida
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded">
                    <strong>2. Middleware</strong><br/>
                    Verifica token JWT automaticamente
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded">
                    <strong>3. Resposta</strong><br/>
                    API recebe userId ou erro 401
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-orange-50 p-4 dark:bg-orange-900/20">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">⚡ Vantagens do Sistema</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-orange-700 dark:text-orange-300 text-xs">
                <ul className="space-y-1">
                  <li>🚀 <strong>Zero configuração:</strong> Proteção automática</li>
                  <li>🔒 <strong>Segurança garantida:</strong> Impossível burlar</li>
                  <li>⚡ <strong>Performance:</strong> Middleware edge-side</li>
                </ul>
                <ul className="space-y-1">
                  <li>🎯 <strong>Isolamento:</strong> Dados por usuário</li>
                  <li>🛠️ <strong>Debugging:</strong> Erros claros</li>
                  <li>📱 <strong>Multiplataforma:</strong> Web, mobile, API</li>
                </ul>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">🌐 APIs Públicas vs Protegidas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-green-100 dark:bg-green-800 p-2 rounded">
                  <strong className="text-green-800 dark:text-green-200">🔓 APIs Públicas</strong><br/>
                  <span className="text-green-600 dark:text-green-400">
                    <code>/api/health</code>, <code>/api/webhooks/*</code><br/>
                    ✅ Sem autenticação necessária<br/>
                    ✅ Ideais para webhooks, status
                  </span>
                </div>
                <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded">
                  <strong className="text-blue-800 dark:text-blue-200">🔒 APIs Protegidas</strong><br/>
                  <span className="text-blue-600 dark:text-blue-400">
                    <code>/api/protected/*</code><br/>
                    🛡️ Autenticação obrigatória<br/>
                    🎯 Dados específicos do usuário
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📖 Documentação Completa</h4>
              <p className="text-gray-600 dark:text-gray-400 text-xs">
                Para guias detalhados, exemplos e melhores práticas, consulte:{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                  /docs/03-development/apis-endpoints.md
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Documentação dos Endpoints */}
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-semibold">📋 Documentação dos Endpoints</h3>
          
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-green-600">GET /api/protected/user-profile</h4>
              <p className="mt-1 text-sm">Retorna dados completos do perfil do usuário autenticado.</p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <strong>Autenticação:</strong> Obrigatória | <strong>Retorno:</strong> JSON com dados do usuário
              </p>
            </div>
            
            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-blue-600">POST /api/protected/user-profile</h4>
              <p className="mt-1 text-sm">Atualiza as preferências do usuário.</p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <strong>Body:</strong> {`{ theme, language, notifications }`}
              </p>
            </div>
            
            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-purple-600">GET /api/protected/dashboard-data</h4>
              <p className="mt-1 text-sm">Retorna dados simulados do dashboard do usuário.</p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <strong>Inclui:</strong> Métricas, atividades recentes, estatísticas rápidas
              </p>
            </div>
            
            <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-orange-600">POST /api/protected/dashboard-data</h4>
              <p className="mt-1 text-sm">Cria um novo projeto para o usuário.</p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <strong>Body:</strong> {`{ title, description }`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}