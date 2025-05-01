<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
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
  import type { NewTimeEntry, BillingRate } from '$lib/types';
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
    Check
  } from '@steeze-ui/heroicons';
  import Modal from '$lib/components/Modal.svelte';
  
  const { onClose, onComplete } = $props<{
    onClose?: () => void;
    onComplete?: () => void;
  }>();

  // Wizard steps
  const STEPS = {
    CLIENT: 0,
    DATES: 1,
    ENTRIES: 2,
    REVIEW: 3
  };
  
  // Current wizard step
  let currentStep = $state(STEPS.CLIENT);
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successCount = $state(0);
  let confirmModal = $state(false);

  // Step 1: Client selection
  let selectedClientId = $state<string | null>(null);
  let selectedBillingRateId = $state<string | null>(null);
  let billable = $state(true);
  
  // Step 2: Date selection
  let dateRange = $state<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: new Date(),
    endDate: new Date()
  });
  
  // Step 3: Time entries
  type BulkEntry = {
    id: string;
    date: Date;
    description: string;
    duration: string; // HH:MM format
    minutes: number;
    ticketId: string | null;
    clientId?: string | null; // Added client ID for per-entry client selection
  };
  
  let entries = $state<BulkEntry[]>([]);
  let availableDates = $state<Date[]>([]);
  let availableDatesKey = $state(''); // Add a key to track changes to available dates
  let billingRates = $state<BillingRate[]>([]);
  
  // Computed values using $derived
  const selectedClient = $derived($clientStore.find(c => c.id === selectedClientId));
  
  const availableTickets = $derived(
    selectedClientId
      ? $ticketStore.filter(t => t.clientId === selectedClientId)
      : []
  );
    
  const availableBillingRates = $derived(billable ? billingRates : []);
  
  const clientOverrides = $derived(selectedClient?.billingRateOverrides || []);
  
  const selectedRate = $derived(billingRates.find(r => r.id === selectedBillingRateId));
  
  const clientRateOverride = $derived(
    selectedRate && clientOverrides.find(o => o.baseRateId === selectedRate.id)
  );
  
  const effectiveRate = $derived(
    selectedRate
      ? clientRateOverride
        ? clientRateOverride.overrideType === 'percentage'
          ? (selectedRate.rate * clientRateOverride.value / 100)
          : clientRateOverride.value
        : selectedRate.rate
      : 0
  );
    
  const hasValidEntries = $derived(
    entries.length > 0 && entries.every(e => 
      e.description && 
      e.minutes > 0 && 
      (!selectedClientId ? e.clientId : true) // Require client ID if no global client
    )
  );
     
  const totalMinutes = $derived(entries.reduce((sum, entry) => sum + entry.minutes, 0));
  
  const totalAmount = $derived(effectiveRate * (totalMinutes / 60));
  
  onMount(() => {
    // Load clients, billing rates and tickets
    clientStore.load();
    settingsStore.load();
    ticketStore.load();
    
    // Get billing rates from settings
    const unsubscribe = settingsStore.billingRates.subscribe(rates => {
      billingRates = rates;
      
      // Auto-select default rate
      if (rates.length > 0 && !selectedBillingRateId) {
        const defaultRate = rates.find(r => r.isDefault);
        selectedBillingRateId = defaultRate?.id || rates[0].id;
      }
    });
    
    return unsubscribe;
  });
  
  // Update available dates when date range changes
  let isUpdatingDates = $state(false);
  let isUpdatingEntries = $state(false);
  
  $effect(() => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    if (isUpdatingDates) return; // Prevent recursive updates
    
    try {
      isUpdatingDates = true;
      console.debug('Dates effect: Generating date range');
      
      const newDates = generateDateRange(dateRange.startDate, dateRange.endDate);
      availableDates = newDates;
      
      // Create a unique key from the date range to track changes
      const newKey = `${dateRange.startDate.toISOString()}-${dateRange.endDate.toISOString()}`;
      if (availableDatesKey !== newKey) {
        console.debug(`Dates effect: Key changed from ${availableDatesKey} to ${newKey}`);
        availableDatesKey = newKey;
      }
    } finally {
      isUpdatingDates = false;
    }
  });
  
  // Update entries when available dates change (using the key to prevent infinite loops)
  $effect(() => {
    if (availableDatesKey === '' || availableDates.length === 0) return;
    if (isUpdatingEntries) return; // Prevent recursive updates
    
    try {
      isUpdatingEntries = true;
      console.debug(`Entries effect: Processing ${availableDates.length} dates with key ${availableDatesKey}`);
      
      // Generate initial entries for each date
      if (entries.length === 0) {
        console.debug('Entries effect: Creating initial entries');
        entries = availableDates.map((date, index) => createEmptyEntry(date, index.toString()));
        return;
      }
      
      console.debug(`Entries effect: Updating existing entries (${entries.length})`);
      
      // For existing entries, ensure they match the date range
      const updatedEntries = [...entries];
      
      // Filter entries to only include dates in the range
      const filteredEntries = updatedEntries.filter(entry => 
        availableDates.some(date => 
          date.toDateString() === entry.date.toDateString()
        )
      );
      
      console.debug(`Entries effect: Filtered to ${filteredEntries.length} entries in date range`);
      
      // Add entries for new dates
      const newEntries = [];
      for (const date of availableDates) {
        const hasEntry = filteredEntries.some(entry => 
          entry.date.toDateString() === date.toDateString()
        );
        
        if (!hasEntry) {
          newEntries.push(createEmptyEntry(date, `new-${Date.now()}-${Math.random()}`));
        }
      }
      
      console.debug(`Entries effect: Adding ${newEntries.length} new entries`);
      
      if (filteredEntries.length === entries.length && newEntries.length === 0) {
        console.debug('Entries effect: No changes needed');
        return; // Skip update if nothing changed
      }
      
      entries = [...filteredEntries, ...newEntries];
    } finally {
      isUpdatingEntries = false;
    }
  });
  
  function createEmptyEntry(date: Date, id: string): BulkEntry {
    return {
      id,
      date: new Date(date),
      description: '',
      duration: '60', // Default to 60 minutes instead of '01:00'
      minutes: 60,
      ticketId: null,
      clientId: selectedClientId // Use global client ID if set
    };
  }
  
  function generateDateRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    
    // Reset time component
    current.setHours(0, 0, 0, 0);
    
    // Create end date with time reset
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);
    
    // Generate dates
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }
  
  function addEntryForDate(date: Date): void {
    const newId = Date.now().toString();
    entries = [...entries, createEmptyEntry(date, newId)];
  }
  
  function removeEntry(id: string): void {
    entries = entries.filter(e => e.id !== id);
  }
  
  function updateEntryDuration(entry: BulkEntry, value: string): void {
    // Store the original value as entered by the user without formatting
    entry.duration = value;
    
    // Try parse as HH:MM format first
    const parsedMinutes = formattedToMinutes(value);
    
    if (parsedMinutes !== null) {
      // Valid HH:MM format
      entry.minutes = parsedMinutes;
    } else if (!isNaN(parseInt(value, 10))) {
      // If it's a plain number, assume minutes and keep raw value
      const minutes = parseInt(value, 10);
      entry.minutes = minutes;
      // Don't format the duration, keep it as entered
      entry.duration = value;
    } else if (value.includes('.') || value.includes(',')) {
      // Handle decimal hours (e.g., 1.5 hours = 90 minutes)
      const hourValue = parseFloat(value.replace(',', '.'));
      if (!isNaN(hourValue)) {
        const minutes = Math.round(hourValue * 60);
        entry.minutes = minutes;
        // Show decimal hours as minutes
        entry.duration = minutes.toString();
      }
    }
    
    // Force reactivity update
    entries = [...entries];
  }
  
  // Get formatted time display for label
  function getTimeDisplayLabel(minutes: number): string {
    if (minutes <= 0) {
      return '';
    }
    
    if (minutes < 60) {
      return `(${minutes} minutes)`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      if (remainingMinutes === 0) {
        return `(${hours} ${hours === 1 ? 'hour' : 'hours'})`;
      } else {
        return `(${hours}h ${remainingMinutes}m)`;
      }
    }
  }
  
  function getAvailableTickets(entry: BulkEntry) {
    const clientId = entry.clientId || selectedClientId;
    return clientId ? $ticketStore.filter(t => t.clientId === clientId) : [];
  }
  
  function nextStep(): void {
    if (currentStep < STEPS.REVIEW) {
      currentStep++;
    } else {
      confirmModal = true;
    }
  }
  
  function prevStep(): void {
    if (currentStep > 0) {
      currentStep--;
    }
  }
  
  function canProceedToNext(): boolean {
    switch (currentStep) {
      case STEPS.CLIENT:
        return !!selectedClientId && (!billable || !!selectedBillingRateId);
      case STEPS.DATES:
        return !!dateRange.startDate && !!dateRange.endDate;
      case STEPS.ENTRIES:
        return hasValidEntries;
      default:
        return true;
    }
  }
  
  async function handleConfirm(): Promise<void> {
    if (!hasValidEntries || isSubmitting) return;
    
    try {
      isSubmitting = true;
      errorMessage = null;
      
      // Create time entries
      const timeEntries: NewTimeEntry[] = entries.map(entry => ({
        description: entry.description,
        date: entry.date,
        minutes: entry.minutes,
        startTime: entry.date, // Use date as start time
        endTime: calculateEndTime(entry.date, entry.minutes),
        clientId: entry.clientId || selectedClientId,
        ticketId: entry.ticketId,
        billable,
        billingRateId: billable ? selectedBillingRateId : null,
        billed: false,
        locked: false
      }));
      
      // Submit all entries
      const results = await Promise.allSettled(
        timeEntries.map(entry => timeEntryStore.add(entry))
      );
      
      // Calculate success count
      successCount = results.filter(r => r.status === 'fulfilled').length;
      
      // Refresh time entries store
      await timeEntryStore.load();
      
      // Notify completion
      onComplete();
    } catch (error) {
      console.error('Failed to submit time entries:', error);
      errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to submit time entries';
    } finally {
      isSubmitting = false;
      confirmModal = false;
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

<div class="space-y-6 py-4">
  <!-- Wizard Header -->
  <div class="border-b border-white border-opacity-10 pb-4 mb-4">
    <h2 class="text-xl font-medium">Bulk Time Entry</h2>
    
    <!-- Progress Bar -->
    <div class="w-full bg-gray-800 bg-opacity-20 h-1 rounded-full mt-4">
      <div 
        class="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-in-out"
        style="width: {Math.round((currentStep / (Object.keys(STEPS).length - 1)) * 100)}%"
      ></div>
    </div>
    
    <!-- Step Labels -->
    <div class="flex justify-between mt-2 text-xs">
      <div class={currentStep >= STEPS.CLIENT ? "text-blue-400" : "text-gray-400"}>Client & Rate</div>
      <div class={currentStep >= STEPS.DATES ? "text-blue-400" : "text-gray-400"}>Date Range</div>
      <div class={currentStep >= STEPS.ENTRIES ? "text-blue-400" : "text-gray-400"}>Time Entries</div>
      <div class={currentStep >= STEPS.REVIEW ? "text-blue-400" : "text-gray-400"}>Review & Submit</div>
    </div>
  </div>
  
  {#if errorMessage}
    <div class="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 text-red-400 p-4 rounded-lg">
      {errorMessage}
      <button class="ml-2 underline" onclick={() => errorMessage = null}>Dismiss</button>
    </div>
  {/if}
  
  {#if successCount > 0}
    <div class="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg">
      Successfully created {successCount} time {successCount === 1 ? 'entry' : 'entries'}!
    </div>
  {:else}
    <!-- Step Content -->
    <div class="space-y-4">
      {#if confirmModal}
        <Modal
          open={true}
          title="Confirm Time Entries"
          size="lg"
          onclose={() => confirmModal = false}
        >
          <div class="p-6">
            <p class="mb-4 text-gray-900">
              Are you sure you want to create {entries.length} time {entries.length === 1 ? 'entry' : 'entries'}?
            </p>
            <p class="text-sm text-gray-600">
              Total time: {minutesToFormatted(totalMinutes)}
              {#if totalAmount > 0}
                <br />
                Total billable amount: {formatCurrency(totalAmount)}
              {/if}
            </p>
          </div>

          {#snippet footer()}
            <div class="flex justify-end gap-3">
              <button class="btn btn-secondary" onclick={() => confirmModal = false}>Cancel</button>
              <button class="btn btn-primary" onclick={handleConfirm}>Create Entries</button>
            </div>
          {/snippet}
        </Modal>
      {/if}

      <div class="rounded-lg bg-amber-100 p-3 text-amber-800">
        <p class="text-sm">
          Create multiple time entries at once. Fill in the common details below, then add specific entries.
        </p>
      </div>

      <div class="min-h-[calc(100vh-16rem)] md:min-h-[500px] max-h-[calc(100vh-8rem)] md:max-h-[700px] overflow-y-auto px-1">
        {#if currentStep === STEPS.CLIENT}
          <!-- Step 1: Client Selection -->
          <div class="space-y-6 container-glass rounded-lg p-6">
            <div class="form-field">
              <label for="clientId" class="form-label flex items-center gap-2">
                <Icon src={UserCircle} class="w-5 h-5 text-blue-500" />
                Client
              </label>
              <select
                id="clientId"
                class="form-select"
                bind:value={selectedClientId}
              >
                <option value="">Select a client</option>
                {#each $clientStore as client}
                  <option value={client.id}>{client.name}</option>
                {/each}
              </select>
            </div>
            
            <div class="form-field">
              <label class="form-label flex items-center gap-2">
                <Icon src={CurrencyDollar} class="w-5 h-5 text-green-500" />
                Billable
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="billable"
                  type="checkbox"
                  class="form-checkbox"
                  bind:checked={billable}
                />
                <span class="form-hint">Time is billable</span>
              </div>
            </div>
            
            {#if billable}
              <div class="form-field">
                <label for="billingRateId" class="form-label flex items-center gap-2">
                  <Icon src={CurrencyDollar} class="w-5 h-5 text-green-500" />
                  Billing Rate
                </label>
                <select
                  id="billingRateId"
                  class="form-select"
                  bind:value={selectedBillingRateId}
                  required={billable}
                >
                  <option value="">Select a billing rate</option>
                  {#each availableBillingRates as rate}
                    <option value={rate.id}>{rate.name} ({formatCurrency(rate.rate)}/hr)</option>
                  {/each}
                </select>
                
                {#if selectedClient && selectedBillingRateId && clientRateOverride}
                  <span class="form-hint text-blue-400">
                    This client has a custom rate override: 
                    {clientRateOverride.overrideType === 'percentage' 
                      ? `${clientRateOverride.value}% of standard rate` 
                      : `${formatCurrency(clientRateOverride.value)} per hour`}
                  </span>
                {/if}
                
                {#if selectedRate && effectiveRate !== selectedRate.rate}
                  <div class="mt-2 p-3 bg-blue-500 bg-opacity-10 text-blue-400 rounded-lg border border-blue-500 border-opacity-20">
                    <p class="font-medium">Custom Rate Applied</p>
                    <p class="text-sm">
                      Standard rate: {formatCurrency(selectedRate.rate)}/hr →
                      Client rate: {formatCurrency(effectiveRate)}/hr
                    </p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else if currentStep === STEPS.DATES}
          <!-- Step 2: Date Range -->
          <div class="space-y-6 container-glass rounded-lg p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-field">
                <label for="startDate" class="form-label flex items-center gap-2">
                  <Icon src={CalendarDays} class="w-5 h-5 text-blue-500" />
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="date"
                  class="form-input"
                  bind:value={dateRange.startDate}
                  max={dateRange.endDate ? dateRange.endDate.toISOString().split('T')[0] : undefined}
                />
              </div>
              
              <div class="form-field">
                <label for="endDate" class="form-label flex items-center gap-2">
                  <Icon src={CalendarDays} class="w-5 h-5 text-blue-500" />
                  End Date
                </label>
                <input
                  id="endDate"
                  type="date"
                  class="form-input"
                  bind:value={dateRange.endDate}
                  min={dateRange.startDate ? dateRange.startDate.toISOString().split('T')[0] : undefined}
                />
              </div>
            </div>
            
            {#if availableDates.length > 0}
              <div class="p-4 bg-blue-500 bg-opacity-10 rounded-lg border border-blue-500 border-opacity-20">
                <h3 class="text-sm font-medium text-blue-400 mb-2">Date Range Preview</h3>
                <div class="flex flex-wrap gap-2">
                  {#each availableDates as date}
                    <div class="bg-blue-500 bg-opacity-20 text-blue-300 px-3 py-1 rounded-full text-xs">
                      {formatDate(date)}
                    </div>
                  {/each}
                </div>
                <p class="text-sm text-blue-400 mt-2">
                  {availableDates.length} {availableDates.length === 1 ? 'day' : 'days'} selected
                </p>
              </div>
            {/if}
          </div>
        {:else if currentStep === STEPS.ENTRIES}
          <!-- Step 3: Time Entries -->
          <div class="space-y-4 container-glass rounded-lg p-6">
            {#each entries as entry, i (entry.id)}
              <div class="p-4 bg-gray-800 bg-opacity-20 rounded-lg border border-gray-700 border-opacity-30">
                <div class="flex justify-between items-start mb-3">
                  <h3 class="font-medium flex items-center gap-2">
                    <Icon src={CalendarDays} class="w-4 h-4" />
                    {formatDate(entry.date)}
                  </h3>
                  
                  {#if entries.filter(e => e.date.toDateString() === entry.date.toDateString()).length > 1}
                    <button 
                      class="text-red-400 hover:text-red-300"
                      title="Remove Entry"
                      onclick={() => removeEntry(entry.id)}
                    >
                      <Icon src={MinusCircle} class="w-5 h-5" />
                    </button>
                  {/if}
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="col-span-1 md:col-span-2">
                    <label for={`description-${entry.id}`} class="text-sm text-gray-400">Description</label>
                    <input 
                      id={`description-${entry.id}`}
                      class="form-input w-full" 
                      placeholder="What did you work on?"
                      bind:value={entry.description}
                    />
                  </div>
                  
                  <div>
                    <label for={`duration-${entry.id}`} class="text-sm text-gray-400 flex items-center gap-2">
                      <Icon src={Clock} class="w-4 h-4 text-blue-500" />
                      Duration {getTimeDisplayLabel(entry.minutes)}
                    </label>
                    <input 
                      id={`duration-${entry.id}`}
                      class="form-input w-full" 
                      placeholder="HH:MM or minutes"
                      value={entry.duration}
                      oninput={(e) => updateEntryDuration(entry, e.currentTarget.value)}
                    />
                    <span class="text-xs text-gray-500">Enter as minutes or HH:MM</span>
                  </div>
                  
                  <div>
                    <label for={`client-${entry.id}`} class="text-sm text-gray-400">Client</label>
                    <select
                      id={`client-${entry.id}`}
                      class="form-select w-full"
                      bind:value={entry.clientId}
                    >
                      <option value="">Select a client</option>
                      {#each $clientStore as client}
                        <option value={client.id}>{client.name}</option>
                      {/each}
                    </select>
                  </div>
                  
                  {#if getAvailableTickets(entry).length > 0}
                    <div class="col-span-full">
                      <label for={`ticket-${entry.id}`} class="text-sm text-gray-400">Ticket (Optional)</label>
                      <select
                        id={`ticket-${entry.id}`}
                        class="form-select w-full"
                        bind:value={entry.ticketId}
                      >
                        <option value="">No ticket</option>
                        {#each getAvailableTickets(entry) as ticket}
                          <option value={ticket.id}>{ticket.title}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
            
            {#if entries.length > 0}
              <div class="flex items-center justify-between pt-3">
                <div class="text-sm text-gray-400">
                  <span class="font-medium text-white">{entries.length}</span> entries, 
                  <span class="font-medium text-white">{minutesToFormatted(totalMinutes)}</span> total
                  {#if billable && effectiveRate > 0}
                    <span class="ml-1">
                      (<span class="font-medium text-green-400">{formatCurrency(totalAmount)}</span>)
                    </span>
                  {/if}
                </div>
                
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => addEntryForDate(entries[0].date)}
                >
                  <Icon src={Plus} class="w-4 h-4 mr-1" />
                  Add Another Entry
                </button>
              </div>
            {/if}
          </div>
        {:else if currentStep === STEPS.REVIEW}
          <!-- Step 4: Review & Submit -->
          <div class="space-y-6 container-glass rounded-lg p-6">
            <div class="p-4 bg-blue-500 bg-opacity-10 rounded-lg border border-blue-500 border-opacity-20">
              <h3 class="font-medium text-blue-400 mb-2">Summary</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-400">Client</p>
                  <p class="font-medium">{selectedClient?.name || 'None'}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Date Range</p>
                  <p class="font-medium">
                    {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                  </p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Entries</p>
                  <p class="font-medium">{entries.length} entries</p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Total Time</p>
                  <p class="font-medium">{minutesToFormatted(totalMinutes)}</p>
                </div>
                {#if billable}
                  <div class="col-span-2">
                    <p class="text-sm text-gray-400">Billing</p>
                    <p class="font-medium">
                      {billable ? 'Billable' : 'Non-billable'}
                      {#if billable && selectedRate}
                        at {formatCurrency(effectiveRate)}/hr 
                        ({formatCurrency(totalAmount)} total)
                      {/if}
                    </p>
                  </div>
                {/if}
              </div>
            </div>
            
            <div class="space-y-3 max-h-[300px] overflow-y-auto">
              <h3 class="font-medium border-b border-gray-700 border-opacity-30 pb-2">Time Entries</h3>
              {#each entries as entry}
                <div class="p-3 bg-gray-800 bg-opacity-20 rounded-lg border border-gray-700 border-opacity-30 flex justify-between">
                  <div>
                    <p class="font-medium">{entry.description || 'No description'}</p>
                    <p class="text-sm text-gray-400">
                      {formatDate(entry.date)} · {minutesToFormatted(entry.minutes)}
                      {#if entry.ticketId}
                        · <span class="text-blue-400">Ticket assigned</span>
                      {/if}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">
                      {#if billable && effectiveRate > 0}
                        {formatCurrency(effectiveRate * (entry.minutes / 60))}
                      {:else}
                        {minutesToFormatted(entry.minutes)}
                      {/if}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Wizard Footer -->
    <div class="flex justify-between pt-4 mt-6 border-t border-gray-800 border-opacity-30">
      {#if currentStep > 0}
        <button
          class="btn btn-secondary"
          onclick={prevStep}
          disabled={isSubmitting}
        >
          Back
        </button>
      {:else}
        <div></div>
      {/if}
      
      <button
        class="btn btn-primary"
        onclick={nextStep}
        disabled={!canProceedToNext() || isSubmitting}
        class:opacity-50={!canProceedToNext() || isSubmitting}
        class:cursor-not-allowed={!canProceedToNext() || isSubmitting}
      >
        {#if currentStep === STEPS.REVIEW}
          {#if isSubmitting}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Submitting...
          {:else}
            <Icon src={Check} class="w-4 h-4 mr-1" />
            Submit All Entries
          {/if}
        {:else}
          Next
          <Icon src={ArrowRight} class="w-4 h-4 ml-1" />
        {/if}
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  /* No custom styles needed - using styles from tailwind-theme.css */

  /* Fix for dropdown menus to appear above other content */
  :global(.form-select) {
    position: relative;
    z-index: 20;
  }

  /* Ensure each time entry card has proper stacking context */
  :global([id^="client-"]) {
    position: relative;
    z-index: 30; /* Higher z-index for client dropdowns */
  }

  /* Style for the expanded dropdown */
  :global(.form-select:focus) {
    z-index: 40; /* Even higher z-index when focused */
  }
</style>