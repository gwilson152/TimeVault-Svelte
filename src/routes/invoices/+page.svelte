<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard, DataTable } from '$lib/components';
  import { StatsCard } from '$lib/components';
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
  let currentPage = 1;
  let pageSize = 10;
  
  // Summary statistics
  let totalAmount = 0;
  let totalHours = 0;
  let totalProfit = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let profitMargin = 0;
  
  $: isFiltered = filterClient || filterDateFrom || filterDateTo || filterInvoiceNumber || filterStatus !== 'all';

  // Define table columns
  const columns = [
    {
      key: 'invoiceNumber',
      title: 'Invoice #',
      sortable: true,
      render: (value, row) => {
        return `<a href="/invoices/${row.id}" class="font-medium text-blue-400 hover:text-blue-300">
          ${value || '-'}
        </a>`;
      }
    },
    {
      key: 'client.name',
      title: 'Client',
      sortable: true,
      render: (value, row) => {
        if (row.client) {
          return `<a href="/clients/${row.clientId}" class="hover:text-blue-400">
            ${value}
          </a>`;
        }
        return `<span class="text-gray-400">Unknown Client</span>`;
      }
    },
    {
      key: 'date',
      title: 'Date',
      sortable: true,
      formatter: (value) => formatDate(value)
    },
    {
      key: 'paid',
      title: 'Status',
      sortable: true,
      render: (value) => {
        return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${value ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}">
          ${value ? 'Paid' : 'Unpaid'}
        </span>`;
      }
    },
    {
      key: 'totalMinutes',
      title: 'Hours',
      align: 'right',
      sortable: true,
      formatter: (value) => minutesToFormatted(value)
    },
    {
      key: 'totalAmount',
      title: 'Amount',
      align: 'right',
      sortable: true,
      formatter: (value) => formatCurrency(value)
    },
    {
      key: 'totalCost',
      title: 'Cost',
      align: 'right',
      sortable: true,
      cellClass: 'text-gray-400',
      formatter: (value) => formatCurrency(value)
    },
    {
      key: 'totalProfit',
      title: 'Profit',
      align: 'right',
      sortable: true,
      render: (value, row) => {
        const profitPercentage = row.totalAmount > 0 
          ? ((row.totalProfit / row.totalAmount) * 100).toFixed(1) + '%' 
          : '0%';
        
        return `<span class="${value >= 0 ? 'text-green-400' : 'text-red-400'}">
          ${formatCurrency(value)}
          <div class="text-xs text-gray-400">
            ${profitPercentage}
          </div>
        </span>`;
      }
    },
    {
      key: 'id',
      title: 'Actions',
      align: 'right',
      sortable: false,
      render: (id) => {
        return `<div class="flex justify-end gap-2">
          <a href="/invoices/${id}" class="table-action-button-primary">
            View
          </a>
        </div>`;
      }
    }
  ];

  // Footer row for the DataTable
  let tableFooter = `
    <tr>
      <td colspan="4"><strong>Totals</strong></td>
      <td class="right-aligned">${minutesToFormatted(filteredInvoices.reduce((sum, i) => sum + i.totalMinutes, 0))}</td>
      <td class="right-aligned">${formatCurrency(totalAmount)}</td>
      <td class="right-aligned">${formatCurrency(filteredInvoices.reduce((sum, i) => sum + i.totalCost, 0))}</td>
      <td class="right-aligned">
        <span class="${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
          ${formatCurrency(totalProfit)}
        </span>
      </td>
      <td></td>
    </tr>
  `;

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

    // Calculate summary statistics
    totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    totalHours = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalMinutes, 0) / 60;
    totalProfit = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalProfit, 0);
    totalPaid = filteredInvoices.filter(i => i.paid).reduce((sum, i) => sum + i.totalAmount, 0);
    totalUnpaid = filteredInvoices.filter(i => !i.paid).reduce((sum, i) => sum + i.totalAmount, 0);
    
    // Calculate profit margin percentage
    const totalCost = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalCost, 0);
    profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
    
    // Update footer content
    tableFooter = `
      <tr>
        <td colspan="4"><strong>Totals</strong></td>
        <td class="right-aligned">${minutesToFormatted(filteredInvoices.reduce((sum, i) => sum + i.totalMinutes, 0))}</td>
        <td class="right-aligned">${formatCurrency(totalAmount)}</td>
        <td class="right-aligned">${formatCurrency(filteredInvoices.reduce((sum, i) => sum + i.totalCost, 0))}</td>
        <td class="right-aligned">
          <span class="${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${formatCurrency(totalProfit)}
          </span>
        </td>
        <td></td>
      </tr>
    `;
  }

  function handleSort(event) {
    sortBy = event.detail.key;
    sortDirection = event.detail.direction;
  }

  function resetFilters() {
    filterClient = '';
    filterDateFrom = '';
    filterDateTo = '';
    filterInvoiceNumber = '';
    filterStatus = 'all';
    applyFilters();
  }

  function handleRowClick(event) {
    const { row } = event.detail;
    window.location.href = `/invoices/${row.id}`;
  }

  function handlePageChange(event) {
    currentPage = event.detail.page;
  }

  function handlePageSizeChange(event) {
    pageSize = event.detail.size;
    currentPage = 1;
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
          onclick={loadInvoices}
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
      <StatsCard
        title="Total Invoices"
        value={filteredInvoices.length}
        icon={DocumentText}
        iconColor="blue"
        subtitle={isFiltered ? `Filtered from ${invoices.length} total` : ''}
      />
      
      <StatsCard
        title="Total Amount"
        value={formatCurrency(totalAmount)}
        icon={Banknotes}
        iconColor="green"
        subtitle={`<span class="${totalPaid > 0 ? 'text-green-400' : ''}">${formatCurrency(totalPaid)} paid</span>
                  ${totalUnpaid > 0 ? `<span class="text-red-400">($${formatCurrency(totalUnpaid)} unpaid)</span>` : ''}`}
      />
      
      <StatsCard
        title="Total Hours"
        value={totalHours.toFixed(1)}
        icon={Clock}
        iconColor="yellow"
        subtitle={`Average: ${(totalHours / Math.max(filteredInvoices.length, 1)).toFixed(1)} per invoice`}
      />
      
      <StatsCard
        title="Total Profit"
        value={formatCurrency(totalProfit)}
        valueClassName={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}
        icon={ChartPie}
        iconColor="purple"
        subtitle={`Margin: ${profitMargin.toFixed(1)}%`}
        highlight={true}
      />
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
        onclick={resetFilters}
        disabled={!isFiltered}
      >
        Reset Filters
      </button>
    </div>
  </GlassCard>

  <!-- Invoice Data Table -->
  <DataTable
    data={filteredInvoices}
    {columns}
    loading={isLoading}
    searchable={false}
    pageable={true}
    bind:currentPage
    bind:pageSize
    footerContent={tableFooter}
    on:sort={handleSort}
    on:rowClick={handleRowClick}
    on:pageChange={handlePageChange}
    on:pageSizeChange={handlePageSizeChange}
    emptyMessage={isFiltered 
      ? 'No invoices match your filters. Try adjusting your filter criteria.' 
      : 'No invoices found. Start by creating a new invoice.'}
  >
    <svelte:fragment slot="footer">
      {#if filteredInvoices.length === 0 && isFiltered}
        <div class="flex justify-center">
          <button class="btn btn-secondary" onclick={resetFilters}>Reset Filters</button>
        </div>
      {:else if filteredInvoices.length === 0 && !isFiltered}
        <div class="flex justify-center">
          <a href="/invoices/generate" class="btn btn-primary">Generate New Invoice</a>
        </div>
      {/if}
    </svelte:fragment>
  </DataTable>
</div>