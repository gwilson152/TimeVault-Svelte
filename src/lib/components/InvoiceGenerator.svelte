<script lang="ts">
  import { onMount } from 'svelte';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { GlassCard, ClientSearch } from '$lib/components';
  import type { Client, TimeEntry } from '$lib/types';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { getEffectiveBillingRateOverride } from '$lib/utils/clientUtils';
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

  // Use $state instead of writable stores for better reactivity with Svelte 5
  let clients = $state<Client[]>([]);
  let allEntries = $state<TimeEntry[]>([]);
  let clientHierarchy = $state<Client[]>([]);
  let selectedEntries = $state<Record<string, boolean>>({});
  let invoiceNumber = $state<string>('');
  let isLoading = $state<boolean>(true);
  let isGenerating = $state<boolean>(false);
  let selectedClientId = $state<string | null>(null);
  let showAddonsForm = $state<boolean>(false);
  let invoiceAddons = $state<NewInvoiceAddon[]>([]);
  let timeFormat = $state<'minutes' | 'hours' | 'formatted'>('minutes');

  const activeClients = clientStore.clientsWithUnbilledTime;
  const billingRates = settingsStore.billingRates;

  onMount(async () => {
    try {
      // Load all required data in parallel
      await Promise.all([
        clientStore.load(),
        timeEntryStore.load(),
        settingsStore.load()
      ]);
      
      // If clientId was provided, initialize with that client
      if (clientId) {
        selectedClientId = clientId;
        await loadClientEntries(clientId);
      }
      
      isLoading = false;
    } catch (error) {
      console.error('Error loading data:', error);
      isLoading = false;
    }
  });

  // Use effect to watch for changes to selectedClientId
  $effect(() => {
    if (selectedClientId) {
      loadClientEntries(selectedClientId);
    } else {
      allEntries = [];
      selectedEntries = {};
      clientHierarchy = [];
    }
  });

  async function loadClientEntries(cid: string) {
    try {
      clientHierarchy = clientStore.getClientHierarchy(cid);
      if (clientHierarchy.length === 0) return;
      
      // Get unbilled entries with client info from the store
      const entries = timeEntryStore.getUnbilledByClientId(cid, true);
      
      // Get all clients for hierarchy lookup
      clients = [];
      clientStore.subscribe(value => {
        clients = value;
      })();
      
      // Map entries to filtered entries with billing rates
      const filteredEntries = entries.map(entry => {
        const client = clientHierarchy.find(c => c.id === entry.clientId);
        const billingRate = entry.billingRateId ? 
          $billingRates.find(r => r.id === entry.billingRateId) : null;
        
        // Calculate effective rate including client overrides with inheritance
        let effectiveRate = billingRate?.rate ?? 0;
        if (billingRate && entry.clientId) {
          const override = getEffectiveBillingRateOverride(clients, entry.clientId, billingRate.id);
          if (override) {
            effectiveRate = override.overrideType === 'fixed'
              ? override.value
              : billingRate.rate * (override.value / 100);
          }
        }

        return {
          ...entry,
          client,
          billingRate: billingRate ? {
            ...billingRate,
            rate: effectiveRate
          } : undefined
        };
      });

      allEntries = filteredEntries;

      // Initialize all entries as selected
      const initialSelection: Record<string, boolean> = {};
      filteredEntries.forEach(entry => {
        initialSelection[entry.id] = true;
      });
      selectedEntries = initialSelection;
    } catch (error) {
      console.error('Error loading client entries:', error);
      allEntries = [];
      selectedEntries = {};
    }
  }

  function handleClientChange(event: CustomEvent<string | null>) {
    selectedClientId = event.detail;
  }

  function toggleAllEntries(event: Event) {
    const target = event.target as HTMLInputElement;
    const newSelection = { ...selectedEntries };
    allEntries.forEach(entry => {
      newSelection[entry.id] = target.checked;
    });
    selectedEntries = newSelection;
  }
  
  function getClientName(clientId: string | null): string {
    if (!clientId) return 'No Client';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  }
  
  function formatTime(minutes: number): string {
    if (timeFormat === 'minutes') {
      return `${minutes} min`;
    } else if (timeFormat === 'formatted') {
      return minutesToFormatted(minutes);
    } else {
      return `${(minutes / 60).toFixed(2)} hrs`;
    }
  }
  
  // Computed totals using runes
  const selectedTotal = $derived(
    allEntries
      .filter(entry => selectedEntries[entry.id])
      .reduce((total, entry) => {
        const amount = entry.billingRate?.rate 
          ? (entry.minutes / 60) * entry.billingRate.rate 
          : 0;
          
        return {
          minutes: total.minutes + entry.minutes,
          amount: total.amount + amount
        };
      }, { minutes: 0, amount: 0 })
  );

  const addonTotals = $derived(
    invoiceAddons.reduce((total, addon) => {
      const addonTotal = addon.amount * addon.quantity;
      const addonCost = addon.cost * addon.quantity;
      return {
        amount: total.amount + addonTotal,
        cost: total.cost + addonCost,
        profit: total.profit + (addonTotal - addonCost)
      };
    }, { amount: 0, cost: 0, profit: 0 })
  );

  const grandTotal = $derived(selectedTotal.amount + addonTotals.amount);
  
  function addAddon() {
    const newAddon: NewInvoiceAddon = {
      description: '',
      amount: 0,
      cost: 0,
      quantity: 1,
      profit: 0
    };
    invoiceAddons = [...invoiceAddons, newAddon];
  }
  
  function removeAddon(index: number) {
    invoiceAddons = invoiceAddons.filter((_, i) => i !== index);
  }

  function updateAddonDescription(index: number, description: string) {
    invoiceAddons = invoiceAddons.map((addon, i) => 
      i === index ? { ...addon, description } : addon
    );
  }

  function updateAddonAmount(index: number, amount: number) {
    invoiceAddons = invoiceAddons.map((addon, i) => 
      i === index ? { 
        ...addon, 
        amount,
        profit: (amount * addon.quantity) - (addon.cost * addon.quantity)
      } : addon
    );
  }

  function updateAddonCost(index: number, cost: number) {
    invoiceAddons = invoiceAddons.map((addon, i) => 
      i === index ? { 
        ...addon, 
        cost,
        profit: (addon.amount * addon.quantity) - (cost * addon.quantity)
      } : addon
    );
  }

  function updateAddonQuantity(index: number, quantity: number) {
    invoiceAddons = invoiceAddons.map((addon, i) => 
      i === index ? { 
        ...addon, 
        quantity,
        profit: (addon.amount * quantity) - (addon.cost * quantity)
      } : addon
    );
  }

  async function generateInvoice() {
    if (!selectedClientId) {
      alert('Please select a client');
      return;
    }
    
    const selectedTimeEntries = allEntries.filter(entry => selectedEntries[entry.id]);
    
    if (selectedTimeEntries.length === 0 && invoiceAddons.length === 0) {
      alert('Please select at least one time entry or add an addon');
      return;
    }
    
    isGenerating = true;
    
    try {
      await api.generateInvoice(selectedClientId, selectedTimeEntries, {
        invoiceNumber: invoiceNumber || undefined,
        addons: invoiceAddons.map(addon => ({
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
      isGenerating = false;
    }
  }

  function resetForm() {
    selectedClientId = null;
    selectedEntries = {};
    invoiceNumber = '';
    invoiceAddons = [];
  }
</script>

<div class="space-y-4">
  <GlassCard className="p-4">
    <h2 class="text-xl font-semibold mb-2">Generate Invoice</h2>
    
    {#if isLoading}
      <div class="flex items-center justify-center py-4">
        <div class="animate-pulse text-gray-400">Loading...</div>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-field">
          <ClientSearch
            selectedClientId={selectedClientId}
            onchange={handleClientChange}
            label="Client"
            placeholder="Select a client to invoice"
            hint="Only showing clients with unbilled time. Time entries for selected client and sub-clients will be included."
          />
        </div>

        <div class="form-field">
          <label for="invoiceNumber" class="form-label">Invoice Number</label>
          <input
            type="text"
            id="invoiceNumber"
            value={invoiceNumber}
            oninput={(e) => invoiceNumber = (e.target as HTMLInputElement).value}
            placeholder="Optional custom invoice number"
            class="form-input"
            disabled={isGenerating}
          />
        </div>
        
        <div class="form-field col-span-full">
          <div class="form-label mb-2">Time Format Display</div>
          <div class="flex gap-4" role="radiogroup" aria-label="Time Format">
            <label class="flex items-center" for="format-minutes">
              <input 
                type="radio" 
                id="format-minutes"
                checked={timeFormat === "minutes"}
                onclick={() => timeFormat = "minutes"}
                class="form-radio mr-2"
              />
              Minutes
            </label>
            <label class="flex items-center" for="format-formatted">
              <input 
                type="radio" 
                id="format-formatted"
                checked={timeFormat === "formatted"}
                onclick={() => timeFormat = "formatted"}
                class="form-radio mr-2"
              />
              HH:MM
            </label>
            <label class="flex items-center" for="format-hours">
              <input 
                type="radio" 
                id="format-hours"
                checked={timeFormat === "hours"}
                onclick={() => timeFormat = "hours"}
                class="form-radio mr-2"
              />
              Hours
            </label>
          </div>
        </div>
      </div>
    {/if}
  </GlassCard>

  {#if selectedClientId && allEntries.length > 0}
    <GlassCard className="p-0 overflow-hidden">
      <div class="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 class="text-lg font-medium">Time Entries</h3>
        
        <div class="flex items-center">
          <label class="flex items-center mr-4 text-sm">
            <input 
              type="checkbox" 
              checked={Object.values(selectedEntries).every(Boolean) && Object.keys(selectedEntries).length > 0}
              class="form-checkbox mr-2"
              onchange={toggleAllEntries}
              disabled={isGenerating}
            />
            Select All
          </label>
          
          <span class="text-sm">
            {Object.values(selectedEntries).filter(Boolean).length} of {allEntries.length} selected
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
              {@const amount = entry.billingRate?.rate 
                ? (entry.minutes / 60) * entry.billingRate.rate 
                : 0}
              <tr class="data-table-row">
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedEntries[entry.id]}
                    onchange={(e) => {
                      selectedEntries = {
                        ...selectedEntries,
                        [entry.id]: (e.target as HTMLInputElement).checked
                      };
                    }}
                    class="form-checkbox" 
                    disabled={isGenerating}
                  />
                </td>
                <td>{entry.description}</td>
                <td>{getClientName(entry.clientId)}</td>
                <td>{new Date(entry.date).toLocaleDateString()}</td>
                <td class="right-aligned">{formatTime(entry.minutes)}</td>
                <td class="right-aligned">
                  {formatCurrency(amount)}
                </td>
              </tr>
            {/each}
            {#if Object.values(selectedEntries).some(Boolean)}
              <tr class="data-table-footer">
                <td colspan="4">Selected Total</td>
                <td class="right-aligned">{formatTime(selectedTotal.minutes)}</td>
                <td class="right-aligned">{formatCurrency(selectedTotal.amount)}</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </GlassCard>
  {:else if selectedClientId}
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
        disabled={isGenerating}
      >
        Add Item
      </button>
    </div>
    
    {#if invoiceAddons.length > 0}
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
            {#each invoiceAddons as addon, index}
              {@const total = addon.amount * addon.quantity}
              {@const cost = addon.cost * addon.quantity}
              {@const profit = total - cost}
              <tr class="data-table-row">
                <td>
                  <input 
                    type="text" 
                    class="form-input w-full" 
                    value={addon.description}
                    oninput={(e) => updateAddonDescription(index, (e.target as HTMLInputElement).value)}
                    placeholder="Description"
                    disabled={isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number"
                    min="0"
                    step="0.01" 
                    class="form-input w-24 text-right" 
                    value={addon.amount}
                    oninput={(e) => updateAddonAmount(index, +(e.target as HTMLInputElement).value)}
                    disabled={isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    class="form-input w-24 text-right" 
                    value={addon.cost}
                    oninput={(e) => updateAddonCost(index, +(e.target as HTMLInputElement).value)}
                    disabled={isGenerating}
                  />
                </td>
                <td class="right-aligned">
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    class="form-input w-20 text-right" 
                    value={addon.quantity}
                    oninput={(e) => updateAddonQuantity(index, +(e.target as HTMLInputElement).value)}
                    disabled={isGenerating}
                  />
                </td>
                <td class="right-aligned">{formatCurrency(total)}</td>
                <td class="right-aligned">{formatCurrency(profit)}</td>
                <td class="right-aligned">
                  <button 
                    type="button" 
                    class="text-red-400 hover:text-red-300"
                    onclick={() => removeAddon(index)}
                    disabled={isGenerating}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
            {#if invoiceAddons.length > 0}
              <tr class="data-table-footer">
                <td colspan="4">Addons Total</td>
                <td class="right-aligned">{formatCurrency(addonTotals.amount)}</td>
                <td class="right-aligned">{formatCurrency(addonTotals.profit)}</td>
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

  {#if selectedClientId}
    {#if Object.values(selectedEntries).some(Boolean) || invoiceAddons.length > 0}
      <GlassCard className="p-6">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="text-lg font-medium mb-4 md:mb-0">
            Total Invoice Amount: <span class="text-xl font-bold">{formatCurrency(grandTotal)}</span>
          </div>
          
          <div class="flex gap-4">
            <button 
              type="button" 
              class="btn btn-secondary"
              disabled={isGenerating}
              onclick={resetForm}
            >
              Cancel
            </button>
            <button 
              type="button" 
              class="btn btn-primary" 
              onclick={generateInvoice}
              disabled={isGenerating || (selectedTotal.minutes === 0 && addonTotals.amount === 0)}
            >
              {isGenerating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </GlassCard>
    {/if}
  {/if}
</div>