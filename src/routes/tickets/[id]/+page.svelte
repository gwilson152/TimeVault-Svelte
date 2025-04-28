<script lang="ts">
  import { page } from '$app/stores';
  import { ticketStore, ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { TimeEntryForm, TimeEntryList, TicketNotes, GlassCard, Modal } from '$lib/components';
  import type { TimeEntry } from '$lib/types';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { settingsStore } from '$lib/stores/settingsStore';

  // State
  let ticket = $state<ReturnType<typeof getTicket> | null>(null);
  let isUpdating = $state(false);
  let newStatusId = $state<string | null>(null);
  let ticketId = $derived($page.params.id);
  let showTimeEntryForm = $state(false);
  let ticketStatuses = $state([]);
  
  // Temporary user ID (replace with actual user ID from authentication in the future)
  const temporaryUserId = "temp-user-id";

  // Computed values
  const clientName = $derived(ticket?.clientId ? 
    $clientStore.find(c => c.id === ticket?.clientId)?.name || 'Unknown Client' : '');
  
  const ticketEntries = $derived(
    $timeEntryStore.filter(entry => entry.ticketId === ticketId)
  );
  
  const totalMinutes = $derived(
    ticketEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  );
  
  const totalHours = $derived(totalMinutes / 60);
  
  // Load data
  onMount(async () => {
    try {
      // Load all required data
      await Promise.all([
        ticketStore.load(),
        clientStore.load(),
        timeEntryStore.load()
      ]);
      
      // Get ticket statuses
      const statuses = await settingsStore.loadTicketStatuses();
      ticketStatuses = statuses;
      
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  });

  // Get the full ticket info including related data
  function getTicket() {
    return $ticketsWithClientInfo.find(t => t.id === ticketId);
  }

  // Update ticket whenever necessary data changes
  $effect(() => {
    if ($ticketsWithClientInfo.length > 0 && ticketId) {
      ticket = getTicket();
      if (ticket) {
        newStatusId = ticket.statusId;
      }
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
      // Refresh ticket data
      await ticketStore.load();
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

  // Handle time entry creation
  function handleAddTimeEntryClick() {
    showTimeEntryForm = true;
  }
  
  // Handle time entry save
  function handleTimeEntrySave(entry: TimeEntry) {
    showTimeEntryForm = false;
    // Refresh time entries list
    timeEntryStore.load();
  }
  
  // Close time entry modal
  function handleTimeEntryCancel() {
    showTimeEntryForm = false;
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
        class="text-blue-400 hover:text-blue-300 flex items-center gap-1"
      >
        <span>←</span> Back to Tickets
      </a>
    </div>
    
    <!-- Header -->
    <GlassCard>
      <div class="flex flex-col md:flex-row items-start justify-between gap-4">
        <div class="space-y-2">
          <h1 class="text-2xl font-bold">{ticket.title}</h1>
          <p class="text-sm text-gray-400">
            Client: {clientName}
          </p>
          <p class="text-sm text-gray-400">
            Created: {formatDate(ticket.createdAt)}
          </p>
        </div>
        
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div class="flex items-center">
            <span class="mr-2 text-sm font-medium">Status:</span>
            <select
              bind:value={newStatusId}
              on:change={updateStatus}
              disabled={isUpdating}
              class="form-select"
            >
              {#each ticketStatuses as status}
                <option value={status.id}>{status.name}</option>
              {/each}
            </select>
          </div>
          
          <div class="flex space-x-2">
            <button
              on:click={handleEdit}
              class="btn btn-primary"
            >
              Edit Ticket
            </button>
            <button
              on:click={handleDelete}
              class="btn btn-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
    
    <!-- Ticket Description -->
    {#if ticket.description}
      <GlassCard>
        <h2 class="text-xl font-semibold mb-4">Description</h2>
        <div class="prose max-w-none text-gray-100">
          {ticket.description}
        </div>
      </GlassCard>
    {/if}
    
    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <GlassCard>
        <h3 class="text-lg font-semibold mb-2">Status</h3>
        {#if ticket.status}
          <span 
            class="px-2.5 py-1 inline-flex text-sm leading-5 font-medium rounded-full"
            style="background-color: {ticket.status.color}25; color: {ticket.status.color};"
          >
            {ticket.status.name}
          </span>
        {:else}
          <span class="text-gray-400">Unknown Status</span>
        {/if}
      </GlassCard>
      <GlassCard>
        <h3 class="text-lg font-semibold mb-2">Time Entries</h3>
        <p class="text-3xl font-bold">{ticketEntries.length}</p>
      </GlassCard>
      <GlassCard>
        <h3 class="text-lg font-semibold mb-2">Total Hours</h3>
        <p class="text-3xl font-bold">{totalHours.toFixed(2)}</p>
      </GlassCard>
    </div>
    
    <!-- Time Entries -->
    <GlassCard>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold">Time Entries</h2>
        <button 
          class="btn btn-primary"
          on:click={handleAddTimeEntryClick}
        >
          Add Time Entry
        </button>
      </div>
      
      {#if ticketEntries.length === 0}
        <p class="text-gray-400 text-center py-8">No time entries associated with this ticket yet.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="data-table w-full">
            <thead class="data-table-header">
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Duration</th>
                <th class="right-aligned">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each ticketEntries as entry}
                <tr class="data-table-row">
                  <td>{new Date(entry.date).toLocaleDateString()}</td>
                  <td>{entry.description}</td>
                  <td>{(entry.minutes / 60).toFixed(2)} hrs</td>
                  <td class="right-aligned">
                    <button 
                      class="table-action-button-primary" 
                      on:click={() => handleTimeEntryEdit(entry)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="data-table-footer">
              <tr>
                <td colspan="2" class="text-right font-medium">Total:</td>
                <td colspan="2">{totalHours.toFixed(2)} hrs</td>
              </tr>
            </tfoot>
          </table>
        </div>
      {/if}
    </GlassCard>
    
    <!-- Ticket Notes -->
    <GlassCard>
      <h2 class="text-xl font-semibold mb-6">Conversation & Notes</h2>
      <TicketNotes 
        ticketId={ticketId} 
        userId={temporaryUserId} 
        showInternalNotes={true} 
      />
    </GlassCard>
  </div>
{:else}
  <div class="container mx-auto px-4 py-12 text-center">
    <h1 class="text-2xl font-bold mb-4">Ticket not found</h1>
    <p class="text-gray-400 mb-6">The ticket you're looking for could not be found.</p>
    <a 
      href="/tickets"
      class="btn btn-primary"
    >
      Return to Tickets
    </a>
  </div>
{/if}

<!-- Time Entry Modal -->
<Modal
  open={showTimeEntryForm}
  title="Add Time Entry"
  hasFooter={false}
  on:close={handleTimeEntryCancel}
>
  <div class="p-6">
    <TimeEntryForm
      editEntry={null}
      onSave={handleTimeEntrySave}
      onCancel={handleTimeEntryCancel}
      prefilledTicketId={ticketId}
      prefilledClientId={ticket?.clientId}
    />
  </div>
</Modal>