<script lang="ts">
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard } from '$lib/components';
  import TimeEntryForm from './TimeEntryForm.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { calculateTotals } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { LockClosed, MagnifyingGlass } from '@steeze-ui/heroicons';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { getClientHierarchy } from '$lib/utils/clientUtils';

  export let clientId: string | undefined = undefined;
  export let showForm = false; // Default to not showing the full form
  export let filter: string = 'all';
  export let includeChildClients = false; // New prop to include child clients
  
  let searchText = '';
  let loading = false;
  let error: string | null = null;
  let showBulkActions = false;
  let selectedEntries: Set<string> = new Set();

  // Apply filtering and searching to entries
  $: baseEntries = ($entriesWithClientInfo || [])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .filter(e => {
      if (!clientId) return true;
      if (!includeChildClients) return e.clientId === clientId;
      
      // If including child clients, get the hierarchy and filter by all client IDs
      const hierarchy = getClientHierarchy($clientStore, clientId);
      const clientIds = hierarchy.map(c => c.id);
      return e.clientId && clientIds.includes(e.clientId);
    })
    .map(entry => ({
      ...entry,
      durationHours: entry.minutes / 60,
      // Ensure client data is properly structured even if incomplete
      client: entry.client ? {
        ...entry.client,
        billingRateOverrides: entry.client.billingRateOverrides || []
      } : undefined
    }));
  
  $: filteredByTypeEntries = filter === 'all' 
    ? baseEntries
    : filter === 'billable' 
      ? baseEntries.filter(entry => entry.billable)
      : filter === 'unbilled' 
        ? baseEntries.filter(entry => entry.billable && !entry.billed)
        : filter === 'billed'
          ? baseEntries.filter(entry => entry.billed)
          : baseEntries;
            
  $: filteredEntries = searchText 
    ? filteredByTypeEntries.filter(entry => 
        entry.description?.toLowerCase().includes(searchText.toLowerCase()) ||
        entry.clientName?.toLowerCase().includes(searchText.toLowerCase()))
    : filteredByTypeEntries;

  function isEntryLocked(entry: any): boolean {
    return entry.billed === true || entry.locked === true;
  }

  $: totals = calculateTotals(filteredEntries, []);

  $: anythingSelected = selectedEntries.size > 0;
  
  $: bulkSelectedDuration = filteredEntries
    .filter(entry => selectedEntries.has(entry.id))
    .reduce((sum, entry) => sum + entry.minutes, 0);
    
  $: bulkSelectedAmount = filteredEntries
    .filter(entry => selectedEntries.has(entry.id) && entry.billable && entry.billingRate)
    .reduce((sum, entry) => sum + (entry.billingRate ? entry.billingRate.rate * (entry.minutes / 60) : 0), 0);
  
  onMount(() => {
    settingsStore.load();
    clientStore.load();
    timeEntryStore.load();
  });

  async function handleDelete(id: string) {
    if (loading) return;
    
    try {
      loading = true;
      error = null;
      await timeEntryStore.remove(id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete time entry';
    } finally {
      loading = false;
    }
  }

  function confirmDelete(entry: TimeEntryWithClient) {
    if (entry.billed || isEntryLocked(entry)) return;
    
    if (confirm('Are you sure you want to delete this time entry?')) {
      handleDelete(entry.id);
    }
  }

  function toggleSelection(id: string) {
    if (selectedEntries.has(id)) {
      selectedEntries.delete(id);
    } else {
      selectedEntries.add(id);
    }
    selectedEntries = selectedEntries; // Trigger reactivity
  }

  function toggleAllSelection() {
    if (selectedEntries.size === filteredEntries.length) {
      // Deselect all
      selectedEntries = new Set();
    } else {
      // Select all
      selectedEntries = new Set(filteredEntries.map(e => e.id));
    }
  }
  
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  // Events
  const dispatch = createEventDispatcher();
  
  function handleEdit(entry) {
    dispatch('edit', entry);
  }
</script>

<div class="space-y-4">
  <!-- Summary Card -->
  <GlassCard className="p-4">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <div class="text-sm text-gray-400">Total Hours</div>
        <div class="font-medium text-lg">{(totals.minutes / 60).toFixed(2)}</div>
      </div>
      <div>
        <div class="text-sm text-gray-400">Total Amount</div>
        <div class="font-medium text-lg">{formatCurrency(totals.amount)}</div>
      </div>
      <div>
        <div class="text-sm text-gray-400">Total Cost</div>
        <div class="font-medium text-lg">{formatCurrency(totals.cost)}</div>
      </div>
      <div class="md:col-span-1 flex items-center">
        <div class="relative w-full">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Icon src={MagnifyingGlass} class="w-4 h-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            bind:value={searchText} 
            placeholder="Search entries..." 
            class="form-input pl-10 py-2 w-full"
          />
        </div>
      </div>
    </div>
  </GlassCard>

  {#if showForm}
    <TimeEntryForm 
      editEntry={null}
      onSave={() => {
        timeEntryStore.load();
      }}
      onCancel={null}
    />
  {/if}

  {#if error}
    <div class="bg-red-500/10 text-red-400 p-4 rounded-lg border border-red-500/20">
      {error}
      <button class="ml-2 underline" on:click={() => error = null}>Dismiss</button>
    </div>
  {/if}

  <!-- Bulk Actions -->
  {#if anythingSelected}
    <GlassCard className="p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div class="flex flex-col">
          <span class="text-sm text-gray-400">{selectedEntries.size} entries selected</span>
          <div class="flex items-center gap-4 mt-1">
            <span>{minutesToFormatted(bulkSelectedDuration)}</span>
            {#if bulkSelectedAmount > 0}
              <span>{formatCurrency(bulkSelectedAmount)}</span>
            {/if}
          </div>
        </div>
        <div class="flex gap-2 mt-2 sm:mt-0">
          <button class="btn btn-secondary" on:click={() => selectedEntries = new Set()}>
            Deselect All
          </button>
          <!-- Add bulk actions here in the future -->
        </div>
      </div>
    </GlassCard>
  {/if}

  {#if filteredEntries.length === 0}
    <div class="text-center py-8 text-gray-400">
      {searchText ? 'No matching time entries found. Try a different search.' : 'No time entries found'}
    </div>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead class="data-table-header">
            <tr>
              <th class="w-10">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  checked={selectedEntries.size === filteredEntries.length && filteredEntries.length > 0}
                  on:change={toggleAllSelection}
                />
              </th>
              <th>Client</th>
              <th>Description</th>
              <th>Date</th>
              <th class="right-aligned">Duration</th>
              <th class="right-aligned">Amount</th>
              <th>Status</th>
              <th class="right-aligned">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredEntries as entry}
              <tr class="data-table-row">
                <td>
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    checked={selectedEntries.has(entry.id)}
                    on:change={() => toggleSelection(entry.id)}
                    disabled={isEntryLocked(entry)}
                  />
                </td>
                <td>
                  <div class="font-medium">{entry.clientName || 'No Client'}</div>
                </td>
                <td>
                  <div class="max-w-md truncate">{entry.description}</div>
                </td>
                <td>{formatDate(entry.date)}</td>
                <td class="right-aligned">
                  <span class="whitespace-nowrap">
                    {minutesToFormatted(entry.minutes)}
                  </span>
                </td>
                <td class="right-aligned">
                  {#if entry.billable && entry.billingRate}
                    <div class="whitespace-nowrap">
                      {formatCurrency(entry.billingRate.rate * (entry.minutes / 60))}
                    </div>
                    <div class="text-xs text-gray-400">
                      Profit: {formatCurrency((entry.billingRate.rate - entry.billingRate.cost) * (entry.minutes / 60))}
                    </div>
                  {:else}
                    <span class="text-gray-400">—</span>
                  {/if}
                </td>
                <td>
                  {#if isEntryLocked(entry)}
                    <span class="flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded w-fit">
                      <Icon src={LockClosed} class="w-3 h-3" />
                      <span>Locked</span>
                    </span>
                  {:else if entry.billed}
                    <span class="flex items-center gap-2 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded w-fit">
                      <span>Billed</span>
                    </span>
                  {:else if entry.billable}
                    <span class="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded w-fit">
                      Billable
                    </span>
                  {:else}
                    <span class="text-xs bg-gray-500/10 text-gray-400 px-2 py-1 rounded w-fit">
                      Non-billable
                    </span>
                  {/if}
                  
                  {#if entry.invoiceId}
                    <div class="mt-1 text-xs">
                      <a 
                        href="/invoices/{entry.invoiceId}"
                        class="text-blue-400 hover:text-blue-300"
                      >
                        View Invoice
                      </a>
                    </div>
                  {/if}
                </td>
                <td class="right-aligned">
                  <div class="flex justify-end gap-2">
                    <button
                      class="btn btn-primary mr-1"
                      on:click={() => handleEdit(entry)}
                      disabled={loading || isEntryLocked(entry)}
                      class:opacity-50={isEntryLocked(entry)}
                      title={isEntryLocked(entry) ? "This time entry is locked" : "Edit this entry"}
                    >
                      Edit
                    </button>
                    <button
                      class="btn btn-danger"
                      on:click={() => confirmDelete(entry)}
                      disabled={loading || isEntryLocked(entry)}
                      class:opacity-50={isEntryLocked(entry)}
                      title={isEntryLocked(entry) ? "This time entry is locked" : "Delete this entry"}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="data-table-footer">
            <tr>
              <td colspan="4">Totals</td>
              <td class="right-aligned">{minutesToFormatted(totals.minutes)}</td>
              <td class="right-aligned">{formatCurrency(totals.amount)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassCard>
  {/if}
</div>

<style>
  /* Table button styles following TimeVault style conventions */
  :global(.table-action-button-primary) {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    transition-property: color, background-color;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
    background-color: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  :global(.table-action-button-primary:hover) {
    background-color: rgba(59, 130, 246, 0.3);
  }

  :global(.table-action-button-danger) {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    transition-property: color, background-color;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
    background-color: rgba(220, 38, 38, 0.2);
    color: rgb(252, 165, 165);
  }

  :global(.table-action-button-danger:hover) {
    background-color: rgba(220, 38, 38, 0.3);
  }
</style>