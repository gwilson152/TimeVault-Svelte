<script lang="ts">
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { GlassCard } from '$lib/components';
  import TimeEntryForm from './TimeEntryForm.svelte';
  import { onMount } from 'svelte';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { calculateTotals } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import { goto } from '$app/navigation';
  import * as api from '$lib/services/api';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { LockClosed, MagnifyingGlass } from '@steeze-ui/heroicons';

  export let clientId: string | undefined = undefined;
  export let showForm = true;
  export let filter: string = 'all';
  
  let searchText = '';
  let loading = false;
  let error: string | null = null;
  let editing: string | null = null;

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
  
  onMount(() => {
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
  
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
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
    </div>
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
              {#if editing === entry.id}
                <tr>
                  <td colspan="7" class="p-4">
                    <TimeEntryForm
                      editEntry={entry}
                      onSave={() => {
                        cancelEdit();
                        timeEntryStore.load();
                      }}
                      onCancel={() => cancelEdit()}
                    />
                  </td>
                </tr>
              {:else}
                <tr class="data-table-row">
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
                        title={isEntryLocked(entry) ? "This time entry is locked" : ""}
                      >
                        {isEntryLocked(entry) ? "View" : "Edit"}
                      </button>
                      <button
                        class="table-action-button-danger"
                        on:click={() => confirmDelete(entry)}
                        disabled={loading || isEntryLocked(entry)}
                        class:opacity-50={isEntryLocked(entry)}
                        title={isEntryLocked(entry) ? "This time entry is locked" : ""}
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
              <td colspan="3">Totals</td>
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