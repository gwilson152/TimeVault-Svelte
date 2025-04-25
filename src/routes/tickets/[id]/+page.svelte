<script lang="ts">
  import { page } from '$app/stores';
  import { ticketStore, ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import type { TimeEntry } from '$lib/types';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { settingsStore } from '$lib/stores/settingsStore';

  // State
  let ticket = $state<ReturnType<typeof getTicket> | null>(null);
  let isUpdating = $state(false);
  let newStatusId = $state<string | null>(null);
  let ticketId = $derived($page.params.id);

  // Computed values
  const clientName = $derived(ticket?.clientId ? 
    $clientStore.find(c => c.id === ticket?.clientId)?.name || 'Unknown Client' : '');
  
  const ticketEntries = $derived(
    $timeEntryStore.filter(entry => entry.ticketId === ticketId)
  );
  
  const totalHours = $derived(
    ticketEntries.reduce((sum, entry) => sum + entry.hours, 0)
  );

  // Load data
  onMount(async () => {
    await Promise.all([
      ticketStore.load(),
      clientStore.load(),
      timeEntryStore.load(),
      settingsStore.load()
    ]);
  });

  // Get the full ticket info including related data
  function getTicket() {
    return $ticketsWithClientInfo.find(t => t.id === ticketId);
  }

  $effect(() => {
    ticket = getTicket();
    if (ticket) {
      newStatusId = ticket.statusId;
    }
  });

  // Format date in a user-friendly way
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Handle status change
  async function updateStatus() {
    if (!ticket || ticket.statusId === newStatusId || !newStatusId) return;
    
    isUpdating = true;
    try {
      await ticketStore.update(ticket.id, {
        statusId: newStatusId
      });
      ticket = getTicket(); // Refresh ticket data
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      alert('Failed to update ticket status');
    } finally {
      isUpdating = false;
    }
  }

  // Handle edit click
  function handleEdit() {
    goto(`/tickets/edit/${ticketId}`);
  }

  // Handle delete click
  async function handleDelete() {
    if (!ticket) return;
    
    if (!confirm('Are you sure you want to delete this ticket?')) {
      return;
    }
    
    // Check if ticket has time entries
    if (ticketEntries.length > 0) {
      alert(`Cannot delete ticket with ${ticketEntries.length} associated time entries`);
      return;
    }
    
    try {
      await ticketStore.remove(ticket.id);
      goto('/tickets');
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      alert('Failed to delete ticket');
    }
  }

  // Handle time entry edit
  function handleTimeEntryEdit(entry: TimeEntry) {
    goto(`/?edit=${entry.id}`);
  }
</script>

{#if ticket}
  <div class="container mx-auto px-4 py-8 space-y-8">
    <!-- Back navigation -->
    <div>
      <a 
        href="/tickets"
        class="text-text-blue-300 hover:text-accentBlue flex items-center gap-1"
      >
        <span class="material-icons text-sm">arrow_back</span>
        Back to Tickets
      </a>
    </div>
    
    <!-- Header -->
    <div class="card-glass">
      <div class="flex items-start justify-between">
        <div class="space-y-2">
          <h1 class="text-2xl font-bold text-default">{ticket.title}</h1>
          <p class="text-sm text-text-blue-300">
            Client: {clientName}
          </p>
          <p class="text-sm text-text-blue-300">
            Created: {formatDate(ticket.createdAt)}
          </p>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="flex items-center">
            <span class="mr-2 text-sm font-medium text-default">Status:</span>
            <select
              bind:value={newStatusId}
              onchange={updateStatus}
              disabled={isUpdating}
              class="px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-default focus:border-accentBlue"
            >
              {#each $settingsStore.filter(s => s.category === 'ticket') as status}
                <option value={status.id}>{status.value}</option>
              {/each}
            </select>
          </div>
          
          <div class="flex space-x-2">
            <button
              onclick={handleEdit}
              class="btn btn-primary"
            >
              Edit Ticket
            </button>
            <button
              onclick={handleDelete}
              class="btn btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Ticket Description -->
    {#if ticket.description}
      <div class="card-glass">
        <h2 class="text-xl font-semibold mb-4">Description</h2>
        <div class="prose max-w-none text-default">
          {ticket.description}
        </div>
      </div>
    {/if}
    
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Status</h3>
        <span 
          class="px-2.5 py-1 inline-flex text-sm leading-5 font-medium rounded-full"
          style="background-color: {ticket.status.color}25; color: {ticket.status.color};"
        >
          {ticket.status.name}
        </span>
      </div>
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Time Entries</h3>
        <p class="text-3xl font-bold">{ticketEntries.length}</p>
      </div>
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Total Hours</h3>
        <p class="text-3xl font-bold">{totalHours.toFixed(2)}</p>
      </div>
    </div>
    
    <!-- Time Entries -->
    <div class="card-glass">
      <h2 class="text-xl font-semibold mb-4">Time Entries</h2>
      {#if ticketEntries.length === 0}
        <p class="text-text-blue-300">No time entries associated with this ticket yet.</p>
      {:else}
        <TimeEntryList showForm={false} />
      {/if}
    </div>
  </div>
{:else}
  <div class="container mx-auto px-4 py-12 text-center">
    <h1 class="text-2xl font-bold text-default mb-4">Ticket not found</h1>
    <p class="text-text-blue-300 mb-6">The ticket you're looking for could not be found.</p>
    <a 
      href="/tickets"
      class="btn btn-primary"
    >
      Return to Tickets
    </a>
  </div>
{/if}