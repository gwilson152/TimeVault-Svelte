<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  export let open = false;
  export let title = '';
  export let width = 'max-w-2xl';
  
  const dispatch = createEventDispatcher();
  
  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      dispatch('close');
    }
  }
  
  onMount(() => {
    if (browser) {
      document.addEventListener('keydown', handleEscape);
    }
  });
  
  onDestroy(() => {
    if (browser) {
      document.removeEventListener('keydown', handleEscape);
    }
  });
</script>

{#if open}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="0"
    on:click|self={() => dispatch('close')}
    on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
  >
    <div class="modal-container {width}">
      <div class="glass-card bg-gray-50 shadow-lg rounded-lg overflow-hidden">
        {#if title}
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 id="modal-title" class="text-lg font-semibold">{title}</h3>
          </div>
        {/if}
        <div class="p-6">
          <slot />
        </div>
        {#if $$slots.footer}
          <div class="px-6 py-4 border-t border-gray-200">
            <slot name="footer" />
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}