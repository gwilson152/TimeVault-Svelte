<script lang="ts">
  import { writable } from 'svelte/store';
  import type { NewTimeEntry, TimeEntry } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { formatDate } from '$lib/utils/invoiceUtils';

  // Props
  const props = $props<{
    editEntry: TimeEntry | null;
    onSave: ((entry: TimeEntry) => void) | null;
    onCancel: (() => void) | null;
  }>();

  // Initialize form state
  const initialState: NewTimeEntry = {
    description: '',
    hours: 0,
    date: new Date(),
    clientId: null,
    billable: true
  };

  // Create reactive state
  let form = writable<NewTimeEntry>(initialState);
  
  // Update form when editing an existing entry
  $effect(() => {
    if (props.editEntry) {
      form.set({
        description: props.editEntry.description,
        hours: props.editEntry.hours,
        date: props.editEntry.date,
        clientId: props.editEntry.clientId,
        billable: props.editEntry.billable
      });
    } else {
      // Set today's date for new entries
      form.set({
        ...initialState,
        date: new Date()
      });
    }
  });
  
  // Form submission handler
  function handleSubmit() {
    // Basic validation
    if (!$form.description) {
      alert('Please enter a description');
      return;
    }
    
    if ($form.hours <= 0) {
      alert('Please enter valid hours (greater than 0)');
      return;
    }
    
    let result: TimeEntry;
    
    if (props.editEntry) {
      // Update existing entry
      timeEntryStore.update(props.editEntry.id, $form);
      result = { ...props.editEntry, ...$form } as TimeEntry;
    } else {
      // Add new entry
      result = timeEntryStore.add($form);
    }
    
    // Reset form after submission
    form.set(initialState);
    
    // Call callback if provided
    if (props.onSave) {
      props.onSave(result);
    }
  }
  
  function handleCancel() {
    form.set(initialState);
    if (props.onCancel) {
      props.onCancel();
    }
  }
  
  function updateField(field: keyof NewTimeEntry, value: any) {
    form.update(f => ({ ...f, [field]: value }));
  }
</script>

<div class="bg-white p-6 rounded-lg shadow-md">
  <h3 class="text-xl font-semibold mb-4">
    {props.editEntry ? 'Edit Time Entry' : 'Add New Time Entry'}
  </h3>
  
  <form 
    onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
    class="space-y-4"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          id="description"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={$form.description}
          oninput={(e) => updateField('description', e.currentTarget.value)}
        />
      </div>
      
      <div>
        <label for="hours" class="block text-sm font-medium text-gray-700 mb-1">
          Hours
        </label>
        <input
          id="hours"
          type="number"
          min="0.25"
          step="0.25"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={$form.hours}
          oninput={(e) => updateField('hours', parseFloat(e.currentTarget.value) || 0)}
        />
      </div>
      
      <div>
        <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
          Date
        </label>
        <input
          id="date"
          type="date"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={formatDate($form.date)}
          oninput={(e) => updateField('date', new Date(e.currentTarget.value))}
        />
      </div>
      
      <div>
        <label for="client" class="block text-sm font-medium text-gray-700 mb-1">
          Client
        </label>
        <select
          id="client"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={$form.clientId || ''}
          onchange={(e) => updateField('clientId', e.currentTarget.value || null)}
        >
          <option value="">-- No Client --</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
      </div>
    </div>
    
    <div class="flex items-center">
      <input
        id="billable"
        type="checkbox"
        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        checked={$form.billable}
        onchange={(e) => updateField('billable', e.currentTarget.checked)}
      />
      <label for="billable" class="ml-2 block text-sm text-gray-700">
        Billable
      </label>
    </div>
    
    <div class="flex justify-end space-x-3 pt-2">
      {#if props.editEntry}
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          onclick={handleCancel}
        >
          Cancel
        </button>
      {/if}
      
      <button
        type="submit"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        {props.editEntry ? 'Update' : 'Add'} Time Entry
      </button>
    </div>
  </form>
</div>