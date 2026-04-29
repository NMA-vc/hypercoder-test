<script lang="ts">
  import { twMerge } from 'tailwind-merge';
  import type { Snippet } from 'svelte';

  type Variant = 'default' | 'elevated' | 'outlined' | 'ghost';
  type Padding = 'none' | 'sm' | 'md' | 'lg';

  interface Props {
    variant?: Variant;
    padding?: Padding;
    interactive?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    title?: string;
    description?: string;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
    actions?: Snippet;
  }

  let {
    variant = 'default',
    padding = 'md',
    interactive = false,
    class: className = '',
    onclick,
    title,
    description,
    children,
    header,
    footer,
    actions
  }: Props = $props();

  const variantClasses: Record<Variant, string> = {
    default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800',
    elevated: 'bg-white dark:bg-gray-900 shadow-lg border border-gray-100 dark:border-gray-800',
    outlined: 'bg-transparent border-2 border-gray-200 dark:border-gray-700',
    ghost: 'bg-gray-50 dark:bg-gray-800/50 border border-transparent'
  };

  const paddingClasses: Record<Padding, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7'
  };

  const interactiveClasses = $derived(
    interactive
      ? 'cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700'
      : ''
  );

  const classes = $derived(
    twMerge(
      'rounded-xl overflow-hidden',
      variantClasses[variant],
      paddingClasses[padding],
      interactiveClasses,
      className
    )
  );

  const hasHeader = $derived(!!header || !!title || !!description || !!actions);
</script>

{#if interactive || onclick}
  <button type="button" {onclick} class={twMerge(classes, 'w-full text-left')}>
    {#if hasHeader}
      <div class="flex items-start justify-between gap-3 {children ? 'mb-4' : ''}">
        <div class="flex-1 min-w-0">
          {#if header}
            {@render header()}
          {:else}
            {#if title}
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
            {/if}
            {#if description}
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            {/if}
          {/if}
        </div>
        {#if actions}
          <div class="flex-shrink-0">{@render actions()}</div>
        {/if}
      </div>
    {/if}

    {#if children}
      <div class="text-sm text-gray-700 dark:text-gray-300">{@render children()}</div>
    {/if}

    {#if footer}
      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">{@render footer()}</div>
    {/if}
  </button>
{:else}
  <div class={classes}>
    {#if hasHeader}
      <div class="flex items-start justify-between gap-3 {children ? 'mb-4' : ''}">
        <div class="flex-1 min-w-0">
          {#if header}
            {@render header()}
          {:else}
            {#if title}
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
            {/if}
            {#if description}
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            {/if}
          {/if}
        </div>
        {#if actions}
          <div class="flex-shrink-0">{@render actions()}</div>
        {/if}
      </div>
    {/if}

    {#if children}
      <div class="text-sm text-gray-700 dark:text-gray-300">{@render children()}</div>
    {/if}

    {#if footer}
      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">{@render footer()}</div>
    {/if}
  </div>
{/if}
