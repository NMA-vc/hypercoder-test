<script lang="ts">
  import { twMerge } from 'tailwind-merge';
  import type { Snippet } from 'svelte';

  interface Props {
    columns?: 1 | 2 | 3 | 4 | 6 | 12;
    gap?: 'sm' | 'md' | 'lg';
    autoRows?: 'sm' | 'md' | 'lg' | 'xl';
    class?: string;
    children?: Snippet;
  }

  let {
    columns = 4,
    gap = 'md',
    autoRows = 'md',
    class: className = '',
    children
  }: Props = $props();

  const columnClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-12'
  };

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const autoRowClasses = {
    sm: 'auto-rows-[120px]',
    md: 'auto-rows-[160px]',
    lg: 'auto-rows-[200px]',
    xl: 'auto-rows-[240px]'
  };

  const classes = $derived(
    twMerge(
      'grid w-full',
      columnClasses[columns],
      gapClasses[gap],
      autoRowClasses[autoRows],
      className
    )
  );
</script>

<div class={classes}>
  {#if children}
    {@render children()}
  {/if}
</div>

<!--
  Usage:
  <BentoGrid columns={4} gap="md" autoRows="md">
    <div class="col-span-2 row-span-2">...</div>
    <div class="col-span-1 row-span-1">...</div>
  </BentoGrid>
-->
