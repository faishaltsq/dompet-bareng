import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type AppNotification = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  title: string;
  message: string;
  type: 'member_kicked' | 'info' | 'system' | string;
  data?: {
    reason?: string;
    workspace_name?: string;
    admin_name?: string;
    [key: string]: any;
  } | null;
  is_read: boolean;
  created_at: string;
};

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  sendNotification: (params: {
    targetUserId: string;
    title: string;
    message: string;
    type?: string;
    workspaceId?: string;
    data?: any;
  }) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {},
  markAsRead: async () => false,
  markAllAsRead: async () => false,
  sendNotification: async () => false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
    } catch (e) {
      console.error('fetchNotifications error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    const channel = supabase
      .channel(`user_notif:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as AppNotification, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => (n.id === payload.new.id ? (payload.new as AppNotification) : n))
            );
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('markAsRead error:', error);
      return false;
    }
    return true;
  }, []);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('markAllAsRead error:', error);
      return false;
    }
    return true;
  }, [user]);

  const sendNotification = useCallback(async ({
    targetUserId,
    title,
    message,
    type = 'info',
    workspaceId,
    data = {},
  }: {
    targetUserId: string;
    title: string;
    message: string;
    type?: string;
    workspaceId?: string;
    data?: any;
  }): Promise<boolean> => {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        title,
        message,
        type,
        workspace_id: workspaceId || null,
        data,
        is_read: false,
      });

    if (error) {
      console.error('sendNotification error:', error);
      return false;
    }
    return true;
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        sendNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
