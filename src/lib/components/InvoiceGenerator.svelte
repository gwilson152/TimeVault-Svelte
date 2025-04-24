<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Invoice } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { generateInvoice, processInvoice, formatDate, formatCurrency, formatHours } from '$lib/utils/invoiceUtils';
  
  // State
  let selectedClientId = writable<string>('');
  let currentInvoice = writable<Invoice | null>(null);
  let showConfirmation = writable<boolean>(false);
  
  // Prepare invoice preview
  function previewInvoice() {
    const clientId = $selectedClientId;
    if (!clientId) {
      alert('Please select a client');
      return;
    }
    
    const invoice = generateInvoice(clientId);
    currentInvoice.set(invoice);
    
    if (!invoice) {
      alert('No unbilled entries found for this client');
    }
  }
  
  // Generate and process invoice
  function handleGenerateInvoice() {
    const invoice = $currentInvoice;
    if (!invoice) return;
    
    processInvoice(invoice);
    showConfirmation.set(true);
    
    // Reset after a few seconds
    setTimeout(() => {
      showConfirmation.set(false);
      currentInvoice.set(null);
      selectedClientId.set('');
    }, 3000);
  }
  
  // Format current date for invoice
  const today = new Date();
  const formattedDate = formatDate(today);
  
  // Get clients with unbilled entries
  $: clientsWithUnbilledWork = $clientStore.filter(client => {
    const unbilledEntries = timeEntryStore.getUnbilledByClientId(client.id);
    return unbilledEntries.length > 0;
  });
</script>

<div class="space-y-8">
  <h2 class="text-xl font-semibold">Generate Invoice</h2>
  
  {#if $showConfirmation}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
      <span class="block sm:inline">Invoice generated successfully! The time entries have been marked as billed.</span>
    </div>
  {/if}
  
  <div class="bg-white p-6 rounded-lg shadow-md">
    <div class="mb-6">
      <label for="client" class="block text-sm font-medium text-gray-700 mb-2">
        Select Client
      </label>
      <select
        id="client"
        class="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        bind:value={$selectedClientId}
      >
        <option value="">-- Select Client --</option>
        {#each clientsWithUnbilledWork as client}
          <option value={client.id}>{client.name}</option>
        {/each}
      </select>
    </div>
    
    <button
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      onclick={previewInvoice}
      disabled={!$selectedClientId}
    >
      Preview Invoice
    </button>
  </div>
  
  {#if $currentInvoice}
    {@const invoice = $currentInvoice}
    {@const client = $clientStore.find(c => c.id === invoice?.clientId)}
    
    <div class="bg-white p-6 rounded-lg shadow-md">
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
            {#each invoice.entries as entry}
              <tr class="border-b border-gray-200">
                <td class="text-left pl-4 pr-2 py-3">{formatDate(entry.date)}</td>
                <td class="text-left px-2 py-3">{entry.description}</td>
                <td class="text-right px-2 py-3">{formatHours(entry.hours)}</td>
                <td class="text-right px-2 py-3">{formatCurrency(client?.rate || 0)}</td>
                <td class="text-right pl-2 pr-4 py-3">{formatCurrency(entry.hours * (client?.rate || 0))}</td>
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