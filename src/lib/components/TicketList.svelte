<script lang="ts">
  import { onMount } from 'svelte';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import type { Ticket } from '$lib/types';
  import GlassCard from './GlassCard.svelte';

  export let clientId: string | undefined = undefined;
  export let onEdit: ((ticket: Ticket) => void) | undefined = undefined;

  let tickets: Ticket[] = [];

  onMount(async () => {
    await ticketStore.load();
    await clientStore.load();
    
    tickets = $ticketStore.filter(ticket => 
      clientId ? ticket.clientId === clientId : true
    );
  });

  function getClientName(id: string) {
    return $clientStore.find(c => c.id === id)?.name || 'Unknown Client';
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function getStatusStyles(ticket: Ticket) {
    if (!ticket.status) {
      // Default styling if status is missing
      return 'background-color: rgba(209, 213, 219, 0.2); color: rgb(107, 114, 128);';
    }
    return `background-color: ${ticket.status.color}25; color: ${ticket.status.color};`;
  }
</script>

<div>
  {#if tickets.length === 0}
    <div class="text-center py-8 text-gray-500">
      No tickets found
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="data-table w-full">
        <thead class="data-table-header">
          <tr>
            <th>Status</th>
            <th>Title</th>
            {#if !clientId}
              <th>Client</th>
            {/if}
            <th>Created</th>
            <th>Addons</th>
            <th class="right-aligned">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each tickets as ticket}
            <tr class="data-table-row">
              <td>
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={getStatusStyles(ticket)}
                >
                  {ticket.status?.name || 'Unknown Status'}
                </span>
              </td>
              <td>
                <a 
                  href="/tickets/{ticket.id}" 
                  class="hover:text-blue-600 font-medium"
                >
                  {ticket.title}
                </a>
              </td>
              {#if !clientId}
                <td>{getClientName(ticket.clientId)}</td>
              {/if}
              <td>{formatDate(ticket.createdAt)}</td>
              <td>
                {#if ticket.addons && ticket.addons.length > 0}
                  <div class="flex flex-wrap gap-2">
                    {#each ticket.addons as addon}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-700 text-gray-300">
                        {addon.name}
                      </span>
                    {/each}
                  </div>
                {:else}
                  <span class="text-gray-500">-</span>
                {/if}
              </td>
              <td class="right-aligned">
                {#if onEdit}
                  <button
                    class="table-action-button-primary"
                    on:click={() => onEdit(ticket)}
                  >
                    Edit
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>