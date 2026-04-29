<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import BentoGrid from '$lib/components/ui/BentoGrid.svelte';

  interface Workspace {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }

  interface Item {
    id: string;
    title: string;
    item_type: string;
    workspace_id: string;
    tags: string[];
    updated_at: string;
  }

  interface Widget {
    id: string;
    type: string;
    title: string;
    updated_at: string;
  }

  let workspaces = $state<Workspace[]>([]);
  let items = $state<Item[]>([]);
  let widgets = $state<Widget[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function authHeaders(): Record<string, string> {
    return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
  }

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [wsRes, itemsRes, widgetsRes] = await Promise.all([
        fetch('/api/workspaces', { headers: authHeaders() }),
        fetch('/api/items?limit=10', { headers: authHeaders() }),
        fetch('/api/widgets?limit=10', { headers: authHeaders() })
      ]);

      if (wsRes.ok) workspaces = await wsRes.json();
      if (itemsRes.ok) items = await itemsRes.json();
      if (widgetsRes.ok) {
        const data = await widgetsRes.json();
        widgets = data.widgets ?? [];
      }
    } catch (e: any) {
      error = e.message ?? 'Failed to load dashboard';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAuthenticated) loadData();
  });

  const stats = $derived([
    { label: 'Workspaces', value: workspaces.length, color: 'from-blue-500 to-blue-600', icon: 'folder' },
    { label: 'Items', value: items.length, color: 'from-emerald-500 to-emerald-600', icon: 'doc' },
    { label: 'Widgets', value: widgets.length, color: 'from-purple-500 to-purple-600', icon: 'grid' },
    { label: 'Tags', value: new Set(items.flatMap(i => i.tags)).size, color: 'from-amber-500 to-amber-600', icon: 'tag' }
  ]);

  function formatDate(s: string): string {
    try {
      return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }
</script>

<svelte:head>
  <title>Dashboard</title>
</svelte:head>

<div class="max-w-7xl mx-auto space-y-6">
  <div class="flex items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Welcome back{auth.user?.email ? `, ${auth.user.email.split('@')[0]}` : ''}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Here's an overview of your workspace activity.</p>
    </div>
    <button
      onclick={loadData}
      class="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Refresh
    </button>
  </div>

  {#if error}
    <div class="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400">
      {error}
    </div>
  {/if}

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {#each stats as stat}
      <Card variant="elevated" padding="md">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {loading ? '—' : stat.value}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br {stat.color} text-white flex items-center justify-center">
            {#if stat.icon === 'folder'}
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
            {:else if stat.icon === 'doc'}
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/></svg>
            {:else if stat.icon === 'grid'}
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5l8 8-8 8-8-8V5a2 2 0 012-2z"/></svg>
            {/if}
          </div>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Bento layout -->
  <BentoGrid columns={4} gap="md" autoRows="lg">
    <!-- Workspaces -->
    <div class="col-span-1 sm:col-span-2 row-span-2">
      <Card variant="elevated" padding="md" class="h-full flex flex-col" title="Recent workspaces" description="Your active workspaces">
        {#snippet actions()}
          <a href="/dashboard/workspaces" class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">View all</a>
        {/snippet}
        <div class="flex-1 overflow-y-auto -mx-2">
          {#if loading}
            <div class="space-y-2 px-2">
              {#each Array(3) as _}
                <div class="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              {/each}
            </div>
          {:else if workspaces.length === 0}
            <div class="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No workspaces yet. Create one to get started.
            </div>
          {:else}
            <ul class="space-y-1 px-2">
              {#each workspaces.slice(0, 6) as ws}
                <li>
                  <a href={`/dashboard/workspaces/${ws.id}`} class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div class="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {ws.name?.[0]?.toUpperCase() ?? 'W'}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ws.name}</p>
                      {#if ws.description}
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{ws.description}</p>
                      {/if}
                    </div>
                    <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(ws.updated_at)}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </Card>
    </div>

    <!-- Recent items -->
    <div class="col-span-1 sm:col-span-2 row-span-2">
      <Card variant="elevated" padding="md" class="h-full flex flex-col" title="Recent items" description="Latest content across workspaces">
        {#snippet actions()}
          <a href="/dashboard/items" class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">View all</a>
        {/snippet}
        <div class="flex-1 overflow-y-auto -mx-2">
          {#if loading}
            <div class="space-y-2 px-2">
              {#each Array(4) as _}
                <div class="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              {/each}
            </div>
          {:else if items.length === 0}
            <div class="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No items yet.
            </div>
          {:else}
            <ul class="divide-y divide-gray-100 dark:divide-gray-800 px-2">
              {#each items.slice(0, 8) as item}
                <li class="py-2.5 flex items-start gap-3">
                  <span class="mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {item.item_type}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
                    {#if item.tags.length > 0}
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each item.tags.slice(0, 3) as tag}
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(item.updated_at)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </Card>
    </div>

    <!-- Quick actions -->
    <div class="col-span-1 sm:col-span-2 row-span-1">
      <Card variant="elevated" padding="md" class="h-full" title="Quick actions">
        <div class="grid grid-cols-2 gap-2 mt-2">
          <a href="/dashboard/workspaces/new" class="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors">
            <div class="w-8 h-8 rounded-md bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">New workspace</span>
          </a>
          <a href="/dashboard/items/new" class="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors">
            <div class="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-3-3v6m9-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">New item</span>
          </a>
        </div>
      </Card>
    </div>

    <!-- Widgets -->
    <div class="col-span-1 sm:col-span-2 row-span-1">
      <Card variant="elevated" padding="md" class="h-full" title="Widgets" description="Your dashboard widgets">
        {#snippet actions()}
          <a href="/dashboard/widgets" class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Manage</a>
        {/snippet}
        <div class="mt-2">
          {#if loading}
            <div class="flex gap-2">
              {#each Array(3) as _}
                <div class="h-8 w-20 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              {/each}
            </div>
          {:else if widgets.length === 0}
            <p class="text-sm text-gray-500 dark:text-gray-400">No widgets configured.</p>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each widgets.slice(0, 6) as widget}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                  {widget.title}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </Card>
    </div>
  </BentoGrid>
</div>
