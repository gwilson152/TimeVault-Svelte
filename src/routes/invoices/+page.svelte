<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard } from '$lib/components';
  import { formatCurrency, formatDate, formatTime, minutesToFormatted } from '$lib/utils/invoiceUtils';
  import { clientStore } from '$lib/stores/clientStore';
  import * as api from '$lib/services/api';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { 
    DocumentText, 
    MagnifyingGlass, 
    ArrowPath, 
    Banknotes, 
    ChartPie, 
    Clock 
  } from '@steeze-ui/heroicons';
  import type { Invoice } from '$lib/types';

  let invoices: Invoice[] = [];
  let isLoading = true;
  let filterClient = '';
  let filterDateFrom = '';
  let filterDateTo = '';
  let filterInvoiceNumber = '';
  let filterStatus = 'all'; // 'all', 'paid', 'unpaid'
  let sortBy = 'date';
  let sortDirection: 'asc' | 'desc' = 'desc';
  let filteredInvoices: Invoice[] = [];
  
  // Summary statistics
  let totalAmount = 0;
  let totalHours = 0;
  let totalProfit = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let profitMargin = 0;
  
  $: isFiltered = filterClient || filterDateFrom || filterDateTo || filterInvoiceNumber || filterStatus !== 'all';

  onMount(async () => {
    loadInvoices();
  });

  async function loadInvoices() {
    isLoading = true;
    try {
      await clientStore.load();
      invoices = await api.getInvoices();
      applyFilters();
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    filteredInvoices = invoices.filter(invoice => {
      // Client filter
      if (filterClient && invoice.clientId !== filterClient) {
        return false;
      }
      
      // Invoice number filter
      if (filterInvoiceNumber && !invoice.invoiceNumber?.toLowerCase().includes(filterInvoiceNumber.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filterStatus === 'paid' && !invoice.paid) {
        return false;
      }
      if (filterStatus === 'unpaid' && invoice.paid) {
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
        toDate.setHours(23, 59, 59, 999); // End of day
        if (invoiceDate > toDate) return false;
      }
      
      return true;
    });

    // Apply sorting
    filteredInvoices.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'invoiceNumber':
          comparison = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
          break;
        case 'client':
          comparison = (a.client?.name || '').localeCompare(b.client?.name || '');
          break;
        case 'hours':
          comparison = a.totalMinutes - b.totalMinutes;
          break;
        case 'amount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'cost':
          comparison = a.totalCost - b.totalCost;
          break;
        case 'profit':
          comparison = a.totalProfit - b.totalProfit;
          break;
        case 'paid':
          comparison = a.paid === b.paid ? 0 : a.paid ? 1 : -1;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Calculate summary statistics
    totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    totalHours = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalMinutes, 0) / 60;
    totalProfit = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalProfit, 0);
    totalPaid = filteredInvoices.filter(i => i.paid).reduce((sum, i) => sum + i.totalAmount, 0);
    totalUnpaid = filteredInvoices.filter(i => !i.paid).reduce((sum, i) => sum + i.totalAmount, 0);
    
    // Calculate profit margin percentage
    const totalCost = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);
    profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'desc';
    }
    applyFilters();
  }

  function resetFilters() {
    filterClient = '';
    filterDateFrom = '';
    filterDateTo = '';
    filterInvoiceNumber = '';
    filterStatus = 'all';
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
      <div class="flex items-center space-x-3">
        <Icon src={DocumentText} class="w-8 h-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Invoices</h1>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="btn btn-secondary flex items-center gap-2"
          on:click={loadInvoices}
        >
          <Icon src={ArrowPath} class="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <a href="/invoices/generate" class="btn btn-primary flex items-center gap-2">
          <span>Generate Invoice</span>
        </a>
      </div>
    </div>
  </GlassCard>

  <!-- Summary Stats Cards -->
  {#if !isLoading && filteredInvoices.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <GlassCard className="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm text-gray-400">Total Invoices</div>
            <div class="text-xl font-semibold mt-1">{filteredInvoices.length}</div>
            {#if isFiltered}
              <div class="text-xs text-gray-400 mt-1">
                Filtered from {invoices.length} total
              </div>
            {/if}
          </div>
          <div class="bg-blue-500/20 text-blue-400 rounded-full p-2">
            <Icon src={DocumentText} class="w-5 h-5" />
          </div>
        </div>
      </GlassCard>
      
      <GlassCard className="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm text-gray-400">Total Amount</div>
            <div class="text-xl font-semibold mt-1">{formatCurrency(totalAmount)}</div>
            <div class="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <span class={totalPaid > 0 ? 'text-green-400' : ''}>
                {formatCurrency(totalPaid)} paid
              </span>
              {#if totalUnpaid > 0}
                <span class="text-red-400">
                  ({formatCurrency(totalUnpaid)} unpaid)
                </span>
              {/if}
            </div>
          </div>
          <div class="bg-green-500/20 text-green-400 rounded-full p-2">
            <Icon src={Banknotes} class="w-5 h-5" />
          </div>
        </div>
      </GlassCard>
      
      <GlassCard className="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm text-gray-400">Total Hours</div>
            <div class="text-xl font-semibold mt-1">{totalHours.toFixed(1)}</div>
            <div class="text-xs text-gray-400 mt-1">
              Average: {(totalHours / Math.max(filteredInvoices.length, 1)).toFixed(1)} per invoice
            </div>
          </div>
          <div class="bg-yellow-500/20 text-yellow-400 rounded-full p-2">
            <Icon src={Clock} class="w-5 h-5" />
          </div>
        </div>
      </GlassCard>
      
      <GlassCard className="p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm text-gray-400">Total Profit</div>
            <div class={`text-xl font-semibold mt-1 ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(totalProfit)}
            </div>
            <div class="text-xs text-gray-400 mt-1">
              Margin: {profitMargin.toFixed(1)}%
            </div>
          </div>
          <div class="bg-purple-500/20 text-purple-400 rounded-full p-2">
            <Icon src={ChartPie} class="w-5 h-5" />
          </div>
        </div>
      </GlassCard>
    </div>
  {/if}

  <!-- Filters -->
  <GlassCard className="p-4">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="form-field">
        <label for="invoiceNumber" class="form-label">Invoice #</label>
        <div class="relative">
          <input
            type="text"
            id="invoiceNumber"
            bind:value={filterInvoiceNumber}
            class="form-input pl-9"
            placeholder="Search invoice #"
          />
          <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon src={MagnifyingGlass} class="w-4 h-4" />
          </div>
        </div>
      </div>
      
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
        <label for="status" class="form-label">Status</label>
        <select
          id="status"
          bind:value={filterStatus}
          class="form-select"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-2">
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
    </div>

    <div class="mt-4 flex justify-end">
      <button 
        type="button" 
        class="btn btn-secondary"
        on:click={resetFilters}
        disabled={!isFiltered}
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
        {isFiltered 
          ? 'No invoices match your filters. Try adjusting your filter criteria.' 
          : 'No invoices found. Start by creating a new invoice.'}
        {#if isFiltered}
          <div class="mt-4">
            <button class="btn btn-secondary" on:click={resetFilters}>Reset Filters</button>
          </div>
        {:else}
          <div class="mt-4">
            <a href="/invoices/generate" class="btn btn-primary">Generate New Invoice</a>
          </div>
        {/if}
      </div>
    </GlassCard>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead class="data-table-header">
            <tr>
              <th class="cursor-pointer" on:click={() => toggleSort('invoiceNumber')}>
                <div class="flex items-center">
                  <span>Invoice #</span>
                  {#if sortBy === 'invoiceNumber'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer" on:click={() => toggleSort('client')}>
                <div class="flex items-center">
                  <span>Client</span>
                  {#if sortBy === 'client'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer" on:click={() => toggleSort('date')}>
                <div class="flex items-center">
                  <span>Date</span>
                  {#if sortBy === 'date'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer" on:click={() => toggleSort('paid')}>
                <div class="flex items-center">
                  <span>Status</span>
                  {#if sortBy === 'paid'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer right-aligned" on:click={() => toggleSort('hours')}>
                <div class="flex items-center justify-end">
                  <span>Hours</span>
                  {#if sortBy === 'hours'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer right-aligned" on:click={() => toggleSort('amount')}>
                <div class="flex items-center justify-end">
                  <span>Amount</span>
                  {#if sortBy === 'amount'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer right-aligned" on:click={() => toggleSort('cost')}>
                <div class="flex items-center justify-end">
                  <span>Cost</span>
                  {#if sortBy === 'cost'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="cursor-pointer right-aligned" on:click={() => toggleSort('profit')}>
                <div class="flex items-center justify-end">
                  <span>Profit</span>
                  {#if sortBy === 'profit'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredInvoices as invoice}
              <tr class="data-table-row">
                <td>
                  <a href="/invoices/{invoice.id}" class="font-medium text-blue-400 hover:text-blue-300">
                    {invoice.invoiceNumber || '-'}
                  </a>
                </td>
                <td>
                  {#if invoice.client}
                    <a href="/clients/{invoice.clientId}" class="hover:text-blue-400">
                      {invoice.client?.name}
                    </a>
                  {:else}
                    <span class="text-gray-400">Unknown Client</span>
                  {/if}
                </td>
                <td>
                  {formatDate(invoice.date)}
                </td>
                <td>
                  <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${invoice.paid ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    {invoice.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td class="right-aligned font-mono">
                  {minutesToFormatted(invoice.totalMinutes)}
                </td>
                <td class="right-aligned">
                  {formatCurrency(invoice.totalAmount)}
                </td>
                <td class="right-aligned text-gray-400">
                  {formatCurrency(invoice.totalCost)}
                </td>
                <td class="right-aligned">
                  <span class={invoice.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatCurrency(invoice.totalProfit)}
                    <div class="text-xs text-gray-400">
                      {invoice.totalAmount > 0 
                        ? ((invoice.totalProfit / invoice.totalAmount) * 100).toFixed(1) + '%' 
                        : '0%'}
                    </div>
                  </span>
                </td>
                <td>
                  <div class="flex justify-end gap-2">
                    <a 
                      href="/invoices/{invoice.id}"
                      class="table-action-button-primary"
                    >
                      View
                    </a>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="data-table-footer">
            <tr>
              <td colspan="4"><strong>Totals</strong></td>
              <td class="right-aligned font-mono">{minutesToFormatted(filteredInvoices.reduce((sum, i) => sum + i.totalMinutes, 0))}</td>
              <td class="right-aligned">{formatCurrency(totalAmount)}</td>
              <td class="right-aligned">{formatCurrency(filteredInvoices.reduce((sum, i) => sum + i.totalCost, 0))}</td>
              <td class="right-aligned">
                <span class={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(totalProfit)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassCard>
  {/if}
</div>

<style>
  .right-aligned {
    text-align: right;
  }
  
  /* Ensure that we properly use the data-table utilities */
  :global(.data-table) {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  
  :global(.data-table-header) {
    background-color: rgba(30, 41, 59, 0.5);
  }
  
  :global(.data-table-header th) {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 500;
    font-size: 0.875rem;
    color: rgba(148, 163, 184, 1);
    text-transform: uppercase;
  }
  
  :global(.data-table-row) {
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    transition: background-color 0.2s;
  }
  
  :global(.data-table-row:hover) {
    background-color: rgba(30, 41, 59, 0.3);
  }
  
  :global(.data-table-row td) {
    padding: 0.75rem 1rem;
    vertical-align: middle;
  }
  
  :global(.data-table-footer) {
    background-color: rgba(30, 41, 59, 0.3);
  }
  
  :global(.data-table-footer td) {
    padding: 0.75rem 1rem;
    font-weight: 500;
  }
</style>