<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { itemsApi, type Item, type CreateItemPayload, type UpdateItemPayload } from '$lib/api/items';

  interface Props {
    workspaceId?: string;
    title?: string;
  }

  let { workspaceId, title = 'Items' }: Props = $props();

  let items = $state<Item[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Filters
  let search = $state('');
  let typeFilter = $state('');
  let tagFilter = $state('');

  // Form state
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formTitle = $state('');
  let formContent = $state('');
  let formType = $state('note');
  let formTags = $state('');
  let formWorkspaceId = $state('');
  let saving = $state(false);

  // Delete confirm
  let confirmDeleteId = $state<string | null>(null);

  const itemTypes = ['note', 'task', 'document', 'link', 'image'];

  async function load() {
    loading = true;
    error = null;
    try {
      const filters: any = {};
      if (workspaceId) filters.workspace_id = workspaceId;
      if (typeFilter) filters.item_type = typeFilter;
      if (tagFilter.trim()) filters.tags = tagFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (search.trim()) filters.search = search.trim();

      items = await itemsApi.list(filters);
    } catch (e: any) {
      error = e.message ?? 'Failed to load items';
      items = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void workspaceId;
    load();
  });

  let searchTimer: any;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(), 300);
  }

  function openCreate() {
    editingId = null;
    formTitle = '';
    formContent = '';
    formType = 'note';
    formTags = '';
    formWorkspaceId = workspaceId ?? '';
    showForm = true;
  }

  function openEdit(item: Item) {
    editingId = item.id;
    formTitle = item.title;
    formContent = item.content ?? '';
    formType = item.item_type;
    formTags = item.tags.join(', ');
    formWorkspaceId = item.workspace_id;
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingId = null;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      error = 'Title is required';
      return;
    }
    if (!editingId && !formWorkspaceId.trim()) {
      error = 'Workspace ID is required';
      return;
    }

    saving = true;
    error = null;
    try {
      const tags = formTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (editingId) {
        const payload: UpdateItemPayload = {
          title: formTitle.trim(),
          content: formContent.trim() || null,
          item_type: formType,
          tags
        };
        const updated = await itemsApi.update(editingId, payload);
        items = items.map(i => (i.id === editingId ? updated : i));
      } else {
        const payload: CreateItemPayload = {
          workspace_id: formWorkspaceId.trim(),
          title: formTitle.trim(),
          content: formContent.trim() || null,
          item_type: formType,
          tags
        };
        const created = await itemsApi.create(payload);
        items = [created, ...items];
      }
      closeForm();
    } catch (e: any) {
      error = e.message ?? 'Failed to save item';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await itemsApi.remove(id);
      items = items.filter(i => i.id !== id);
      confirmDeleteId = null;
    } catch (e: any) {
      error = e.message ?? 'Failed to delete item';
    }
  }

  function formatDate(s: string): string {
    try {
      return new Date(s).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  const filteredCount = $derived(items.length);
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {loading ? 'Loading...' : `${filteredCount} item${filteredCount === 1 ? '' : 's'}`}
      </p>
    </div>
    <button
      onclick={openCreate}
      class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      New item
    </button>
  </div>

  {#if error}
    <div class="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
      <span>{error}</span>
      <button onclick={() => (error = null)} class="text-red-700 dark:text-red-400 hover:underline text-xs">Dismiss</button>
    </div>
  {/if}

  <!-- Filters -->
  <Card variant="default" padding="md">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label for="search" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
        <input
          id="search"
          type="text"
          bind:value={search}
          oninput={onSearchInput}
          placeholder="Search by title..."
          class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </div>
      <div>
        <label for="type" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
        <select
          id="type"
          bind:value={typeFilter}
          onchange={load}
          class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All types</option>
          {#each itemTypes as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="tags" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
        <input
          id="tags"
          type="text"
          bind:value={tagFilter}
          onchange={load}
          placeholder="work, urgent"
          class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </div>
    </div>
  </Card>

  <!-- Items list -->
  {#if loading}
    <div class="space-y-2">
      {#each Array(4) as _}
        <div class="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if items.length === 0}
    <Card variant="ghost" padding="lg">
      <div class="text-center py-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">No items found</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Create your first item to get started.</p>
      </div>
    </Card>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      {#each items as item (item.id)}
        <Card variant="elevated" padding="md">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300">
                  {item.item_type}
                </span>
                <span class="text-xs text-gray-400 dark:text-gray-500">{formatDate(item.updated_at)}</span>
              </div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.title}</h3>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                onclick={() => openEdit(item)}
                aria-label="Edit"
                class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                onclick={() => (confirmDeleteId = item.id)}
                aria-label="Delete"
                class="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
                </svg>
              </button>
            </div>
          </div>

          {#if item.content}
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{item.content}</p>
          {/if}

          {#if item.tags.length > 0}
            <div class="flex flex-wrap gap-1">
              {#each item.tags as tag}
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{tag}</span>
              {/each}
            </div>
          {/if}

          {#if confirmDeleteId === item.id}
            <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
              <span class="text-xs text-gray-700 dark:text-gray-300">Delete this item?</span>
              <div class="flex gap-2">
                <button
                  onclick={() => (confirmDeleteId = null)}
                  class="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onclick={() => handleDelete(item.id)}
                  class="px-2 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Form modal -->
{#if showForm}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      aria-label="Close modal"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      onclick={closeForm}
    ></button>
    <div class="relative w-full max-w-lg">
      <Card variant="elevated" padding="lg">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingId ? 'Edit item' : 'Create item'}
          </h3>
          <button
            onclick={closeForm}
            aria-label="Close"
            class="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onsubmit={handleSubmit} class="space-y-4">
          {#if !editingId && !workspaceId}
            <div>
              <label for="f-ws" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workspace ID</label>
              <input
                id="f-ws"
                type="text"
                required
                bind:value={formWorkspaceId}
                class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="workspace_xxx"
              />
            </div>
          {/if}

          <div>
            <label for="f-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              id="f-title"
              type="text"
              required
              bind:value={formTitle}
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Item title"
            />
          </div>

          <div>
            <label for="f-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              id="f-type"
              bind:value={formType}
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {#each itemTypes as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="f-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <textarea
              id="f-content"
              rows={4}
              bind:value={formContent}
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Optional content..."
            ></textarea>
          </div>

          <div>
            <label for="f-tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
            <input
              id="f-tags"
              type="text"
              bind:value={formTags}
              class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="work, important"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onclick={closeForm}
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              class="px-3 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create item'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  </div>
{/if}
