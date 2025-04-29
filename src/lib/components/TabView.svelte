<script lang="ts">
  import { onMount } from 'svelte';

  // Define props with proper Svelte 5 syntax
  const props = $props<{
    tabs: Array<{
      id: string;
      title: string;
      icon?: () => any;  // Must be a function
    }>;
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    tabContent: Record<string, () => {
      component: () => any;  // Must be a function that returns component
      props?: Record<string, any>;
      content?: string;
      handlers?: {
        onMount?: (element: HTMLElement) => (() => void) | void;
      };
    }>;
  }>();

  // State for the active tab
  let currentTabId = $state(props.activeTab || (props.tabs.length > 0 ? props.tabs[0].id : ''));
  // Store cleanup functions for component handlers
  let cleanupFunctions = $state<Record<string, () => void>>({});

  // Keep track of tab panels
  let tabPanels = $state<Record<string, HTMLElement>>({});

  // Function to handle panel reference updates
  function setPanelRef(tabId: string, element: HTMLElement | null) {
    if (!element) return;
    
    tabPanels[tabId] = element;
    
    // If this is the active tab and has content
    if (tabId === currentTabId && props.tabContent[tabId]) {
      const contentObj = props.tabContent[tabId]();
      
      if (contentObj.handlers?.onMount) {
        const cleanup = contentObj.handlers.onMount(element);
        if (cleanup) {
          cleanupFunctions[tabId] = cleanup;
        }
      }
    }
  }

  // Switch tabs when clicked
  function switchTab(tabId: string) {
    // Clean up previous tab's handlers if any
    if (cleanupFunctions[currentTabId]) {
      cleanupFunctions[currentTabId]();
      delete cleanupFunctions[currentTabId];
    }
    
    currentTabId = tabId;
    if (props.onTabChange) {
      props.onTabChange(tabId);
    }
  }

  // Clean up all handlers on component unmount
  onMount(() => {
    return () => {
      Object.values(cleanupFunctions).forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  });

  // Helper functions
  function renderIcon(icon: any) {
    return typeof icon === 'function' ? icon : () => icon;
  }

  function renderComponent(component: any) {
    return typeof component === 'function' ? component : () => component;
  }
</script>

<div class="space-y-4">
  <!-- Tab navigation -->
  <div class="border-b border-gray-700/50">
    <div class="flex -mb-px space-x-6 overflow-x-auto">
      {#each props.tabs as tab}
        <button
          onclick={() => switchTab(tab.id)}
          class="py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap {currentTabId === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'}"
          aria-selected={currentTabId === tab.id}
          role="tab"
        >
          <div class="flex items-center gap-1">
            {#if tab.icon}
              {@render renderIcon(tab.icon)()}
            {/if}
            <span>{tab.title}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Tab content -->
  <div>
    {#each props.tabs as tab}
      {#if currentTabId === tab.id && props.tabContent[tab.id]}
        {@const tabContent = props.tabContent[tab.id]()}
        <div 
          role="tabpanel" 
          id={`tabpanel-${tab.id}`}
          bind:this={tabPanels[tab.id]}
          onmount={() => setPanelRef(tab.id, tabPanels[tab.id])}
        >
          {@render renderComponent(tabContent.component)({
            ...tabContent.props || {},
            children: tabContent.content ? { html: tabContent.content } : undefined
          })}
        </div>
      {/if}
    {/each}
  </div>
</div>