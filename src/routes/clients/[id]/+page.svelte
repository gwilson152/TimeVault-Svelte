<script lang="ts">
  import { page } from '$app/stores';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import TicketList from '$lib/components/TicketList.svelte';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import type { Client, Invoice, BillingRate, NewBillingRateOverride } from '$lib/types';
  import type { TimeEntry } from '$lib/types';
  import * as api from '$lib/services/api';
  import { onMount } from 'svelte';

  $: client = $clientStore.find(c => c.id === $page.params.id);
  $: parentClient = client?.parentId ? $clientStore.find(c => c.id === client.parentId) : null;
  $: children = $clientStore.filter(c => c.parentId === client?.id);
  
  $: clientEntries = $timeEntryStore.filter(entry => entry.clientId === client?.id);
  $: unbilledEntries = clientEntries.filter(entry => !entry.billed);
  $: clientTickets = $ticketStore.filter(ticket => ticket.clientId === client?.id);

  $: totalHours = unbilledEntries.reduce((sum, entry) => sum + entry.hours, 0);
  $: totalBillableHours = unbilledEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + entry.hours, 0);

  $: totalAmount = unbilledEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => {
      if (!client) return sum;
      let rate = 0;
      
      // Get applicable billing rate override
      const override = client.billingRateOverrides.find(o => o.baseRateId === entry.clientId);
      if (override) {
        rate = override.value;
      }
      
      return sum + (entry.hours * rate);
    }, 0);

  let invoices: Invoice[] = [];
  let isLoading = true;

  async function loadInvoices() {
    try {
      const invoicesData = await api.getInvoices(client?.id);
      invoices = invoicesData.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }

  onMount(async () => {
    if (client) {
      try {
        await loadInvoices();
      } finally {
        isLoading = false;
      }
    }
  });

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

  let editingOverride: {
    rateId: string;
    type: 'percentage' | 'fixed';
    value: number;
  } | null = null;

  let isSaving = false;

  async function updateRateOverride() {
    if (!editingOverride || !client) return;

    isSaving = true;
    try {
      const overrideData: NewBillingRateOverride = {
        baseRateId: editingOverride.rateId,
        overrideType: editingOverride.type,
        value: editingOverride.value
      };

      await clientStore.update(client.id, {
        billingRateOverrides: [overrideData]
      });

      editingOverride = null;
    } catch (error) {
      console.error('Failed to update rate override:', error);
      alert('Failed to update rate override. Please try again.');
    } finally {
      isSaving = false;
    }
  }

  function getRateWithOverride(baseRate: BillingRate) {
    if (!client) return baseRate.rate;

    const override = client.billingRateOverrides.find(o => o.baseRateId === baseRate.id);
    if (!override) return baseRate.rate;

    if (override.overrideType === 'fixed') {
      return override.value;
    } else {
      return baseRate.rate * (override.value / 100);
    }
  }

  const { billingRates } = settingsStore;
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
        <h3 class="text-lg font-semibold mb-2">Unbilled Hours</h3>
        <p class="text-3xl font-bold">{totalHours.toFixed(2)}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Unbilled Billable Hours</h3>
        <p class="text-3xl font-bold">{totalBillableHours.toFixed(2)}</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-2">Unbilled Amount</h3>
        <p class="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
      </div>
    </div>

    <!-- Invoice History -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Invoice History</h2>
      {#if isLoading}
        <p class="text-gray-500">Loading invoices...</p>
      {:else if invoices.length === 0}
        <p class="text-gray-500">No invoices found for this client.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entries</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each invoices as invoice}
                <tr class="hover:bg-gray-50/50">
                  <td class="px-3 py-2 whitespace-nowrap">
                    {new Date(invoice.date).toLocaleDateString()}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {invoice.totalHours.toFixed(2)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatCurrency(invoice.totalAmount)}
                  </td>
                  <td class="px-3 py-2">
                    <a 
                      href="/invoices/{invoice.id}"
                      class="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <!-- Billing Rates -->
    <div class="card-glass">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold">Billing Rates</h2>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr>
              <th class="text-left px-4 py-2">Rate Name</th>
              <th class="text-left px-4 py-2">Base Rate</th>
              <th class="text-left px-4 py-2">Override</th>
              <th class="text-left px-4 py-2">Effective Rate</th>
              <th class="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200/10">
            {#each $billingRates as rate}
              <tr class="hover:bg-white/5">
                <td class="px-4 py-2">
                  {rate.name}
                  {#if rate.isDefault}
                    <span class="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-2">
                  ${rate.rate}/hr
                </td>
                <td class="px-4 py-2">
                  {#if editingOverride?.rateId === rate.id}
                    <div class="form-field flex gap-2 items-center">
                      <select
                        bind:value={editingOverride!.type}
                        class="form-select w-32"
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Rate</option>
                      </select>

                      <div class="form-field relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          bind:value={editingOverride!.value}
                          class="form-input w-32"
                        />
                        {#if editingOverride!.type === 'percentage'}
                          <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    {#if client.billingRateOverrides.find(o => o.baseRateId === rate.id)}
                      {@const override = client.billingRateOverrides.find(o => o.baseRateId === rate.id)}
                      {#if override}
                        {#if override.overrideType === 'percentage'}
                          {override.value}%
                        {:else}
                          ${override.value}/hr
                        {/if}
                      {/if}
                    {:else}
                      —
                    {/if}
                  {/if}
                </td>
                <td class="px-4 py-2">
                  ${getRateWithOverride(rate)}/hr
                </td>
                <td class="px-4 py-2 text-right">
                  {#if editingOverride?.rateId === rate.id}
                    <div class="flex justify-end space-x-2">
                      <button
                        class="form-submit"
                        class:loading={isSaving}
                        on:click={updateRateOverride}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        class="form-submit"
                        on:click={() => editingOverride = null}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  {:else}
                    <div class="flex justify-end space-x-2">
                      <button
                        class="form-submit"
                        on:click={() => {
                          const override = client.billingRateOverrides.find(o => o.baseRateId === rate.id);
                          editingOverride = override ? {
                            rateId: rate.id,
                            type: override.overrideType,
                            value: override.value
                          } : {
                            rateId: rate.id,
                            type: 'percentage',
                            value: 100
                          };
                        }}
                      >
                        {client.billingRateOverrides.find(o => o.baseRateId === rate.id) ? 'Edit' : 'Add Override'}
                      </button>
                      {#if client.billingRateOverrides.find(o => o.baseRateId === rate.id)}
                        <button
                          class="form-submit"
                          on:click={async () => {
                            if (!confirm('Are you sure you want to remove this rate override?')) return;
                            if (!client) return;
                            
                            try {
                              await clientStore.update(client.id, {
                                billingRateOverrides: client.billingRateOverrides
                                  .filter(o => o.baseRateId !== rate.id)
                                  .map(o => ({
                                    baseRateId: o.baseRateId,
                                    overrideType: o.overrideType,
                                    value: o.value
                                  }))
                              });
                            } catch (error) {
                              console.error('Failed to remove rate override:', error);
                              alert('Failed to remove rate override. Please try again.');
                            }
                          }}
                        >
                          Remove
                        </button>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
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
      <TicketList clientId={client.id} />
    </div>

    <!-- Time Entries -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Time Entries</h2>
      <TimeEntryList clientId={client.id} onEdit={handleTimeEntryEdit} />
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <h1 class="text-2xl font-bold text-gray-900">Client not found</h1>
    <a href="/clients" class="mt-4 text-blue-600 hover:underline">Back to Clients</a>
  </div>
{/if}