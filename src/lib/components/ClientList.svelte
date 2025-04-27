<script lang="ts">
  import { writable, derived } from 'svelte/store';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  
  interface ClientWithStats extends Client {
    level: number;
    totalHours: number;
    billableHours: number;
    unbilledHours: number;
  }

  // Props using runes syntax
  const props = $props<{
    onEdit: ((client: Client) => void) | null;
  }>();
  
  // State
  let sortField = writable<keyof Client>('name');
  let sortDirection = writable<'asc' | 'desc'>('asc');
  let filter = writable('');
  
  // Add collapsed state store
  const collapsedClients = writable<Set<string>>(new Set());
  
  // Client hierarchy store
  const clientHierarchy = derived(clientStore, ($clients) => {
    // Get root level clients (no parent)
    const rootClients = $clients.filter(c => !c.parentId);
    
    function processClient(client: Client, level: number): ClientWithStats {
      const clientTimeEntries = timeEntryStore.getByClientId(client.id);
      const totalHours = clientTimeEntries.reduce((sum, e) => sum + e.minutes, 0) / 60;
      const billableHours = clientTimeEntries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes, 0) / 60;
      const unbilledHours = clientTimeEntries.filter(e => e.billable && !e.billed).reduce((sum, e) => sum + e.minutes, 0) / 60;
      
      return {
        ...client,
        level,
        totalHours,
        billableHours,
        unbilledHours
      };
    }

    function buildHierarchy(clients: Client[], parentId: string | null = null, level: number = 0): ClientWithStats[] {
      const result: ClientWithStats[] = [];
      
      clients
        .filter(c => c.parentId === parentId)
        .forEach(client => {
          const processedClient = processClient(client, level);
          result.push(processedClient);
          result.push(...buildHierarchy(clients, client.id, level + 1));
        });
        
      return result;
    }
    
    return buildHierarchy($clients);
  });
  
  // Modify clientHierarchy to include visibility
  const visibleClients = derived(
    [clientHierarchy, collapsedClients],
    ([$hierarchy, $collapsed]) => {
      const result: ClientWithStats[] = [];
      
      function addVisibleClients(clients: ClientWithStats[]) {
        for (const client of clients) {
          result.push(client);
          
          // If client is not collapsed and has children, add them recursively
          if (!$collapsed.has(client.id)) {
            const children = $hierarchy.filter(c => c.parentId === client.id);
            addVisibleClients(children);
          }
        }
      }
      
      // Start with root clients
      const rootClients = $hierarchy.filter(c => !c.parentId);
      addVisibleClients(rootClients);
      
      return result;
    }
  );

  // Replace filteredClients derivation
  const filteredClients = derived(
    [visibleClients, filter],
    ([$visible, $filter]) => {
      const searchTerm = $filter.toLowerCase();
      if (!searchTerm) return $visible;
      
      return $visible.filter(client =>
        client.name.toLowerCase().includes(searchTerm) ||
        client.type.toLowerCase().includes(searchTerm)
      );
    }
  );

  // Toggle sort direction or change sort field
  function handleSort(field: keyof Client) {
    if ($sortField === field) {
      sortDirection.set($sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      sortField.set(field);
      sortDirection.set('asc');
    }
  }
  
  // Handle edit button click
  function handleEdit(client: Client) {
    if (props.onEdit) {
      props.onEdit(client);
    }
  }
  
  // Handle delete button click
  function handleDelete(id: string) {
    // Check if any time entries are associated with this client
    const clientEntries = timeEntryStore.getByClientId(id);
    
    if (clientEntries.length > 0) {
      alert(`Cannot delete client with ${clientEntries.length} associated time entries`);
      return;
    }
    
    if (confirm('Are you sure you want to delete this client?')) {
      clientStore.remove(id);
    }
  }

  function toggleCollapse(clientId: string) {
    collapsedClients.update($collapsed => {
      const newCollapsed = new Set($collapsed);
      if (newCollapsed.has(clientId)) {
        newCollapsed.delete(clientId);
      } else {
        newCollapsed.add(clientId);
      }
      return newCollapsed;
    });
  }
</script>

<div class="space-y-3">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
    <h2 class="text-xl font-semibold">Clients</h2>
    
    <div class="relative w-full sm:w-auto min-w-[200px]">
      <input
        type="text"
        placeholder="Search clients..."
        class="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        bind:value={$filter}
      />
      {#if $filter}
        <button 
          class="absolute right-2 top-1.5 text-gray-500 hover:text-gray-700"
          onclick={() => filter.set('')}
        >
          ✕
        </button>
      {/if}
    </div>
  </div>
  
  <div class="card-dense overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Client Name
          </th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
            Type
          </th>
          <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Hours
          </th>
          <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      
      <tbody class="divide-y divide-gray-200">
        {#if $filteredClients.length === 0}
          <tr>
            <td colspan="4" class="px-3 py-2 text-center text-gray-500">
              No clients found. Create a new client to get started.
            </td>
          </tr>
        {:else}
          {#each $filteredClients as client}
            <tr class="hover:bg-gray-50/50">
              <td class="px-3 py-2 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  {#if client.level > 0}
                    <div style="width: {client.level * 1.5}rem"></div>
                  {/if}
                  
                  {#if $clientHierarchy.some(c => c.parentId === client.id)}
                    <button 
                      class="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700"
                      onclick={(e) => {
                        e.preventDefault();
                        toggleCollapse(client.id);
                      }}
                    >
                      {#if $collapsedClients.has(client.id)}
                        <span class="transform rotate-[-90deg] transition-transform">▼</span>
                      {:else}
                        <span class="transform transition-transform">▼</span>
                      {/if}
                    </button>
                  {:else}
                    <div class="w-4"></div>
                  {/if}
                  
                  <a 
                    href="/clients/{client.id}" 
                    class="text-blue-600 hover:text-blue-900"
                  >
                    {client.name}
                  </a>
                  
                  <!-- Show type badge on mobile -->
                  <span class="sm:hidden inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium
                    {client.type === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                    {client.type.charAt(0).toUpperCase()}
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium
                  {client.type === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                  {client.type.charAt(0).toUpperCase() + client.type.slice(1)}
                </span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                <div class="flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span title="Total Hours">{client.totalHours.toFixed(1)}</span>
                  <span class="text-blue-600" title="Unbilled Hours">({client.unbilledHours.toFixed(1)})</span>
                </div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                <button 
                  class="text-blue-600 hover:text-blue-900 mr-2"
                  onclick={() => handleEdit(client)}
                >
                  Edit
                </button>
                <button 
                  class="text-red-600 hover:text-red-900"
                  onclick={() => handleDelete(client.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>