<!-- ClientSearch.svelte -->
<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { UserCircle } from '@steeze-ui/heroicons';
  import type { Client } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    change: string | null;
  }>();
  
  const props = $props<{
    selectedClientId?: string | null;
    label?: string;
    placeholder?: string;
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
  let showIcon = $state(props.showIcon ?? true);
  let className = $state(props.className ?? '');
  let fieldClassName = $state(props.fieldClassName ?? '');
  let hint = $state(props.hint);
  let restrictToClientId = $state(props.restrictToClientId ?? null);
  let allowNullSelection = $state(props.allowNullSelection ?? true);

  // Update state when props change
  $effect(() => {
    label = props.label ?? 'Client';
    placeholder = props.placeholder ?? 'Select a client';
    showIcon = props.showIcon ?? true;
    className = props.className ?? '';
    fieldClassName = props.fieldClassName ?? '';
    hint = props.hint;
    restrictToClientId = props.restrictToClientId ?? null;
    allowNullSelection = props.allowNullSelection ?? true;
  });

  // Helper functions
  function getClientTypePrefix(type: string): string {
    switch (type) {
      case 'business': return '[B] ';
      case 'container': return '[C] ';
      case 'individual': return '[I] ';
      default: return '[?] ';
    }
  }

  function getClientLabel(client: Client, level: number): string {
    const indent = "　".repeat(level);
    const prefix = getClientTypePrefix(client.type);
    return `${indent}${prefix}${client.name}`;
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

  // Get client type priority for sorting (containers first, then business, then individuals)
  function getClientTypePriority(type: string): number {
    switch (type) {
      case 'container': return 1;
      case 'business': return 2;
      case 'individual': return 3;
      default: return 4;
    }
  }

  // Sort clients by type priority then by name
  function sortClients(a: Client, b: Client): number {
    const typePriorityDiff = getClientTypePriority(a.type) - getClientTypePriority(b.type);
    
    // If types are different, sort by type priority
    if (typePriorityDiff !== 0) {
      return typePriorityDiff;
    }
    
    // If types are the same, sort alphabetically by name
    return a.name.localeCompare(b.name);
  }

  function getClientsInHierarchy(clients: Client[]) {
    const result: { client: Client; level: number }[] = [];
    
    function addWithDescendants(clientId: string | null, level: number) {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;
      
      result.push({ client, level });
      
      const children = clients
        .filter(c => c.parentId === clientId)
        .sort(sortClients); // Sort by type priority first, then by name
        
      for (const child of children) {
        addWithDescendants(child.id, level + 1);
      }
    }
    
    const rootClients = clients
      .filter(c => !c.parentId)
      .sort(sortClients); // Sort by type priority first, then by name
      
    for (const client of rootClients) {
      addWithDescendants(client.id, 0);
    }
    
    return result;
  }

  function handleSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const clientId = select.value === "" ? null : select.value;
    dispatch('change', clientId);
  }

  // Filter clients based on restriction
  const displayClients = $derived((() => {
    let clients = $clientStore;
    
    // Filter to only show the restricted client and its descendants if specified
    if (restrictToClientId) {
      const descendantIds = new Set([
        restrictToClientId,
        ...getDescendantClientIds(restrictToClientId, clients)
      ]);
      
      clients = clients.filter(client => descendantIds.has(client.id));
    }

    return getClientsInHierarchy(clients);
  })());

  // Get the selected client name for display
  const selectedClientName = $derived((() => {
    if (!props.selectedClientId) return placeholder;
    
    const client = $clientStore.find(c => c.id === props.selectedClientId);
    if (!client) return placeholder;
    
    return client.name;
  })());
</script>

<div class="form-field mb-0 {className}">
  <label for="client-select" class="form-label flex items-center gap-2 mb-1">
    {#if showIcon}
      <Icon src={UserCircle} class="w-4 h-4 text-blue-500" />
    {/if}
    {label}
  </label>
  <div class="space-y-2 {fieldClassName}">
    <select
      id="client-select"
      class="form-select w-full"
      onchange={handleSelectChange}
      value={props.selectedClientId || ""}
    >
      {#if allowNullSelection}
        <option value="">-- {placeholder} --</option>
      {/if}
      
      {#each displayClients as { client, level }}
        <option value={client.id} selected={props.selectedClientId === client.id}>
          {getClientLabel(client, level)}
        </option>
      {/each}
    </select>

    {#if hint}
      <div class="form-hint">{hint}</div>
    {:else}
      <div class="form-hint">
        [C] Container &nbsp; [B] Business &nbsp; [I] Individual
      </div>
    {/if}
  </div>
</div>