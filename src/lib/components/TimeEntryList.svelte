<script lang="ts">
  import { writable, derived } from 'svelte/store';
  import type { TimeEntry } from '$lib/types';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { formatDate, formatHours } from '$lib/utils/invoiceUtils';
  
  const onEdit = $props<((entry: TimeEntry) => void) | null>();
  
  // State
  let sortField = writable<keyof TimeEntry>('date');
  let sortDirection = writable<'asc' | 'desc'>('desc');
  let filter = writable('');
  
  // Filter entries
  const filteredEntries = derived(
    [entriesWithClientInfo, filter],
    ([$entriesWithClientInfo, $filter]) => {
      return $entriesWithClientInfo.filter(entry => {
        const searchTerm = $filter.toLowerCase();
        if (!searchTerm) return true;
        
        return (
          entry.description.toLowerCase().includes(searchTerm) ||
          (entry.clientName?.toLowerCase() || '').includes(searchTerm)
        );
      });
    }
  );

  // Sort entries
  const sortedEntries = derived(
    [filteredEntries, sortField, sortDirection],
    ([$filteredEntries, $sortField, $sortDirection]) => {
      const field = $sortField;
      const direction = $sortDirection;
      
      return [...$filteredEntries].sort((a, b) => {
        const valueA = a[field];
        const valueB = b[field];
        
        if (valueA === null || valueB === null) return 0;
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return direction === 'asc' 
            ? valueA.localeCompare(valueB) 
            : valueB.localeCompare(valueA);
        }
        
        return direction === 'asc' 
          ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
          : (valueA > valueB ? -1 : valueA < valueB ? 1 : 0);
      });
    }
  );
  
  // Toggle sort direction or change sort field
  function handleSort(field: keyof TimeEntry) {
    if ($sortField === field) {
      sortDirection.set($sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      sortField.set(field);
      sortDirection.set('asc');
    }
  }
  
  // Handle edit button click
  function handleEdit(entry: TimeEntry) {
    if (onEdit) {
      onEdit(entry);
    }
  }
  
  // Handle delete button click
  function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this time entry?')) {
      timeEntryStore.remove(id);
    }
  }
</script>

<div class="space-y-4">
  <div class="flex justify-between items-center">
    <h2 class="text-xl font-semibold">Time Entries</h2>
    
    <div class="relative">
      <input
        type="text"
        placeholder="Search entries..."
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
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('date')}
          >
            Date
            {#if $sortField === 'date'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('description')}
          >
            Description
            {#if $sortField === 'description'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('clientId')}
          >
            Client
            {#if $sortField === 'clientId'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('hours')}
          >
            Hours
            {#if $sortField === 'hours'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('billable')}
          >
            Billable
            {#if $sortField === 'billable'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('billed')}
          >
            Status
            {#if $sortField === 'billed'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      
      <tbody class="bg-white divide-y divide-gray-200">
        {#if $sortedEntries.length === 0}
          <tr>
            <td colspan="7" class="px-6 py-4 text-center text-gray-500">
              No time entries found. Create a new entry to get started.
            </td>
          </tr>
        {:else}
          {#each $sortedEntries as entry}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatDate(entry.date)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {entry.description}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {entry.clientName || 'No Client'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatHours(entry.hours)}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {entry.billable ? 'Yes' : 'No'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {entry.billable 
                  ? (entry.billed ? 'Billed' : 'Unbilled') 
                  : 'N/A'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                  class="text-blue-600 hover:text-blue-900 mr-3"
                  onclick={() => handleEdit(entry)}
                >
                  Edit
                </button>
                <button 
                  class="text-red-600 hover:text-red-900"
                  onclick={() => handleDelete(entry.id)}
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