<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { GlassCard, Modal, TimeEntryForm, BulkTimeEntryWizard, DataTable } from '$lib/components';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Clock, Plus, TableCells, ArrowPath, CheckCircle, DocumentDuplicate } from '@steeze-ui/heroicons';
  import { formatCurrency, formatDate, formatTime } from '$lib/utils/invoiceUtils';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';

  // Initialize with default values
  let entries: TimeEntryWithClient[] = [];
  let filteredEntries: TimeEntryWithClient[] = [];
  
  // Page state
  let isLoading = true;
  let showSingleEntryModal = false;
  let showBulkEntryModal = false;
  let editingEntry: TimeEntry | null = null;
  let selectedFilter = 'unbilled'; // Default to unbilled entries
  let currentPage = 1;
  let pageSize = 10;
  let selectedEntries: TimeEntryWithClient[] = [];
  
  // Define table columns
  const columns = [
    {
      key: 'date',
      title: 'Date',
      sortable: true,
      formatter: (value: Date) => formatDate(value)
    },
    {
      key: 'description',
      title: 'Description',
      sortable: true,
      render: (value: string, row: TimeEntryWithClient) => {
        return `<div>
          ${value}
          ${row.locked ? '<span class="ml-1 text-orange-400">🔒</span>' : ''}
        </div>`;
      }
    },
    {
      key: 'clientName',
      title: 'Client',
      sortable: true,
      render: (value: string | null | undefined, row: TimeEntryWithClient) => {
        if (row.clientId) {
          return `<a href="/clients/${row.clientId}" class="hover:text-blue-400">${value || 'Unknown'}</a>`;
        }
        return '<span class="text-gray-400">-</span>';
      }
    },
    {
      key: 'durationHours',
      title: 'Hours',
      align: "right" as "right",
      sortable: true,
      formatter: (value: number | undefined | null) => value?.toFixed(1) || '0.0'
    },
    {
      key: 'billable',
      title: 'Status',
      sortable: true,
      render: (billable: boolean, row: TimeEntryWithClient) => {
        if (row.billed) {
          return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-400">
            Billed
            ${row.invoiceId ? `<a href="/invoices/${row.invoiceId}" class="ml-1 hover:text-blue-300">📄</a>` : ''}
          </span>`;
        }
        
        if (billable) {
          return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400">
            Billable
          </span>`;
        }
        
        return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-500/10 text-gray-400">
          Non-Billable
        </span>`;
      }
    },
    {
      key: 'amount',
      title: 'Amount',
      align: "right" as "right",
      sortable: true,
      render: (_: unknown, row: TimeEntryWithClient) => {
        const amount = row.billable && row.billingRate?.rate
          ? row.durationHours * row.billingRate.rate
          : 0;
        
        return amount > 0 
          ? `<span class="text-green-400">${formatCurrency(amount)}</span>` 
          : '<span class="text-gray-400">-</span>';
      }
    },
    {
      key: 'id',
      title: 'Actions',
      align: "right" as "right",
      sortable: false,
      render: (id: string, row: TimeEntryWithClient) => {
        return row.locked
          ? `<div class="flex justify-end gap-2">
              <button class="table-action-button" data-action="duplicate" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 16H6C4.89543 16 4 15.1046 4 14V6C4 4.89543 4.89543 4 6 4H14C15.1046 4 16 4.89543 16 6V8M10 20H18C19.1046 20 20 19.1046 20 18V10C20 8.89543 19.1046 8 18 8H10C8.89543 8 8 8.89543 8 10V18C8 19.1046 8.89543 20 10 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>`
          : `<div class="flex justify-end gap-2">
              <button class="table-action-button" data-action="edit" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5H6C4.89543 5 4 5.89543 4 7V18C4 19.1046 4.89543 20 6 20H17C18.1046 20 19 19.1046 19 18V13M17.5858 3.58579C18.3668 2.80474 19.6332 2.80474 20.4142 3.58579C21.1953 4.36683 21.1953 5.63316 20.4142 6.41421L11.8284 15H9L9 12.1716L17.5858 3.58579Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button class="table-action-button" data-action="duplicate" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 16H6C4.89543 16 4 15.1046 4 14V6C4 4.89543 4.89543 4 6 4H14C15.1046 4 16 4.89543 16 6V8M10 20H18C19.1046 20 20 19.1046 20 18V10C20 8.89543 19.1046 8 18 8H10C8.89543 8 8 8.89543 8 10V18C8 19.1046 8.89543 20 10 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>`;
      }
    }
  ];

  // Handle store updates
  $: {
    if ($entriesWithClientInfo) {
      entries = $entriesWithClientInfo
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map(entry => ({
          ...entry,
          durationHours: entry.minutes / 60
        }));
      filteredEntries = filterEntries(entries, selectedFilter);
    }
  }

  $: totalHours = filteredEntries.reduce((sum, entry) => 
    sum + (entry.durationHours || 0), 0
  ) ?? 0;
  
  $: totalBillableAmount = filteredEntries
    .filter(entry => entry.billable && entry.billingRate)
    .reduce((sum, entry) => 
      sum + ((entry.durationHours || 0) * (entry.billingRate?.rate || 0)), 0
    ) ?? 0;

  // Load data on mount
  onMount(async () => {
    try {
      await Promise.all([
        clientStore.load(),
        timeEntryStore.load()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      isLoading = false;
    }
  });

  // Filter entries based on selected filter
  function filterEntries(entries: TimeEntryWithClient[], filter: string): TimeEntryWithClient[] {
    const sorted = [...entries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    switch (filter) {
      case 'billable':
        return sorted.filter(entry => entry.billable);
      case 'unbilled':
        return sorted.filter(entry => entry.billable && !entry.billed);
      case 'billed':
        return sorted.filter(entry => entry.billed);
      default:
        return sorted;
    }
  }

  // Handle edit entry
  function handleEditEntry(entry: TimeEntry) {
    editingEntry = entry;
    showSingleEntryModal = true;
  }
  
  // Handle entry creation completion
  function handleEntryCreated() {
    // Refresh data
    timeEntryStore.load();
    
    // Close modal 
    showSingleEntryModal = false;
    editingEntry = null;
  }
  
  // Handle bulk entry completion
  function handleBulkEntryComplete() {
    // Successful bulk entry creation
    showBulkEntryModal = false;
  }
  
  // Handle duplicate entry
  function handleDuplicateEntry(entry: TimeEntry) {
    // Create a copy of the entry without ID and billed/locked status
    const { id, ...entryCopy } = entry;
    const duplicatedEntry = {
      ...entryCopy,
      billed: false,
      locked: false,
      invoiceId: null,
      date: new Date() // Set to today
    } as TimeEntry;
    
    editingEntry = duplicatedEntry;
    showSingleEntryModal = true;
  }
  
  // Handle row click
  function handleRowClick(event: CustomEvent<{row: TimeEntry}>) {
    const { row } = event.detail;
    handleEditEntry(row);
  }
  
  // Handle table actions (edit, duplicate)
  function handleCellClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]');
    
    if (button) {
      event.stopPropagation(); // Prevent row click
      const action = button.getAttribute('data-action');
      const id = button.getAttribute('data-id');
      
      if (id) {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          if (action === 'edit') {
            handleEditEntry(entry);
          } else if (action === 'duplicate') {
            handleDuplicateEntry(entry);
          }
        }
      }
    }
  }
  
  // Refresh entries
  function refreshEntries() {
    isLoading = true;
    timeEntryStore.load().then(() => {
      isLoading = false;
    });
  }
  
  // Table footer content
  $: tableFooter = `
    <tr>
      <td colspan="3"><strong>Totals</strong></td>
      <td class="right-aligned"><strong>${totalHours.toFixed(1)}</strong></td>
      <td></td>
      <td class="right-aligned"><strong>${formatCurrency(totalBillableAmount)}</strong></td>
      <td></td>
    </tr>
  `;
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center space-x-3">
        <Icon src={Clock} class="w-8 h-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Time Entries</h1>
      </div>
      
      <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
        <!-- Stats Summary -->
        <div class="flex flex-wrap gap-3">
          <div class="px-4 py-2 bg-white/5 rounded-full text-sm">
            <span class="font-semibold">{totalHours.toFixed(1)}</span> hours
          </div>
          <div class="px-4 py-2 bg-white/5 rounded-full text-sm">
            <span class="font-semibold">{formatCurrency(totalBillableAmount)}</span> billable
          </div>
        </div>
      
        <!-- Action buttons -->  
        <div class="flex gap-2 ml-auto">
          <button
            class="btn btn-secondary flex items-center gap-2"
            on:click={refreshEntries}
          >
            <Icon src={ArrowPath} class="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <a
            href="/time-entries/wizard"
            class="btn btn-secondary"
          >
            <Icon src={TableCells} class="w-4 h-4 mr-2" />
            Bulk Entry
          </a>
          <button
            class="btn btn-primary"
            on:click={() => {
              editingEntry = null;
              showSingleEntryModal = true;
            }}
          >
            <Icon src={Plus} class="w-4 h-4 mr-2" />
            New Entry
          </button>
        </div>
      </div>
    </div>
  </GlassCard>

  <!-- Filters -->
  <GlassCard className="p-4">
    <div class="flex flex-col md:flex-row justify-between gap-4">
      <div class="flex flex-wrap gap-2">
        <button
          class="px-3 py-1.5 rounded-full text-sm transition-colors {selectedFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-container-glass hover:bg-container-glass-hover'}"
          on:click={() => selectedFilter = 'all'}
        >
          All
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-sm transition-colors {selectedFilter === 'billable' ? 'bg-blue-500 text-white' : 'bg-container-glass hover:bg-container-glass-hover'}"
          on:click={() => selectedFilter = 'billable'}
        >
          Billable
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-sm transition-colors {selectedFilter === 'unbilled' ? 'bg-blue-500 text-white' : 'bg-container-glass hover:bg-container-glass-hover'}"
          on:click={() => selectedFilter = 'unbilled'}
        >
          Unbilled
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-sm transition-colors {selectedFilter === 'billed' ? 'bg-blue-500 text-white' : 'bg-container-glass hover:bg-container-glass-hover'}"
          on:click={() => selectedFilter = 'billed'}
        >
          Billed
        </button>
      </div>
    </div>
  </GlassCard>

  <!-- Time Entries Data Table -->
  <DataTable
    data={filteredEntries}
    {columns}
    loading={isLoading}
    searchable={true}
    pageable={true}
    selectable={true}
    bind:currentPage
    bind:pageSize
    footerContent={tableFooter}
    searchPlaceholder="Search time entries..."
    on:click={handleCellClick}
    on:rowClick={handleRowClick}
    on:selection={(e) => selectedEntries = e.detail.rows}
    emptyMessage={selectedFilter !== 'all' 
      ? `No ${selectedFilter} time entries found. Try changing your filters.`
      : 'No time entries found. Create a new entry to get started.'}
  />
  
  <!-- Single Entry Modal -->
  <Modal
    open={showSingleEntryModal}
    title={editingEntry ? (editingEntry.id ? 'Edit Time Entry' : 'Duplicate Time Entry') : 'New Time Entry'}
    width="max-w-2xl"
    hasFooter={false}
    on:close={() => {
      showSingleEntryModal = false;
      editingEntry = null;
    }}
  >
    <div class="p-6">
      <TimeEntryForm
        editEntry={editingEntry}
        onSave={handleEntryCreated}
        onCancel={() => {
          showSingleEntryModal = false;
          editingEntry = null;
        }}
      />
    </div>
  </Modal>
  
  <!-- Bulk Entry Modal -->
  <Modal
    open={showBulkEntryModal}
    title="Bulk Time Entry"
    variant="fullscreen-mobile"
    hasFooter={false}
    on:close={() => showBulkEntryModal = false}
  >
    <BulkTimeEntryWizard 
      on:close={() => showBulkEntryModal = false}
      on:complete={handleBulkEntryComplete}
    />
  </Modal>
</div>