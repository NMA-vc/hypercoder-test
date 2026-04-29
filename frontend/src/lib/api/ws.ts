import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth.svelte';

export type WsMessage =
  | { type: 'widget_update'; widget_id: string; data: any }
  | { type: 'widget_delete'; widget_id: string }
  | { type: 'dashboard_update'; dashboard_id: string; layout: any }
  | { type: 'user_joined'; user_id: string }
  | { type: 'user_left'; user_id: string }
  | { type: 'ping' }
  | { type: 'pong' };

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

type Listener = (msg: WsMessage) => void;

function createWsClient() {
  let socket: WebSocket | null = null;
  let status = $state<WsStatus>('idle');
  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  let pingTimer: any = null;
  let currentRoom: string | null = null;
  let currentUserId: string | null = null;
  let manuallyClosed = false;
  const listeners = new Set<Listener>();

  function url(): string {
    if (!browser) return '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  function emit(msg: WsMessage) {
    for (const l of listeners) {
      try {
        l(msg);
      } catch (e) {
        console.error('ws listener error', e);
      }
    }
  }

  function send(data: any) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      send({ type: 'ping' });
    }, 25000);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    if (reconnectTimer) return;
    reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (currentRoom) connect(currentRoom, currentUserId ?? undefined);
    }, delay);
  }

  function connect(roomId: string, userId?: string) {
    if (!browser) return;
    currentRoom = roomId;
    currentUserId = userId ?? auth.user?.id ?? null;
    manuallyClosed = false;

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      // Already connecting/open: just join the room
      send({ type: 'join', room_id: roomId, user_id: currentUserId });
      return;
    }

    status = 'connecting';
    try {
      socket = new WebSocket(url());
    } catch (e) {
      status = 'error';
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      status = 'connected';
      reconnectAttempts = 0;
      send({ type: 'join', room_id: roomId, user_id: currentUserId });
      startPing();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        emit(msg);
      } catch (e) {
        console.warn('ws parse error', e);
      }
    };

    socket.onerror = () => {
      status = 'error';
    };

    socket.onclose = () => {
      status = 'disconnected';
      stopPing();
      socket = null;
      if (!manuallyClosed) scheduleReconnect();
    };
  }

  function disconnect() {
    manuallyClosed = true;
    stopPing();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch {}
      socket = null;
    }
    status = 'idle';
    currentRoom = null;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    connect,
    disconnect,
    subscribe,
    send,
    get status() {
      return status;
    },
    get room() {
      return currentRoom;
    }
  };
}

export const ws = createWsClient();

export function connectUserRoom(userId?: string) {
  const id = userId ?? auth.user?.id;
  if (!id) return;
  ws.connect(`user:${id}`, id);
}
