<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { clientStore } from '$lib/stores/clientStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { ticketStore } from '$lib/stores/ticketStore';
  import type { Ticket, NewTicket } from '$lib/types';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { BuildingOffice, Folder, User } from '@steeze-ui/heroicons';

  const props = $props<{
    editTicket?: Ticket | null;
    onSubmit?: (ticket: Ticket) => void;
    onCancel?: () => void;
  }>();

  // Initialize form state
  const initialState: NewTicket = {
    title: '',
    description: '',
    statusId: '',
    clientId: ''
  };

  let form = writable<NewTicket>(initialState);
  let errors = $state<{[key: string]: string}>({});
  let isSubmitting = $state(false);
  
  // Subscribe to ticket statuses from settings store
  const { ticketSettings } = settingsStore;
  
  // Effect to update form when editTicket changes
  $effect(() => {
    if (props.editTicket) {
      form.set({
        title: props.editTicket.title,
        description: props.editTicket.description || '',
        statusId: props.editTicket.statusId,
        clientId: props.editTicket.clientId
      });
    }
  });
  
  // Check if the client can be a parent based on its type
  function canBeParent(client) {
    return client.type === 'business' || client.type === 'container';
  }

  // Handle form validation
  function validate(): boolean {
    const newErrors: {[key: string]: string} = {};
    
    if (!$form.title) {
      newErrors.title = 'Title is required';
    }
    
    if (!$form.clientId) {
      newErrors.clientId = 'Client is required';
    }
    
    if (!$form.statusId) {
      newErrors.statusId = 'Status is required';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  // Handle form submission
  async function handleSubmit() {
    if (isSubmitting) return;
    
    if (!validate()) {
      return;
    }
    
    isSubmitting = true;
    
    try {
      let ticket: Ticket;
      
      if (props.editTicket) {
        // Update existing ticket
        ticket = await ticketStore.update(props.editTicket.id, $form);
      } else {
        // Create new ticket
        ticket = await ticketStore.add($form as NewTicket);
      }
      
      // Reset form
      if (!props.editTicket) {
        form.set(initialState);
      }
      
      // Call onSubmit callback if provided
      if (props.onSubmit) {
        props.onSubmit(ticket);
      }
    } catch (error) {
      console.error('Failed to save ticket:', error);
      errors.form = error instanceof Error ? error.message : 'Failed to save ticket';
    } finally {
      isSubmitting = false;
    }
  }

  // Handle cancel button
  function handleCancel() {
    if (props.onCancel) {
      props.onCancel();
    }
  }

  // Load required data
  onMount(() => {
    clientStore.load();
    settingsStore.loadTicketStatuses();
    
    // Set default status ID if no ticket is being edited
    if (!props.editTicket) {
      const unsubscribe = ticketSettings.subscribe(settings => {
        if (settings.statuses) {
          const defaultStatus = settings.statuses.find(s => s.isDefault);
          if (defaultStatus && !$form.statusId) {
            form.update(f => ({ ...f, statusId: defaultStatus.id }));
          }
        }
      });
      
      return unsubscribe;
    }
  });
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <!-- Form errors -->
  {#if errors.form}
    <div class="form-error mb-4">{errors.form}</div>
  {/if}
  
  <!-- Title field -->
  <div class="form-field">
    <label for="title" class="form-label">Title</label>
    <input
      id="title"
      type="text"
      bind:value={$form.title}
      class="form-input {errors.title ? 'border-red-500' : ''}"
      placeholder="Enter ticket title"
    />
    {#if errors.title}
      <span class="form-error mt-1">{errors.title}</span>
    {/if}
  </div>

  <!-- Client field -->
  <div class="form-field">
    <label for="clientId" class="form-label">Client</label>
    <select
      id="clientId"
      bind:value={$form.clientId}
      class="form-select {errors.clientId ? 'border-red-500' : ''}"
    >
      <option value="">Select a client</option>
      {#each $clientStore as client}
        <option value={client.id}>
          {client.name} 
          {#if client.type === 'business'}
            (Business)
          {:else if client.type === 'container'}
            (Container)
          {:else}
            (Individual)
          {/if}
        </option>
      {/each}
    </select>
    {#if errors.clientId}
      <span class="form-error mt-1">{errors.clientId}</span>
    {:else}
      <span class="form-hint mt-1">
        <div class="flex flex-wrap gap-2 mt-1">
          <span class="flex items-center gap-1 text-xs">
            <Icon src={BuildingOffice} class="h-3 w-3 text-blue-500" />
            Business
          </span>
          <span class="flex items-center gap-1 text-xs">
            <Icon src={Folder} class="h-3 w-3 text-amber-500" />
            Container
          </span>
          <span class="flex items-center gap-1 text-xs">
            <Icon src={User} class="h-3 w-3 text-green-500" />
            Individual
          </span>
        </div>
      </span>
    {/if}
  </div>

  <!-- Status field -->
  <div class="form-field">
    <label for="statusId" class="form-label">Status</label>
    <select
      id="statusId"
      bind:value={$form.statusId}
      class="form-select {errors.statusId ? 'border-red-500' : ''}"
    >
      <option value="">Select a status</option>
      {#each $ticketSettings.statuses as status}
        <option value={status.id}>{status.name}</option>
      {/each}
    </select>
    {#if errors.statusId}
      <span class="form-error mt-1">{errors.statusId}</span>
    {/if}
  </div>

  <!-- Description field -->
  <div class="form-field">
    <label for="description" class="form-label">Description</label>
    <textarea
      id="description"
      bind:value={$form.description}
      class="form-textarea"
      rows="4"
      placeholder="Enter ticket description (optional)"
    ></textarea>
  </div>

  <!-- Form buttons -->
  <div class="flex justify-end gap-3 pt-4">
    <button
      type="button" 
      class="btn btn-secondary"
      onclick={handleCancel}
      disabled={isSubmitting}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="btn btn-primary {isSubmitting ? 'loading' : ''}"
      disabled={isSubmitting}
    >
      {props.editTicket ? 'Save Changes' : 'Create Ticket'}
    </button>
  </div>
</form>