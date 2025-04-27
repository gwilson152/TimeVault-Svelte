<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard } from '$lib/components';
  import { formatCurrency, formatDate, formatTime } from '$lib/utils/invoiceUtils';
  import { clientStore } from '$lib/stores/clientStore';
  import * as api from '$lib/services/api';
  import type { Invoice } from '$lib/types';

  let invoices: Invoice[] = [];
  let isLoading = true;
  let filterClient = '';
  let filterDateFrom = '';
  let filterDateTo = '';
  let filteredInvoices: Invoice[] = [];

  onMount(async () => {
    try {
      await clientStore.load();
      invoices = await api.getInvoices();
      applyFilters();
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      isLoading = false;
    }
  });

  function applyFilters() {
    filteredInvoices = invoices.filter(invoice => {
      // Client filter
      if (filterClient && invoice.clientId !== filterClient) {
        return false;
      }
      
      // Date range filter
      const invoiceDate = new Date(invoice.date);
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        if (invoiceDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        if (invoiceDate > toDate) return false;
      }
      
      return true;
    });
  }

  function resetFilters() {
    filterClient = '';
    filterDateFrom = '';
    filterDateTo = '';
    applyFilters();
  }

  $: {
    if (invoices) {
      applyFilters();
    }
  }
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h1 class="text-2xl font-bold">Invoices</h1>
      <a href="/invoices/generate" class="btn btn-primary">
        Generate Invoice
      </a>
    </div>
  </GlassCard>

  <!-- Filters -->
  <GlassCard className="p-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="form-field">
        <label for="client" class="form-label">Client</label>
        <select
          id="client"
          bind:value={filterClient}
          class="form-select"
        >
          <option value="">All Clients</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="dateFrom" class="form-label">Date From</label>
        <input
          type="date"
          id="dateFrom"
          bind:value={filterDateFrom}
          class="form-input"
        />
      </div>

      <div class="form-field">
        <label for="dateTo" class="form-label">Date To</label>
        <input
          type="date"
          id="dateTo"
          bind:value={filterDateTo}
          class="form-input"
        />
      </div>
    </div>

    <div class="mt-4 flex justify-end">
      <button 
        type="button" 
        class="btn btn-secondary"
        on:click={resetFilters}
      >
        Reset Filters
      </button>
    </div>
  </GlassCard>

  <!-- Invoice List -->
  {#if isLoading}
    <GlassCard className="p-6">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading invoices...</div>
      </div>
    </GlassCard>
  {:else if filteredInvoices.length === 0}
    <GlassCard className="p-6">
      <div class="text-center py-12 text-gray-400">
        No invoices found.
      </div>
    </GlassCard>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              <th class="p-4">Invoice #</th>
              <th class="p-4">Client</th>
              <th class="p-4">Date</th>
              <th class="p-4 text-right">Hours</th>
              <th class="p-4 text-right">Amount</th>
              <th class="p-4 text-right">Cost</th>
              <th class="p-4 text-right">Profit</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each filteredInvoices as invoice}
              <tr class="hover:bg-white/5">
                <td class="p-4">
                  {invoice.invoiceNumber || '-'}
                </td>
                <td class="p-4">
                  {invoice.client?.name || 'Unknown Client'}
                </td>
                <td class="p-4">
                  {formatDate(invoice.date)}
                </td>
                <td class="p-4 text-right">
                  {formatTime(invoice.totalMinutes / 60, 'formatted')}
                </td>
                <td class="p-4 text-right">
                  {formatCurrency(invoice.totalAmount)}
                </td>
                <td class="p-4 text-right">
                  {formatCurrency(invoice.totalCost)}
                </td>
                <td class="p-4 text-right">
                  {formatCurrency(invoice.totalProfit)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </GlassCard>
  {/if}
</div>