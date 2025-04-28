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

  $: totalHours = unbilledEntries.reduce((sum, entry) => sum + entry.minutes, 0) / 60;
  $: totalBillableHours = unbilledEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0) / 60;

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
      
      return sum + (entry.minutes * rate);
    }, 0);

  let invoices: Invoice[] = [];
  let isLoading = true;
  let isLoadingClient = true;

  async function loadClientData() {
    isLoadingClient = true;
    try {
      // Make sure clients are loaded
      await clientStore.load();
      await timeEntryStore.load();
      await ticketStore.load();
      await settingsStore.load(); // This loads billing rates as well
      
      // If client is loaded, load invoices
      if (client) {
        await loadInvoices();
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      isLoadingClient = false;
      isLoading = false;
    }
  }

  async function loadInvoices() {
    try {
      const invoicesData = await api.getInvoices({
        clientId: client?.id
      });
      invoices = invoicesData.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }

  onMount(async () => {
    await loadClientData();
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

  let activeTab: 'tickets' | 'time-entries' | 'invoices' | 'settings' = 'tickets';
</script>

{#if client}
  <div class="space-y-8">
    <!-- Client Header -->
    <div class="card-glass">
      <div class="flex justify-between items-start">
        <div>
          <div class="text-sm text-gray-400 mb-1">
            {#each getHierarchyPath(client) as ancestor, i}
              {#if i > 0}
                <span class="mx-2">›</span>
              {/if}
              <a 
                href="/clients/{ancestor.id}" 
                class="hover:text-blue-400 {ancestor.id === client.id ? 'font-semibold' : ''}"
              >
                {ancestor.name}
              </a>
            {/each}
          </div>
          <h1 class="text-2xl font-bold">{client.name}</h1>
          <div class="mt-2 text-gray-400">
            <p>Type: {client.type}</p>
          </div>
        </div>
        <a 
          href="/clients/edit/{client.id}"
          class="form-submit"
        >
          Edit Client
        </a>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Unbilled Hours</h3>
        <p class="text-3xl font-bold">{totalHours.toFixed(2)}</p>
      </div>
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Unbilled Billable Hours</h3>
        <p class="text-3xl font-bold">{totalBillableHours.toFixed(2)}</p>
      </div>
      <div class="card-glass">
        <h3 class="text-lg font-semibold mb-2">Unbilled Amount</h3>
        <p class="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
      </div>
    </div>

    <!-- Sub-clients -->
    {#if children.length > 0}
      <div class="card-glass">
        <h2 class="text-xl font-semibold mb-6">Sub-clients</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each children as child}
            <a 
              href="/clients/{child.id}"
              class="light-glass p-4 hover:bg-white/10 transition-colors"
            >
              <div class="font-medium">{child.name}</div>
              <div class="text-sm text-gray-400">{child.type}</div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Content Tabs -->
    <div class="card-glass">
      <div class="flex gap-4 mb-6 border-b border-gray-200/10">
        <button 
          class="px-4 py-2 border-b-2 -mb-[2px] transition-colors"
          class:border-blue-500={activeTab === 'tickets'}
          class:text-blue-400={activeTab === 'tickets'}
          class:border-transparent={activeTab !== 'tickets'}
          class:hover:text-blue-400={activeTab !== 'tickets'}
          on:click={() => activeTab = 'tickets'}
        >
          Tickets
        </button>
        <button 
          class="px-4 py-2 border-b-2 -mb-[2px] transition-colors"
          class:border-blue-500={activeTab === 'time-entries'}
          class:text-blue-400={activeTab === 'time-entries'}
          class:border-transparent={activeTab !== 'time-entries'}
          class:hover:text-blue-400={activeTab !== 'time-entries'}
          on:click={() => activeTab = 'time-entries'}
        >
          Time Entries
        </button>
        <button 
          class="px-4 py-2 border-b-2 -mb-[2px] transition-colors"
          class:border-blue-500={activeTab === 'invoices'}
          class:text-blue-400={activeTab === 'invoices'}
          class:border-transparent={activeTab !== 'invoices'}
          class:hover:text-blue-400={activeTab !== 'invoices'}
          on:click={() => activeTab = 'invoices'}
        >
          Invoices
        </button>
        <button 
          class="px-4 py-2 border-b-2 -mb-[2px] transition-colors"
          class:border-blue-500={activeTab === 'settings'}
          class:text-blue-400={activeTab === 'settings'}
          class:border-transparent={activeTab !== 'settings'}
          class:hover:text-blue-400={activeTab !== 'settings'}
          on:click={() => activeTab = 'settings'}
        >
          Settings
        </button>
      </div>

      <!-- Tab Content -->
      <div class="space-y-6">
        {#if activeTab === 'tickets'}
          <TicketList clientId={client.id} />
        {:else if activeTab === 'time-entries'}
          <TimeEntryList clientId={client.id} />
        {:else if activeTab === 'invoices'}
          {#if isLoading}
            <div class="text-center py-12">
              <div class="text-gray-400 animate-pulse">Loading invoices...</div>
            </div>
          {:else if invoices.length === 0}
            <div class="text-center py-12">
              <p class="text-gray-400">No invoices found for this client.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead class="data-table-header">
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each invoices as invoice}
                    <tr class="data-table-row">
                      <td>
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td>
                        {invoice.totalMinutes} min
                      </td>
                      <td>
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td>
                        <a 
                          href="/invoices/{invoice.id}"
                          class="text-blue-400 hover:text-blue-300"
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
        {:else if activeTab === 'settings'}
          <div class="space-y-4">
            <p class="text-sm text-gray-400">
              Configure custom billing rates for this client. You can override rates by setting either a fixed rate or a percentage of the base rate.
            </p>

            <div class="overflow-x-auto">
              <table class="data-table">
                <thead class="data-table-header">
                  <tr>
                    <th>Rate Name</th>
                    <th>Base Rate</th>
                    <th>Override</th>
                    <th>Effective Rate</th>
                    <th class="right-aligned">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each $billingRates as rate}
                    <tr class="data-table-row">
                      <td>
                        {rate.name}
                        {#if rate.isDefault}
                          <span class="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        {/if}
                      </td>
                      <td>
                        ${rate.rate}/hr
                      </td>
                      <td>
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
                      <td>
                        ${getRateWithOverride(rate)}/hr
                      </td>
                      <td class="right-aligned">
                        {#if editingOverride?.rateId === rate.id}
                          <div class="flex justify-end space-x-2">
                            <button
                              class="btn btn-primary"
                              class:loading={isSaving}
                              on:click={updateRateOverride}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              class="btn btn-secondary"
                              on:click={() => editingOverride = null}
                              disabled={isSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        {:else}
                          <div class="flex justify-end space-x-2">
                            <button
                              class="btn btn-secondary"
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
                                class="btn btn-danger"
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
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <div class="card-glass inline-block">
      <h1 class="text-2xl font-bold mb-4">Client not found</h1>
      <a href="/clients" class="text-blue-400 hover:text-blue-300">Back to Clients</a>
    </div>
  </div>
{/if}