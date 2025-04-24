<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Client, NewClient } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  
  // Props using runes syntax
  const props = $props<{
    editClient: Client | null;
    onSave: ((client: Client) => void) | null;
    onCancel: (() => void) | null;
  }>();

  // Initialize form state
  const initialState: NewClient = {
    name: '',
    rate: 0
  };

  // Create reactive state
  let form = writable<NewClient>(initialState);
  
  // Update form when editing an existing client
  $effect(() => {
    if (props.editClient) {
      form.set({
        name: props.editClient.name,
        rate: props.editClient.rate
      });
    } else {
      form.set(initialState);
    }
  });
  
  function handleSubmit() {
    // Basic validation
    if (!$form.name) {
      alert('Please enter a client name');
      return;
    }
    
    if ($form.rate < 0) {
      alert('Please enter a valid hourly rate');
      return;
    }
    
    let result: Client;
    
    if (props.editClient) {
      // Update existing client
      clientStore.update(props.editClient.id, $form);
      result = { ...props.editClient, ...$form };
    } else {
      // Add new client
      result = clientStore.add($form);
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
  
  function updateField(field: keyof NewClient, value: any) {
    form.update(f => ({ ...f, [field]: value }));
  }
</script>

<div class="bg-white p-6 rounded-lg shadow-md">
  <h3 class="text-xl font-semibold mb-4">
    {props.editClient ? 'Edit Client' : 'Add New Client'}
  </h3>
  
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
    <div>
      <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
        Client Name
      </label>
      <input
        id="name"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={$form.name}
        oninput={(e) => updateField('name', e.currentTarget.value)}
      />
    </div>
    
    <div>
      <label for="rate" class="block text-sm font-medium text-gray-700 mb-1">
        Hourly Rate
      </label>
      <input
        id="rate"
        type="number"
        min="0"
        step="0.01"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={$form.rate}
        oninput={(e) => updateField('rate', parseFloat(e.currentTarget.value) || 0)}
      />
    </div>
    
    <div class="flex justify-end space-x-3 pt-2">
      {#if props.editClient}
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
        {props.editClient ? 'Update' : 'Add'} Client
      </button>
    </div>
  </form>
</div>