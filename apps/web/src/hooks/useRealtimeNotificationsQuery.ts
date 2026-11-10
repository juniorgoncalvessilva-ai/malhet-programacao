import { useMemo } from 'react'
import { useAppStore } from '@/store'

/**
 * Notificações locais (Zustand). Substitui a versão Supabase Realtime do starter kit.
 * Mantém a mesma assinatura usada pelo header para não quebrar o layout.
 * Quando a API Python expuser notificações (ex.: programação aprovada / exportada ao Simova),
 * troque a fonte por um useQuery em `@/lib/api`.
 */
export function useRealtimeNotifications() {
  const items = useAppStore((s) => s.notifications)
  const markNotificationAsRead = useAppStore((s) => s.markNotificationAsRead)
  const removeNotification = useAppStore((s) => s.removeNotification)
  const clearAllNotifications = useAppStore((s) => s.clearAllNotifications)

  const notifications = useMemo(
    () =>
      items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        created_at: new Date(n.timestamp).toISOString(),
        sender_name: null as string | null,
        sender_avatar: null as string | null,
      })),
    [items],
  )

  return {
    notifications,
    recentNotifications: notifications.slice(0, 10),
    loading: false,
    error: null as string | null,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead: async (id: string) => markNotificationAsRead(id),
    markAllAsRead: async () => notifications.forEach((n) => markNotificationAsRead(n.id)),
    deleteNotification: async (id: string) => removeNotification(id),
    clearAllNotifications: async () => clearAllNotifications(),
  }
}
