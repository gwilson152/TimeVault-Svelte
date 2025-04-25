<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';
  import { GlassCard, Modal, TimeEntryForm } from '$lib/components';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Clock, Plus, ChevronDown, ChevronUp } from '@steeze-ui/heroicons';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';

  // Initialize with default values
  let entries: TimeEntryWithClient[] = [];
  let filteredEntries: TimeEntryWithClient[] = [];
  let groupedEntries: Record<string, TimeEntryWithClient[]> = {};
  
  // Page state
  let isLoading = true;
  let showQuickEntry = false;
  let showFullEntry = false;
  let editingEntry: TimeEntry | null = null;
  let selectedFilter = 'all';
  let groupByDate = true;
  
  // Quick entry form state
  let quickEntry = {
    description: '',
    hours: '',
    clientId: ''
  };

  // Handle store updates
  $: {
    if ($entriesWithClientInfo) {
      entries = $entriesWithClientInfo.filter((entry): entry is TimeEntryWithClient => entry !== null);
      filteredEntries = filterEntries(entries, selectedFilter);
      groupedEntries = groupByDate ? groupEntriesByDate(filteredEntries) : { 'All Entries': filteredEntries };
    }
  }

  $: totalHours = filteredEntries?.reduce((sum, entry) => sum + (entry?.hours || 0), 0) ?? 0;
  $: totalBillableAmount = filteredEntries
    ?.filter(entry => entry?.billable)
    .reduce((sum, entry) => sum + ((entry?.hours || 0) * (entry?.clientRate || 0)), 0) ?? 0;

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

  // Group entries by date for better organization
  function groupEntriesByDate(entries: TimeEntryWithClient[]): Record<string, TimeEntryWithClient[]> {
    return entries.reduce((groups: Record<string, TimeEntryWithClient[]>, entry) => {
      const dateStr = new Date(entry.date).toLocaleDateString(undefined, { 
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(entry);
      return groups;
    }, {});
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
    if (!quickEntry.description || !quickEntry.hours || !quickEntry.clientId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await timeEntryStore.add({
        description: quickEntry.description,
        hours: parseFloat(quickEntry.hours),
        clientId: quickEntry.clientId,
        date: new Date(),
        ticketId: null,
        billable: true
      });

      // Reset form
      quickEntry.description = '';
      quickEntry.hours = '';
      quickEntry.clientId = '';
    } catch (error) {
      console.error('Failed to add time entry:', error);
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
        
        <div class="flex items-center gap-3">
          <button
            class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors bg-white/5 hover:bg-white/10"
            on:click={() => groupByDate = !groupByDate}
          >
            <span>{groupByDate ? 'Ungroup' : 'Group by Date'}</span>
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
                <label for="quick-hours" class="form-label">Hours</label>
                <input
                  id="quick-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  bind:value={quickEntry.hours}
                  class="form-input"
                  placeholder="0.00"
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

    <!-- Time Entries List -->
    {#if filteredEntries.length === 0}
      <GlassCard className="p-6">
        <div class="text-center py-8" transition:fade={{ duration: 200 }}>
          <p class="text-gray-400">No time entries found</p>
        </div>
      </GlassCard>
    {:else}
      {#each Object.entries(groupedEntries) as [dateGroup, entries]}
        <div transition:fade|local={{ duration: 200 }}>
          <GlassCard className="p-0 overflow-hidden">
            {#if groupByDate}
              <div class="px-5 py-3 border-b border-white/5 bg-white/2">
                <h3 class="text-sm font-medium">{dateGroup}</h3>
              </div>
            {/if}
            
            <div class="divide-y divide-white/5">
              {#each entries as entry}
                <button 
                  class="w-full text-left p-5 container-glass border-none hover:bg-container-glass-hover transition-colors"
                  on:click={() => editEntry(entry)}
                  transition:fade={{duration: 200}}
                >
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-medium">{entry.description}</p>
                      <p class="text-sm text-gray-400 mt-1">
                        {entry.clientName} • {entry.hours} {entry.hours === 1 ? 'hour' : 'hours'}
                        {#if !groupByDate}
                          • {formatDate(entry.date)}
                        {/if}
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="font-medium">
                        {entry.clientRate ? formatCurrency(entry.hours * entry.clientRate) : 'N/A'}
                      </p>
                      <div class="flex gap-2 mt-1 justify-end">
                        {#if entry.billable}
                          <span class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                            Billable
                          </span>
                        {/if}
                        {#if entry.billed}
                          <span class="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                            Billed
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </GlassCard>
        </div>
      {/each}
    {/if}
  {/if}
</div>

<!-- Entry Modal (for new or edit) -->
<Modal
  open={showFullEntry}
  title={editingEntry ? 'Edit Time Entry' : 'New Time Entry'}
  on:close={() => {
    showFullEntry = false;
    editingEntry = null; // Ensure editingEntry is reset
  }}
>
  <div in:fade={{ duration: 200 }}>
    <TimeEntryForm
      entry={editingEntry || {
        description: '',
        hours: 1,
        date: new Date(),
        clientId: '',
        ticketId: null,
        billable: true
      }}
      onSubmit={() => {
        showFullEntry = false;
        editingEntry = null; // Ensure editingEntry is reset after submission
      }}
    />
  </div>
</Modal>