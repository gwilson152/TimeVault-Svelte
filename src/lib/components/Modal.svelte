<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let width = 'max-w-2xl';
  export let variant: 'default' | 'fullscreen-mobile' = 'default';

  function handleClose() {
    open = false;
  }
</script>

<svelte:window on:keydown={e => e.key === 'Escape' && handleClose()} />

{#if open}
  <div 
    class="fixed inset-0 z-50 overflow-y-auto"
    role="dialog"
    tabindex="-1"
    aria-labelledby="modal-title"
    aria-modal="true"
    on:click|self={handleClose}
    on:keydown={e => e.key === 'Enter' && handleClose()}
    transition:fade={{ duration: 200 }}
  >
    <div class="min-h-screen px-4 flex items-center justify-center">
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        transition:fade={{ duration: 200 }}
      ></div>
      
      <div
        class="relative {width} w-full {variant === 'fullscreen-mobile' ? 'min-h-screen md:min-h-0 m-0 md:m-8 rounded-none md:rounded-lg' : 'm-8 rounded-lg'} glass-panel"
        transition:fly={{ y: 20, duration: 200 }}
      >
        <div class="flex flex-col {variant === 'fullscreen-mobile' ? 'h-screen md:h-auto' : ''}">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-white border-opacity-10">
            <div class="flex justify-between items-center">
              <h2 id="modal-title" class="text-lg font-medium">{title}</h2>
              <button
                type="button"
                class="rounded-full p-2 hover:bg-white hover:bg-opacity-5 transition-colors"
                on:click={handleClose}
                aria-label="Close modal"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto">
            <slot />
          </div>

          <!-- Optional footer slot -->
          {#if $$slots.footer}
            <div class="px-6 py-4 border-t border-white border-opacity-10">
              <slot name="footer" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  @layer components {
    .glass-panel {
      background-color: rgb(17 24 39 / 0.9);
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    }
  }
</style>