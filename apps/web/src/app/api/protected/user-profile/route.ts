import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário está autenticado
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso negado. Você precisa estar autenticado para acessar este endpoint.' },
        { status: 401 }
      );
    }

    // Obter dados completos do usuário
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 }
      );
    }

    // Simular alguns dados adicionais do perfil
    const profileData = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || 'N/A',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuário Anônimo',
      avatar: user.imageUrl,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      // Dados simulados para demonstração
      preferences: {
        theme: 'dark',
        language: 'pt-BR',
        notifications: true
      },
      stats: {
        totalLogins: Math.floor(Math.random() * 100) + 1,
        accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)),
        lastActivity: new Date().toISOString()
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Dados do perfil obtidos com sucesso!',
      data: profileData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint protegido:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor. Tente novamente mais tarde.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso negado. Você precisa estar autenticado.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Simular atualização de preferências
    const updatedPreferences = {
      theme: body.theme || 'light',
      language: body.language || 'pt-BR',
      notifications: body.notifications !== undefined ? body.notifications : true
    };

    return NextResponse.json({
      success: true,
      message: 'Preferências atualizadas com sucesso!',
      data: {
        userId,
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar preferências:', error);
    
    return NextResponse.json(
      { error: 'Erro ao processar solicitação.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Acesso negado.' },
        { status: 401 }
      );
    }

    // Simular exclusão de dados (não vamos realmente deletar o usuário)
    return NextResponse.json({
      success: true,
      message: 'Solicitação de exclusão processada (simulado).',
      data: {
        userId,
        action: 'delete_requested',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro na exclusão:', error);
    
    return NextResponse.json(
      { error: 'Erro ao processar exclusão.' },
      { status: 500 }
    );
  }
}