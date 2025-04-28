<!-- ClientSearch.svelte -->
<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { MagnifyingGlass, UserCircle } from '@steeze-ui/heroicons';
  import type { Client } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  
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

  // Track selected value and emit changes
  function handleSelectionChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value ? select.value : null;
    dispatch('change', value);
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

  const defaultHint = $derived(
    props.selectedClientId
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
          value={searchQuery}
          oninput={e => searchQuery = e.currentTarget.value}
        />
      </div>
    {/if}
    <select
      class="form-select"
      value={props.selectedClientId ?? ''}
      onchange={handleSelectionChange}
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