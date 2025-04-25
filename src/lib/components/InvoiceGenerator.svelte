<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { GlassCard } from '$lib/components';
  import type { Client, TimeEntry, NewInvoiceAddon } from '$lib/types';
  import { hoursToFormatted, hoursToMinutes } from '$lib/utils/timeUtils';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { goto } from '$app/navigation';
  import * as api from '$lib/services/api';

  export let clientId: string | undefined = undefined;

  let clients: Client[] = [];
  let allEntries: TimeEntry[] = [];
  let selectedEntries = writable<Record<string, boolean>>({});
  let invoiceNumber = writable<string>('');
  let isLoading = writable<boolean>(true);
  let isGenerating = writable<boolean>(false);
  let selectedClientId = writable<string>('');
  let clientHierarchy: Client[] = [];
  let showAddonsForm = writable<boolean>(false);
  let invoiceAddons = writable<NewInvoiceAddon[]>([]);

  // Time entry format preference
  let timeFormat = writable<'minutes' | 'hours' | 'formatted'>('minutes');

  onMount(async () => {
    try {
      await clientStore.load();
      await timeEntryStore.load();
      
      // Get all clients or use the provided client
      clients = $clientStore;
      
      // If clientId is provided, select that client
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

  // Watch for changes to selectedClientId
  $effect(() => {
    if ($selectedClientId) {
      loadClientEntries($selectedClientId);
    } else {
      allEntries = [];
      selectedEntries.set({});
      clientHierarchy = [];
    }
  });

  // Get all child clients recursively
  function getChildClients(parentId: string): Client[] {
    const children = $clientStore.filter(c => c.parentId === parentId);
    let allChildren: Client[] = [...children];
    
    // Recursively add children of children
    for (const child of children) {
      allChildren = [...allChildren, ...getChildClients(child.id)];
    }
    
    return allChildren;
  }

  // Load all unbilled time entries for a client and its children
  async function loadClientEntries(cid: string) {
    // Get the selected client
    const client = $clientStore.find(c => c.id === cid);
    if (!client) return;
    
    // Get the client hierarchy (selected client + all children)
    clientHierarchy = [client, ...getChildClients(client.id)];
    
    // Get all clientIds in the hierarchy
    const clientIds = clientHierarchy.map(c => c.id);
    
    // Get all unbilled time entries for all clients in the hierarchy
    allEntries = $timeEntryStore.filter(entry => 
      entry.billable && 
      !entry.billed && 
      entry.clientId && 
      clientIds.includes(entry.clientId)
    );
    
    // Initialize all entries as selected
    const initialSelection: Record<string, boolean> = {};
    allEntries.forEach(entry => {
      initialSelection[entry.id] = true;
    });
    
    selectedEntries.set(initialSelection);
  }

  // Toggle all entries
  function toggleAllEntries(selected: boolean) {
    const newSelection = { ...$selectedEntries };
    allEntries.forEach(entry => {
      newSelection[entry.id] = selected;
    });
    selectedEntries.set(newSelection);
  }
  
  // Get the client name for an entry
  function getClientName(clientId: string | null): string {
    if (!clientId) return 'No Client';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  }
  
  // Format time based on preferred format
  function formatTime(hours: number): string {
    if ($timeFormat === 'minutes') {
      return `${hoursToMinutes(hours)} min`;
    } else if ($timeFormat === 'formatted') {
      return hoursToFormatted(hours);
    } else {
      return `${hours.toFixed(2)} hrs`;
    }
  }
  
  // Calculate the total for selected entries
  function calculateSelectedTotal(): { hours: number, amount: number } {
    return allEntries
      .filter(entry => $selectedEntries[entry.id])
      .reduce((total, entry) => {
        const client = clients.find(c => c.id === entry.clientId);
        const rate = client?.rate || 0;
        return {
          hours: total.hours + entry.hours,
          amount: total.amount + (entry.hours * rate)
        };
      }, { hours: 0, amount: 0 });
  }
  
  // Calculate the total for addons
  function calculateAddonsTotal(): { amount: number, cost: number, profit: number } {
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
  
  // Add a new blank addon
  function addAddon() {
    invoiceAddons.update(addons => [
      ...addons, 
      { description: '', amount: 0, cost: 0, quantity: 1 }
    ]);
  }
  
  // Remove an addon
  function removeAddon(index: number) {
    invoiceAddons.update(addons => 
      addons.filter((_, i) => i !== index)
    );
  }

  // Generate the invoice
  async function generateInvoice() {
    if (!$selectedClientId) {
      alert('Please select a client');
      return;
    }
    
    // Get selected entries
    const selectedTimeEntries = allEntries.filter(entry => $selectedEntries[entry.id]);
    
    if (selectedTimeEntries.length === 0 && $invoiceAddons.length === 0) {
      alert('Please select at least one time entry or add an addon');
      return;
    }
    
    isGenerating.set(true);
    
    try {
      // Generate invoice
      await api.generateInvoice($selectedClientId, selectedTimeEntries, {
        invoiceNumber: $invoiceNumber || undefined,
        addons: $invoiceAddons.map(addon => ({
          description: addon.description,
          amount: addon.amount,
          cost: addon.cost,
          quantity: addon.quantity
        }))
      });
      
      // Navigate to invoices page
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
  <GlassCard class="p-6">
    <h2 class="text-xl font-semibold mb-4">Generate Invoice</h2>
    
    {#if $isLoading}
      <div class="flex items-center justify-center py-6">
        <div class="animate-pulse text-gray-400">Loading...</div>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Client Selection -->
        <div class="form-field">
          <label for="client" class="form-label">Client</label>
          <select
            id="client"
            bind:value={$selectedClientId}
            class="form-select"
            disabled={!!clientId || $isGenerating}
          >
            <option value="">Select a client</option>
            {#each clients as client}
              <option value={client.id}>{client.name}</option>
            {/each}
          </select>
          <span class="form-hint">
            Time entries for this client and all sub-clients will be included
          </span>
        </div>

        <!-- Invoice Number -->
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
        
        <!-- Time Format Selection -->
        <div class="form-field col-span-full">
          <label class="form-label">Time Format</label>
          <div class="flex gap-4">
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={$timeFormat} 
                value="minutes" 
                class="form-radio mr-2"
              />
              Minutes
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={$timeFormat} 
                value="hours" 
                class="form-radio mr-2"
              />
              Decimal Hours
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
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

  <!-- Time Entries Section -->
  {#if $selectedClientId && allEntries.length > 0}
    <GlassCard class="p-0 overflow-hidden">
      <div class="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 class="text-lg font-medium">Time Entries</h3>
        
        <div class="flex items-center">
          <label class="flex items-center mr-4 text-sm">
            <input 
              type="checkbox" 
              checked={Object.values($selectedEntries).every(Boolean)}
              class="form-checkbox mr-2"
              on:change={(e) => toggleAllEntries(e.target.checked)}
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
        <table class="w-full">
          <thead class="sticky top-0 bg-gray-900 bg-opacity-90 z-10">
            <tr class="text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              <th class="p-3">
                <span class="sr-only">Select</span>
              </th>
              <th class="p-3">Description</th>
              <th class="p-3">Client</th>
              <th class="p-3">Date</th>
              <th class="p-3 text-right">Time</th>
              <th class="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each allEntries as entry}
              {@const client = clients.find(c => c.id === entry.clientId)}
              <tr class="hover:bg-white/5">
                <td class="p-3">
                  <input 
                    type="checkbox" 
                    bind:checked={$selectedEntries[entry.id]}
                    class="form-checkbox" 
                    disabled={$isGenerating}
                  />
                </td>
                <td class="p-3">{entry.description}</td>
                <td class="p-3">{getClientName(entry.clientId)}</td>
                <td class="p-3">{entry.date.toLocaleDateString()}</td>
                <td class="p-3 text-right">{formatTime(entry.hours)}</td>
                <td class="p-3 text-right">
                  {formatCurrency(entry.hours * (client?.rate || 0))}
                </td>
              </tr>
            {/each}
            {@const total = calculateSelectedTotal()}
            <tr class="font-medium bg-blue-900/20">
              <td class="p-3" colspan="4">Selected Total</td>
              <td class="p-3 text-right">{formatTime(total.hours)}</td>
              <td class="p-3 text-right">{formatCurrency(total.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  {:else if $selectedClientId}
    <GlassCard class="p-6">
      <div class="text-center py-6 text-gray-400">
        No unbilled time entries found for this client or its sub-clients.
      </div>
    </GlassCard>
  {/if}

  <!-- Invoice Addons Section -->
  <GlassCard class="p-4">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-medium">Invoice Add-ons</h3>
      <button 
        type="button" 
        class="btn btn-sm btn-secondary"
        on:click={addAddon}
        disabled={$isGenerating}
      >
        Add Item
      </button>
    </div>
    
    {#if $invoiceAddons.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full mb-4">
          <thead>
            <tr class="text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              <th class="p-3">Description</th>
              <th class="p-3 text-right">Price</th>
              <th class="p-3 text-right">Cost</th>
              <th class="p-3 text-right">Qty</th>
              <th class="p-3 text-right">Total</th>
              <th class="p-3 text-right">Profit</th>
              <th class="p-3"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each $invoiceAddons as addon, index}
              {@const total = addon.amount * addon.quantity}
              {@const cost = addon.cost * addon.quantity}
              {@const profit = total - cost}
              <tr>
                <td class="p-3">
                  <input 
                    type="text" 
                    class="form-input w-full" 
                    bind:value={addon.description}
                    placeholder="Description"
                    disabled={$isGenerating}
                  />
                </td>
                <td class="p-3">
                  <input 
                    type="number"
                    min="0"
                    step="0.01" 
                    class="form-input w-24 text-right" 
                    bind:value={addon.amount}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="p-3">
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    class="form-input w-24 text-right" 
                    bind:value={addon.cost}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="p-3">
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    class="form-input w-20 text-right" 
                    bind:value={addon.quantity}
                    disabled={$isGenerating}
                  />
                </td>
                <td class="p-3 text-right">{formatCurrency(total)}</td>
                <td class="p-3 text-right">{formatCurrency(profit)}</td>
                <td class="p-3 text-right">
                  <button 
                    type="button" 
                    class="text-red-400 hover:text-red-300"
                    on:click={() => removeAddon(index)}
                    disabled={$isGenerating}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
            {@const addonTotals = calculateAddonsTotal()}
            <tr class="font-medium bg-blue-900/20">
              <td class="p-3" colspan="4">Addons Total</td>
              <td class="p-3 text-right">{formatCurrency(addonTotals.amount)}</td>
              <td class="p-3 text-right">{formatCurrency(addonTotals.profit)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    {:else}
      <div class="text-center py-4 text-gray-400">
        No add-ons. Click "Add Item" to add products or services to the invoice.
      </div>
    {/if}
  </GlassCard>

  <!-- Invoice Summary Section -->
  {#if $selectedClientId}
    {@const timeTotal = calculateSelectedTotal()}
    {@const addonTotals = calculateAddonsTotal()}
    {@const grandTotal = timeTotal.amount + addonTotals.amount}
    
    <GlassCard class="p-6">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="text-lg font-medium mb-4 md:mb-0">
          Total Invoice Amount: <span class="text-xl font-bold">{formatCurrency(grandTotal)}</span>
        </div>
        
        <div class="flex gap-4">
          <button 
            type="button" 
            class="btn btn-secondary"
            disabled={$isGenerating}
            on:click={() => {
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
            on:click={generateInvoice}
            disabled={$isGenerating || (timeTotal.hours === 0 && addonTotals.amount === 0)}
          >
            {$isGenerating ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </GlassCard>
  {/if}
</div>