import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado. Login necessário.' },
        { status: 401 }
      );
    }

    // Simular dados de dashboard específicos do usuário
    const dashboardData = {
      userId,
      metrics: {
        totalViews: Math.floor(Math.random() * 10000) + 1000,
        totalClicks: Math.floor(Math.random() * 1000) + 100,
        conversionRate: (Math.random() * 10 + 1).toFixed(2) + '%',
        revenue: 'R$ ' + (Math.random() * 50000 + 5000).toFixed(2)
      },
      recentActivity: [
        {
          id: 1,
          action: 'Login realizado',
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          type: 'auth'
        },
        {
          id: 2,
          action: 'Dados atualizados',
          timestamp: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString(),
          type: 'update'
        },
        {
          id: 3,
          action: 'Relatório gerado',
          timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
          type: 'report'
        }
      ],
      notifications: [
        {
          id: 1,
          title: 'Bem-vindo!',
          message: 'Sua conta foi configurada com sucesso.',
          read: false,
          priority: 'high'
        },
        {
          id: 2,
          title: 'Atualização disponível',
          message: 'Uma nova versão está disponível.',
          read: true,
          priority: 'medium'
        }
      ],
      quickStats: {
        activeProjects: Math.floor(Math.random() * 20) + 1,
        pendingTasks: Math.floor(Math.random() * 15) + 1,
        completedGoals: Math.floor(Math.random() * 50) + 10,
        teamMembers: Math.floor(Math.random() * 10) + 1
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Dados do dashboard carregados com sucesso!',
      data: dashboardData,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error);
    
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Simular criação de novo projeto/item
    const newItem = {
      id: Date.now(),
      userId,
      title: body.title || 'Novo Projeto',
      description: body.description || 'Descrição do projeto',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Novo item criado com sucesso!',
      data: newItem
    });

  } catch (error) {
    console.error('Erro ao criar item:', error);
    
    return NextResponse.json(
      { error: 'Erro ao criar item.' },
      { status: 500 }
    );
  }
}