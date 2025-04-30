<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard, TimeEntryForm } from '$lib/components';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted } from '$lib/utils/timeUtils';
  import type { TimeEntry } from '$lib/types';
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { 
    DocumentText,
    Clock,
    CurrencyDollar,
    Plus,
    Check,
    ArrowUturnLeft
  } from '@steeze-ui/heroicons';

  // State management
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successCount = $state(0);

  // Array to track form entries
  let entries = $state<{id: string}[]>([{ id: crypto.randomUUID() }]);

  // Track totals from TimeEntryForm components
  let entryTotals = $state<{[key: string]: { minutes: number; amount: number }}>({});

  // Computed totals using runes
  const totalMinutes = $derived(
    Object.values(entryTotals).reduce((sum, entry) => sum + entry.minutes, 0)
  );

  const totalAmount = $derived(
    Object.values(entryTotals).reduce((sum, entry) => sum + entry.amount, 0)
  );

  function addNewEntry(): void {
    entries = [...entries, { id: crypto.randomUUID() }];
  }

  function removeEntry(id: string): void {
    entries = entries.filter(e => e.id !== id);
    delete entryTotals[id];
  }

  async function handleEntrySave(entry: TimeEntry, id: string) {
    // Update totals for this entry
    entryTotals[id] = {
      minutes: entry.minutes,
      amount: entry.billable && entry.billingRate ? (entry.minutes / 60) * entry.billingRate.rate : 0
    };
  }

  async function submitEntries(): Promise<void> {
    if (isSubmitting) return;
    
    try {
      isSubmitting = true;
      errorMessage = null;

      // Get all form references
      const forms = document.querySelectorAll('[data-entry-form]');
      const submitButtons = Array.from(forms).map(form => 
        form.querySelector('button[type="submit"]') as HTMLButtonElement
      );

      // Click all submit buttons to trigger form submissions
      await Promise.all(
        submitButtons.map(button => button.click())
      );
      
      // Redirect back to time entries page
      goto('/time-entries');
    } catch (error) {
      console.error('Failed to submit time entries:', error);
      errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to submit time entries';
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    // Load required data
    Promise.all([
      clientStore.load(),
      settingsStore.load(),
      timeEntryStore.load()
    ]);
  });
</script>

<div class="space-y-6 container pb-24">
  <!-- Sticky Header -->
  <div class="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
    <div class="container-glass border-b border-gray-800">
      <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <!-- Top Row with Actions -->
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-4">
            <button 
              class="btn btn-secondary btn-sm"
              onclick={() => goto('/time-entries')}
            >
              <Icon src={ArrowUturnLeft} class="w-4 h-4" />
              <span class="ml-1.5">Back</span>
            </button>
            <h1 class="text-xl font-semibold">Bulk Time Entry</h1>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="btn btn-primary"
              disabled={entries.length === 0 || isSubmitting}
              onclick={submitEntries}
            >
              {#if isSubmitting}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Submitting...
              {:else}
                <Icon src={Check} class="w-4 h-4 mr-2" />
                Submit All ({entries.length})
              {/if}
            </button>
          </div>
        </div>
        
        <!-- Bottom Row with Stats -->
        <div class="flex flex-wrap items-center gap-6 text-sm">
          <div class="flex items-center gap-2">
            <Icon src={DocumentText} class="w-4 h-4 text-blue-400" />
            <span>
              <span class="font-medium">{entries.length}</span> entries
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Icon src={Clock} class="w-4 h-4 text-purple-400" />
            <span>
              <span class="font-medium">{minutesToFormatted(totalMinutes)}</span> total
            </span>
          </div>
          {#if totalAmount > 0}
            <div class="flex items-center gap-2">
              <Icon src={CurrencyDollar} class="w-4 h-4 text-green-400" />
              <span class="font-medium text-green-400">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if errorMessage}
    <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 text-red-400 p-4 rounded-lg">
      {errorMessage}
      <button class="ml-2 underline" onclick={() => errorMessage = null}>Dismiss</button>
    </div>
  {/if}

  <!-- Time Entry Forms -->
  <div class="space-y-3">
    {#each entries as entry (entry.id)}
      <GlassCard className="p-4">
        <div class="flex justify-end mb-4">
          <button 
            class="text-red-400 hover:text-red-300 p-1"
            title="Remove Entry"
            onclick={() => removeEntry(entry.id)}
          >
            Remove Entry
          </button>
        </div>
        <div data-entry-form>
          <TimeEntryForm
            onSave={(savedEntry) => handleEntrySave(savedEntry, entry.id)}
          />
        </div>
      </GlassCard>
    {/each}
  </div>

  <!-- Add Entry Button -->
  <div class="fixed bottom-16 right-6">
    <button
      class="btn btn-primary"
      onclick={addNewEntry}
    >
      <Icon src={Plus} class="w-4 h-4 mr-2" />
      Add Entry
    </button>
  </div>

  <!-- Add bottom padding to account for fixed elements -->
  <div class="pb-24"></div>
</div>