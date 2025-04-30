<!-- ClientSearch.svelte -->
<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { 
    UserCircle, MagnifyingGlass, 
    BuildingOffice, Folder, User 
  } from '@steeze-ui/heroicons';
  import type { Client } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import { clickOutside } from '$lib/utils/actions';
  
  const dispatch = createEventDispatcher<{
    change: string | null;
  }>();
  
  const props = $props<{
    selectedClientId?: string | null;
    label?: string;
    placeholder?: string;
    showSearch?: boolean;
    showIcon?: boolean;
    className?: string;
    fieldClassName?: string;
    hint?: string;
    restrictToClientId?: string | null;
    allowNullSelection?: boolean;
  }>();

  // Local state with default values
  let label = $state(props.label ?? 'Client');
  let placeholder = $state(props.placeholder ?? 'Select a client');
  let showSearch = $state(props.showSearch ?? true);
  let showIcon = $state(props.showIcon ?? true);
  let className = $state(props.className ?? '');
  let fieldClassName = $state(props.fieldClassName ?? '');
  let hint = $state(props.hint);
  let restrictToClientId = $state(props.restrictToClientId ?? null);
  let allowNullSelection = $state(props.allowNullSelection ?? true);
  let searchQuery = $state('');
  let isOpen = $state(false);
  let selectRef: HTMLDivElement;

  // Update state when props change
  $effect(() => {
    label = props.label ?? 'Client';
    placeholder = props.placeholder ?? 'Select a client';
    showSearch = props.showSearch ?? true;
    showIcon = props.showIcon ?? true;
    className = props.className ?? '';
    fieldClassName = props.fieldClassName ?? '';
    hint = props.hint;
    restrictToClientId = props.restrictToClientId ?? null;
    allowNullSelection = props.allowNullSelection ?? true;
  });

  // Helper functions
  function getClientTypeIcon(type: string) {
    switch (type) {
      case 'business': return BuildingOffice;
      case 'container': return Folder;
      case 'individual': return User;
      default: return UserCircle;
    }
  }

  function getClientLabel(client: Client, level: number): string {
    const indent = "　".repeat(level);
    return `${indent}${client.name}`;
  }

  function getParentClientIds(clientId: string, clients: Client[]): string[] {
    const ids: string[] = [];
    let current = clients.find(c => c.id === clientId);
    
    while (current?.parentId) {
      ids.push(current.parentId);
      current = clients.find(c => c.id === current?.parentId);
    }
    
    return ids;
  }
  
  function getDescendantClientIds(clientId: string, clients: Client[]): string[] {
    const descendantIds: string[] = [];
    const stack = [clientId];
    
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const children = clients.filter(c => c.parentId === currentId);
      
      for (const child of children) {
        descendantIds.push(child.id);
        stack.push(child.id);
      }
    }
    
    return descendantIds;
  }

  function getClientsInHierarchy(clients: Client[]) {
    const result: { client: Client; level: number }[] = [];
    
    function addWithDescendants(clientId: string | null, level: number) {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;
      
      result.push({ client, level });
      
      const children = clients
        .filter(c => c.parentId === clientId)
        .sort((a, b) => a.name.localeCompare(b.name));
        
      for (const child of children) {
        addWithDescendants(child.id, level + 1);
      }
    }
    
    const rootClients = clients
      .filter(c => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
      
    for (const client of rootClients) {
      addWithDescendants(client.id, 0);
    }
    
    return result;
  }

  function handleOptionClick(clientId: string | null) {
    dispatch('change', clientId);
    isOpen = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isOpen = false;
    }
  }

  // Filter and sort clients
  const filteredClients = $derived((() => {
    const matchingIds = new Set<string>();
    
    $clientStore.forEach(client => {
      const matchesSearch = !searchQuery || 
        client.name.toLowerCase().includes(searchQuery.toLowerCase());
        
      if (matchesSearch) {
        matchingIds.add(client.id);
        getParentClientIds(client.id, $clientStore).forEach(id => matchingIds.add(id));
      }
    });

    if (restrictToClientId) {
      const descendantIds = new Set([
        restrictToClientId,
        ...getDescendantClientIds(restrictToClientId, $clientStore)
      ]);
      if (searchQuery) {
        const intersection = new Set(
          [...matchingIds].filter(id => descendantIds.has(id))
        );
        matchingIds.clear();
        intersection.forEach(id => matchingIds.add(id));
      } else {
        matchingIds.clear();
        descendantIds.forEach(id => matchingIds.add(id));
      }
    }

    return getClientsInHierarchy($clientStore)
      .filter(({ client }) => matchingIds.has(client.id))
      .sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.client.name.localeCompare(b.client.name);
      });
  })());
</script>

<div class="form-field mb-0 {className}">
  <label class="form-label flex items-center gap-2 mb-1">
    {#if showIcon}
      <Icon src={UserCircle} class="w-4 h-4 text-blue-500" />
    {/if}
    {label}
  </label>
  <div class="space-y-2 {fieldClassName}">
    {#if showSearch}
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          <Icon src={MagnifyingGlass} class="w-4 h-4 text-gray-400" />
        </div>
        <input
          type="text"
          class="form-input pl-8"
          placeholder="Type to search clients..."
          value={searchQuery}
          oninput={e => searchQuery = e.currentTarget.value}
        />
      </div>
    {/if}
    
    <div 
      class="client-search-container"
      use:clickOutside={() => isOpen = false}
      bind:this={selectRef}
    >
      <button
        type="button"
        class="form-select w-full text-left flex items-center gap-2"
        onclick={() => isOpen = !isOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {#if props.selectedClientId}
          {@const selectedClient = $clientStore.find(c => c.id === props.selectedClientId)}
          {#if selectedClient}
            <Icon src={getClientTypeIcon(selectedClient.type)} class="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span class="truncate">{selectedClient.name}</span>
          {/if}
        {:else}
          <Icon src={UserCircle} class="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span class="text-gray-400">{placeholder}</span>
        {/if}
      </button>

      {#if isOpen}
        <div 
          class="client-search-dropdown"
          role="listbox"
          tabindex="-1"
          onkeydown={handleKeyDown}
        >
          {#if allowNullSelection}
            <button
              type="button"
              class="client-search-option"
              role="option"
              aria-selected={props.selectedClientId === null}
              onclick={() => handleOptionClick(null)}
            >
              <Icon src={UserCircle} class="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span class="text-gray-400">{placeholder}</span>
            </button>
          {/if}
          
          {#each filteredClients as { client, level }}
            <button
              type="button"
              class="client-search-option z-[1000] {props.selectedClientId === client.id ? 'selected' : ''}"
              style="padding-left: {level * 1.5 + 0.75}rem"
              role="option"
              aria-selected={props.selectedClientId === client.id}
              onclick={() => handleOptionClick(client.id)}
            >
              <Icon src={getClientTypeIcon(client.type)} class="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span class="truncate">{client.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="form-hint flex items-center gap-2">
      {#if hint}
        {hint}
      {:else}
        <span class="flex items-center gap-1">
          <Icon src={BuildingOffice} class="w-3 h-3" /> Business
        </span>
        <span class="flex items-center gap-1">
          <Icon src={Folder} class="w-3 h-3" /> Container
        </span>
        <span class="flex items-center gap-1">
          <Icon src={User} class="w-3 h-3" /> Individual
        </span>
      {/if}
    </div>
  </div>
</div>