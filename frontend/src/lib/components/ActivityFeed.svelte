<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { ws, connectUserRoom, type WsMessage, type WsStatus } from '$lib/api/ws';
  import { auth } from '$lib/stores/auth.svelte';

  interface Props {
    roomId?: string;
    title?: string;
    maxEvents?: number;
    autoConnect?: boolean;
  }

  let {
    roomId,
    title = 'Activity feed',
    maxEvents = 50,
    autoConnect = true
  }: Props = $props();

  interface ActivityEvent {
    id: string;
    timestamp: number;
    kind: 'widget_update' | 'widget_delete' | 'dashboard_update' | 'user_joined' | 'user_left' | 'system';
    label: string;
    detail?: string;
  }

  let events = $state<ActivityEvent[]>([]);
  let paused = $state(false);
  let status = $state<WsStatus>('idle');

  function addEvent(ev: Omit<ActivityEvent, 'id' | 'timestamp'>) {
    if (paused) return;
    const next: ActivityEvent = {
      ...ev,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now()
    };
    events = [next, ...events].slice(0, maxEvents);
  }

  function handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case 'widget_update':
        addEvent({
          kind: 'widget_update',
          label: 'Widget updated',
          detail: msg.widget_id
        });
        break;
      case 'widget_delete':
        addEvent({
          kind: 'widget_delete',
          label: 'Widget deleted',
          detail: msg.widget_id
        });
        break;
      case 'dashboard_update':
        addEvent({
          kind: 'dashboard_update',
          label: 'Dashboard updated',
          detail: msg.dashboard_id
        });
        break;
      case 'user_joined':
        addEvent({
          kind: 'user_joined',
          label: 'User joined',
          detail: msg.user_id
        });
        break;
      case 'user_left':
        addEvent({
          kind: 'user_left',
          label: 'User left',
          detail: msg.user_id
        });
        break;
      // Ignore ping/pong
    }
  }

  $effect(() => {
    if (!autoConnect) return;
    if (!auth.isAuthenticated) return;

    if (roomId) {
      ws.connect(roomId, auth.user?.id);
    } else {
      connectUserRoom();
    }

    const unsub = ws.subscribe(handleMessage);

    const statusInterval = setInterval(() => {
      status = ws.status;
    }, 500);
    status = ws.status;

    return () => {
      unsub();
      clearInterval(statusInterval);
    };
  });

  function clearAll() {
    events = [];
  }

  function togglePause() {
    paused = !paused;
  }

  function reconnect() {
    if (roomId) ws.connect(roomId, auth.user?.id);
    else connectUserRoom();
  }

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  }

  const statusInfo = $derived.by(() => {
    switch (status) {
      case 'connected':
        return { label: 'Live', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' };
      case 'connecting':
        return { label: 'Connecting', color: 'bg-amber-500 animate-pulse', text: 'text-amber-700 dark:text-amber-400' };
      case 'disconnected':
        return { label: 'Disconnected', color: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' };
      case 'error':
        return { label: 'Error', color: 'bg-red-500', text: 'text-red-700 dark:text-red-400' };
      default:
        return { label: 'Idle', color: 'bg-gray-300', text: 'text-gray-500' };
    }
  });

  function eventStyle(kind: ActivityEvent['kind']) {
    switch (kind) {
      case 'widget_update':
        return { dot: 'bg-blue-500', badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' };
      case 'widget_delete':
        return { dot: 'bg-red-500', badge: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' };
      case 'dashboard_update':
        return { dot: 'bg-purple-500', badge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' };
      case 'user_joined':
        return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' };
      case 'user_left':
        return { dot: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' };
      default:
        return { dot: 'bg-gray-400', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' };
    }
  }
</script>

<Card variant="elevated" padding="md" class="h-full flex flex-col">
  {#snippet header()}
    <div class="flex items-center gap-2">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium {statusInfo.text} bg-gray-100 dark:bg-gray-800">
        <span class="w-1.5 h-1.5 rounded-full {statusInfo.color}"></span>
        {statusInfo.label}
      </span>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
      {paused ? 'Paused' : 'Real-time updates from your workspace'}
    </p>
  {/snippet}

  {#snippet actions()}
    <div class="flex items-center gap-1">
      <button
        onclick={togglePause}
        title={paused ? 'Resume' : 'Pause'}
        aria-label={paused ? 'Resume' : 'Pause'}
        class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        {#if paused}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        {/if}
      </button>
      {#if status !== 'connected' && status !== 'connecting'}
        <button
          onclick={reconnect}
          title="Reconnect"
          aria-label="Reconnect"
          class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      {/if}
      <button
        onclick={clearAll}
        title="Clear"
        aria-label="Clear"
        class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
        </svg>
      </button>
    </div>
  {/snippet}

  <div class="flex-1 overflow-y-auto -mx-2 mt-2">
    {#if events.length === 0}
      <div class="px-4 py-10 text-center">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">No activity yet</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {status === 'connected' ? 'Waiting for updates...' : 'Connecting to live updates...'}
        </p>
      </div>
    {:else}
      <ul class="px-2 space-y-1">
        {#each events as ev (ev.id)}
          {@const style = eventStyle(ev.kind)}
          <li class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <span class="mt-1.5 w-2 h-2 rounded-full {style.dot} flex-shrink-0"></span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{ev.label}</span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium {style.badge}">
                  {ev.kind.replace('_', ' ')}
                </span>
              </div>
              {#if ev.detail}
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate font-mono mt-0.5">{ev.detail}</p>
              {/if}
            </div>
            <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">{formatTime(ev.timestamp)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Card>
