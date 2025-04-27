<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { Ticket, TicketAddon } from '$lib/types';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { clientStore } from '$lib/stores/clientStore';

  export let ticket: Partial<Ticket & { priority?: string }> = {};
  export let onSubmit: (ticket: Partial<Ticket>) => void;
  export let editTicket: Ticket | null = null;
  export let onSave: ((ticket: Ticket) => void) | null = null;

  let addons: TicketAddon[] = ticket.addons || [];
  let selectedAddonType = '';
  let addonAmount: number = 0;
  let addonDescription: string = '';
  let isLoading = true;
  let clientError = '';

  // Get the derived store
  const { ticketSettings } = settingsStore;
  
  $: statuses = $ticketSettings.statuses || [];
  $: priorities = $ticketSettings.priorities || [];
  $: addonTypes = $ticketSettings.addonTypes || [];
  $: hasClients = $clientStore && $clientStore.length > 0;
  $: hasStatuses = statuses && statuses.length > 0;

  // Ensure default status and priority are set for new tickets
  $: if (!isLoading && !editTicket && !ticket.statusId && hasStatuses) {
    ticket.statusId = statuses[0]?.id;
  }
  
  $: if (!isLoading && !editTicket && !ticket.priority && priorities.length > 0) {
    ticket.priority = priorities[0];
  }

  $: if (editTicket) {
    ticket = { ...editTicket };
    addons = ticket.addons || [];
  }

  onMount(async () => {
    try {
      // Make sure we have necessary data
      await Promise.all([
        settingsStore.load(),
        clientStore.load()
      ]);
      
      // Set defaults after data is loaded
      if (!ticket.statusId && statuses.length > 0) {
        ticket.statusId = statuses[0]?.id;
      }
      
      if (!ticket.priority && priorities.length > 0) {
        ticket.priority = priorities[0];
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    } finally {
      isLoading = false;
    }
  });

  function addAddon() {
    if (selectedAddonType) {
      const addonType = addonTypes.find((type) => type?.name === selectedAddonType);
      if (addonType) {
        addons = [...addons, {
          id: crypto.randomUUID(),
          ticketId: ticket.id || '',
          name: selectedAddonType,
          amount: addonAmount || addonType.defaultAmount,
          description: addonDescription,
          billed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }];
        selectedAddonType = '';
        addonAmount = 0;
        addonDescription = '';
      }
    }
  }

  function removeAddon(id: string) {
    addons = addons.filter(addon => addon.id !== id);
  }

  function validateForm() {
    // Reset error states
    clientError = '';
    
    // Check if client is selected
    if (!ticket.clientId) {
      clientError = 'Client is required';
      return false;
    }
    
    return true;
  }

  function handleSubmit() {
    if (!validateForm()) {
      return; // Stop if validation fails
    }
    
    // Ensure required fields are set
    if (!ticket.statusId && statuses.length > 0) {
      ticket.statusId = statuses[0].id;
    }
    
    if (!ticket.priority && priorities.length > 0) {
      ticket.priority = priorities[0];
    }
    
    // Create a new object with only the properties we want
    const submissionData = {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      clientId: ticket.clientId,
      statusId: ticket.statusId,
      priority: ticket.priority,
      addons: addons
    };
    
    onSubmit(submissionData);
  }

  function handleSave() {
    if (onSave && validateForm()) {
      const ticketToSave = { 
        id: ticket.id || crypto.randomUUID(),
        title: ticket.title,
        description: ticket.description,
        clientId: ticket.clientId,
        statusId: ticket.statusId,
        priority: ticket.priority,
        addons: addons,
        // Add required fields with defaults if not present
        createdAt: ticket.createdAt || new Date(),
        updatedAt: new Date()
      };
      onSave(ticketToSave as Ticket);
    }
  }
</script>

{#if isLoading}
  <div class="text-center py-4">
    <div class="text-gray-400 animate-pulse">Loading...</div>
  </div>
{:else}
  <form on:submit|preventDefault={handleSubmit} class="form-group">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="form-field">
        <label for="title" class="form-label">Title</label>
        <input
          type="text"
          id="title"
          bind:value={ticket.title}
          class="form-input"
          required
        />
      </div>

      <div class="form-field">
        <label for="status" class="form-label">Status</label>
        <select
          id="status"
          bind:value={ticket.statusId}
          class="form-select"
          required
        >
          {#each statuses as status}
            <option value={status.id}>{status.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="priority" class="form-label">Priority</label>
        <select
          id="priority"
          bind:value={ticket.priority}
          class="form-select"
          required
        >
          {#each priorities as priority}
            <option value={priority}>{priority}</option>
          {/each}
        </select>
      </div>

      <div class="form-field">
        <label for="clientId" class="form-label">Client</label>
        <select
          id="clientId"
          bind:value={ticket.clientId}
          class="form-select"
          class:error={clientError}
          required
        >
          <option value="">Select a client</option>
          {#each $clientStore as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
        {#if clientError}
          <span class="form-error">{clientError}</span>
        {/if}
      </div>
    </div>

    <div class="form-field">
      <label for="description" class="form-label">Description</label>
      <textarea
        id="description"
        bind:value={ticket.description}
        class="form-textarea"
        rows="4"
      ></textarea>
    </div>

    <div class="form-section mt-6">
      <h3 class="text-lg font-medium mb-4">Addons</h3>
      
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
        <div class="form-field">
          <label for="addonType" class="form-label">Type</label>
          <select
            id="addonType"
            bind:value={selectedAddonType}
            class="form-select"
          >
            <option value="">Select addon type</option>
            {#each addonTypes as type}
              <option value={type.name}>{type.name}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label for="addonAmount" class="form-label">Amount</label>
          <input
            type="number"
            id="addonAmount"
            bind:value={addonAmount}
            class="form-input"
            step="0.01"
            min="0"
          />
        </div>

        <div class="form-field">
          <label for="addonDescription" class="form-label">Description</label>
          <div class="flex gap-2">
            <input
              type="text"
              id="addonDescription"
              bind:value={addonDescription}
              class="form-input"
            />
            <button
              type="button"
              class="btn btn-primary"
              on:click={addAddon}
              disabled={!selectedAddonType}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {#if addons.length > 0}
        <div class="overflow-x-auto mt-4">
          <table class="data-table">
            <thead class="data-table-header">
              <tr>
                <th class="text-left">Type</th>
                <th class="text-left">Amount</th>
                <th class="text-left">Description</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each addons as addon}
                <tr class="data-table-row">
                  <td>{addon.name}</td>
                  <td>${addon.amount.toFixed(2)}</td>
                  <td>{addon.description || '-'}</td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="table-action-button-danger"
                      on:click={() => removeAddon(addon.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="flex justify-end gap-4 mt-6">
      <slot name="actions"></slot>
      <button type="submit" class="form-submit">
        {ticket.id ? 'Update' : 'Create'} Ticket
      </button>
    </div>
  </form>
{/if}