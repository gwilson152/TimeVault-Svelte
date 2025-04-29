<script lang="ts">
  import { page } from '$app/stores';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import TicketList from '$lib/components/TicketList.svelte';
  import { formatCurrency, formatTime } from '$lib/utils/invoiceUtils';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { 
    User, UserGroup, Folder, Clock, CurrencyDollar, 
    DocumentText, Pencil, ChartPie, BuildingOffice,
    Check, XMark
  } from '@steeze-ui/heroicons';
  import type { Client, Invoice, BillingRate, NewBillingRateOverride } from '$lib/types';
  import type { TimeEntry } from '$lib/types';
  import * as api from '$lib/services/api';
  import { onMount } from 'svelte';
  import { GlassCard, StatsCard } from '$lib/components';

  $: client = $clientStore.find(c => c.id === $page.params.id);
  $: parentClient = client?.parentId ? $clientStore.find(c => c.id === client.parentId) : null;
  $: children = $clientStore.filter(c => c.parentId === client?.id);
  
  $: clientEntries = $timeEntryStore.filter(entry => entry.clientId === client?.id);
  $: unbilledEntries = clientEntries.filter(entry => !entry.billed);
  $: clientTickets = $ticketStore.filter(ticket => ticket.clientId === client?.id);

  $: totalMinutes = unbilledEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  $: totalBillableMinutes = unbilledEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0);

  $: totalAmount = unbilledEntries
    .filter(entry => entry.billable)
    .reduce((sum, entry) => {
      if (!client) return sum;
      let rate = 0;
      
      // Get applicable billing rate override
      const override = client.billingRateOverrides.find(o => o.baseRateId === entry.billingRateId);
      if (override) {
        const baseRate = $billingRates.find(r => r.id === entry.billingRateId);
        if (baseRate) {
          rate = override.overrideType === 'fixed' 
            ? override.value 
            : (baseRate.rate * override.value / 100);
        }
      } else if (entry.billingRate) {
        rate = entry.billingRate.rate;
      }
      
      return sum + (entry.minutes / 60 * rate);
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
  
  function getClientTypeIcon(type: string) {
    switch (type) {
      case 'business':
        return BuildingOffice;
      case 'container':
        return Folder;
      case 'individual':
        return User;
      default:
        return UserGroup;
    }
  }
  
  function getClientTypeEmoji(type: string) {
    switch (type) {
      case 'business':
        return '🏢';
      case 'container':
        return '📁';
      case 'individual':
        return '👤';
      default:
        return '📋';
    }
  }
</script>

<div class="container mx-auto px-4 py-8 pb-20">
  {#if isLoadingClient}
    <div class="text-center py-12">
      <div class="animate-pulse text-gray-400">Loading client data...</div>
    </div>
  {:else if client}
    <div class="space-y-6">
      <!-- Client Header -->
      <GlassCard className="p-6">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4">
          <div class="flex items-start gap-4">
            <div class="rounded-full bg-blue-500/20 p-3 text-blue-400">
              <Icon src={getClientTypeIcon(client.type)} class="h-8 w-8" />
            </div>
            <div>
              <div class="text-sm text-gray-400 mb-1">
                {#each getHierarchyPath(client) as ancestor, i}
                  {#if i > 0}
                    <span class="mx-1">›</span>
                  {/if}
                  <a 
                    href="/clients/{ancestor.id}" 
                    class="hover:text-blue-400 {ancestor.id === client.id ? 'font-semibold' : ''}"
                  >
                    {ancestor.name}
                  </a>
                {/each}
              </div>
              <h1 class="text-2xl font-bold flex items-center">
                {client.name}
                <span class="ml-2 text-sm bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  {getClientTypeEmoji(client.type)} {client.type}
                </span>
              </h1>
              
              <div class="mt-2 text-gray-400 space-y-1">
                {#if client.description}
                  <p>{client.description}</p>
                {/if}
                {#if parentClient}
                  <p class="flex items-center">
                    <span class="mr-2">Parent:</span>
                    <a href={`/clients/${parentClient.id}`} class="text-blue-400 hover:text-blue-300">
                      {parentClient.name} {getClientTypeEmoji(parentClient.type)}
                    </a>
                  </p>
                {/if}
                {#if client.contact}
                  <p>Contact: {client.contact}</p>
                {/if}
                {#if client.email}
                  <p>Email: {client.email}</p>
                {/if}
              </div>
            </div>
          </div>
          <a 
            href="/clients/edit/{client.id}"
            class="btn btn-primary flex items-center gap-2"
          >
            <Icon src={Pencil} class="h-4 w-4" />
            Edit Client
          </a>
        </div>
      </GlassCard>

      <!-- Summary Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Unbilled Time"
          value={formatTime(totalMinutes / 60, 'formatted')}
          icon={Clock}
          iconColor="blue"
        />
        
        <StatsCard
          title="Billable Time"
          value={formatTime(totalBillableMinutes / 60, 'formatted')}
          icon={Clock}
          iconColor="green"
        />
        
        <StatsCard
          title="Unbilled Amount"
          value={formatCurrency(totalAmount)}
          icon={CurrencyDollar}
          iconColor="green"
          highlight={true}
        />
        
        <StatsCard
          title="Active Tickets"
          value={clientTickets.filter(t => !t.closed).length.toString()}
          icon={DocumentText}
          iconColor="purple"
        />
      </div>

      <!-- Sub-clients -->
      {#if children.length > 0}
        <GlassCard className="p-6">
          <h2 class="text-xl font-semibold mb-6 flex items-center">
            <Icon src={Folder} class="h-5 w-5 mr-2 text-blue-400" />
            Sub-clients
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each children as child}
              <a 
                href="/clients/{child.id}"
                class="light-glass p-4 hover:bg-white/10 transition-colors flex items-center gap-3"
              >
                <div class="rounded-full bg-blue-500/10 p-2 text-blue-400">
                  <Icon src={getClientTypeIcon(child.type)} class="h-5 w-5" />
                </div>
                <div>
                  <div class="font-medium">{child.name}</div>
                  <div class="text-sm text-gray-400">{getClientTypeEmoji(child.type)} {child.type}</div>
                </div>
              </a>
            {/each}
          </div>
        </GlassCard>
      {/if}

      <!-- Content Tabs -->
      <GlassCard className="p-0">
        <div class="flex gap-1 border-b border-gray-800/30">
          <button 
            class="px-6 py-4 text-sm font-medium transition-colors {activeTab === 'tickets' ? 'bg-white/5' : ''} 
              {activeTab === 'tickets' ? 'text-blue-400' : 'text-gray-400'} 
              {activeTab !== 'tickets' ? 'hover:text-blue-400 hover:bg-white/5' : ''}"
            on:click={() => activeTab = 'tickets'}
          >
            <div class="flex items-center gap-2">
              <Icon src={DocumentText} class="h-4 w-4" />
              Tickets
            </div>
          </button>
          <button 
            class="px-6 py-4 text-sm font-medium transition-colors {activeTab === 'time-entries' ? 'bg-white/5' : ''} 
              {activeTab === 'time-entries' ? 'text-blue-400' : 'text-gray-400'} 
              {activeTab !== 'time-entries' ? 'hover:text-blue-400 hover:bg-white/5' : ''}"
            on:click={() => activeTab = 'time-entries'}
          >
            <div class="flex items-center gap-2">
              <Icon src={Clock} class="h-4 w-4" />
              Time Entries
            </div>
          </button>
          <button 
            class="px-6 py-4 text-sm font-medium transition-colors {activeTab === 'invoices' ? 'bg-white/5' : ''} 
              {activeTab === 'invoices' ? 'text-blue-400' : 'text-gray-400'} 
              {activeTab !== 'invoices' ? 'hover:text-blue-400 hover:bg-white/5' : ''}"
            on:click={() => activeTab = 'invoices'}
          >
            <div class="flex items-center gap-2">
              <Icon src={DocumentText} class="h-4 w-4" />
              Invoices
            </div>
          </button>
          <button 
            class="px-6 py-4 text-sm font-medium transition-colors {activeTab === 'settings' ? 'bg-white/5' : ''} 
              {activeTab === 'settings' ? 'text-blue-400' : 'text-gray-400'} 
              {activeTab !== 'settings' ? 'hover:text-blue-400 hover:bg-white/5' : ''}"
            on:click={() => activeTab = 'settings'}
          >
            <div class="flex items-center gap-2">
              <Icon src={ChartPie} class="h-4 w-4" />
              Billing Settings
            </div>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
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
                <a 
                  href="/invoices/generate?clientId={client.id}" 
                  class="mt-4 btn btn-primary inline-flex items-center gap-2">
                  <Icon src={DocumentText} class="h-4 w-4" />
                  Generate New Invoice
                </a>
              </div>
            {:else}
              <div class="overflow-x-auto">
                <table class="data-table w-full">
                  <thead class="data-table-header">
                    <tr>
                      <th>Date</th>
                      <th>Invoice #</th>
                      <th>Time</th>
                      <th class="right-aligned">Amount</th>
                      <th>Status</th>
                      <th class="w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each invoices as invoice}
                      <tr class="data-table-row">
                        <td>
                          {new Date(invoice.date).toLocaleDateString()}
                        </td>
                        <td>
                          #{invoice.invoiceNumber || 'Draft'}
                        </td>
                        <td>
                          {formatTime(invoice.totalMinutes / 60, 'formatted')}
                        </td>
                        <td class="right-aligned">
                          {formatCurrency(invoice.totalAmount)}
                        </td>
                        <td>
                          {#if invoice.sent}
                            <span class="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded">Sent</span>
                          {:else}
                            <span class="px-2 py-1 bg-amber-900/30 text-amber-400 text-xs rounded">Draft</span>
                          {/if}
                        </td>
                        <td>
                          <div class="flex justify-end">
                            <a 
                              href="/invoices/{invoice.id}"
                              class="p-2 rounded hover:bg-gray-700/50"
                              title="View invoice details"
                            >
                              <Icon src={DocumentText} class="h-4 w-4 text-blue-400" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              
              <div class="mt-6 flex justify-end">
                <a 
                  href="/invoices/generate?clientId={client.id}" 
                  class="btn btn-primary inline-flex items-center gap-2">
                  <Icon src={DocumentText} class="h-4 w-4" />
                  Generate New Invoice
                </a>
              </div>
            {/if}
          {:else if activeTab === 'settings'}
            <div class="space-y-4">
              <div class="mb-6 border-l-4 border-blue-400 bg-blue-500/10 p-4">
                <p class="text-sm">
                  Configure custom billing rates for this client. You can override rates by setting either a fixed rate or a percentage of the base rate.
                </p>
              </div>

              <div class="overflow-x-auto">
                <table class="data-table w-full">
                  <thead class="data-table-header">
                    <tr>
                      <th>Rate Name</th>
                      <th>Base Rate</th>
                      <th>Override</th>
                      <th>Effective Rate</th>
                      <th class="w-40">Actions</th>
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
                        <td>
                          <div class="flex justify-end space-x-1">
                            {#if editingOverride?.rateId === rate.id}
                              <button
                                class="p-2 rounded hover:bg-gray-700/50 text-green-400"
                                class:opacity-50={isSaving}
                                on:click={updateRateOverride}
                                disabled={isSaving}
                                title="Save changes"
                              >
                                <Icon src={Check} class="h-4 w-4" />
                              </button>
                              <button
                                class="p-2 rounded hover:bg-gray-700/50 text-red-400"
                                on:click={() => editingOverride = null}
                                disabled={isSaving}
                                title="Cancel"
                              >
                                <Icon src={XMark} class="h-4 w-4" />
                              </button>
                            {:else}
                              <button
                                class="p-2 rounded hover:bg-gray-700/50 text-blue-400"
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
                                title={client.billingRateOverrides.find(o => o.baseRateId === rate.id) ? 'Edit override' : 'Add override'}
                              >
                                <Icon src={Pencil} class="h-4 w-4" />
                              </button>
                              {#if client.billingRateOverrides.find(o => o.baseRateId === rate.id)}
                                <button
                                  class="p-2 rounded hover:bg-gray-700/50 text-red-400"
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
                                  title="Remove override"
                                >
                                  <Icon src={XMark} class="h-4 w-4" />
                                </button>
                              {/if}
                            {/if}
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}
        </div>
      </GlassCard>
    </div>
  {:else}
    <div class="text-center py-12">
      <GlassCard className="p-6 inline-block">
        <h1 class="text-2xl font-bold mb-4">Client not found</h1>
        <a href="/clients" class="btn btn-primary">Back to Clients</a>
      </GlassCard>
    </div>
  {/if}
</div>