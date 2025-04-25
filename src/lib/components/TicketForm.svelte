<script lang="ts">
  import { clientStore } from '$lib/stores/clientStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import type { Ticket, TicketStatus, NewTicket } from '$lib/types';
  import { onMount } from 'svelte';

  const props = $props<{
    editTicket?: Ticket | null;
    onSave?: (ticket: Ticket) => void;
    onCancel?: () => void;
  }>();

  // Form state
  let title = $state('');
  let description = $state('');
  let status = $state<TicketStatus>('open');
  let clientId = $state('');
  let isSubmitting = $state(false);

  // Status options
  const statusOptions = ['open', 'in-progress', 'closed'] as const;

  // Initialize form with edit data if available
  $effect(() => {
    if (props.editTicket) {
      title = props.editTicket.title;
      description = props.editTicket.description || '';
      status = props.editTicket.status;
      clientId = props.editTicket.clientId;
    }
  });

  // Handle form submission
  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    
    if (!title || !clientId) {
      alert('Please fill in all required fields');
      return;
    }
    
    isSubmitting = true;
    
    try {
      let result: Ticket;
      
      if (props.editTicket) {
        // Update existing ticket
        result = await ticketStore.update(props.editTicket.id, {
          title,
          description,
          status,
          clientId
        });
      } else {
        // Create new ticket
        const newTicket: NewTicket = {
          title,
          description: description || null,
          status,
          clientId
        };
        
        result = await ticketStore.add(newTicket);
      }
      
      // Reset form
      if (!props.editTicket) {
        title = '';
        description = '';
        status = 'open';
        clientId = '';
      }
      
      // Call onSave callback if provided
      if (props.onSave) {
        props.onSave(result);
      }
    } catch (error) {
      console.error('Failed to save ticket:', error);
      alert('Failed to save ticket');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label for="title" class="block text-sm font-medium text-default mb-1">
        Title <span class="text-accentPink">*</span>
      </label>
      <input
        id="title"
        type="text"
        required
        bind:value={title}
        class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-default"
        placeholder="Enter ticket title"
      />
    </div>
    
    <div>
      <label for="client" class="block text-sm font-medium text-default mb-1">
        Client <span class="text-accentPink">*</span>
      </label>
      <select
        id="client"
        required
        bind:value={clientId}
        class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-default"
      >
        <option value="">Select a client</option>
        {#each $clientStore as client}
          <option value={client.id}>{client.name}</option>
        {/each}
      </select>
    </div>
  </div>
  
  <div>
    <label for="description" class="block text-sm font-medium text-default mb-1">
      Description
    </label>
    <textarea
      id="description"
      rows="4"
      bind:value={description}
      class="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-default"
      placeholder="Enter ticket description (optional)"
    ></textarea>
  </div>
  
  <fieldset class="mt-4">
    <legend class="block text-sm font-medium text-default mb-1">
      Status
    </legend>
    <div class="flex space-x-4">
      {#each statusOptions as option}
        <label class="inline-flex items-center">
          <input
            type="radio"
            id={`status-${option}`}
            bind:group={status}
            value={option}
            class="form-radio"
          />
          <span class="ml-2 text-text-blue-300">
            {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
          </span>
        </label>
      {/each}
    </div>
  </fieldset>
  
  <div class="flex justify-end space-x-3">
    {#if props.onCancel}
      <button
        type="button"
        onclick={props.onCancel}
        class="btn btn-secondary"
        disabled={isSubmitting}
      >
        Cancel
      </button>
    {/if}
    
    <button
      type="submit"
      class="btn btn-primary"
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Saving...' : props.editTicket ? 'Update Ticket' : 'Create Ticket'}
    </button>
  </div>
</form>