<script lang="ts">
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard } from '$lib/components';
  import TimeEntryForm from './TimeEntryForm.svelte';
  import { onMount } from 'svelte';
  import type { TimeEntry, TimeEntryWithClient, NewTimeEntry } from '$lib/types';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { calculateTotals } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import * as api from '$lib/services/api';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { LockClosed, MagnifyingGlass, PlusCircle, Check, XMark } from '@steeze-ui/heroicons';
  import { settingsStore } from '$lib/stores/settingsStore';

  export let clientId: string | undefined = undefined;
  export let showForm = false; // Default to not showing the full form
  export let filter: string = 'all';
  
  let searchText = '';
  let loading = false;
  let error: string | null = null;
  let editing: string | null = null;
  let addingNewEntry = false;
  let newEntry: Partial<NewTimeEntry> = createEmptyTimeEntry();
  let showBulkActions = false;
  let selectedEntries: Set<string> = new Set();
  let isSubmittingInline = false;

  // Apply filtering and searching to entries
  $: baseEntries = ($entriesWithClientInfo || [])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .filter(e => !clientId || e.clientId === clientId)
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

  function createEmptyTimeEntry(): Partial<NewTimeEntry> {
    const now = new Date();
    // Round the time to the nearest 15 minutes for better default start time
    const minutes = Math.round(now.getMinutes() / 15) * 15;
    const roundedTime = new Date(now);
    roundedTime.setMinutes(minutes, 0, 0);

    return {
      description: '',
      date: now,
      startTime: roundedTime,
      endTime: null,
      minutes: 0,
      clientId: clientId || null,
      ticketId: null,
      billable: !!clientId, // Set billable to true if a client is pre-selected
      billingRateId: null,
      billed: false,
      locked: false,
      invoiceId: null,
    };
  }
  
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

  function startEdit(id: string) {
    editing = id;
  }

  function cancelEdit() {
    editing = null;
  }

  function confirmDelete(entry: TimeEntryWithClient) {
    if (entry.billed || isEntryLocked(entry)) return;
    
    if (confirm('Are you sure you want to delete this time entry?')) {
      handleDelete(entry.id);
    }
  }

  async function saveInlineEntry(entry: TimeEntryWithClient, updatedData: Partial<TimeEntry>) {
    if (isSubmittingInline) return;
    try {
      isSubmittingInline = true;
      await timeEntryStore.update(entry.id, updatedData);
      editing = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update time entry';
    } finally {
      isSubmittingInline = false;
    }
  }

  async function addNewInlineEntry() {
    if (isSubmittingInline || !newEntry.description || !newEntry.minutes) return;
    
    try {
      isSubmittingInline = true;
      
      // Ensure we have valid data
      if (typeof newEntry.minutes !== 'number' || newEntry.minutes <= 0) {
        throw new Error('Duration must be greater than 0');
      }
      
      // Create the time entry
      await timeEntryStore.add(newEntry as NewTimeEntry);
      
      // Reset the form
      newEntry = createEmptyTimeEntry();
      if (clientId) {
        newEntry.clientId = clientId;
        newEntry.billable = true;
      }
      
      addingNewEntry = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add time entry';
    } finally {
      isSubmittingInline = false;
    }
  }
  
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
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

  function startNewEntry() {
    addingNewEntry = true;
    newEntry = createEmptyTimeEntry();
    if (clientId) {
      newEntry.clientId = clientId;
      newEntry.billable = true;
    }
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

  <div class="flex justify-end">
    <button 
      class="btn btn-primary flex items-center gap-2"
      on:click={startNewEntry}
    >
      <Icon src={PlusCircle} class="w-4 h-4" />
      <span>Add Time Entry</span>
    </button>
  </div>

  {#if filteredEntries.length === 0 && !addingNewEntry}
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
            {#if addingNewEntry}
              <tr class="bg-blue-500/5 border-b border-blue-500/10">
                <td></td>
                <td>
                  <select 
                    bind:value={newEntry.clientId}
                    class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                    on:change={() => {
                      // Set billable to true when a client is selected
                      if (newEntry.clientId) {
                        newEntry.billable = true;
                      }
                    }}
                  >
                    <option value={null}>No Client</option>
                    {#each $clientStore as client}
                      <option value={client.id}>{client.name}</option>
                    {/each}
                  </select>
                </td>
                <td>
                  <input 
                    bind:value={newEntry.description}
                    placeholder="Description"
                    class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                  />
                </td>
                <td>
                  <input 
                    type="date"
                    bind:value={newEntry.date}
                    class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                  />
                </td>
                <td>
                  <input 
                    type="number"
                    bind:value={newEntry.minutes}
                    step="15"
                    min="1"
                    placeholder="Minutes"
                    class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500 text-right"
                  />
                </td>
                <td>
                  <div class="flex items-center justify-end">
                    <input 
                      type="checkbox"
                      bind:checked={newEntry.billable}
                      class="form-checkbox mr-2"
                    />
                    <span class="text-sm">Billable</span>
                  </div>
                </td>
                <td></td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button
                      class="p-1 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      on:click={addNewInlineEntry}
                      disabled={isSubmittingInline || !newEntry.description || !newEntry.minutes}
                      title="Save"
                    >
                      <Icon src={Check} class="w-4 h-4" />
                    </button>
                    <button
                      class="p-1 rounded-full bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                      on:click={() => addingNewEntry = false}
                      title="Cancel"
                    >
                      <Icon src={XMark} class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/if}

            {#each filteredEntries as entry}
              {#if editing === entry.id}
                <tr class="bg-blue-500/5 border-b border-blue-500/10">
                  <td></td>
                  <td>
                    <select 
                      value={entry.clientId}
                      class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                      disabled={isEntryLocked(entry)}
                      on:change={(e) => {
                        const updatedEntry = { ...entry, clientId: e.target.value || null };
                        if (e.target.value) {
                          updatedEntry.billable = true;
                        }
                        saveInlineEntry(entry, updatedEntry);
                      }}
                    >
                      <option value={null}>No Client</option>
                      {#each $clientStore as client}
                        <option value={client.id}>{client.name}</option>
                      {/each}
                    </select>
                  </td>
                  <td>
                    <input 
                      value={entry.description}
                      placeholder="Description"
                      class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                      disabled={isEntryLocked(entry)}
                      on:blur={(e) => {
                        if (e.target.value !== entry.description) {
                          saveInlineEntry(entry, { description: e.target.value });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input 
                      type="date"
                      value={new Date(entry.date).toISOString().split('T')[0]}
                      class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500"
                      disabled={isEntryLocked(entry)}
                      on:change={(e) => {
                        const newDate = new Date(e.target.value);
                        saveInlineEntry(entry, { date: newDate });
                      }}
                    />
                  </td>
                  <td>
                    <input 
                      type="number"
                      value={entry.minutes}
                      step="15"
                      min="1"
                      disabled={isEntryLocked(entry)}
                      class="w-full py-1 px-2 text-sm bg-transparent border-0 border-b border-blue-500/30 focus:ring-0 focus:border-blue-500 text-right"
                      on:change={(e) => {
                        const minutes = parseInt(e.target.value, 10);
                        if (!isNaN(minutes) && minutes > 0) {
                          saveInlineEntry(entry, { minutes });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <div class="flex items-center justify-end">
                      <input 
                        type="checkbox"
                        checked={entry.billable}
                        disabled={isEntryLocked(entry)}
                        class="form-checkbox mr-2"
                        on:change={(e) => {
                          saveInlineEntry(entry, { billable: e.target.checked });
                        }}
                      />
                      <span class="text-sm">Billable</span>
                    </div>
                  </td>
                  <td>
                    {#if isEntryLocked(entry)}
                      <span class="flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded w-fit">
                        <Icon src={LockClosed} class="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    {/if}
                  </td>
                  <td>
                    <div class="flex justify-end gap-1">
                      <button
                        class="p-1 rounded-full bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                        on:click={() => cancelEdit()}
                        title="Cancel"
                      >
                        <Icon src={XMark} class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {:else}
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
                        class="table-action-button-primary"
                        on:click={() => startEdit(entry.id)}
                        disabled={loading || isEntryLocked(entry)}
                        class:opacity-50={isEntryLocked(entry)}
                        title={isEntryLocked(entry) ? "This time entry is locked" : "Edit this entry"}
                      >
                        {isEntryLocked(entry) ? "View" : "Edit"}
                      </button>
                      <button
                        class="table-action-button-danger"
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
              {/if}
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