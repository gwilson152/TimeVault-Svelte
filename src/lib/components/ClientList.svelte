<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  
  // Props
  const onEdit = $props<((client: Client) => void) | null>();
  
  // State
  let sortField = writable<keyof Client>('name');
  let sortDirection = writable<'asc' | 'desc'>('asc');
  let filter = writable('');
  
  // Sort clients
  $effect(() => {
    const field = $sortField;
    const direction = $sortDirection;
    
    $clientStore = [...$clientStore].sort((a, b) => {
      if (typeof a[field] === 'string' && typeof b[field] === 'string') {
        const valueA = (a[field] as string).toLowerCase();
        const valueB = (b[field] as string).toLowerCase();
        return direction === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      } else {
        const valueA = a[field];
        const valueB = b[field];
        return direction === 'asc' 
          ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
          : (valueA > valueB ? -1 : valueA < valueB ? 1 : 0);
      }
    });
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
    if (onEdit) {
      onEdit(client);
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
  
  // Filter clients
  $: filteredClients = $clientStore.filter(client => {
    const searchTerm = $filter.toLowerCase();
    if (!searchTerm) return true;
    
    return (
      client.name.toLowerCase().includes(searchTerm) ||
      client.rate.toString().includes(searchTerm)
    );
  });
  
  // Calculate stats for each client
  $: clientStats = filteredClients.map((client: Client) => {
    const entries = timeEntryStore.getByClientId(client.id);
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const billableEntries = entries.filter(entry => entry.billable);
    const billableHours = billableEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const unbilledEntries = billableEntries.filter(entry => !entry.billed);
    const unbilledHours = unbilledEntries.reduce((sum, entry) => sum + entry.hours, 0);
    
    return {
      ...client,
      totalHours,
      billableHours,
      unbilledHours
    };
  });
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
          on:click={() => filter.set('')}
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
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => handleSort('name')}
          >
            Client Name
            {#if $sortField === 'name'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => handleSort('rate')}
          >
            Hourly Rate
            {#if $sortField === 'rate'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
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
        {#if clientStats.length === 0}
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-gray-500">
              No clients found. Create a new client to get started.
            </td>
          </tr>
        {:else}
          {#each clientStats as client}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {client.name}
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
                  on:click={() => handleEdit(client)}
                >
                  Edit
                </button>
                <button 
                  class="text-red-600 hover:text-red-900"
                  on:click={() => handleDelete(client.id)}
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