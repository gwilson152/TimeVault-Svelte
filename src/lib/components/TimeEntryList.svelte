<script lang="ts">
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { GlassCard } from '$lib/components';
  import TimeEntryForm from './TimeEntryForm.svelte';
  import { onMount } from 'svelte';
  import type { TimeEntryWithClient } from '$lib/types';

  export let clientId: string | undefined = undefined;
  export let showForm = true;
  export let onEdit: ((entry: TimeEntryWithClient) => void) | undefined = undefined; // Ensure 'onEdit' is used or documented

  let loading = false;
  let error: string | null = null;
  let editing: string | null = null;

  $: entries = ($entriesWithClientInfo || [])
    .filter((e): e is TimeEntryWithClient => e !== null)
    .filter(e => !clientId || e.clientId === clientId);

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

  // Example usage of 'onEdit' to avoid unused export warning
  function handleEdit(entry: TimeEntryWithClient) {
    if (onEdit) {
      onEdit(entry);
    }
  }
</script>

<div class="space-y-4">
  {#if showForm}
    <TimeEntryForm 
      entry={clientId ? { clientId } : {}} 
      onSubmit={() => timeEntryStore.load(true)}
    />
  {/if}

  {#if error}
    <div class="text-red-500">{error}</div>
  {/if}

  <div class="grid gap-4">
    {#each entries as entry (entry.id)}
      <GlassCard className="p-4">
        {#if editing === entry.id}
          <TimeEntryForm 
            entry={{
              id: entry.id,
              description: entry.description,
              hours: entry.hours,
              date: entry.date,
              clientId: entry.clientId,
              ticketId: entry.ticketId,
              billable: entry.billable,
              billed: entry.billed,
              invoiceId: entry.invoiceId
            }}
            onSubmit={() => {
              cancelEdit();
              timeEntryStore.load(true);
            }}
          />
        {:else}
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-semibold">{entry.clientName}</h3>
              <p class="text-sm text-gray-400">
                {new Date(entry.date).toLocaleDateString()}
              </p>
              <p class="mt-2">{entry.description}</p>
              <div class="mt-2 flex items-center gap-2">
                <span class="text-sm font-medium">
                  {entry.hours} hours
                </span>
                {#if entry.billable}
                  <span class="badge badge-success">Billable</span>
                {/if}
                {#if entry.billed}
                  <span class="badge badge-info">Billed</span>
                {/if}
              </div>
            </div>
            
            <div class="flex gap-2">
              <button
                class="btn btn-ghost btn-sm"
                on:click={() => startEdit(entry.id)}
                disabled={loading}
              >
                Edit
              </button>
              <button
                class="btn btn-ghost btn-sm text-error"
                on:click={() => handleDelete(entry.id)}
                disabled={loading}
              >
                Delete
              </button>
            </div>
          </div>
        {/if}
      </GlassCard>
    {/each}
  </div>
</div>