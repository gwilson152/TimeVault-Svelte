<script lang="ts">
  import '../app.css';
  import ActionBar from '$lib/components/ActionBar.svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
</script>

<div class="min-h-screen flex flex-col">
  <main class="flex-grow pt-16 pb-24">
    {#key $page.url.pathname}
      <div 
        class="responsive-container mx-auto"
        in:fade={{ duration: 150 }}
      >
        <slot />
      </div>
    {/key}
  </main>
  <ActionBar />
</div>

<style>
  :global(body) {
    overflow-y: scroll;
  }
</style>