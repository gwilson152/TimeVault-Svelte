<script lang="ts">
  import { writable } from 'svelte/store';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { hoursToFormatted, formattedToHours, hoursToMinutes, minutesToHours } from '$lib/utils/timeUtils';
  import type { TimeEntry, NewTimeEntry } from '$lib/types';

  const props = $props<{
    editEntry: TimeEntry | null;
    onSave: ((entry: TimeEntry) => void) | null;
    onCancel: (() => void) | null;
  }>();

  // Initialize form state
  const initialState: NewTimeEntry = {
    description: '',
    hours: 0,
    minutes: 0,
    timeFormatted: '00:00',
    date: new Date(),
    clientId: '',
    ticketId: null,
    billable: true,
    billingRateId: null
  };

  let form = writable<NewTimeEntry>(initialState);
  let timeFormat = writable<'minutes' | 'hours' | 'formatted'>('minutes');
  let minutes = writable<number>(0);
  let timeFormatted = writable<string>('00:00');
  
  // Load preferred time format from settings
  $effect(() => {
    const formatSetting = $settingsStore.find(s => s.key === 'time_entry_format');
    if (formatSetting) {
      if (formatSetting.value === 'minutes') {
        timeFormat.set('minutes');
      } else if (formatSetting.value === 'formatted') {
        timeFormat.set('formatted');
      } else {
        timeFormat.set('hours');
      }
    }
  });
  
  $effect(() => {
    if (props.editEntry) {
      const hoursValue = props.editEntry.hours;
      form.set({
        description: props.editEntry.description,
        hours: hoursValue,
        minutes: hoursToMinutes(hoursValue),
        timeFormatted: hoursToFormatted(hoursValue),
        date: props.editEntry.date,
        clientId: props.editEntry.clientId || '',
        ticketId: props.editEntry.ticketId,
        billable: props.editEntry.billable,
        billingRateId: props.editEntry.billingRateId
      });
      minutes.set(hoursToMinutes(hoursValue));
      timeFormatted.set(hoursToFormatted(hoursValue));
    } else {
      form.set(initialState);
      minutes.set(0);
      timeFormatted.set('00:00');
    }
  });

  // Synchronize time values when hours change
  $effect(() => {
    if ($form.hours !== undefined) {
      const minutesValue = hoursToMinutes($form.hours);
      const formattedValue = hoursToFormatted($form.hours);
      
      if ($minutes !== minutesValue) {
        minutes.set(minutesValue);
      }
      
      if ($timeFormatted !== formattedValue) {
        timeFormatted.set(formattedValue);
      }
    }
  });
  
  // Update hours when minutes change
  function updateFromMinutes(min: number) {
    const hoursValue = minutesToHours(min);
    form.update(f => ({ ...f, hours: hoursValue, minutes: min }));
    timeFormatted.set(hoursToFormatted(hoursValue));
  }
  
  // Update hours when formatted time changes
  function updateFromFormatted(formatted: string) {
    const hoursValue = formattedToHours(formatted);
    if (hoursValue !== null) {
      form.update(f => ({ ...f, hours: hoursValue, timeFormatted: formatted }));
      minutes.set(hoursToMinutes(hoursValue));
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    
    if (!$form.description) {
      alert('Please enter a description');
      return;
    }

    if (!$form.clientId) {
      alert('Please select a client');
      return;
    }

    if ($form.hours <= 0) {
      alert('Time must be greater than 0');
      return;
    }

    if ($form.billable && !$form.billingRateId) {
      alert('Please select a billing rate');
      return;
    }
    
    try {
      const result = props.editEntry 
        ? await timeEntryStore.update(props.editEntry.id, $form)
        : await timeEntryStore.add($form);
      
      form.set(initialState);
      minutes.set(0);
      timeFormatted.set('00:00');
      
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
    minutes.set(0);
    timeFormatted.set('00:00');
    if (props.onCancel) {
      props.onCancel();
    }
  }

  const selectedClient = $derived($clientStore.find(c => c.id === $form.clientId));
  const billingRatesStore = settingsStore.billingRates;
  const availableBillingRates = $derived($form.billable ? $billingRatesStore : []);
</script>

<div class="form-section">
  <form onsubmit={handleSubmit} class="form-container">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="form-group">
        <label for="description" class="form-label">Description</label>
        <input
          id="description"
          type="text"
          class="form-control"
          bind:value={$form.description}
          required
        />
      </div>

      <div class="form-group">
        <label for="timeInput" class="form-label">Time</label>
        <div class="flex flex-col gap-2">
          <!-- Time format selection -->
          <div class="flex gap-4 text-sm mb-2">
            <label class="flex items-center cursor-pointer">
              <input 
                type="radio" 
                name="timeFormat" 
                value="minutes" 
                bind:group={$timeFormat} 
                class="mr-1"
              />
              <span>Minutes</span>
            </label>
            
            <label class="flex items-center cursor-pointer">
              <input 
                type="radio" 
                name="timeFormat" 
                value="formatted" 
                bind:group={$timeFormat} 
                class="mr-1"
              />
              <span>HH:MM</span>
            </label>
            
            <label class="flex items-center cursor-pointer">
              <input 
                type="radio" 
                name="timeFormat" 
                value="hours" 
                bind:group={$timeFormat} 
                class="mr-1"
              />
              <span>Decimal Hours</span>
            </label>
          </div>
          
          <!-- Time input based on selected format -->
          {#if $timeFormat === 'minutes'}
            <input
              id="timeInput"
              type="number"
              min="0"
              step="1"
              class="form-control"
              bind:value={$minutes}
              on:input={(e) => updateFromMinutes(Number(e.currentTarget.value))}
              required
            />
            <span class="text-xs text-gray-500">Time in minutes (e.g., 90 = 1 hour and 30 minutes)</span>
          {:else if $timeFormat === 'formatted'}
            <input
              id="timeInput"
              type="text"
              pattern="[0-9]+:[0-5][0-9]"
              placeholder="HH:MM"
              class="form-control"
              bind:value={$timeFormatted}
              on:input={(e) => updateFromFormatted(e.currentTarget.value)}
              required
            />
            <span class="text-xs text-gray-500">Time in HH:MM format (e.g., 1:30 = 1 hour and 30 minutes)</span>
          {:else}
            <input
              id="timeInput"
              type="number"
              step="0.01"
              min="0"
              class="form-control"
              bind:value={$form.hours}
              required
            />
            <span class="text-xs text-gray-500">Time in decimal hours (e.g., 1.5 = 1 hour and 30 minutes)</span>
          {/if}
        </div>
      </div>

      <div class="form-group">
        <label for="date" class="form-label">Date</label>
        <input
          id="date"
          type="date"
          class="form-control"
          bind:value={$form.date}
          required
        />
      </div>

      <div class="form-group">
        <label for="clientId" class="form-label">Client</label>
        <select
          id="clientId"
          class="form-control"
          bind:value={$form.clientId}
          required
        >
          <option value="">Select a client</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="billable" class="form-label">Billable</label>
        <div class="flex items-center gap-2">
          <input
            id="billable"
            type="checkbox"
            class="form-checkbox"
            bind:checked={$form.billable}
          />
          <span class="text-sm text-gray-600">Time is billable</span>
        </div>
      </div>

      {#if $form.billable}
        <div class="form-group">
          <label for="billingRateId" class="form-label">Billing Rate</label>
          <select
            id="billingRateId"
            class="form-control"
            bind:value={$form.billingRateId}
            required={$form.billable}
          >
            <option value="">Select a billing rate</option>
            {#each availableBillingRates as rate}
              <option value={rate.id}>{rate.name} ({formatCurrency(rate.rate)}/hr)</option>
            {/each}
          </select>
          {#if selectedClient && $form.billingRateId}
            {#if selectedClient.billingRateOverrides.some(o => o.baseRateId === $form.billingRateId)}
              <div class="text-xs text-blue-600 mt-1">
                This client has a custom rate override for this billing rate
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="flex justify-end space-x-3 mt-6">
      {#if props.editEntry}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleCancel}
        >
          Cancel
        </button>
      {/if}
      
      <button
        type="submit"
        class="btn btn-primary"
      >
        {props.editEntry ? 'Save Changes' : 'Add Time Entry'}
      </button>
    </div>
  </form>
</div>