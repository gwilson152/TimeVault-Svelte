<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { TicketList, TicketForm, GlassCard, Modal } from '$lib/components';
  import type { Ticket, NewTicket } from '$lib/types';
  import { ticketStore } from '$lib/stores/ticketStore';

  // State management
  let showForm = writable<boolean>(false);
  let editingTicket = writable<Ticket | null>(null);
  let isLoading = writable<boolean>(true);
  
  // Load tickets data when page mounts
  onMount(async () => {
    try {
      await ticketStore.load();
      isLoading.set(false);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      isLoading.set(false);
    }
  });

  // Event handlers
  function handleEdit(ticket: Ticket) {
    editingTicket.set(ticket);
    showForm.set(true);
  }

  async function handleSubmit(ticket: Partial<Ticket>) {
    try {
      if ($editingTicket) {
        await ticketStore.update($editingTicket.id, ticket);
      } else {
        // Cast to NewTicket since we know required fields will be present
        await ticketStore.add(ticket as NewTicket);
      }
      editingTicket.set(null);
      showForm.set(false);
    } catch (error) {
      console.error('Failed to save ticket:', error);
      alert('Failed to save ticket');
    }
  }

  function handleCancel() {
    editingTicket.set(null);
    showForm.set(false);
  }
</script>

<div class="space-y-6">
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h1 class="text-2xl font-bold">Tickets</h1>
      <button
        class="btn btn-primary"
        on:click={() => showForm.set(true)}
      >
        New Ticket
      </button>
    </div>
  </GlassCard>

  {#if $isLoading}
    <GlassCard className="p-6">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading tickets...</div>
      </div>
    </GlassCard>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <TicketList onEdit={handleEdit} />
    </GlassCard>
  {/if}
</div>

<Modal
  open={$showForm}
  title={$editingTicket ? 'Edit Ticket' : 'New Ticket'}
  width="max-w-2xl"
  on:close={handleCancel}
>
  <div class="p-6">
    <TicketForm 
      editTicket={$editingTicket}
      onSubmit={handleSubmit}
    />
  </div>
</Modal>