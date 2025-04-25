<script lang="ts">
  import { page } from '$app/stores';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import TicketList from '$lib/components/TicketList.svelte';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import type { Client } from '$lib/types';
  import type { TimeEntry } from '$lib/types';

  $: client = $clientStore.find(c => c.id === $page.params.id);
  $: parentClient = client?.parentId ? $clientStore.find(c => c.id === client.parentId) : null;
  $: children = $clientStore.filter(c => c.parentId === client?.id);
  
  $: clientEntries = $timeEntryStore.filter(entry => entry.clientId === client?.id);
  $: clientTickets = $ticketStore.filter(ticket => ticket.clientId === client?.id);

  $: totalHours = clientEntries.reduce((sum, entry) => sum + entry.hours, 0);
  $: totalBillableHours = clientEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + entry.hours, 0);
  $: totalAmount = totalBillableHours * (client?.rate || 0);

  function getHierarchyPath(client: Client | null): Client[] {
    const path: Client[] = [];
    let current = client;
    while (current) {
      path.unshift(current);
      const parent = $clientStore.find(c => c.id === current?.parentId);
      current = parent || null;
    }
    return path;
  }

  function handleTimeEntryEdit(entry: TimeEntry) {
    // This will be implemented when we add inline editing
    console.log('Edit time entry:', entry);
  }
</script>

{#if client}
  <div class="space-y-8">
    <!-- Client Header -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <div class="flex justify-between items-start">
        <div>
          <div class="text-sm text-gray-500 mb-1">
            {#each getHierarchyPath(client) as ancestor, i}
              {#if i > 0}
                <span class="mx-2">›</span>
              {/if}
              <a 
                href="/clients/{ancestor.id}" 
                class="hover:text-blue-600 {ancestor.id === client.id ? 'font-semibold' : ''}"
              >
                {ancestor.name}
              </a>
            {/each}
          </div>
          <h1 class="text-2xl font-bold text-gray-900">{client.name}</h1>
          <div class="mt-2 text-gray-600">
            <p>Type: {client.type}</p>
            <p>Rate: {formatCurrency(client.rate)}/hour</p>
          </div>
        </div>
        <a 
          href="/clients/edit/{client.id}"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Edit Client
        </a>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Total Hours</h3>
        <p class="text-3xl font-bold">{totalHours.toFixed(2)}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Billable Hours</h3>
        <p class="text-3xl font-bold">{totalBillableHours.toFixed(2)}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Total Billable Amount</h3>
        <p class="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
      </div>
    </div>

    <!-- Sub-clients -->
    {#if children.length > 0}
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-4">Sub-clients</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each children as child}
            <a 
              href="/clients/{child.id}"
              class="p-4 border border-gray-200 rounded-md hover:border-blue-500 transition-colors"
            >
              <div class="font-medium">{child.name}</div>
              <div class="text-sm text-gray-500">{child.type}</div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tickets -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Tickets</h2>
      <TicketList client={client} />
    </div>

    <!-- Time Entries -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Time Entries</h2>
      <TimeEntryList client={client} onEdit={handleTimeEntryEdit} />
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <h1 class="text-2xl font-bold text-gray-900">Client not found</h1>
    <a href="/clients" class="mt-4 text-blue-600 hover:underline">Back to Clients</a>
  </div>
{/if}