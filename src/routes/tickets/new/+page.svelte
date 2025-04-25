<script lang="ts">
  import TicketForm from '$lib/components/TicketForm.svelte';
  import type { Ticket } from '$lib/types';
  import { goto } from '$app/navigation';

  // Handle save event
  function handleSave(ticket: Ticket) {
    goto(`/tickets/${ticket.id}`);
  }

  // Handle cancel event
  function handleCancel() {
    goto('/tickets');
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a 
      href="/tickets"
      class="text-text-blue-300 hover:text-accentBlue"
    >
      ← Back to Tickets
    </a>
  </div>

  <div class="card-glass">
    <h1 class="text-2xl font-bold text-default mb-6">Create New Ticket</h1>
    <TicketForm 
      onSave={handleSave}
      onCancel={handleCancel}
    />
  </div>
</div>