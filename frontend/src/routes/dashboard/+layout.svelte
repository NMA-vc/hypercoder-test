<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  $effect(() => {
    if (!auth.isAuthenticated) {
      goto('/login');
    }
  });

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: 'home' },
    { href: '/dashboard/workspaces', label: 'Workspaces', icon: 'folder' },
    { href: '/dashboard/items', label: 'Items', icon: 'list' },
    { href: '/dashboard/widgets', label: 'Widgets', icon: 'grid' }
  ];

  const currentPath = $derived($page.url.pathname);

  async function handleLogout() {
    await auth.logout();
    goto('/login');
  }

  let sidebarOpen = $state(false);
</script>

{#if auth.isAuthenticated}
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
    >
      <div class="flex flex-col h-full">
        <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <a href="/dashboard" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span class="font-semibold text-gray-900 dark:text-gray-100">Dashboard</span>
          </a>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {#each navItems as item}
            {@const active = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
            <a
              href={item.href}
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors {active ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
            >
              <span class="w-5 h-5">
                {#if item.icon === 'home'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>
                {:else if item.icon === 'folder'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                {:else if item.icon === 'list'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                {:else if item.icon === 'grid'}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
                {/if}
              </span>
              {item.label}
            </a>
          {/each}
        </nav>

        <div class="p-3 border-t border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-3 px-3 py-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-medium">
              {auth.user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{auth.user?.email}</p>
            </div>
          </div>
          <button
            onclick={handleLogout}
            class="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </aside>

    {#if sidebarOpen}
      <button
        type="button"
        aria-label="Close sidebar"
        class="fixed inset-0 z-30 bg-black/40 lg:hidden"
        onclick={() => (sidebarOpen = false)}
      ></button>
    {/if}

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between px-4 sm:px-6 py-3">
          <button
            type="button"
            onclick={() => (sidebarOpen = !sidebarOpen)}
            class="lg:hidden p-2 -ml-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div class="flex-1"></div>
        </div>
      </header>

      <main class="flex-1 px-4 sm:px-6 py-6 overflow-x-hidden">
        {#if children}
          {@render children()}
        {/if}
      </main>
    </div>
  </div>
{/if}
