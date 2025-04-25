<script lang="ts">
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { formatCurrency, formatHours } from '$lib/utils/invoiceUtils';
  import { onMount } from 'svelte';

  // Calculate dashboard metrics
  $: totalUnbilledHours = $entriesWithClientInfo
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter(entry => !entry.billed && entry.billable)
    .reduce((sum, entry) => sum + entry.hours, 0);

  $: totalUnbilledAmount = $entriesWithClientInfo
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter(entry => !entry.billed && entry.billable)
    .reduce((sum, entry) => {
      const client = $clientStore.find(c => c.id === entry.clientId);
      if (!client) return sum;

      // Get the applicable rate from overrides
      let rate = 0;
      if (client.billingRateOverrides.length > 0) {
        const override = client.billingRateOverrides[0]; // Use first override as default
        rate = override.value;
      }

      return sum + (entry.hours * rate);
    }, 0);

  $: activeClients = $clientStore.filter(client => {
    const hasUnbilledWork = $entriesWithClientInfo
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .some(entry => entry.clientId === client.id && !entry.billed && entry.billable);
    return hasUnbilledWork;
  });

  $: openTickets = $ticketStore.filter(ticket => !ticket.status?.isClosed);

  $: recentEntries = [...$entriesWithClientInfo]
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  $: clientsByUnbilledAmount = [...activeClients]
    .map(client => {
      const unbilledAmount = $entriesWithClientInfo
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .filter(entry => entry.clientId === client.id && !entry.billed && entry.billable)
        .reduce((sum, entry) => {
          const override = client.billingRateOverrides[0];
          const rate = override ? override.value : 0;
          return sum + (entry.hours * rate);
        }, 0);

      return {
        ...client,
        unbilledAmount
      };
    })
    .sort((a, b) => b.unbilledAmount - a.unbilledAmount);
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold">Dashboard</h1>

  <!-- Key Metrics -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="card-dense">
      <h3 class="text-lg font-semibold mb-1">Unbilled Hours</h3>
      <p class="text-3xl font-bold">{totalUnbilledHours.toFixed(1)}</p>
    </div>
    <div class="card-dense">
      <h3 class="text-lg font-semibold mb-1">Unbilled Amount</h3>
      <p class="text-3xl font-bold">{formatCurrency(totalUnbilledAmount)}</p>
    </div>
    <div class="card-dense">
      <h3 class="text-lg font-semibold mb-1">Active Clients</h3>
      <p class="text-3xl font-bold">{activeClients.length}</p>
    </div>
    <div class="card-dense">
      <h3 class="text-lg font-semibold mb-1">Open Tickets</h3>
      <p class="text-3xl font-bold">{openTickets.length}</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Recent Time Entries -->
    <div class="card-dense">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Recent Time Entries</h2>
        <a href="/time-entries" class="text-blue-600 hover:text-blue-800">View All</a>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each recentEntries as entry}
              <tr class="hover:bg-gray-50/50">
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td class="px-3 py-2 text-sm">
                  <div>{entry.description}</div>
                  <div class="text-xs text-gray-500">{entry.clientName}</div>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-right">
                  {entry.hours.toFixed(1)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top Clients by Unbilled Amount -->
    <div class="card-dense">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Top Clients by Unbilled Work</h2>
        <a href="/clients" class="text-blue-600 hover:text-blue-800">View All</a>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unbilled</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each clientsByUnbilledAmount as client}
              <tr class="hover:bg-gray-50/50">
                <td class="px-3 py-2 whitespace-nowrap">
                  <a 
                    href="/clients/{client.id}" 
                    class="text-blue-600 hover:text-blue-800"
                  >
                    {client.name}
                  </a>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-right">
                  {formatCurrency(client.unbilledAmount)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>