<script lang="ts">
  import { page } from '$app/stores';
  import { ticketStore, ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import type { Ticket, TicketStatus, TimeEntry } from '$lib/types';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // State
  let ticket = $state<ReturnType<typeof getTicket> | null>(null);
  let isUpdating = $state(false);
  let newStatus = $state<TicketStatus>('open');

  // Computed values
  const clientName = $derived(ticket?.clientId ? 
    $clientStore.find(c => c.id === ticket?.clientId)?.name || 'Unknown Client' : '');
  
  const ticketEntries = $derived(
    $timeEntryStore.filter(entry => entry.ticketId === $page.params.id)
  );
  
  const totalHours = $derived(
    ticketEntries.reduce((sum, entry) => sum + entry.hours, 0)
  );

  // Ensure data is loaded
  onMount(async () => {
    await Promise.all([
      ticketStore.load(),
      clientStore.load(),
      timeEntryStore.load()
    ]);
  });

  // Get the full ticket info including related data
  function getTicket() {
    return $ticketsWithClientInfo.find(t => t.id === $page.params.id);
  }

  $effect(() => {
    ticket = getTicket();
    if (ticket) {
      newStatus = ticket.status;
    }
  });

  // Status options with labels and colors
  const statusOptions: Array<{value: TicketStatus, label: string, color: string}> = [
    { value: 'open', label: 'Open', color: 'bg-green-100 text-green-800' },
    { value: 'in-progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' }
  ];

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
    if (!ticket || ticket.status === newStatus) return;
    
    isUpdating = true;
    try {
      await ticketStore.update(ticket.id, {
        status: newStatus
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
    goto(`/tickets/edit/${$page.params.id}`);
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
        <span>← Back to Tickets</span>
      </a>
    </div>
    
    <!-- Ticket Header -->
    <div class="card-glass">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-default">{ticket.title}</h1>
          <div class="mt-2 text-text-blue-300">
            <p>
              <span class="font-medium text-default">Client:</span>
              <a href={`/clients/${ticket.clientId}`} class="ml-1 text-accentBlue hover:text-accentPink">
                {clientName}
              </a>
            </p>
            <p>
              <span class="font-medium text-default">Created:</span>
              <span class="ml-1">{formatDate(ticket.createdAt)}</span>
            </p>
            <p>
              <span class="font-medium text-default">Last Updated:</span>
              <span class="ml-1">{formatDate(ticket.updatedAt)}</span>
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <div class="flex items-center">
            <span class="mr-2 text-sm font-medium text-default">Status:</span>
            <select
              bind:value={newStatus}
              onchange={updateStatus}
              disabled={isUpdating}
              class="px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-default focus:border-accentBlue"
            >
              {#each statusOptions as option}
                <option value={option.value}>
                  {option.label}
                </option>
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
        <span class="px-2.5 py-1 inline-flex text-sm leading-5 font-medium rounded-full
          {statusOptions.find(o => o.value === ticket?.status)?.color || ''}">
          {ticket?.status}
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
        <TimeEntryList onEdit={handleTimeEntryEdit} />
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
      Back to Tickets
    </a>
  </div>
{/if}