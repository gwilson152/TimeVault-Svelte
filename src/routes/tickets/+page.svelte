<script lang="ts">
  import { writable } from 'svelte/store';
  import TicketList from '$lib/components/TicketList.svelte';
  import TicketForm from '$lib/components/TicketForm.svelte';
  import type { Ticket } from '$lib/types';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { onMount } from 'svelte';

  // State management
  let showForm = $state(false);
  let editTicket = $state<Ticket | null>(null);
  
  // Load tickets data when page mounts
  onMount(async () => {
    await ticketStore.load();
  });

  // Handle edit button click
  function handleEdit(ticket: Ticket) {
    editTicket = ticket;
    showForm = true;
    // Scroll form into view
    setTimeout(() => {
      document.getElementById('ticket-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Handle save completion
  function handleSave() {
    editTicket = null;
    showForm = false;
  }

  // Handle cancel edit
  function handleCancel() {
    editTicket = null;
    showForm = false;
  }

  // Handle create new ticket click
  function handleCreate() {
    editTicket = null;
    showForm = true;
    // Scroll form into view
    setTimeout(() => {
      document.getElementById('ticket-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
</script>

<div class="container mx-auto px-4 py-8 space-y-8">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-bold text-default">Tickets</h1>
    <button
      class="btn btn-primary"
      onclick={handleCreate}
    >
      New Ticket
    </button>
  </div>

  {#if showForm}
    <section id="ticket-form" class="card-glass">
      <TicketForm 
        editTicket={editTicket} 
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </section>
  {/if}

  <section class="card-glass">
    <TicketList onEdit={handleEdit} />
  </section>
</div>