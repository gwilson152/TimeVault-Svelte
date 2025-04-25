<script lang="ts">
  import { ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import type { Ticket, Client } from '$lib/types';
  import { onMount } from 'svelte';

  const props = $props<{
    onEdit?: (ticket: Ticket) => void;
    client?: Client | null;
  }>();

  // Filter state
  let searchTerm = $state('');
  let statusFilter = $state<string>('all');

  // Status options
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'closed', label: 'Closed' }
  ];

  // Filtered tickets
  const filteredTickets = $derived(
    $ticketsWithClientInfo
      .filter(ticket => {
        // Client filtering
        if (props.client && ticket.clientId !== props.client.id) {
          return false;
        }
        
        // Status filtering
        if (statusFilter !== 'all' && ticket.status !== statusFilter) {
          return false;
        }
        
        // Search filtering
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            ticket.title.toLowerCase().includes(search) ||
            (ticket.description?.toLowerCase().includes(search) || false) ||
            ticket.clientName.toLowerCase().includes(search)
          );
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  // Format date in a user-friendly way
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  // Status badge classes
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'open':
        return 'badge badge-success';
      case 'in-progress':
        return 'badge badge-warning';
      case 'closed':
        return 'badge bg-gray-700 text-default';
      default:
        return 'badge badge-info';
    }
  }
</script>

<div>
  <!-- Filters -->
  <div class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="search" class="sr-only">Search</label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <!-- Search icon (you can replace with an actual icon) -->
          <span class="text-text-blue-300">🔍</span>
        </div>
        <input
          id="search"
          type="text"
          bind:value={searchTerm}
          placeholder="Search tickets..."
          class="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-default"
        />
      </div>
    </div>
    
    <div>
      <label for="status" class="sr-only">Filter by status</label>
      <select
        id="status"
        bind:value={statusFilter}
        class="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-default"
      >
        {#each statusOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Ticket list -->
  {#if filteredTickets.length === 0}
    <div class="light-glass p-8 text-center rounded-md">
      <p class="text-text-blue-300">No tickets found matching your filters</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Client</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th class="w-16">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredTickets as ticket}
            <tr class="hover:light-glass">
              <td>
                <a 
                  href={`/tickets/${ticket.id}`}
                  class="text-accentBlue hover:text-accentPink"
                >
                  {ticket.title}
                </a>
              </td>
              <td>{ticket.clientName}</td>
              <td>
                <span class={getStatusBadgeClass(ticket.status)}>
                  {ticket.status}
                </span>
              </td>
              <td>{formatDate(ticket.updatedAt)}</td>
              <td>
                <button
                  class="p-1 text-text-blue-300 hover:text-accentBlue"
                  onclick={() => props.onEdit?.(ticket)}
                >
                  Edit
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>