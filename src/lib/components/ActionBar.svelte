<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import { actionBarStore } from '$lib/stores/actionBarStore';
  import { themeStore } from '$lib/stores/themeStore';
  import { onMount } from 'svelte';
  import { Sun, Moon } from '@steeze-ui/heroicons';

  export let flashTrigger = 0;

  $: actions = $actionBarStore.currentActions;
  $: currentTheme = $themeStore.current;
  
  onMount(() => {
    // Initialize the theme on component mount
    themeStore.initialize();
  });
  
  function toggleTheme() {
    themeStore.toggle();
  }
</script>

<!-- Bottom Action Bar -->
<div class="fixed bottom-2 sm:bottom-4 left-0 right-0 flex justify-center pointer-events-none z-50">
  <div
    class="container-glass w-fit rounded-md p-0.5 sm:p-1 flex justify-center transition-all duration-300 ease-in-out relative pointer-events-auto"
    class:flash={flashTrigger}
  >
    <div class="flex gap-1 sm:gap-2">
      <!-- Theme toggle button -->
      <button
        class="group relative p-1 sm:p-2 hover:text-accentBlue transition-all duration-100 ease-in-out hover:scale-110 hover:shadow-[0_0_8px_rgba(59,130,246,0.5)] flex flex-col items-center"
        on:click={toggleTheme}
        aria-label={currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {#if currentTheme === 'dark'}
          <Icon src={Sun} theme="solid" class="w-5 h-5 sm:w-6 sm:h-6" />
          <span class="text-xs mt-0.5 hidden sm:block">Light</span>
        {:else}
          <Icon src={Moon} theme="solid" class="w-5 h-5 sm:w-6 sm:h-6" />
          <span class="text-xs mt-0.5 hidden sm:block">Dark</span>
        {/if}
        <span
          class="absolute bottom-full mb-1 sm:mb-2 hidden group-hover:block light-glass text-default text-xs rounded py-0.5 sm:py-1 px-1 sm:px-2 transition-all duration-200 ease-in-out"
        >
          {currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        </span>
      </button>
      
      {#each actions as action}
        <a
          href={action.href}
          class="group relative p-1 sm:p-2 hover:text-accentBlue transition-all duration-100 ease-in-out hover:scale-110 hover:shadow-[0_0_8px_rgba(59,130,246,0.5)] flex flex-col items-center"
          aria-label={action.tooltip}
        >
          <Icon src={action.icon} theme="solid" class="w-5 h-5 sm:w-6 sm:h-6" />
          <span class="text-xs mt-0.5 hidden sm:block">{action.tooltip}</span>
          <span
            class="absolute bottom-full mb-1 sm:mb-2 hidden group-hover:block light-glass text-default text-xs rounded py-0.5 sm:py-1 px-1 sm:px-2 transition-all duration-200 ease-in-out"
          >
            {action.tooltip}
          </span>
        </a>
      {/each}
    </div>
  </div>
</div>

<style>
  .flash {
    animation: flash 0.5s ease-in-out;
  }

  @keyframes flash {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }
</style>