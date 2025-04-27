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
</script>

<div class="space-y-4">
  {#if tickets.length === 0}
    <div class="text-center py-8 text-gray-500">
      No tickets found
    </div>
  {:else}
    {#each tickets as ticket}
      <GlassCard>
        <div class="flex items-start justify-between">
          <div class="space-y-2">
            <div class="flex items-center space-x-3">
              <span 
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background-color: {ticket.status.color}25; color: {ticket.status.color};"
              >
                {ticket.status.name}
              </span>
              <h3 class="text-lg font-medium">
                <a 
                  href="/tickets/{ticket.id}" 
                  class="hover:text-blue-600"
                >
                  {ticket.title}
                </a>
              </h3>
            </div>
            {#if !clientId}
              <p class="text-sm text-gray-600">
                Client: {getClientName(ticket.clientId)}
              </p>
            {/if}
            <p class="text-sm text-gray-500">
              Created: {formatDate(ticket.createdAt)}
            </p>
            {#if ticket.addons && ticket.addons.length > 0}
              <div class="mt-2">
                <div class="text-sm font-medium text-gray-500">Addons:</div>
                <div class="flex flex-wrap gap-2 mt-1">
                  {#each ticket.addons as addon}
                    <span class="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-800">
                      {addon.name} (${addon.amount})
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          <div class="flex space-x-2">
            {#if onEdit}
              <button
                class="btn btn-secondary"
                on:click={() => onEdit(ticket)}
              >
                Edit
              </button>
            {/if}
          </div>
        </div>
      </GlassCard>
    {/each}
  {/if}
</div>