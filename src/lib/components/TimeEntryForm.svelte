<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import { formatCurrency, calculateTimeEntryAmount } from '$lib/utils/invoiceUtils';
  import { minutesToFormatted, formattedToMinutes, calculateDurationInMinutes, calculateEndTime } from '$lib/utils/timeUtils';
  import type { TimeEntry, NewTimeEntry, BillingRate } from '$lib/types';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { LockClosed } from '@steeze-ui/heroicons';
  
  const props = $props<{
    editEntry?: TimeEntry | null;
    onSave?: ((entry: TimeEntry) => void) | null;
    onCancel?: (() => void) | null;
  }>();

  // Check if the entry is locked (associated with invoice)
  const isLocked = $derived(props.editEntry?.locked || props.editEntry?.billed || false);

  // Initialize form state with current date and time
  const now = new Date();
  const initialState: NewTimeEntry = {
    description: '',
    startTime: now,
    endTime: null,
    minutes: 0,
    date: now,
    clientId: '',
    ticketId: null,
    billable: true,
    billingRateId: null,
    billed: false,
    locked: false,
    billedRate: undefined
  };

  let form = writable<NewTimeEntry>(initialState);
  let durationInput = $state('');
  let endTimeInput = $state('');
  let errors = $state<{[key: string]: string}>({});
  
  // Format input values
  const dateValue = $derived($form.date ? formatDateForInput($form.date) : '');
  const startTimeValue = $derived($form.startTime ? formatTimeForInput($form.startTime) : '');
  const selectedClient = $derived($clientStore.find(c => c.id === $form.clientId));
  
  // Track available tickets based on selected client
  let availableTickets = $derived($form.clientId ? 
    $ticketStore.filter(t => t.clientId === $form.clientId) :
    []
  );

  // Subscribe to billing rates from settings store
  let billingRates: BillingRate[] = $state([]);
  const availableBillingRates = $derived($form.billable ? billingRates : []);
  
  // Auto-select default billing rate when needed
  $effect(() => {
    // Only proceed if entry is billable and no rate is selected
    if ($form.billable && !$form.billingRateId && availableBillingRates.length > 0) {
      // First try to find the default rate
      const defaultRate = availableBillingRates.find(rate => rate.isDefault);
      
      // If client has overrides, try to find an override for the default rate first
      if (selectedClient?.billingRateOverrides?.length) {
        if (defaultRate && selectedClient.billingRateOverrides.some(o => o.baseRateId === defaultRate.id)) {
          form.update(f => ({ ...f, billingRateId: defaultRate.id }));
          return;
        }
        
        // If no override for default rate, try any rate with an override
        const rateWithOverride = availableBillingRates.find(rate => 
          selectedClient.billingRateOverrides.some(o => o.baseRateId === rate.id)
        );
        if (rateWithOverride) {
          form.update(f => ({ ...f, billingRateId: rateWithOverride.id }));
          return;
        }
      }
      
      // If we found a default rate earlier, use it
      if (defaultRate) {
        form.update(f => ({ ...f, billingRateId: defaultRate.id }));
        return;
      }
      
      // Last resort: select the first available rate
      form.update(f => ({ ...f, billingRateId: availableBillingRates[0].id }));
    }
  });

  onMount(() => {
    const unsubscribe = settingsStore.billingRates.subscribe(rates => {
      billingRates = rates;
    });

    settingsStore.load();
    return unsubscribe;
  });

  function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatTimeForInput(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }
  
  // Load entry data if editing
  $effect(() => {
    if (props.editEntry) {
      form.set({
        description: props.editEntry.description,
        startTime: new Date(props.editEntry.startTime),
        endTime: props.editEntry.endTime ? new Date(props.editEntry.endTime) : null,
        minutes: props.editEntry.minutes,
        date: new Date(props.editEntry.date),
        clientId: props.editEntry.clientId || '',
        ticketId: props.editEntry.ticketId,
        billable: props.editEntry.billable,
        billingRateId: props.editEntry.billingRateId,
        billed: props.editEntry.billed || false,
        locked: props.editEntry.locked || false,
        billedRate: props.editEntry.billedRate
      });
      durationInput = minutesToFormatted(props.editEntry.minutes);
    }
  });

  // Update calculations when duration changes
  function updateFromDuration(value: string) {
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    let minutes: number;
    
    if (timeMatch) {
      // Input is in HH:MM format
      const parsedMinutes = formattedToMinutes(value);
      if (parsedMinutes === null) return;
      minutes = parsedMinutes;
    } else {
      // Input is in minutes
      minutes = parseInt(value, 10);
      if (isNaN(minutes)) return;
    }
    
    if ($form.startTime && minutes > 0) {
      const endTime = calculateEndTime($form.startTime, minutes);
      // Ensure minutes is set in the form data
      form.update(f => ({ 
        ...f, 
        minutes, 
        endTime,
        // Default to now if no date is set
        date: f.date || new Date()
      }));
      endTimeInput = formatTimeForInput(endTime);
    }
  }

  // Update calculations when end time changes
  function updateFromEndTime(endTimeStr: string) {
    if (!$form.startTime) return;
    
    const [hours, minutes] = endTimeStr.split(':').map(Number);
    const endTime = new Date($form.startTime);
    endTime.setHours(hours, minutes);
    
    if (endTime <= $form.startTime) {
      // If end time is before start time, assume it's the next day
      endTime.setDate(endTime.getDate() + 1);
    }
    
    const durationMinutes = calculateDurationInMinutes($form.startTime, endTime);
    // Ensure minutes is set in the form data
    form.update(f => ({ 
      ...f, 
      minutes: durationMinutes, 
      endTime,
      // Default to now if no date is set
      date: f.date || new Date()
    }));
    durationInput = minutesToFormatted(durationMinutes);
  }

  // Handle start time changes
  function handleStartTimeChange(timeStr: string) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const startTime = new Date($form.date || new Date());
    startTime.setHours(hours, minutes);
    form.update(f => ({ ...f, startTime }));
    
    // Recalculate duration if we have an end time
    if ($form.endTime) {
      const durationMinutes = calculateDurationInMinutes(startTime, $form.endTime);
      // Ensure minutes is set in the form data
      form.update(f => ({ 
        ...f, 
        minutes: durationMinutes,
        // Default to now if no date is set
        date: f.date || new Date()
      }));
      durationInput = minutesToFormatted(durationMinutes);
    }
  }

  // Handle date changes
  function handleDateChange(dateStr: string) {
    const date = new Date(dateStr);
    // Copy time from existing startTime to new date
    if ($form.startTime) {
      date.setHours($form.startTime.getHours(), $form.startTime.getMinutes());
    }
    form.update(f => ({ ...f, date }));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!$form.description) {
      alert('Please enter a description');
      return;
    }

    if (!$form.minutes && !$form.duration) {
      alert('Please enter a valid duration');
      return;
    }

    if ($form.billable && !$form.billingRateId) {
      alert('Please select a billing rate');
      return;
    }

    try {
      // Create a clean copy of the form data with proper types
      const formData = {
        description: $form.description,
        startTime: new Date($form.startTime),
        endTime: $form.endTime ? new Date($form.endTime) : null,
        // According to style guide, we should use duration in hours
        duration: $form.minutes ? $form.minutes / 60 : $form.duration,
        date: new Date($form.date || new Date()),
        clientId: $form.clientId || null,
        ticketId: $form.ticketId || null,
        billable: $form.billable,
        billingRateId: $form.billingRateId || null,
        billed: $form.billed || false,
        locked: $form.locked || false
      };
      
      const result = props.editEntry 
        ? await timeEntryStore.update(props.editEntry.id, formData)
        : await timeEntryStore.add(formData);
      
      form.set(initialState);
      durationInput = '';
      endTimeInput = '';
      
      if (props.onSave) {
        props.onSave(result);
      }
    } catch (err) {
      console.error('Failed to save time entry:', err);
      alert('Failed to save time entry. Please try again.');
    }
  }
  
  async function handleSubmitAndCreateNew(e: Event) {
    e.preventDefault();
    
    if (!$form.description) {
      alert('Please enter a description');
      return;
    }

    if (!$form.minutes || $form.minutes <= 0) {
      alert('Please enter a valid duration');
      return;
    }

    if ($form.billable && !$form.billingRateId) {
      alert('Please select a billing rate');
      return;
    }
    
    try {
      // Create a clean copy of the form data with proper types
      const formData: NewTimeEntry = {
        description: $form.description,
        startTime: new Date($form.startTime),
        endTime: $form.endTime ? new Date($form.endTime) : null,
        minutes: $form.minutes,
        date: new Date($form.date || new Date()),
        clientId: $form.clientId || null,
        ticketId: $form.ticketId || null,
        billable: $form.billable,
        billingRateId: $form.billingRateId || null,
        billed: false,
        locked: false,
        billedRate: undefined
      };
      
      const result = await timeEntryStore.add(formData);
      
      // Save the current values we want to keep
      const clientId = $form.clientId || '';
      const billable = $form.billable;
      const billingRateId = $form.billingRateId;
      
      // Reset form but keep some fields
      form.set({
        ...initialState,
        clientId,
        billable,
        billingRateId,
        startTime: new Date(),
        endTime: null,
        date: new Date()
      });

      durationInput = '';
      endTimeInput = '';
      
      if (props.onSave) {
        props.onSave(result);
      }
    } catch (err) {
      console.error('Failed to save time entry:', err);
      alert('Failed to save time entry. Please try again.');
    }
  }
  
  function handleCancel() {
    form.set(initialState);
    if (props.onCancel) {
      props.onCancel();
    }
  }
</script>

<div class="form-group">
  {#if isLocked}
    <div class="border border-yellow-600/30 bg-yellow-600/10 rounded-lg mb-4 p-4 flex items-center gap-3">
      <Icon src={LockClosed} class="text-yellow-500 w-5 h-5" />
      <div>
        <p class="text-yellow-500 font-medium">This time entry is locked</p>
        <p class="text-sm text-yellow-500/80">
          This time entry has been included in an invoice and cannot be edited.
          {#if props.editEntry?.invoiceId}
          <a href="/invoices/{props.editEntry.invoiceId}" class="text-yellow-400 underline">View invoice</a>
          {/if}
        </p>
      </div>
    </div>
  {/if}
  
  <form onsubmit={handleSubmit}>
    <!-- Description field - full width -->
    <div class="form-field mb-4">
      <label for="description" class="form-label">Description</label>
      <textarea 
        id="description"
        class="form-textarea w-full"
        bind:value={$form.description}
        rows="3"
        placeholder="Describe the work performed..."
        required
        disabled={isLocked}
      ></textarea>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="form-field">
        <label for="startTime" class="form-label">Start Time</label>
        <input
          id="startTime"
          type="time"
          class="form-control"
          value={startTimeValue}
          oninput={(e) => handleStartTimeChange(e.currentTarget.value)}
          required
          disabled={isLocked}
        />
      </div>

      <div class="form-field">
        <label for="durationInput" class="form-label">Duration or End Time</label>
        <div class="flex gap-2">
          <input
            id="durationInput"
            type="text"
            class="form-control flex-1"
            placeholder="Duration (HH:MM or minutes)"
            value={durationInput}
            oninput={(e) => updateFromDuration(e.currentTarget.value)}
            disabled={isLocked}
          />
          <input
            id="endTimeInput"
            type="time"
            class="form-control flex-1"
            value={endTimeInput}
            oninput={(e) => updateFromEndTime(e.currentTarget.value)}
            aria-label="End Time"
            disabled={isLocked}
          />
        </div>
        <span class="text-xs text-gray-500">Enter duration in HH:MM format or minutes, or specify end time</span>
      </div>

      <div class="form-field">
        <label for="date" class="form-label">Date</label>
        <input
          id="date"
          type="date"
          class="form-input"
          value={dateValue}
          oninput={(e) => handleDateChange(e.currentTarget.value)}
          required
          disabled={isLocked}
        />
      </div>

      <div class="form-field">
        <label for="clientId" class="form-label">Client</label>
        <select
          id="clientId"
          class="form-select"
          bind:value={$form.clientId}
          disabled={isLocked}
        >
          <option value="">Select a client</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="billable" class="form-label">Billable</label>
        <div class="flex items-center gap-2">
          <input
            id="billable"
            type="checkbox"
            class="form-checkbox"
            bind:checked={$form.billable}
            disabled={isLocked}
          />
          <span class="form-hint">Time is billable</span>
        </div>
      </div>

      {#if $form.billable}
        <div class="form-field">
          <label for="billingRateId" class="form-label">Billing Rate</label>
          <select
            id="billingRateId"
            class="form-select"
            bind:value={$form.billingRateId}
            required={$form.billable}
            disabled={isLocked}
          >
            <option value="">Select a billing rate</option>
            {#each availableBillingRates as rate}
              <option value={rate.id}>{rate.name} ({formatCurrency(rate.rate)}/hr)</option>
            {/each}
          </select>
          {#if selectedClient && $form.billingRateId}
            {#if selectedClient.billingRateOverrides?.some(o => o.baseRateId === $form.billingRateId)}
              <span class="form-hint text-blue-600">
                This client has a custom rate override for this billing rate
              </span>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    {#if $form.clientId && $form.billingRateId && $form.minutes !== undefined && $form.minutes > 0}
      {@const client = $clientStore.find(c => c.id === $form.clientId)}
      {@const billingRate = availableBillingRates.find((r: BillingRate) => r.id === $form.billingRateId)}
      {#if client && billingRate}
        {@const result = calculateTimeEntryAmount({
          ...$form,
          id: props.editEntry?.id || '',
          billed: false,
          invoiceId: null,
          minutes: $form.minutes || 0, // Ensure minutes is always a number
          client,
          billingRate,
          createdAt: new Date(),
          updatedAt: new Date()
        })}
        <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
          <div>
            <div class="text-sm text-gray-400">Amount</div>
            <div class="font-medium">{formatCurrency(result.amount)}</div>
          </div>
          <div>
            <div class="text-sm text-gray-400">Cost</div>
            <div class="font-medium">{formatCurrency(result.cost)}</div>
          </div>
          <div>
            <div class="text-sm text-gray-400">Profit</div>
            <div class="font-medium">{formatCurrency(result.profit)}</div>
          </div>
        </div>
      {/if}
    {/if}
    
    <div class="flex justify-end space-x-3 mt-6">
      {#if props.editEntry}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleCancel}
        >
          Cancel
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleSubmitAndCreateNew}
          disabled={isLocked}
        >
          Add and Create New
        </button>
      {/if}
      
      <button
        type="submit"
        class="form-submit"
        disabled={isLocked}
      >
        {props.editEntry ? 'Save Changes' : 'Add Time Entry'}
      </button>
    </div>
  </form>
</div>