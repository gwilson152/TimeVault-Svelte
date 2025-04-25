<script lang="ts">
  import { page } from '$app/stores';
  import { ticketStore } from '$lib/stores/ticketStore';
  import TicketForm from '$lib/components/TicketForm.svelte';
  import type { Ticket } from '$lib/types';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // State
  let ticket = $state<Ticket | null>(null);
  
  // Load ticket data
  onMount(async () => {
    await ticketStore.load();
    const foundTicket = $ticketStore.find(t => t.id === $page.params.id);
    ticket = foundTicket || null;
  });

  // Handle save event
  function handleSave(updatedTicket: Ticket) {
    goto(`/tickets/${updatedTicket.id}`);
  }

  // Handle cancel event
  function handleCancel() {
    goto(`/tickets/${$page.params.id}`);
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a 
      href="/tickets/{$page.params.id}"
      class="text-text-blue-300 hover:text-accentBlue"
    >
      ← Back to Ticket
    </a>
  </div>

  {#if ticket}
    <div class="card-glass">
      <h1 class="text-2xl font-bold text-default mb-6">Edit Ticket</h1>
      <TicketForm 
        editTicket={ticket}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  {:else}
    <div class="text-center py-12 card-glass">
      <h1 class="text-2xl font-bold text-default">Ticket not found</h1>
      <a href="/tickets" class="mt-4 text-accentBlue hover:text-accentPink">Back to Tickets</a>
    </div>
  {/if}
</div>