<script lang="ts">
  import { writable, derived } from 'svelte/store';
  import type { Invoice, Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { formatDate, formatCurrency, formatHours } from '$lib/utils/invoiceUtils';
  import * as api from '$lib/services/api';
  
  // State
  let selectedClientId = writable<string>('');
  let selectedEntries = writable<Record<string, boolean>>({});
  let currentInvoice = writable<Invoice | null>(null);
  let showConfirmation = writable<boolean>(false);
  let previewMode = writable<boolean>(false);
  
  // Format current date for invoice
  const today = new Date();
  const formattedDate = formatDate(today);
  
  // Get all clients - avoid using in #each directly
  let allClientsArray: Client[] = [];
  clientStore.subscribe(clients => {
    allClientsArray = clients;
  });
  
  // Get client hierarchy for the selected client
  const selectedClientWithChildren = derived(
    [clientStore, selectedClientId], 
    ([$clients, $selectedId]) => {
      if (!$selectedId) return [];
      
      const result: string[] = [$selectedId];
      
      // Recursively find all children
      function addChildren(parentId: string) {
        const children = $clients.filter(c => c.parentId === parentId);
        children.forEach(child => {
          result.push(child.id);
          addChildren(child.id);
        });
      }
      
      addChildren($selectedId);
      return result;
    }
  );
  
  // Get unbilled time entries for the selected client and its children
  const unbilledEntries = derived(
    [entriesWithClientInfo, selectedClientWithChildren],
    ([$entries, $clientIds]) => {
      if (!$clientIds.length) return [];
      
      return $entries.filter(entry => 
        $clientIds.includes(entry.clientId || '') && 
        entry.billable && 
        !entry.billed &&
        !entry.invoiceId // Check if entry doesn't belong to an invoice
      );
    }
  );
  
  // Initialize selected entries when unbilled entries change
  unbilledEntries.subscribe(entries => {
    if (entries.length > 0) {
      const entriesState: Record<string, boolean> = {};
      entries.forEach(entry => {
        entriesState[entry.id] = true; // All entries selected by default
      });
      selectedEntries.set(entriesState);
    } else {
      selectedEntries.set({});
    }
  });
  
  // Calculate invoice total from selected entries
  const selectedClient = derived([clientStore, selectedClientId], 
    ([$clients, $selectedId]) => $clients.find(c => c.id === $selectedId)
  );
  
  const selectedEntriesArray = derived(
    [unbilledEntries, selectedEntries],
    ([$entries, $selected]) => $entries.filter(entry => $selected[entry.id])
  );
  
  const totalHours = derived(selectedEntriesArray, $entries => 
    $entries.reduce((sum, entry) => sum + entry.hours, 0)
  );
  
  const totalAmount = derived([totalHours, selectedClient], 
    ([$hours, $client]) => $hours * ($client?.rate || 0)
  );
  
  // Select/deselect all entries
  function toggleAllEntries(select: boolean) {
    const newState = { ...$selectedEntries };
    $unbilledEntries.forEach(entry => {
      newState[entry.id] = select;
    });
    selectedEntries.set(newState);
  }
  
  // Handle client selection
  function handleClientSelect() {
    previewMode.set(true);
  }
  
  // Create invoice preview
  async function previewInvoice() {
    if (!$selectedClientId || $selectedEntriesArray.length === 0) {
      alert('Please select a client and at least one time entry');
      return;
    }
    
    const invoice = {
      clientId: $selectedClientId,
      entries: $selectedEntriesArray,
      totalHours: $totalHours,
      totalAmount: $totalAmount,
      date: today
    };
    
    currentInvoice.set(invoice);
  }
  
  // Generate and process invoice
  async function handleGenerateInvoice() {
    const invoice = $currentInvoice;
    if (!invoice) return;
    
    try {
      await api.generateInvoice(invoice.clientId, $selectedEntriesArray);
      
      // Mark entries as billed
      const entryIds = $selectedEntriesArray.map(entry => entry.id);
      await timeEntryStore.markAsBilled(entryIds);
      
      showConfirmation.set(true);
      
      // Reset after confirmation
      setTimeout(() => {
        showConfirmation.set(false);
        currentInvoice.set(null);
        selectedClientId.set('');
        selectedEntries.set({});
        previewMode.set(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    }
  }
  
  // Go back to client selection
  function handleBack() {
    currentInvoice.set(null);
    previewMode.set(false);
  }
</script>

<div class="space-y-8">
  <h2 class="text-2xl font-semibold">Generate Invoice</h2>
  
  {#if $showConfirmation}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
      <span class="block sm:inline">Invoice generated successfully! The time entries have been marked as billed.</span>
    </div>
  {/if}
  
  {#if !$previewMode}
    <!-- Client Selection -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <div class="mb-6">
        <label for="client" class="block text-sm font-medium text-gray-700 mb-2">
          Select Client
        </label>
        <p class="text-sm text-gray-500 mb-3">First select a client to see their unbilled time entries.</p>
        <select
          id="client"
          class="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={$selectedClientId}
        >
          <option value="">-- Select Client --</option>
          {#each allClientsArray as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
      </div>
      
      <button
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        onclick={handleClientSelect}
        disabled={!$selectedClientId}
      >
        Select Time Entries
      </button>
    </div>
  {:else if !$currentInvoice}
    <!-- Time Entry Selection -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="text-lg font-semibold">Select Time Entries for {$selectedClient?.name}</h3>
          <p class="text-sm text-gray-500">These are unbilled time entries for this client and all child clients.</p>
        </div>
        <button 
          class="text-gray-600 hover:text-gray-800"
          onclick={handleBack}
        >
          ← Back to client selection
        </button>
      </div>
      
      {#if $unbilledEntries.length === 0}
        <div class="py-4 text-center text-gray-600">
          No unbilled time entries found for this client.
        </div>
      {:else}
        <div class="mb-3 flex justify-between">
          <div>
            <button 
              class="text-sm text-blue-600 hover:text-blue-800 mr-3"
              onclick={() => toggleAllEntries(true)}
            >
              Select All
            </button>
            <button 
              class="text-sm text-blue-600 hover:text-blue-800"
              onclick={() => toggleAllEntries(false)}
            >
              Deselect All
            </button>
          </div>
          <div class="text-sm text-gray-600">
            {Object.values($selectedEntries).filter(Boolean).length} of {$unbilledEntries.length} entries selected
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white border">
            <thead>
              <tr class="bg-gray-50">
                <th class="w-10 px-2 py-3 border-b border-gray-200"></th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">Description</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">Client</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase border-b border-gray-200">Hours</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase border-b border-gray-200">Amount</th>
              </tr>
            </thead>
            <tbody>
              {#each $unbilledEntries as entry}
                {@const client = $clientStore.find(c => c.id === entry.clientId)}
                <tr class="hover:bg-gray-50">
                  <td class="px-2 py-4 whitespace-nowrap border-b border-gray-200">
                    <input 
                      type="checkbox" 
                      bind:checked={$selectedEntries[entry.id]} 
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap border-b border-gray-200 text-sm text-gray-900">
                    {formatDate(entry.date)}
                  </td>
                  <td class="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                    {entry.description}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap border-b border-gray-200 text-sm text-gray-900">
                    {client?.name || '-'}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap border-b border-gray-200 text-sm text-gray-900 text-right">
                    {formatHours(entry.hours)}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap border-b border-gray-200 text-sm text-gray-900 text-right">
                    {formatCurrency(entry.hours * (client?.rate || $selectedClient?.rate || 0))}
                  </td>
                </tr>
              {/each}
              <tr class="bg-gray-50 font-bold">
                <td colspan="4" class="px-4 py-3 text-right border-b border-gray-200">
                  Total:
                </td>
                <td class="px-4 py-3 text-right border-b border-gray-200">
                  {formatHours($totalHours)}
                </td>
                <td class="px-4 py-3 text-right border-b border-gray-200">
                  {formatCurrency($totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            onclick={previewInvoice}
            disabled={!Object.values($selectedEntries).some(Boolean)}
          >
            Preview Invoice
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Invoice Preview -->
    {@const invoice = $currentInvoice}
    {@const client = $clientStore.find(c => c.id === invoice?.clientId)}
    
    <div class="bg-white p-6 rounded-lg shadow-md">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Invoice Preview</h3>
        <button 
          class="text-gray-600 hover:text-gray-800"
          onclick={handleBack}
        >
          ← Back to time entry selection
        </button>
      </div>
      
      <div class="flex justify-between items-start mb-8">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">INVOICE</h2>
          <p class="text-gray-600">Invoice Date: {formattedDate}</p>
        </div>
        <div class="text-right">
          <h3 class="text-xl font-semibold">{client?.name}</h3>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white">
          <thead>
            <tr class="w-full h-12 border-b border-gray-200 bg-gray-50">
              <th class="text-left pl-4 pr-2 py-2">Date</th>
              <th class="text-left px-2 py-2">Description</th>
              <th class="text-right px-2 py-2">Hours</th>
              <th class="text-right px-2 py-2">Rate</th>
              <th class="text-right pl-2 pr-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each $selectedEntriesArray as entry}
              {@const entryClient = $clientStore.find(c => c.id === entry.clientId) || client}
              <tr class="border-b border-gray-200">
                <td class="text-left pl-4 pr-2 py-3">{formatDate(entry.date)}</td>
                <td class="text-left px-2 py-3">{entry.description}</td>
                <td class="text-right px-2 py-3">{formatHours(entry.hours)}</td>
                <td class="text-right px-2 py-3">{formatCurrency(entryClient?.rate || 0)}</td>
                <td class="text-right pl-2 pr-4 py-3">{formatCurrency(entry.hours * (entryClient?.rate || 0))}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-b border-gray-200 font-semibold">
              <td colspan="2" class="text-right pl-4 pr-2 py-3">Total:</td>
              <td class="text-right px-2 py-3">{formatHours(invoice.totalHours)}</td>
              <td></td>
              <td class="text-right pl-2 pr-4 py-3">{formatCurrency(invoice.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div class="mt-8 flex justify-end">
        <button
          class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          onclick={handleGenerateInvoice}
        >
          Generate Invoice
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Add any additional styles here */
</style>