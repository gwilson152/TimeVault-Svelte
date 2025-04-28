<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard } from '$lib/components';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { 
    minutesToFormatted, 
    formattedToMinutes, 
    calculateEndTime
  } from '$lib/utils/timeUtils';
  import type { NewTimeEntry, BillingRate, TimeEntry, Client } from '$lib/types';
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { 
    CalendarDays, 
    ArrowRight, 
    Plus, 
    MinusCircle, 
    Clock,
    DocumentText,
    CurrencyDollar,
    UserCircle,
    Ticket,
    Check,
    ArrowUturnLeft,
    MagnifyingGlass
  } from '@steeze-ui/heroicons';
  import ClientSearch from '$lib/components/ClientSearch.svelte';

  // Helper functions
  function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  }

  function changeEntryDate(entry: BulkEntry, days: number): void {
    const newDate = new Date(entry.date);
    newDate.setDate(newDate.getDate() + days);
    entry.date = newDate;
    // Force reactivity update
    entries = [...entries];
  }

  // State management
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successCount = $state(0);
  let clientSearchQuery = $state('');

  // Global settings for all entries
  let globalSettings = $state({
    clientId: null as string | null,
    billingRateId: null as string | null,
    billable: true,
    date: new Date(), // Default to now
    startTime: new Date().toTimeString().slice(0, 5), // Default to current time HH:MM
  });

  type BulkEntry = {
    id: string;
    date: Date;
    description: string;
    startTime: string;
    duration: string;
    minutes: number;
    ticketId: string | null;
    clientId: string | null;
    billable: boolean;
    billingRateId: string | null;
  };

  let entries = $state<BulkEntry[]>([]);
  let billingRates = $state<BillingRate[]>([]);

  // Helper function to get all descendant clients
  function getDescendantClientIds(clientId: string, clients: Client[]): string[] {
    const directChildren = clients.filter(c => c.parentId === clientId);
    const descendantIds = directChildren.map(c => c.id);
    
    // Recursively get descendants of each child
    for (const child of directChildren) {
      descendantIds.push(...getDescendantClientIds(child.id, clients));
    }
    
    return descendantIds;
  }

  // Helper function to get parent client IDs
  function getParentClientIds(clientId: string, clients: Client[]): string[] {
    const ids: string[] = [];
    let current = clients.find(c => c.id === clientId);
    
    while (current?.parentId) {
      ids.push(current.parentId);
      current = clients.find(c => c.id === current?.parentId);
    }
    
    return ids;
  }

  // Helper function to get client with its hierarchy level
  function getClientWithLevel(clientId: string, clients: Client[], level = 0): { client: Client; level: number } | null {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return { client, level };
  }

  // Helper function to get all clients in hierarchical order
  function getClientsInHierarchy(clients: Client[], parentId: string | null = null, level = 0): Array<{ client: Client; level: number }> {
    // Get immediate children of this parent
    const immediateChildren = clients.filter(c => c.parentId === parentId);
    
    // Sort children by name
    immediateChildren.sort((a, b) => a.name.localeCompare(b.name));
    
    // Build the hierarchy
    let result: Array<{ client: Client; level: number }> = [];
    for (const client of immediateChildren) {
      // Add this client
      result.push({ client, level });
      // Add all its children recursively
      result = result.concat(getClientsInHierarchy(clients, client.id, level + 1));
    }
    
    return result;
  }

  // Helper to get client type indicator
  function getClientTypeIndicator(type: string): string {
    switch (type) {
      case 'business': return '🏢';
      case 'container': return '📁';
      case 'individual': return '👤';
      default: return '';
    }
  }

  // Computed values using $derived
  const filteredClients = $derived(
    (() => {
      // First, find all matching clients and their parents
      const matchingIds = new Set<string>();
      
      $clientStore.forEach(client => {
        const matchesSearch = !clientSearchQuery || 
          client.name.toLowerCase().includes(clientSearchQuery.toLowerCase());
          
        if (matchesSearch) {
          // Add the matching client
          matchingIds.add(client.id);
          // Add all its parent clients
          getParentClientIds(client.id, $clientStore).forEach(id => matchingIds.add(id));
        }
      });

      // If a parent client is selected, only show it and its descendants
      if (globalSettings.clientId) {
        const descendantIds = new Set([
          globalSettings.clientId,
          ...getDescendantClientIds(globalSettings.clientId, $clientStore)
        ]);
        // Intersect with matching IDs if we have a search
        if (clientSearchQuery) {
          const intersection = new Set(
            [...matchingIds].filter(id => descendantIds.has(id))
          );
          matchingIds.clear();
          intersection.forEach(id => matchingIds.add(id));
        } else {
          matchingIds.clear();
          descendantIds.forEach(id => matchingIds.add(id));
        }
      }

      // Convert matching IDs to hierarchical client list
      return getClientsInHierarchy($clientStore)
        .filter(({ client }) => matchingIds.has(client.id))
        .sort((a, b) => {
          // Sort by level first (parents before children)
          if (a.level !== b.level) return a.level - b.level;
          // Then by name within the same level
          return a.client.name.localeCompare(b.client.name);
        });
    })()
  );

  const selectedClient = $derived(
    $clientStore.find(c => c.id === globalSettings.clientId)
  );

  const availableTickets = $derived(
    globalSettings.clientId
      ? $ticketStore.filter(t => t.clientId === globalSettings.clientId)
      : []
  );

  const availableBillingRates = $derived(billingRates);
    
  const hasValidEntries = $derived(
    entries.length > 0 && entries.every(e => 
      // Basic validation
      e.description && 
      e.minutes > 0 && 
      (e.clientId || globalSettings.clientId) &&
      // Billing rate validation
      (!e.billable || (e.billingRateId || globalSettings.billingRateId))
    )
  );

  const totalMinutes = $derived(
    entries.reduce((sum, entry) => sum + entry.minutes, 0)
  );

  const totalAmount = $derived(
    entries.reduce((sum, entry) => {
      const rate = entry.billingRateId 
        ? getBillingRateAmount(entry.billingRateId, entry.clientId || globalSettings.clientId)
        : globalSettings.billingRateId 
          ? getBillingRateAmount(globalSettings.billingRateId, entry.clientId || globalSettings.clientId)
          : 0;
      return sum + (rate * (entry.minutes / 60));
    }, 0)
  );

  onMount(() => {
    // Load required data
    Promise.all([
      clientStore.load(),
      settingsStore.load(),
      ticketStore.load()
    ]).then(() => {
      // Subscribe to billing rates
      const unsubscribe = settingsStore.billingRates.subscribe(rates => {
        billingRates = rates;
        
        if (rates.length > 0) {
          const defaultRate = rates.find(r => r.isDefault);
          globalSettings.billingRateId = defaultRate?.id || rates[0].id;
        }
      });
      
      // Create initial entry
      addNewEntry();
      
      return unsubscribe;
    });
  });

  // Helper functions
  function getBillingRateAmount(rateId: string, clientId: string | null): number {
    const rate = billingRates.find(r => r.id === rateId);
    if (!rate) return 0;

    if (clientId) {
      const client = $clientStore.find(c => c.id === clientId);
      const override = client?.billingRateOverrides.find(o => o.baseRateId === rateId);
      
      if (override) {
        return override.overrideType === 'percentage'
          ? (rate.rate * override.value / 100)
          : override.value;
      }
    }
    
    return rate.rate;
  }

  function createEmptyEntry(): BulkEntry {
    const lastEntry = entries[entries.length - 1];
    const nextStartTime = lastEntry 
      ? addMinutesToTime(lastEntry.startTime, lastEntry.minutes)
      : globalSettings.startTime;
    
    // Use last entry as template if available
    if (lastEntry) {
      return {
        id: crypto.randomUUID(),
        date: globalSettings.date,
        description: lastEntry.description,
        startTime: nextStartTime,
        duration: lastEntry.duration,
        minutes: lastEntry.minutes,
        ticketId: lastEntry.ticketId,
        clientId: lastEntry.clientId || globalSettings.clientId,
        billable: lastEntry.billable,
        billingRateId: lastEntry.billingRateId
      };
    }
    
    // Otherwise use defaults
    return {
      id: crypto.randomUUID(),
      date: globalSettings.date,
      description: '',
      startTime: globalSettings.startTime,
      duration: '01:00',
      minutes: 60,
      ticketId: null,
      clientId: globalSettings.clientId,
      billable: globalSettings.billable,
      billingRateId: globalSettings.billingRateId
    };
  }

  function addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  function addNewEntry(): void {
    entries = [...entries, createEmptyEntry()];
  }

  function removeEntry(id: string): void {
    entries = entries.filter(e => e.id !== id);
  }

  function updateEntryDuration(entry: BulkEntry, value: string): void {
    let minutes: number | null = null;
    
    // Try parsing as HH:MM first
    const parsedMinutes = formattedToMinutes(value);
    if (parsedMinutes !== null) {
      minutes = parsedMinutes;
      entry.duration = value;
    } 
    // Then try parsing as raw minutes
    else if (!isNaN(parseInt(value, 10))) {
      minutes = parseInt(value, 10);
      entry.duration = minutesToFormatted(minutes);
    }

    if (minutes !== null) {
      entry.minutes = minutes;
      // Force reactivity update
      entries = [...entries];
    }
  }

  function getAvailableTickets(entry: BulkEntry) {
    const clientId = entry.clientId || globalSettings.clientId;
    return clientId ? $ticketStore.filter(t => t.clientId === clientId) : [];
  }

  async function submitEntries(): Promise<void> {
    if (!hasValidEntries || isSubmitting) return;
    
    try {
      isSubmitting = true;
      errorMessage = null;
      
      // Create time entries
      const timeEntries: NewTimeEntry[] = entries.map(entry => {
        const [hours, minutes] = entry.startTime.split(':').map(Number);
        const startTime = new Date(entry.date);
        startTime.setHours(hours, minutes, 0, 0);

        return {
          description: entry.description,
          date: entry.date,
          minutes: entry.minutes,
          startTime,
          endTime: calculateEndTime(startTime, entry.minutes),
          clientId: entry.clientId || globalSettings.clientId,
          ticketId: entry.ticketId,
          billable: entry.billable,
          billingRateId: entry.billable ? (entry.billingRateId || globalSettings.billingRateId) : null,
          billed: false,
          locked: false
        };
      });
      
      // Submit all entries
      const results = await Promise.allSettled(
        timeEntries.map(entry => timeEntryStore.add(entry))
      );
      
      // Calculate success count
      successCount = results.filter(r => r.status === 'fulfilled').length;
      
      // Refresh time entries store
      await timeEntryStore.load();
      
      // Redirect back to time entries page after successful submission
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
  
  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  }
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
              disabled={!hasValidEntries || isSubmitting}
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

  <!-- Global Settings -->
  <GlassCard className="p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="form-field mb-0">
        <label class="form-label flex items-center gap-2 mb-1">
          <Icon src={CalendarDays} class="w-4 h-4 text-blue-500" />
          Default Date & Time
        </label>
        <div class="grid grid-cols-2 gap-2">
          <input
            type="date"
            class="form-input"
            value={formatDateForInput(globalSettings.date)}
            oninput={(e) => {
              globalSettings.date = new Date(e.currentTarget.value);
            }}
          />
          <input
            type="time"
            class="form-input"
            bind:value={globalSettings.startTime}
          />
        </div>
        <span class="form-hint mt-1">Starting point for all entries. Each entry can override these.</span>
      </div>

      <ClientSearch
        selectedClientId={globalSettings.clientId}
        on:change={(e) => {
          globalSettings.clientId = e.detail;
          // Update entries to use new global client if they don't have a specific client
          entries = entries.map(entry => ({
            ...entry,
            clientId: entry.clientId || e.detail
          }));
        }}
        label="Default Client"
        placeholder="Select a client"
        className="md:col-span-2"
        hint={globalSettings.clientId 
          ? "Selected client will scope available clients in entries to itself and its sub-clients. 🏢 = Business, 📁 = Container, 👤 = Individual"
          : "Select a client to apply to all entries without a specific client selected"}
      />
      
      <div class="form-field mb-0">
        <label class="form-label flex items-center gap-2">
          <Icon src={CurrencyDollar} class="w-4 h-4 text-green-500" />
          Billing Settings
        </label>
        <div class="space-y-2">
          <select
            class="form-select"
            bind:value={globalSettings.billingRateId}
          >
            <option value="">Select a billing rate</option>
            {#each availableBillingRates as rate}
              <option value={rate.id}>{rate.name} ({formatCurrency(rate.rate)}/hr)</option>
            {/each}
          </select>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              class="form-checkbox"
              bind:checked={globalSettings.billable}
            />
            <span class="form-hint">Time is billable</span>
          </div>
          <span class="form-hint">These settings will be applied to new entries. Each entry can override these settings.</span>
        </div>
      </div>
    </div>
  </GlassCard>

  <!-- Time Entries -->
  <div class="space-y-3">
    {#each entries as entry (entry.id)}
      <GlassCard className="p-4">
        <div class="space-y-4">
          <!-- Description -->
          <div>
            <textarea 
              class="form-textarea w-full" 
              rows="3"
              placeholder="Describe what you worked on. Press Tab to move to the next field."
              bind:value={entry.description}
            />
          </div>
          
          <!-- Top Entry Fields -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <!-- Date -->
            <div>
              <div class="flex gap-2 items-start">
                <div class="flex-1">
                  <input 
                    type="date"
                    class="form-input w-full"
                    value={formatDateForInput(entry.date)}
                    oninput={(e) => {
                      entry.date = new Date(e.currentTarget.value);
                      entries = [...entries];
                    }}
                  />
                  <span class="form-hint mt-1">
                    {formatDateDisplay(entry.date)}
                    {entry.date.getTime() !== globalSettings.date.getTime() ? ' (Override)' : ''}
                  </span>
                </div>
                <div class="flex flex-col gap-1">
                  <button 
                    class="btn btn-secondary btn-sm"
                    title="Previous Day"
                    onclick={() => changeEntryDate(entry, -1)}
                  >
                    −
                  </button>
                  <button 
                    class="btn btn-secondary btn-sm"
                    title="Next Day"
                    onclick={() => changeEntryDate(entry, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Start Time -->
            <div>
              <input 
                type="time"
                class="form-input w-full" 
                bind:value={entry.startTime}
                title="Start time for this entry"
              />
              <span class="form-hint mt-1">Start Time</span>
            </div>
            
            <!-- Duration -->
            <div>
              <input 
                class="form-input w-full" 
                placeholder="Minutes"
                value={entry.duration}
                title="Enter duration in minutes (e.g. 90) or HH:MM format"
                oninput={(e) => updateEntryDuration(entry, e.currentTarget.value)}
              />
              <span class="form-hint mt-1">Duration</span>
            </div>
            
            <!-- Billable Option + Remove -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  bind:checked={entry.billable}
                  id={`billable-${entry.id}`}
                />
                <label class="text-sm text-gray-400" for={`billable-${entry.id}`}>
                  Time is billable
                </label>
              </div>
              <button 
                class="text-red-400 hover:text-red-300 p-1"
                title="Remove Entry"
                onclick={() => removeEntry(entry.id)}
              >
                <Icon src={MinusCircle} class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <!-- Bottom Fields Row - Client, Billing Rate, Related Ticket -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-700/30">
            <!-- Client -->
            <ClientSearch
              selectedClientId={entry.clientId}
              on:change={(e) => {
                entry.clientId = e.detail;
                entries = [...entries]; // Force reactivity
              }}
              showSearch={false}
              showIcon={true}
              label="Client"
              placeholder="Select a client"
              restrictToClientId={globalSettings.clientId}
              hint="Client-specific rates will apply if available"
              fieldClassName="space-y-1"
            />
            
            <!-- Billing Rate -->
            <div class="form-field">
              <label class="form-label flex items-center gap-1">
                <Icon src={CurrencyDollar} class="w-3 h-3 text-green-500" />
                Billing Rate
              </label>
              <select
                class="form-select w-full"
                bind:value={entry.billingRateId}
                disabled={!entry.billable}
              >
                <option value="">Global rate</option>
                {#each availableBillingRates as rate}
                  <option value={rate.id}>{rate.name}</option>
                {/each}
              </select>
              {#if !entry.billable}
                <span class="form-hint mt-1 text-amber-400">Not billable</span>
              {/if}
            </div>
            
            <!-- Related Ticket -->
            <div class="form-field">
              <label class="form-label flex items-center gap-1">
                <Icon src={Ticket} class="w-3 h-3 text-purple-500" />
                Related Ticket
              </label>
              <select
                class="form-select w-full text-sm"
                bind:value={entry.ticketId}
                disabled={!entry.clientId && !globalSettings.clientId}
              >
                <option value="">No ticket</option>
                {#each getAvailableTickets(entry) as ticket}
                  <option value={ticket.id}>{ticket.title}</option>
                {/each}
              </select>
              <span class="form-hint mt-1">Optional</span>
            </div>
          </div>
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