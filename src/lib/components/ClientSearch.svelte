<!-- ClientSearch.svelte -->
<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { MagnifyingGlass, UserCircle } from '@steeze-ui/heroicons';
  import type { Client } from '$lib/types';
  
  // Props
  export let selectedClientId: string | null = null;
  export let label = 'Client';
  export let placeholder = 'Select a client';
  export let showSearch = true;
  export let showIcon = true;
  export let className = '';
  export let fieldClassName = '';
  export let hint: string | undefined = undefined;
  export let restrictToClientId: string | null = null;
  export let allowNullSelection = true;

  // Local state
  let searchQuery = $state('');
  
  // Helper functions
  function getClientTypeIndicator(type: string): string {
    switch (type) {
      case 'business': return '🏢';
      case 'container': return '📁';
      case 'individual': return '👤';
      default: return '';
    }
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
    const directChildren = clients.filter(c => c.parentId === clientId);
    const descendantIds = directChildren.map(c => c.id);
    
    for (const child of directChildren) {
      descendantIds.push(...getDescendantClientIds(child.id, clients));
    }
    
    return descendantIds;
  }

  function getClientsInHierarchy(clients: Client[], parentId: string | null = null, level = 0): Array<{ client: Client; level: number }> {
    const immediateChildren = clients.filter(c => c.parentId === parentId);
    immediateChildren.sort((a, b) => a.name.localeCompare(b.name));
    
    let result: Array<{ client: Client; level: number }> = [];
    for (const client of immediateChildren) {
      result.push({ client, level });
      result = result.concat(getClientsInHierarchy(clients, client.id, level + 1));
    }
    
    return result;
  }

  // Computed values
  const filteredClients = $derived((() => {
    // First, find all matching clients and their parents
    const matchingIds = new Set<string>();
    
    $clientStore.forEach(client => {
      const matchesSearch = !searchQuery || 
        client.name.toLowerCase().includes(searchQuery.toLowerCase());
        
      if (matchesSearch) {
        // Add the matching client
        matchingIds.add(client.id);
        // Add all its parent clients
        getParentClientIds(client.id, $clientStore).forEach(id => matchingIds.add(id));
      }
    });

    // If a parent client is selected for restriction, only show it and its descendants
    if (restrictToClientId) {
      const descendantIds = new Set([
        restrictToClientId,
        ...getDescendantClientIds(restrictToClientId, $clientStore)
      ]);
      // Intersect with matching IDs if we have a search
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

    // Convert matching IDs to hierarchical client list
    return getClientsInHierarchy($clientStore)
      .filter(({ client }) => matchingIds.has(client.id))
      .sort((a, b) => {
        // Sort by level first (parents before children)
        if (a.level !== b.level) return a.level - b.level;
        // Then by name within the same level
        return a.client.name.localeCompare(b.client.name);
      });
  })());

  const defaultHint = $derived(
    selectedClientId
      ? "🏢 = Business, 📁 = Container, 👤 = Individual"
      : "Select a client. Parent clients will show their hierarchy."
  );
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
          bind:value={searchQuery}
        />
      </div>
    {/if}
    <select
      class="form-select"
      bind:value={selectedClientId}
      size={1}
    >
      {#if allowNullSelection}
        <option value="">{placeholder}</option>
      {/if}
      {#each filteredClients as { client, level }}
        {@const indent = "　".repeat(level)}
        <option value={client.id}>
          {indent}{getClientTypeIndicator(client.type)} {client.name}
        </option>
      {/each}
    </select>
    <span class="form-hint">
      {hint ?? defaultHint}
    </span>
  </div>
</div>