<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  /**
   * Modal component using Svelte 5 runes
   * @props
   *  - open: Whether the modal is open
   *  - title: Modal title
   *  - size: Size preset (sm, md, lg, xl, full)
   *  - variant: Visual variant (default, drawer, fullscreen)
   *  - hasFooter: Whether the modal has a footer (used for SSR slot detection)
   */
  
  // Component props
  let props = $props<{
    open?: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    variant?: 'default' | 'drawer' | 'fullscreen';
    hasFooter?: boolean;
  }>();

  // Local reactive state
  let isOpen = $state(props.open ?? false);
  let modalTitle = $state(props.title ?? '');
  let modalSize = $state(props.size ?? 'md');
  let modalVariant = $state(props.variant ?? 'default');
  let showFooter = $state(props.hasFooter ?? false);
  
  // Effect to sync prop changes to local state
  $effect(() => {
    isOpen = props.open ?? isOpen;
    modalTitle = props.title ?? modalTitle;
    modalSize = props.size ?? modalSize;
    modalVariant = props.variant ?? modalVariant;
    showFooter = props.hasFooter ?? showFooter;
  });

  // Map size to tailwind width class
  const sizeToWidth = $derived(() => {
    switch (modalSize) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case 'full': return 'max-w-4xl';
      default: return 'max-w-2xl';
    }
  });
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  // Close modal
  function closeModal() {
    dispatch('close');
  }
  
  // Event handlers
  function handleEscapeKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      closeModal();
    }
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && isOpen) {
      closeModal();
    }
  }
  
  // Helper classes for variants
  const variantClasses = $derived(() => {
    switch (modalVariant) {
      case 'drawer':
        return 'fixed right-0 top-0 h-full w-full sm:max-w-md rounded-l-lg';
      case 'fullscreen':
        return 'fixed inset-0 h-full w-full m-0 rounded-none';
      default:
        return `relative ${sizeToWidth} w-full m-4 md:m-8 rounded-lg`;
    }
  });
</script>

<svelte:window on:keydown={handleEscapeKey} />

{#if isOpen}
  <div 
    class="fixed inset-0 z-50 overflow-y-auto"
    role="dialog"
    tabindex="-1"
    aria-labelledby="modal-title"
    aria-modal="true"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    <div class="min-h-screen flex items-center justify-center {modalVariant === 'drawer' ? 'justify-end' : 'px-4'}">
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 bg-opacity-50 backdrop-blur-sm"
        transition:fade={{ duration: 400 }}
      ></div>
      
      <!-- Modal container -->
      <div
        class="bg-white dark:bg-gray-100 text-gray-900 shadow-lg {variantClasses} z-10"
        transition:fly={{ 
          y: modalVariant === 'drawer' ? 0 : 20,
          x: modalVariant === 'drawer' ? 20 : 0, 
          duration: 400
        }}
      >
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 id="modal-title" class="text-lg font-medium text-gray-900">{modalTitle}</h2>
              <button
                type="button"
                class="rounded-full p-2 hover:bg-gray-100 transition-colors"
                on:click={closeModal}
                aria-label="Close modal"
              >
                <svg class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto">
            <slot></slot>
          </div>

          <!-- Optional footer -->
          {#if showFooter}
            <div class="px-6 py-4 border-t border-gray-200">
              <slot name="footer"></slot>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}