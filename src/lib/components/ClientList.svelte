<script lang="ts">
  import { writable, derived } from 'svelte/store';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  
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
  
  // Client hierarchy store
  const clientHierarchy = derived(clientStore, ($clients) => {
    // Get root level clients (no parent)
    const rootClients = $clients.filter(c => !c.parentId);
    
    // Recursively build hierarchy
    function buildHierarchy(clients: Client[], level: number = 0): ClientWithStats[] {
      return clients.flatMap(client => {
        const children = $clients.filter(c => c.parentId === client.id);
        const entries = timeEntryStore.getByClientId(client.id);
        const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
        const billableEntries = entries.filter(entry => entry.billable);
        const billableHours = billableEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const unbilledEntries = billableEntries.filter(entry => !entry.billed);
        const unbilledHours = unbilledEntries.reduce((sum, entry) => sum + entry.hours, 0);
        
        return [
          { ...client, level, totalHours, billableHours, unbilledHours },
          ...buildHierarchy(children, level + 1)
        ];
      });
    }
    
    return buildHierarchy(rootClients);
  });
  
  // Filter clients with hierarchy
  const filteredClients = derived([clientHierarchy, filter], ([$hierarchy, $filter]) => {
    const searchTerm = $filter.toLowerCase();
    if (!searchTerm) return $hierarchy;
    
    return $hierarchy.filter(client =>
      client.name.toLowerCase().includes(searchTerm) ||
      client.type.toLowerCase().includes(searchTerm) ||
      client.rate.toString().includes(searchTerm)
    );
  });
  
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
</script>

<div class="space-y-4">
  <div class="flex justify-between items-center">
    <h2 class="text-xl font-semibold">Clients</h2>
    
    <div class="relative">
      <input
        type="text"
        placeholder="Search clients..."
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        bind:value={$filter}
      />
      {#if $filter}
        <button 
          class="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
          onclick={() => filter.set('')}
        >
          ✕
        </button>
      {/if}
    </div>
  </div>
  
  <div class="bg-white rounded-lg shadow overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Client Name
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Type
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Hourly Rate
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total Hours
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Unbilled Hours
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      
      <tbody class="bg-white divide-y divide-gray-200">
        {#if $filteredClients.length === 0}
          <tr>
            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
              No clients found. Create a new client to get started.
            </td>
          </tr>
        {:else}
          {#each $filteredClients as client}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  {#if client.level > 0}
                    <div class="w-{client.level * 6} border-l-2 border-gray-300 h-6 mr-2"></div>
                  {/if}
                  <a 
                    href="/clients/{client.id}" 
                    class="text-blue-600 hover:text-blue-900"
                  >
                    {client.name}
                  </a>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  {client.type === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                  {client.type.charAt(0).toUpperCase() + client.type.slice(1)}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatCurrency(client.rate)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {client.totalHours.toFixed(2)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {client.unbilledHours.toFixed(2)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                  class="text-blue-600 hover:text-blue-900 mr-3"
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