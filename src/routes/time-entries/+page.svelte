<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';
  import { GlassCard, Modal, TimeEntryForm, TimeEntryList } from '$lib/components';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Clock, Plus, ChevronDown, ChevronUp } from '@steeze-ui/heroicons';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';

  // Initialize with default values
  let entries: TimeEntryWithClient[] = [];
  let filteredEntries: TimeEntryWithClient[] = [];
  
  // Page state
  let isLoading = true;
  let showQuickEntry = false;
  let showFullEntry = false;
  let editingEntry: TimeEntry | null = null;
  let selectedFilter = 'unbilled'; // Default to unbilled entries
  let searchText = '';
  
  // Quick entry form state
  let quickEntry = {
    description: '',
    duration: '', // Will store minutes
    clientId: ''
  };

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

  // Format amount as currency
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Handle quick entry submission
  async function handleQuickEntry(e: SubmitEvent) {
    e.preventDefault();
    if (!quickEntry.description || !quickEntry.duration || !quickEntry.clientId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const now = new Date();
      const durationInHours = parseFloat(quickEntry.duration) / 60; // Convert minutes to hours
      await timeEntryStore.add({
        description: quickEntry.description,
        duration: durationInHours, // Duration in hours as required by the interface
        clientId: quickEntry.clientId,
        date: now,
        startTime: now,
        endTime: null,
        ticketId: null,
        billable: true,
        billingRateId: null,
        billed: false,  // Add required field
        locked: false   // Add required field
      });

      // Reset form
      quickEntry.description = '';
      quickEntry.duration = '';
      quickEntry.clientId = '';
    } catch (error) {
      console.error('Failed to add time entry:', error);
      alert('Failed to add time entry. Please try again.');
    }
  }

  // Open the edit modal for an entry
  function editEntry(entry: TimeEntry) {
    editingEntry = entry;
    showFullEntry = true;
  }
  
  // Format date for display
  function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString();
  }
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
      
        <!-- "New Entry" button -->  
        <button
          class="btn btn-primary ml-auto"
          on:click={() => {
            editingEntry = null;
            showFullEntry = true;
          }}
        >
          <Icon src={Plus} class="w-4 h-4 mr-2" />
          New Entry
        </button>
      </div>
    </div>
  </GlassCard>

  <!-- Loading State -->
  {#if isLoading}
    <GlassCard className="p-6">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading time entries...</div>
      </div>
    </GlassCard>
  {:else}
    <!-- Filters and Control Bar -->
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

    <!-- Quick Entry Form -->
    <GlassCard className="p-0 overflow-hidden">
      <button
        class="w-full text-left p-5 hover:bg-white/5 transition-colors flex items-center justify-between"
        on:click={() => showQuickEntry = !showQuickEntry}
      >
        <span class="font-medium flex items-center">
          <Icon src={Plus} class="w-4 h-4 mr-2" />
          Quick Entry
        </span>
        <Icon src={showQuickEntry ? ChevronUp : ChevronDown} class="w-5 h-5" />
      </button>

      {#if showQuickEntry}
        <div class="px-5 pb-5" 
          in:slide={{ duration: 300, easing: cubicOut }}
          out:slide={{ duration: 200, easing: cubicIn }}
        >
          <form on:submit={handleQuickEntry} class="form-group">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="form-field">
                <label for="quick-description" class="form-label">Description</label>
                <input
                  id="quick-description"
                  type="text"
                  bind:value={quickEntry.description}
                  class="form-input"
                  placeholder="What did you work on?"
                  required
                />
              </div>

              <div class="form-field">
                <label for="quick-duration" class="form-label">Duration (minutes)</label>
                <input
                  id="quick-duration"
                  type="number"
                  step="1"
                  min="1"
                  bind:value={quickEntry.duration}
                  class="form-input"
                  placeholder="0"
                  required
                />
              </div>

              <div class="form-field">
                <label for="quick-client" class="form-label">Client</label>
                <select
                  id="quick-client"
                  bind:value={quickEntry.clientId}
                  class="form-select"
                  required
                >
                  <option value="">Select a client</option>
                  {#each $clientStore as client}
                    <option value={client.id}>{client.name}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="flex justify-end">
              <button type="submit" class="form-submit">
                Add Entry
              </button>
            </div>
          </form>
        </div>
      {/if}
    </GlassCard>

    <!-- Time Entries List (using new datatable component) -->
    <TimeEntryList showForm={false} filter={selectedFilter} />
  {/if}
</div>

<!-- Entry Modal (for new or edit) -->
<Modal
  open={showFullEntry}
  title={editingEntry ? 'Edit Time Entry' : 'New Time Entry'}
  on:close={() => {
    showFullEntry = false;
    editingEntry = null;
  }}
>
  <div in:fade={{ duration: 200 }}>
    <TimeEntryForm
      editEntry={editingEntry}
      onSave={() => {
        showFullEntry = false;
        editingEntry = null;
      }}
      onCancel={() => {
        showFullEntry = false;
        editingEntry = null;
      }}
    />
  </div>
</Modal>