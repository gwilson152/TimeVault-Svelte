<script lang="ts">
  import { writable, derived } from 'svelte/store';
  import type { TimeEntry, Client } from '$lib/types';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import TimeEntryForm from './TimeEntryForm.svelte';
  import { superValidate, superForm } from 'sveltekit-superforms/client';
  import { zod } from 'sveltekit-superforms/adapters';
  import { timeEntrySchema } from '$lib/types';
  import { onMount } from 'svelte';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { z } from 'zod';

  export let onEdit: (entry: TimeEntry) => void;
  export let client: Client | null = null;

  type TimeEntryForm = z.infer<typeof timeEntrySchema>;
  type TimeEntryFormType = SuperForm<TimeEntryForm>;

  let editingEntry: TimeEntry | null = null;
  let showForm = false;
  let superFormData: TimeEntryFormType | null = null;

  // State
  let sortField = writable<keyof TimeEntry>('date');
  let sortDirection = writable<'asc' | 'desc'>('desc');
  let filter = writable('');

  // Initialize form when component mounts
  onMount(async () => {
    const validated = await superValidate(zod(timeEntrySchema));
    superFormData = superForm<TimeEntryForm>(validated);
  });

  // Filter entries
  const filteredEntries = derived(
    [entriesWithClientInfo, filter],
    ([$entriesWithClientInfo, $filter]) => {
      let entries = $entriesWithClientInfo;
      
      // Filter by client if provided
      if (client) {
        entries = entries.filter(entry => entry.clientId === client.id);
      }

      // Apply search filter
      if ($filter) {
        const searchTerm = $filter.toLowerCase();
        entries = entries.filter(entry => {
          return (
            entry.description.toLowerCase().includes(searchTerm) ||
            (entry.clientName?.toLowerCase() || '').includes(searchTerm)
          );
        });
      }

      return entries;
    }
  );

  // Sort entries
  const sortedEntries = derived(
    [filteredEntries, sortField, sortDirection],
    ([$filteredEntries, $sortField, $sortDirection]) => {
      const field = $sortField;
      const direction = $sortDirection;

      return [...$filteredEntries].sort((a, b) => {
        const valueA = a[field];
        const valueB = b[field];

        if (valueA === null || valueB === null) return 0;

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return direction === 'asc'
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        }

        return direction === 'asc'
          ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
          : (valueA > valueB ? -1 : valueA < valueB ? 1 : 0);
      });
    }
  );

  // Toggle sort direction or change sort field
  function handleSort(field: keyof TimeEntry) {
    if ($sortField === field) {
      sortDirection.set($sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      sortField.set(field);
      sortDirection.set('asc');
    }
  }

  function handleEdit(entry: TimeEntry) {
    if (onEdit) {
      onEdit(entry);
    }
    editingEntry = entry;
    showForm = true;
  }

  function handleSave() {
    editingEntry = null;
    showForm = false;
  }

  function handleCancel() {
    editingEntry = null;
    showForm = false;
  }

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this time entry?')) {
      timeEntryStore.remove(id);
    }
  }

  function formatHours(hours: number): string {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  function getTicketTitle(ticketId: string | null): string {
    if (!ticketId) return '';
    const ticket = $ticketStore.find(t => t.id === ticketId);
    return ticket ? ticket.title : '';
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-bold text-gray-900">Time Entries</h2>
    <button
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      onclick={() => showForm = true}
    >
      New Time Entry
    </button>
  </div>

  {#if showForm}
    {#if superFormData}
      <TimeEntryForm 
        form={superFormData}
        editEntry={editingEntry}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    {:else}
      <div class="text-center py-4">Loading form...</div>
    {/if}
  {/if}

  <div class="relative">
    <input
      type="text"
      placeholder="Search entries..."
      class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      bind:value={$filter}
    />
    {#if $filter}
      <button 
        class="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        onclick={() => filter.set('')}
      >
        ✕
      </button>
    {/if}
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('description')}
          >
            Description
            {#if $sortField === 'description'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('clientId')}
          >
            Client
            {#if $sortField === 'clientId'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('hours')}
          >
            Hours
            {#if $sortField === 'hours'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th 
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            onclick={() => handleSort('date')}
          >
            Date
            {#if $sortField === 'date'}
              {$sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if $sortedEntries.length === 0}
          <tr>
            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
              No time entries found. Create a new entry to get started.
            </td>
          </tr>
        {:else}
          {#each $sortedEntries as entry}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900">{entry.description}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{entry.clientName || '-'}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {#if entry.ticketId}
                    <a 
                      href="/tickets" 
                      class="text-blue-600 hover:text-blue-800"
                    >
                      {getTicketTitle(entry.ticketId)}
                    </a>
                  {:else}
                    -
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{formatHours(entry.hours)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{new Date(entry.date).toLocaleDateString()}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  class="text-blue-600 hover:text-blue-900 mr-3"
                  onclick={() => handleEdit(entry)}
                >
                  Edit
                </button>
                <button 
                  class="text-red-600 hover:text-red-900"
                  onclick={() => handleDelete(entry.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>