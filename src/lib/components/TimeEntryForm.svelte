<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { ticketsWithClientInfo } from '$lib/stores/ticketStore';
  import type { TimeEntry } from '$lib/types';
  import { onMount } from 'svelte';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { z } from 'zod';
  import type { timeEntrySchema } from '$lib/types';

  type TimeEntryForm = z.infer<typeof timeEntrySchema>;

  const props = $props<{
    form: SuperForm<TimeEntryForm>;
    editEntry?: TimeEntry | null;
    onSave?: () => void;
    onCancel?: () => void;
  }>();

  const { form: formData, errors, enhance } = props.form;

  // Reference to the description input field
  let descriptionField: HTMLInputElement;
  
  // Time formatting options - update to use $state
  let timeFormat = $state<'decimal' | 'hhmm'>('decimal');
  
  // Function to convert HH:MM to decimal hours
  function convertTimeToDecimal(timeString: string): number {
    if (!timeString) return 0;
    
    // Check if it's just minutes
    if (/^\d+$/.test(timeString)) {
      return Math.round((parseInt(timeString) / 60) * 100) / 100;
    }
    
    // Check if it's HH:MM format
    const match = timeString.match(/^(\d+):(\d+)$/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      return Math.round((hours + minutes / 60) * 100) / 100;
    }
    
    // If it's already decimal, just parse it
    return parseFloat(timeString) || 0;
  }
  
  // Format decimal hours to HH:MM
  function formatDecimalToHHMM(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Format hours from decimal to display format based on user preference
  function formatHoursForDisplay(hours: number): string {
    if (timeFormat === 'hhmm') {
      return formatDecimalToHHMM(hours);
    }
    return hours.toString();
  }
  
  // Update to use $state
  let displayHours = $state(props.editEntry ? formatHoursForDisplay(props.editEntry.hours) : '');

  function updateField<K extends keyof TimeEntryForm>(field: K, value: TimeEntryForm[K]) {
    $formData = { ...$formData, [field]: value };
  }

  $effect(() => {
    if (props.editEntry) {
      updateField('description', props.editEntry.description);
      updateField('hours', props.editEntry.hours);
      updateField('date', props.editEntry.date);
      updateField('clientId', props.editEntry.clientId || '');
      updateField('ticketId', props.editEntry.ticketId || '');
      updateField('billable', props.editEntry.billable);
      displayHours = formatHoursForDisplay(props.editEntry.hours);
    }
  });

  function updateHours(value: string) {
    displayHours = value;
    updateField('hours', convertTimeToDecimal(value));
  }

  function handleTimeFormatChange(format: 'decimal' | 'hhmm') {
    timeFormat = format;
    if (displayHours) {
      const decimal = convertTimeToDecimal(displayHours);
      if (format === 'hhmm') {
        displayHours = formatDecimalToHHMM(decimal);
      } else {
        displayHours = decimal.toString();
      }
      updateField('hours', decimal);
    }
  }

  // Focus description field on component mount
  onMount(() => {
    if (descriptionField) {
      descriptionField.focus();
    }
  });

  const filteredTickets = $derived(
    $ticketsWithClientInfo.filter(
      ticket => !$formData.clientId || ticket.clientId === $formData.clientId
    )
  );

  function handleFormSubmit(e: SubmitEvent) {
    if (!(e.target instanceof HTMLFormElement)) return;
    enhance(e.target);
    if (props.onSave) {
      props.onSave();
    }
  }
</script>

<div class="bg-white p-6 rounded-lg shadow-md">
  <h3 class="text-lg font-medium mb-4">{props.editEntry ? 'Edit' : 'New'} Time Entry</h3>
  
  <form method="POST" onsubmit={handleFormSubmit} class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          required
          bind:this={descriptionField}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={$formData.description}
          class:error={$errors?.description}
        />
        {#if $errors?.description}
          <span class="text-red-500 text-sm">{$errors.description}</span>
        {/if}
      </div>

      <div>
        <div class="flex justify-between items-center">
          <label for="hours" class="block text-sm font-medium text-gray-700">Hours</label>
          <div class="flex space-x-2 text-sm">
            <label class="inline-flex items-center">
              <input 
                type="radio" 
                value="decimal" 
                bind:group={timeFormat} 
                onchange={() => handleTimeFormatChange('decimal')}
                class="form-radio" 
              />
              <span class="ml-1">Decimal</span>
            </label>
            <label class="inline-flex items-center">
              <input 
                type="radio" 
                value="hhmm" 
                bind:group={timeFormat} 
                onchange={() => handleTimeFormatChange('hhmm')}
                class="form-radio" 
              />
              <span class="ml-1">HH:MM</span>
            </label>
          </div>
        </div>
        <input
          id="hours"
          name="hours"
          type="text"
          required
          placeholder={timeFormat === 'decimal' ? "1.5 or 1.75" : "1:30 or 90"}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={displayHours}
          oninput={(e) => updateHours(e.currentTarget.value)}
          class:error={$errors?.hours}
        />
        {#if $errors?.hours}
          <span class="text-red-500 text-sm">{$errors.hours}</span>
        {/if}
        <p class="text-xs text-gray-500 mt-1">
          {timeFormat === 'hhmm' 
            ? "Enter as HH:MM (1:30) or minutes (90)" 
            : "Enter as decimal (1.5 hours)"}
        </p>
      </div>

      <div>
        <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={$formData.date}
          class:error={$errors?.date}
        />
        {#if $errors?.date}
          <span class="text-red-500 text-sm">{$errors.date}</span>
        {/if}
      </div>

      <div>
        <label for="clientId" class="block text-sm font-medium text-gray-700 mb-1">
          Client
        </label>
        <select
          id="clientId"
          name="clientId"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={$formData.clientId}
          class:error={$errors?.clientId}
          onchange={() => {
            updateField('ticketId', '');
          }}
        >
          <option value="">Select a client</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
        {#if $errors?.clientId}
          <span class="text-red-500 text-sm">{$errors.clientId}</span>
        {/if}
      </div>

      <div>
        <label for="ticketId" class="block text-sm font-medium text-gray-700 mb-1">
          Ticket
        </label>
        <select
          id="ticketId"
          name="ticketId"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={$formData.ticketId}
          class:error={$errors?.ticketId}
        >
          <option value="">No ticket</option>
          {#each filteredTickets as ticket}
            <option value={ticket.id}>{ticket.title}</option>
          {/each}
        </select>
        {#if $errors?.ticketId}
          <span class="text-red-500 text-sm">{$errors.ticketId}</span>
        {/if}
      </div>

      <div class="flex items-center">
        <input
          id="billable"
          name="billable"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          bind:checked={$formData.billable}
        />
        <label for="billable" class="ml-2 block text-sm text-gray-700">
          Billable
        </label>
      </div>
    </div>

    <div class="flex justify-end space-x-3">
      {#if props.editEntry}
        <button 
          type="button" 
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          onclick={props.onCancel}
        >
          Cancel
        </button>
      {/if}
      <button
        type="submit"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        {props.editEntry ? 'Update' : 'Create'} Entry
      </button>
    </div>
  </form>
</div>

<style>
  .error {
    border-color: rgb(239, 68, 68);
  }
</style>