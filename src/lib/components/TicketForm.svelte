<script lang="ts">
  import { getContext } from 'svelte';
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

  // Get the derived store
  const { ticketSettings } = settingsStore;
  
  $: statuses = $ticketSettings.statuses || [];
  $: priorities = $ticketSettings.priorities || [];
  $: addonTypes = $ticketSettings.addonTypes || [];

  $: if (editTicket) {
    ticket = { ...editTicket };
  }

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

  function handleSubmit() {
    onSubmit({ ...ticket, addons });
  }

  function handleSave() {
    if (onSave) {
      const ticketToSave = { ...ticket, addons };
      if (!ticketToSave.id) {
        ticketToSave.id = crypto.randomUUID(); // Ensure id is set
      }
      onSave(ticketToSave as Ticket);
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="form-container">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="form-group">
      <label for="title" class="form-label">Title</label>
      <input
        type="text"
        id="title"
        bind:value={ticket.title}
        class="form-control"
        required
      />
    </div>

    <div class="form-group">
      <label for="status" class="form-label">Status</label>
      <select
        id="status"
        bind:value={ticket.statusId}
        class="form-control"
        required
      >
        {#each statuses as status}
          <option value={status.id}>{status.name}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label for="priority" class="form-label">Priority</label>
      <select
        id="priority"
        bind:value={ticket.priority}
        class="form-control"
        required
      >
        {#each priorities as priority}
          <option value={priority}>{priority}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label for="clientId" class="form-label">Client</label>
      <select
        id="clientId"
        bind:value={ticket.clientId}
        class="form-control"
        required
      >
        <option value="">Select a client</option>
        {#each $clientStore as client}
          <option value={client.id}>{client.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="form-group">
    <label for="description" class="form-label">Description</label>
    <textarea
      id="description"
      bind:value={ticket.description}
      class="form-control"
    ></textarea>
  </div>

  <div class="form-section mt-6">
    <h3 class="text-lg font-medium mb-4">Addons</h3>
    
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
      <div class="form-group">
        <label for="addonType" class="form-label">Type</label>
        <select
          id="addonType"
          bind:value={selectedAddonType}
          class="form-control"
        >
          <option value="">Select addon type</option>
          {#each addonTypes as type}
            <option value={type.name}>{type.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="addonAmount" class="form-label">Amount</label>
        <input
          type="number"
          id="addonAmount"
          bind:value={addonAmount}
          class="form-control"
          step="0.01"
          min="0"
        />
      </div>

      <div class="form-group">
        <label for="addonDescription" class="form-label">Description</label>
        <div class="flex gap-2">
          <input
            type="text"
            id="addonDescription"
            bind:value={addonDescription}
            class="form-control"
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
        <table class="w-full">
          <thead>
            <tr>
              <th class="text-left px-4 py-2 text-sm font-medium text-gray-500">Type</th>
              <th class="text-left px-4 py-2 text-sm font-medium text-gray-500">Amount</th>
              <th class="text-left px-4 py-2 text-sm font-medium text-gray-500">Description</th>
              <th class="text-right px-4 py-2 text-sm font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each addons as addon}
              <tr class="hover:bg-gray-50/50">
                <td class="px-4 py-2">{addon.name}</td>
                <td class="px-4 py-2">${addon.amount.toFixed(2)}</td>
                <td class="px-4 py-2">{addon.description || '-'}</td>
                <td class="px-4 py-2 text-right">
                  <button
                    type="button"
                    class="btn btn-danger"
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
    <button type="submit" class="btn btn-primary">
      {ticket.id ? 'Update' : 'Create'} Ticket
    </button>
  </div>
</form>