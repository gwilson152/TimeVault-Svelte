<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { GlassCard, Modal, TimeEntryForm, BulkTimeEntryWizard, DataTable, TimeEntryCsvImport } from '$lib/components';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import {
    Clock,
    Plus,
    TableCells,
    ArrowPath,
    CheckCircle,
    DocumentDuplicate,
    CalendarDays,
    ArrowUpTray
  } from '@steeze-ui/heroicons';
  import { formatCurrency, formatDate } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';

  // Initialize with default values
  let entries = $state<TimeEntryWithClient[]>([]);
  let filteredEntries = $state<TimeEntryWithClient[]>([]);
  let selectedDate = $state(new Date());
  let workdayStart = $state('09:00');
  let workdayEnd = $state('17:00');

  // Page state
  let isLoading = $state(true);
  let showForm = $state(false);
  let showBulkForm = $state(false);
  let showImportModal = $state(false);
  let editingEntry = $state<TimeEntry | null>(null);
  let selectedFilter = $state('unbilled'); // Default to unbilled entries
  let currentPage = $state(1);
  let pageSize = $state(10);
  let selectedEntries = $state<TimeEntry[]>([]);

  // Calculate totals using runes
  const totalHours = $derived(
    filteredEntries.reduce((sum, entry) => sum + (entry.durationHours || 0), 0)
  );

  const totalBillableAmount = $derived(
    filteredEntries
      .filter((entry) => entry.billable && entry.billingRate)
      .reduce(
        (sum, entry) => sum + (entry.durationHours || 0) * (entry.billingRate?.rate || 0),
        0
      )
  );

  // Define table columns with immediate amount calculation
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
      align: 'right' as 'right',
      sortable: true,
      formatter: (value: number | undefined | null) => value?.toFixed(1) || '0.0'
    },
    {
      key: 'amount',
      title: 'Amount',
      align: 'right' as 'right',
      sortable: true,
      render: (_: unknown, row: TimeEntryWithClient) => {
        if (!row.billable || !row.billingRate) {
          return '<span class="text-gray-400">-</span>';
        }
        const amount = row.durationHours * row.billingRate.rate;
        return `<span class="text-green-400">${formatCurrency(amount)}</span>`;
      }
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
      key: 'id',
      title: 'Actions',
      align: 'right' as 'right',
      sortable: false,
      render: (id: string, row: TimeEntryWithClient) => {
        return row.locked
          ? `<div class="flex justify-end gap-2">
              <button class="table-action-button" data-action="duplicate" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>`
          : `<div class="flex justify-end gap-2">
              <button class="table-action-button" data-action="edit" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="table-action-button" data-action="duplicate" data-id="${id}">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 20h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>`;
      }
    }
  ];

  // Consolidated effect to handle store updates and filtering
  $effect(() => {
    // Process entries from store
    const newEntries = $entriesWithClientInfo
      ? $entriesWithClientInfo
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .map((entry) => ({
            ...entry,
            durationHours: entry.minutes / 60,
            client: entry.client || undefined
          }))
      : [];
    
    // Only update entries if they have changed (deep comparison could be added if needed)
    if (JSON.stringify(newEntries) !== JSON.stringify(entries)) {
      entries = newEntries;
    }

    // Update filtered entries based on the current entries and filter
    filteredEntries = filterEntries(entries, selectedFilter);
  });

  // Load data on mount
  onMount(async () => {
    try {
      await Promise.all([clientStore.load(), timeEntryStore.load()]);

      // Check for edit parameter in URL
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      if (editId) {
        const entryToEdit = $entriesWithClientInfo.find(e => e.id === editId);
        if (entryToEdit) {
          editingEntry = entryToEdit;
          showForm = true;
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      isLoading = false;
    }
  });

  // Filter entries based on selected filter
  function filterEntries(entries: TimeEntryWithClient[], filter: string): TimeEntryWithClient[] {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    switch (filter) {
      case 'billable':
        return sorted.filter((entry) => entry.billable);
      case 'unbilled':
        return sorted.filter((entry) => entry.billable && !entry.billed);
      case 'billed':
        return sorted.filter((entry) => entry.billed);
      default:
        return sorted;
    }
  }

  // Handle edit entry
  function handleEditEntry(entry: TimeEntry) {
    editingEntry = entry;
    showForm = true;
  }

  // Handle entry creation completion
  async function handleSaveEntry(savedEntry: TimeEntry) {
    try {
      // Update the entries list directly instead of reloading everything
      if (editingEntry) {
        entries = entries.map(e => e.id === savedEntry.id ? { ...savedEntry, durationHours: savedEntry.minutes / 60, client: e.client } : e);
      } else {
        entries = [...entries, { ...savedEntry, durationHours: savedEntry.minutes / 60, client: undefined }];
      }
      
      // Recalculate filtered entries
      filteredEntries = filterEntries(entries, selectedFilter);
      
      // Close modal
      showForm = false;
      editingEntry = null;
    } catch (error) {
      console.error('Failed to update entries:', error);
    }
  }

  // Handle bulk entry completion
  function handleBulkComplete() {
    // Successful bulk entry creation
    showBulkForm = false;
  }

  // Handle import completion
  function handleImportComplete() {
    showImportModal = false;
    refreshEntries();
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
    showForm = true;
  }

  // Handle row click
  function handleRowClick(event: CustomEvent<{ row: TimeEntry }>) {
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
        const entry = entries.find((e) => e.id === id);
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

  // Cancel modal
  function handleCancel() {
    showForm = false;
    editingEntry = null;
  }

  // Cancel bulk modal
  function handleCancelBulk() {
    showBulkForm = false;
  }

  // Generate CSV template content
  async function downloadCsvTemplate() {
    // Load the billing rates first
    await settingsStore.load();
    
    let billingRates: Array<{ name: string; rate: number }> = [];
    const unsubscribe = settingsStore.billingRates.subscribe(rates => {
      billingRates = rates;
    });

    // Main data columns
    const headers = [
      'Date',
      'Start Time',
      'Minutes',
      'Description',
      'Client Name',
      'Client Email',
      'Billing Rate Name',
      'Billable',
      'Ticket Number',
      'Ticket Title'
    ];

    // Create the sample entry
    const sampleEntry = [
      new Date().toISOString().split('T')[0], // Today's date
      '09:00', // Sample start time
      '15', // Sample duration (1 hour)
      'Sample task description',
      '', // Client name can be filled in
      '', // Client email can be filled in
      '', // Billing rate name can be filled in
      'true', // Billable
      '123456', // Sample ticket number
      'Sample ticket title' // Sample ticket title
    ];

    // Create the CSV content with billing rates as reference
    const csvContent = [
      headers.join(','),
      sampleEntry.join(','),
      '', // Empty line before billing rates
      '# Available Billing Rates (copy and paste the name into the Billing Rate Name column):',
      ...billingRates.map(r => `# ${r.name} (${formatCurrency(r.rate)}/hr)`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-entries-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    unsubscribe(); // Clean up the subscription
  }

  // Table footer content using runes
  const tableFooter = $derived(`
    <tr>
      <td colspan="3"><strong>Totals</strong></td>
      <td class="right-aligned"><strong>${totalHours.toFixed(1)}</strong></td>
      <td></td>
      <td class="right-aligned"><strong>${formatCurrency(totalBillableAmount)}</strong></td>
      <td></td>
    </tr>
  `);
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <GlassCard className="p-6">
    <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div class="flex items-center space-x-3">
        <Icon src={Clock} class="h-8 w-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Time Entries</h1>
      </div>

      <div class="flex w-full flex-col gap-3 md:w-auto md:flex-row">
        <!-- Stats Summary -->
        <div class="flex flex-wrap gap-3">
          <div class="rounded-full bg-white/5 px-4 py-2 text-sm">
            <span class="font-semibold">{totalHours.toFixed(1)}</span> hours
          </div>
          <div class="rounded-full bg-white/5 px-4 py-2 text-sm">
            <span class="font-semibold">{formatCurrency(totalBillableAmount)}</span> billable
          </div>
        </div>

        <!-- Action buttons -->
        <div class="ml-auto flex gap-2">
          <button class="btn btn-secondary flex items-center gap-2" onclick={refreshEntries}>
            <Icon src={ArrowPath} class="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <a href="/time-entries/timeline" class="btn btn-secondary">
            <Icon src={CalendarDays} class="mr-2 h-4 w-4" />
            Timeline
          </a>
          <button
            class="btn btn-secondary flex items-center gap-2"
            onclick={() => (showImportModal = true)}
          >
            <Icon src={ArrowUpTray} class="w-4 h-4" />
            Import CSV
          </button>
          <button
            class="btn btn-secondary flex items-center gap-2"
            onclick={downloadCsvTemplate}
          >
            <Icon src={DocumentDuplicate} class="w-4 h-4" />
            Download Template
          </button>
          <button
            class="btn btn-secondary flex items-center gap-2"
            onclick={() => (showBulkForm = true)}
          >
            <Icon src={TableCells} class="w-4 h-4" />
            Bulk Entry
          </button>
          <button
            class="btn btn-primary flex items-center gap-2"
            onclick={() => (showForm = true)}
          >
            <Icon src={Plus} class="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>
    </div>
  </GlassCard>

  <!-- Filters -->
  <GlassCard className="p-4">
    <div class="flex flex-col justify-between gap-4 md:flex-row">
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {selectedFilter === 'all'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => (selectedFilter = 'all')}
        >
          All
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {selectedFilter === 'billable'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => (selectedFilter = 'billable')}
        >
          Billable
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {selectedFilter === 'unbilled'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => (selectedFilter = 'unbilled')}
        >
          Unbilled
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {selectedFilter === 'billed'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => (selectedFilter = 'billed')}
        >
          Billed
        </button>
      </div>

      <!-- Date selector -->
      <div class="flex items-center gap-2">
        <input
          type="date"
          class="form-input"
          bind:value={selectedDate}
          max={new Date().toISOString().split('T')[0]}
        />
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
    onclick={handleCellClick}
    on:rowClick={handleRowClick}
    on:selection={(e) => (selectedEntries = e.detail.rows)}
    emptyMessage={selectedFilter !== 'all'
      ? `No ${selectedFilter} time entries found. Try changing your filters.`
      : 'No time entries found. Create a new entry to get started.'}
  />

  <!-- Single Entry Modal -->
  <Modal
    open={showForm}
    title={editingEntry ? 'Edit Time Entry' : 'New Time Entry'}
    size="xl"
    onclose={handleCancel}
  >
    <div class="p-6">
      <TimeEntryForm
        editEntry={editingEntry}
        onSave={handleSaveEntry}
        onCancel={handleCancel}
      />
    </div>
  </Modal>

  <!-- Bulk Entry Modal -->
  <Modal
    open={showBulkForm}
    title="Bulk Time Entry"
    size="xl"
    onclose={handleCancelBulk}		
  >
    <div class="p-6">
      <BulkTimeEntryWizard
        onClose={handleCancelBulk}
        onComplete={handleBulkComplete}
      />
    </div>
  </Modal>

  <!-- CSV Import Modal -->
  <Modal
    open={showImportModal}
    title="Import Time Entries"
    size="full"
  >
    <div class="p-6">
      <TimeEntryCsvImport
        onClose={() => (showImportModal = false)}
        onComplete={handleImportComplete}
      />
    </div>
  </Modal>
</div>