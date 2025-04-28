<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { GlassCard } from '$lib/components';
  import type { Client, TimeEntry } from '$lib/types';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { goto } from '$app/navigation';
  import * as api from '$lib/services/api';

  const clientId = $props<string | undefined>();
  
  type NewInvoiceAddon = {
    description: string;
    amount: number;
    cost: number;
    quantity: number;
    profit: number;
    ticketAddonId?: string;
  };

  let clients = $state<Client[]>([]);
  let allEntries = $state<TimeEntry[]>([]);
  let clientHierarchy = $state<Client[]>([]);
  let clientSearchText = $state('');

  let selectedEntries = writable<Record<string, boolean>>({});
  let invoiceNumber = writable<string>('');
  let isLoading = writable<boolean>(true);
  let isGenerating = writable<boolean>(false);
  let selectedClientId = writable<string>('');
  let showAddonsForm = writable<boolean>(false);
  let invoiceAddons = writable<NewInvoiceAddon[]>([]);
  let timeFormat = writable<'minutes' | 'minutes' | 'formatted'>('minutes');

  const activeClients = clientStore.clientsWithUnbilledTime;

  function buildClientOptions(): { value: string, label: string, indent: number }[] {
    const options: { value: string, label: string, indent: number }[] = [];
    
    function addClient(client: Client, level: number = 0) {
      let unbilledClients: Client[] = [];
      activeClients.subscribe(value => { unbilledClients = value; })();
      
      if (!unbilledClients.some(c => c.id === client.id)) return;
      
      options.push({
        value: client.id,
        label: client.name,
        indent: level
      });
      
      const children = $clientStore
        .filter(c => c.parentId === client.id)
        .sort((a, b) => a.name.localeCompare(b.name));
        
      children.forEach(child => addClient(child, level + 1));
    }
    
    const rootClients = $clientStore
      .filter(c => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    rootClients.forEach(client => addClient(client));
    
    return options;
  }

  let filteredClientOptions = $state<{ value: string, label: string, indent: number }[]>([]);

  // Watch for changes in clientSearchText and rebuild options
  $effect(() => {
    filteredClientOptions = buildClientOptions().filter(option =>
      !clientSearchText || 
      option.label.toLowerCase().includes(clientSearchText.toLowerCase())
    );
  });

  onMount(async () => {
    try {
      await clientStore.load();
      await timeEntryStore.load();
      
      if (clientId) {
        selectedClientId.set(clientId);
        await loadClientEntries(clientId);
      }
      
      isLoading.set(false);
    } catch (error) {
      console.error('Error loading data:', error);
      isLoading.set(false);
    }
  });

  selectedClientId.subscribe(async (id) => {
    if (id) {
      await loadClientEntries(id);
    } else {
      allEntries = [];
      selectedEntries.set({});
      clientHierarchy = [];
    }
  });

  async function loadClientEntries(cid: string) {
    clientHierarchy = clientStore.getClientHierarchy(cid);
    if (clientHierarchy.length === 0) return;
    
    const clientIds = clientHierarchy.map(c => c.id);
    
    let entries: TimeEntry[] = [];
    timeEntryStore.subscribe(value => { entries = value; })();
    
    const filteredEntries = entries.filter((entry: TimeEntry) => 
      entry.billable && 
      !entry.billed && 
      entry.clientId && 
      clientIds.includes(entry.clientId)
    );
    
    const initialSelection: Record<string, boolean> = {};
    filteredEntries.forEach((entry: TimeEntry) => {
      initialSelection[entry.id] = true;
    });
    
    allEntries = filteredEntries;
    selectedEntries.set(initialSelection);
  }

  function toggleAllEntries(event: Event) {
    const target = event.target as HTMLInputElement;
    const newSelection = { ...$selectedEntries };
    allEntries.forEach(entry => {
      newSelection[entry.id] = target.checked;
    });
    selectedEntries.set(newSelection);
  }
  
  function getClientName(clientId: string | null): string {
    if (!clientId) return 'No Client';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  }
  
  function formatTime(minutes: number): string {
    if ($timeFormat === 'minutes') {
      return `${minutes} min`;
    } else if ($timeFormat === 'formatted') {
      return minutesToFormatted(minutes);
    } else {
      return `${minutes.toFixed(2)} hrs`;
    }
  }
  
  function getSelectedTotal() {
    return allEntries
      .filter(entry => $selectedEntries[entry.id])
      .reduce((total, entry) => {
        const client = clients.find(c => c.id === entry.clientId);
        const billingRate = client?.billingRateOverrides?.[0]?.value || 0;
        const hourlyDuration = entry.minutes / 60;
        return {
          minutes: total.minutes + entry.minutes,
          amount: total.amount + (hourlyDuration * billingRate)
        };
      }, { minutes: 0, amount: 0 });
  }

  function getAddonTotals() {
    return $invoiceAddons.reduce((total, addon) => {
      const addonTotal = addon.amount * addon.quantity;
      const addonCost = addon.cost * addon.quantity;
      return {
        amount: total.amount + addonTotal,
        cost: total.cost + addonCost,
        profit: total.profit + (addonTotal - addonCost)
      };
    }, { amount: 0, cost: 0, profit: 0 });
  }
  
  function addAddon() {
    const newAddon: NewInvoiceAddon = {
      description: '',
      amount: 0,
      cost: 0,
      quantity: 1,
      profit: 0
    };
    invoiceAddons.update(addons => [...addons, newAddon]);
  }
  
  function removeAddon(index: number) {
    invoiceAddons.update(addons => 
      addons.filter((_, i) => i !== index)
    );
  }

  async function generateInvoice() {
    if (!$selectedClientId) {
      alert('Please select a client');
      return;
    }
    
    const selectedTimeEntries = allEntries.filter(entry => $selectedEntries[entry.id]);
    
    if (selectedTimeEntries.length === 0 && $invoiceAddons.length === 0) {
      alert('Please select at least one time entry or add an addon');
      return;
    }
    
    isGenerating.set(true);
    
    try {
      await api.generateInvoice($selectedClientId, selectedTimeEntries, {
        invoiceNumber: $invoiceNumber || undefined,
        addons: $invoiceAddons.map(addon => ({
          description: addon.description,
          amount: addon.amount,
          cost: addon.cost,
          quantity: addon.quantity
        }))
      });
      
      goto('/invoices');
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      isGenerating.set(false);
    }
  }
</script>

<div class="space-y-6">
  <GlassCard className="p-6">
    <h2 class="text-xl font-semibold mb-4">Generate Invoice</h2>
    
    {#if $isLoading}
      <div class="flex items-center justify-center py-6">
        <div class="animate-pulse text-gray-400">Loading...</div>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="form-field">
          <label for="client" class="form-label">Client</label>
          <div class="relative">
            <input 
              type="text"
              placeholder="Search clients..."
              class="form-input mb-2"
              bind:value={clientSearchText}
            />
            <select
              id="client"
              bind:value={$selectedClientId}
              class="form-select"
              disabled={$isGenerating}
              size={8}
            >
              <option value="">Select a client</option>
              {#each filteredClientOptions as option}
                <option value={option.value}>
                  {'  '.repeat(option.indent)}{option.indent > 0 ? '└─ ' : ''}{option.label}
                </option>
              {/each}
            </select>
          </div>
          <span class="form-hint">
            Only showing clients with unbilled time. Time entries for selected client and sub-clients will be included.
          </span>
        </div>

        <div class="form-field">
          <label for="invoiceNumber" class="form-label">Invoice Number</label>
          <input
            type="text"
            id="invoiceNumber"
            bind:value={$invoiceNumber}
            placeholder="Optional custom invoice number"
            class="form-input"
            disabled={$isGenerating}
          />
        </div>
        
        <div class="form-field col-span-full">
          <div class="form-label mb-2">Time Format Display</div>
          <div class="flex gap-4" role="radiogroup" aria-label="Time Format">
            <label class="flex items-center" for="format-minutes">
              <input 
                type="radio" 
                id="format-minutes"
                bind:group={$timeFormat} 
                value="minutes" 
                class="form-radio mr-2"
              />
              Minutes
            </label>
            <label class="flex items-center" for="format-formatted">
              <input 
                type="radio" 
                id="format-formatted"
                bind:group={$timeFormat} 
                value="formatted" 
                class="form-radio mr-2"
              />
              HH:MM
            </label>
          </div>
        </div>
      </div>
    {/if}
  </GlassCard>

  {#if $selectedClientId && allEntries.length > 0}
    <GlassCard className="p-0 overflow-hidden">
      <div class="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 class="text-lg font-medium">Time Entries</h3>
        
        <div class="flex items-center">
          <label class="flex items-center mr-4 text-sm">
            <input 
              type="checkbox" 
              checked={Object.values($selectedEntries).every(Boolean)}
              class="form-checkbox mr-2"
              onchange={toggleAllEntries}
              disabled={$isGenerating}
            />
            Select All
          </label>
          
          <span class="text-sm">
            {Object.values($selectedEntries).filter(Boolean).length} of {allEntries.length} selected
          </span>
        </div>
      </div>
      
      <div class="max-h-80 overflow-y-auto">
        <table class="data-table">
          <thead class="data-table-header sticky top-0 z-10">
            <tr>
              <th>
                <span class="sr-only">Select</span>
              </th>
              <th>Description</th>
              <th>Client</th>
              <th>Date</th>
              <th class="right-aligned">Time</th>
              <th class="right-aligned">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each allEntries as entry}
              {@const client = clients.find(c => c.id === entry.clientId)}
              {@const billingRate = client?.billingRateOverrides?.[0]?.value || 0}
              <tr class="data-table-row">
                <td>
                  <input 
                    type="checkbox" 
                    bind:checked={$selectedEntries[entry.id]}
                    class="form-checkbox" 
                    disabled={$isGenerating}
                  />
                </td>
                <td>{entry.description}</td>
                <td>{getClientName(entry.clientId)}</td>
                <td>{entry.date.toLocaleDateString()}</td>
                <td class="right-aligned">{formatTime(entry.minutes)}</td>
                <td class="right-aligned">
                  {formatCurrency((entry.minutes / 60) * billingRate)}
                </td>
              </tr>
            {/each}
            {#if Object.values($selectedEntries).some(Boolean)}
              {@const total = getSelectedTotal()}
              <tr class="data-table-footer">
                <td colspan="4">Selected Total</td>
                <td class="right-aligned">{formatTime(total.minutes)}</td>
                <td class="right-aligned">{formatCurrency(total.amount)}</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </GlassCard>
  {:else if $selectedClientId}
    <GlassCard className="p-6">
      <div class="text-center py-6 text-gray-400">
        No unbilled time entries found for this client or its sub-clients.
      </div>
    </GlassCard>
  {/if}

  <GlassCard className="p-4">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-medium">Invoice Add-ons</h3>
      <button 
        type="button" 
        class="btn btn-sm btn-secondary"
        onclick={addAddon}
        disabled={$isGenerating}
      >
        Add Item
      </button>
    </div>
    
    {#if $invoiceAddons.length > 0}
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead class="data-table-header">
            <tr>
              <th>Description</th>
              <th class="right-aligned">Price</th>
              <th class="right-aligned">Cost</th>
              <th class="right-aligned">Qty</th>
              <th class="right-aligned">Total</th>
              <th class="right-aligned">Profit</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each $invoiceAddons as addon, index}
              {@const total = addon.amount * addon.quantity}
              {@const cost = addon.cost * addon.quantity}
              {@const profit = total - cost}
              <tr class="data-table-row">
                <td>
                  <input 
                    type="text" 
                    class="form-input w-full" 
                    bind:value={addon.description}
                    placeholder="Description"
                    disabled={$isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number"
                    min="0"
                    step="0.01" 
                    class="form-input w-24 text-right" 
                    bind:value={addon.amount}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    class="form-input w-24 text-right" 
                    bind:value={addon.cost}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    class="form-input w-20 text-right" 
                    bind:value={addon.quantity}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="right-aligned">{formatCurrency(total)}</td>
                <td class="right-aligned">{formatCurrency(profit)}</td>
                <td class="right-aligned">
                  <button 
                    type="button" 
                    class="text-red-400 hover:text-red-300"
                    onclick={() => removeAddon(index)}
                    disabled={$isGenerating}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
            {#if $invoiceAddons.length > 0}
              <tr class="data-table-footer">
                <td colspan="4">Addons Total</td>
                <td class="right-aligned">{formatCurrency(getAddonTotals().amount)}</td>
                <td class="right-aligned">{formatCurrency(getAddonTotals().profit)}</td>
                <td></td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="text-center py-4 text-gray-400">
        No add-ons. Click "Add Item" to add products or services to the invoice.
      </div>
    {/if}
  </GlassCard>

  {#if $selectedClientId}
    {#if Object.values($selectedEntries).some(Boolean) || $invoiceAddons.length > 0}
      {@const timeTotal = getSelectedTotal()}
      {@const addonTotals = getAddonTotals()}
      {@const grandTotal = timeTotal.amount + addonTotals.amount}
      
      <GlassCard className="p-6">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="text-lg font-medium mb-4 md:mb-0">
            Total Invoice Amount: <span class="text-xl font-bold">{formatCurrency(grandTotal)}</span>
          </div>
          
          <div class="flex gap-4">
            <button 
              type="button" 
              class="btn btn-secondary"
              disabled={$isGenerating}
              onclick={() => {
                selectedClientId.set('');
                selectedEntries.set({});
                invoiceNumber.set('');
                invoiceAddons.set([]);
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              class="btn btn-primary" 
              onclick={generateInvoice}
              disabled={$isGenerating || (timeTotal.minutes === 0 && addonTotals.amount === 0)}
            >
              {$isGenerating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </GlassCard>
    {/if}
  {/if}
</div>