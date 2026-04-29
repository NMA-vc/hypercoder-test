<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let localError = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    localError = null;
    auth.clearError();

    if (password.length < 6) {
      localError = 'Password must be at least 6 characters';
      return;
    }
    if (password !== confirm) {
      localError = 'Passwords do not match';
      return;
    }

    const ok = await auth.signup(email, password);
    if (ok) goto('/');
  }

  const errorMessage = $derived(localError || auth.error);
</script>

<svelte:head>
  <title>Create account</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Create your account</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started in less than a minute</p>
    </div>

    <Card variant="elevated" padding="lg">
      <form onsubmit={handleSubmit} class="space-y-5">
        {#if errorMessage}
          <div class="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400">
            {errorMessage}
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            required
            autocomplete="email"
            bind:value={email}
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
          <input
            id="password"
            type="password"
            required
            minlength={6}
            autocomplete="new-password"
            bind:value={password}
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label for="confirm" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            autocomplete="new-password"
            bind:value={confirm}
            class="w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            placeholder="Re-enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={auth.loading}
          class="w-full inline-flex items-center justify-center rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 text-sm transition-colors"
        >
          {auth.loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {#snippet footer()}
        <p class="text-sm text-center text-gray-600 dark:text-gray-400">
          Already have an account?
          <a href="/login" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">Sign in</a>
        </p>
      {/snippet}
    </Card>
  </div>
</div>
