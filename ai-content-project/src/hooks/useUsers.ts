'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActionType } from '@/lib/permissions';

// ── 类型定义 ──

interface LogEntry {
  id: string;
  action: ActionType;
  userName: string;
  target: string;
  description: string;
  timestamp: number;
}

interface CurrentUser {
  id: number;
  username: string;
  role: string;
  permissions: string[];
}

// ── 辅助函数 ──

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cms_token') || '' : '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function getApiBase(): string {
  // 前端通过 Go 后端代理访问 API
  if (typeof window !== 'undefined') {
    // 如果在 /ai-content/ 路径下，需要回到根 API
    return '';
  }
  return '';
}

// 将后端 action 字符串映射为 ActionType
function mapAction(action: string): ActionType {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('init')) return 'create';
  if (a.includes('update') || a.includes('set_default') || a.includes('publish')) return 'update';
  if (a.includes('delete')) return 'delete';
  if (a.includes('reset') || a.includes('password')) return 'reset';
  if (a.includes('login')) return 'login';
  if (a.includes('view') || a.includes('get')) return 'view';
  return 'update'; // 默认
}

// ── useLogs Hook ──

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiBase()}/api/logs?limit=500`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setLogs([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const rows = data.rows || [];
      const mapped: LogEntry[] = rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        action: mapAction(String(r.action || '')),
        userName: String(r.username || ''),
        target: String(r.target || ''),
        description: String(r.detail || ''),
        timestamp: new Date(String(r.timestamp || '')).getTime(),
      }));
      setLogs(mapped);
    } catch (err) {
      console.error('[useLogs] 获取日志失败:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/logs`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.error('[useLogs] 清空日志失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, clear, loading, refresh: fetchLogs };
}

// ── useCurrentUser Hook ──

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchUser() {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/me`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser({
            id: data.id,
            username: data.username,
            role: data.role,
            permissions: data.permissions || [],
          });
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUser();
    return () => { cancelled = true; };
  }, []);

  return { user, loading };
}
