import { auth } from '$lib/stores/auth.svelte';

export interface Item {
  id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  item_type: string;
  metadata: Record<string, any>;
  tags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateItemPayload {
  workspace_id: string;
  title: string;
  content?: string | null;
  item_type: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface UpdateItemPayload {
  title?: string;
  content?: string | null;
  item_type?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ItemFilters {
  workspace_id?: string;
  item_type?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.token) h.Authorization = `Bearer ${auth.token}`;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.message || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function buildQuery(filters: ItemFilters): string {
  const params = new URLSearchParams();
  if (filters.workspace_id) params.set('workspace_id', filters.workspace_id);
  if (filters.item_type) params.set('item_type', filters.item_type);
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.search) params.set('search', filters.search);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const itemsApi = {
  async list(filters: ItemFilters = {}): Promise<Item[]> {
    const res = await fetch(`/api/items${buildQuery(filters)}`, { headers: headers() });
    return handle<Item[]>(res);
  },

  async listByWorkspace(workspaceId: string, filters: Omit<ItemFilters, 'workspace_id'> = {}): Promise<Item[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/items${buildQuery(filters)}`, { headers: headers() });
    return handle<Item[]>(res);
  },

  async get(id: string): Promise<Item> {
    const res = await fetch(`/api/items/${id}`, { headers: headers() });
    return handle<Item>(res);
  },

  async create(payload: CreateItemPayload): Promise<Item> {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    return handle<Item>(res);
  },

  async update(id: string, payload: UpdateItemPayload): Promise<Item> {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    return handle<Item>(res);
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    await handle<void>(res);
  }
};
