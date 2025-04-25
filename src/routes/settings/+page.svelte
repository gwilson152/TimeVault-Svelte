<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import type { TicketStatus, BillingRate } from '$lib/types';
  import { onMount } from 'svelte';

  // Existing ticket status state
  let editingStatus: TicketStatus | null = null;
  let newStatusName = '';
  let newStatusColor = '#718096';
  let newStatusIsDefault = false;
  let newStatusIsClosed = false;
  let newStatusSortOrder = 0;

  // New billing rate state
  let editingRate: BillingRate | null = null;
  let newRateName = '';
  let newRateAmount = 0;
  let newRateDescription = '';
  let newRateIsDefault = false;

  let loading = false;

  // Get the derived store
  const { ticketSettings, billingRates } = settingsStore;

  onMount(async () => {
    await settingsStore.load();
  });

  async function handleCreateStatus() {
    if (!newStatusName) return;

    try {
      await settingsStore.createTicketStatus({
        name: newStatusName,
        color: newStatusColor,
        isDefault: newStatusIsDefault,
        isClosed: newStatusIsClosed,
        sortOrder: newStatusSortOrder
      });

      // Reset form
      newStatusName = '';
      newStatusColor = '#718096';
      newStatusIsDefault = false;
      newStatusIsClosed = false;
      newStatusSortOrder = 0;
    } catch (error) {
      console.error('Failed to create ticket status:', error);
      alert(error instanceof Error ? error.message : 'Failed to create ticket status');
    }
  }

  async function handleUpdateStatus() {
    if (!editingStatus) return;

    try {
      await settingsStore.updateTicketStatus({
        ...editingStatus,
        name: editingStatus.name,
        color: editingStatus.color,
        isDefault: editingStatus.isDefault,
        isClosed: editingStatus.isClosed,
        sortOrder: editingStatus.sortOrder
      });
      editingStatus = null;
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update ticket status');
    }
  }

  async function handleDeleteStatus(status: TicketStatus) {
    if (!confirm(`Are you sure you want to delete the "${status.name}" status?`)) {
      return;
    }

    try {
      await settingsStore.deleteTicketStatus(status.id);
    } catch (error) {
      console.error('Failed to delete ticket status:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete ticket status');
    }
  }

  async function handleCreateRate() {
    if (!newRateName || newRateAmount <= 0) return;

    try {
      await settingsStore.createBillingRate({
        name: newRateName,
        rate: newRateAmount,
        description: newRateDescription || undefined,
        isDefault: newRateIsDefault
      });

      // Reset form
      newRateName = '';
      newRateAmount = 0;
      newRateDescription = '';
      newRateIsDefault = false;
    } catch (error) {
      console.error('Failed to create billing rate:', error);
      alert(error instanceof Error ? error.message : 'Failed to create billing rate');
    }
  }

  async function handleUpdateRate() {
    if (!editingRate) return;

    try {
      await settingsStore.updateBillingRate(editingRate.id, {
        name: editingRate.name,
        rate: editingRate.rate,
        description: editingRate.description,
        isDefault: editingRate.isDefault
      });
      editingRate = null;
    } catch (error) {
      console.error('Failed to update billing rate:', error);
      alert(error instanceof Error ? error.message : 'Failed to update billing rate');
    }
  }

  async function handleDeleteRate(rate: BillingRate) {
    if (!confirm(`Are you sure you want to delete the "${rate.name}" billing rate?`)) {
      return;
    }

    try {
      await settingsStore.deleteBillingRate(rate.id);
    } catch (error) {
      console.error('Failed to delete billing rate:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete billing rate');
    }
  }
</script>

<div class="container mx-auto px-4 py-8 space-y-8">
  <div class="card-glass">
    <h2 class="text-xl font-semibold mb-6">Ticket Status Settings</h2>

    <!-- Create new status form -->
    <div class="space-y-4 mb-8">
      <h3 class="text-lg font-medium">Create New Status</h3>
      <form on:submit|preventDefault={handleCreateStatus} class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-control">
          <label for="newStatusName" class="label">Name</label>
          <input
            id="newStatusName"
            type="text"
            bind:value={newStatusName}
            class="input input-bordered"
            required
          />
        </div>

        <div class="form-control">
          <label for="newStatusColor" class="label">Color</label>
          <input
            id="newStatusColor"
            type="color"
            bind:value={newStatusColor}
            class="h-[42px]"
          />
        </div>

        <div class="form-control">
          <label for="newStatusSortOrder" class="label">Sort Order</label>
          <input
            id="newStatusSortOrder"
            type="number"
            bind:value={newStatusSortOrder}
            class="input input-bordered"
            min="0"
          />
        </div>

        <div class="flex items-center space-x-4 mt-8">
          <div class="form-control">
            <label class="label cursor-pointer">
              <input
                type="checkbox"
                bind:checked={newStatusIsDefault}
                class="checkbox"
              />
              <span class="label-text ml-2">Default Status</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer">
              <input
                type="checkbox"
                bind:checked={newStatusIsClosed}
                class="checkbox"
              />
              <span class="label-text ml-2">Closed Status</span>
            </label>
          </div>
        </div>

        <div class="md:col-span-2 flex justify-end">
          <button type="submit" class="btn btn-primary">
            Create Status
          </button>
        </div>
      </form>
    </div>

    <!-- Status list -->
    <div class="space-y-4">
      <h3 class="text-lg font-medium">Current Statuses</h3>
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Color</th>
              <th>Sort Order</th>
              <th>Default</th>
              <th>Closed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each $ticketSettings.statuses || [] as status}
              <tr>
                <td>
                  {#if editingStatus?.id === status.id}
                    <input
                      type="text"
                      bind:value={editingStatus!.name}
                      class="input input-bordered input-sm"
                    />
                  {:else}
                    {status.name}
                  {/if}
                </td>
                <td>
                  {#if editingStatus?.id === status.id}
                    <input
                      type="color"
                      bind:value={editingStatus!.color}
                      class="h-[30px] w-[60px]"
                    />
                  {:else}
                    <div
                      class="w-6 h-6 rounded"
                      style="background-color: {status.color}"
                    ></div>
                  {/if}
                </td>
                <td>
                  {#if editingStatus?.id === status.id}
                    <input
                      type="number"
                      bind:value={editingStatus!.sortOrder}
                      class="input input-bordered input-sm w-20"
                      min="0"
                    />
                  {:else}
                    {status.sortOrder}
                  {/if}
                </td>
                <td>
                  {#if editingStatus?.id === status.id}
                    <input
                      type="checkbox"
                      bind:checked={editingStatus!.isDefault}
                      class="checkbox checkbox-sm"
                    />
                  {:else}
                    {status.isDefault ? '✓' : ''}
                  {/if}
                </td>
                <td>
                  {#if editingStatus?.id === status.id}
                    <input
                      type="checkbox"
                      bind:checked={editingStatus!.isClosed}
                      class="checkbox checkbox-sm"
                    />
                  {:else}
                    {status.isClosed ? '✓' : ''}
                  {/if}
                </td>
                <td>
                  {#if editingStatus?.id === status.id}
                    <div class="flex space-x-2">
                      <button
                        class="btn btn-sm btn-primary"
                        on:click={handleUpdateStatus}
                      >
                        Save
                      </button>
                      <button
                        class="btn btn-sm"
                        on:click={() => editingStatus = null}
                      >
                        Cancel
                      </button>
                    </div>
                  {:else}
                    <div class="flex space-x-2">
                      <button
                        class="btn btn-sm btn-secondary"
                        on:click={() => editingStatus = { ...status }}
                      >
                        Edit
                      </button>
                      <button
                        class="btn btn-sm btn-error"
                        on:click={() => handleDeleteStatus(status)}
                      >
                        Delete
                      </button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Billing Rates section -->
  <div class="card-glass">
    <h2 class="text-xl font-semibold mb-6">Billing Rates</h2>

    <!-- Create new rate form -->
    <div class="space-y-4 mb-8">
      <h3 class="text-lg font-medium">Create New Billing Rate</h3>
      <form on:submit|preventDefault={handleCreateRate} class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-field">
          <label for="newRateName" class="form-label">Name</label>
          <input
            id="newRateName"
            type="text"
            bind:value={newRateName}
            class="form-input"
            required
          />
        </div>

        <div class="form-field">
          <label for="newRateAmount" class="form-label">Rate ($/hr)</label>
          <input
            id="newRateAmount"
            type="number"
            step="0.01"
            min="0"
            bind:value={newRateAmount}
            class="form-input"
            required
          />
        </div>

        <div class="form-field col-span-2">
          <label for="newRateDescription" class="form-label">Description</label>
          <textarea
            id="newRateDescription"
            bind:value={newRateDescription}
            class="form-textarea"
            rows="2"
          ></textarea>
        </div>

        <div class="form-field col-span-2">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              bind:checked={newRateIsDefault}
              class="form-checkbox"
            />
            <span>Default Rate</span>
          </label>
        </div>

        <div class="col-span-2">
          <button type="submit" class="form-submit">
            Create Rate
          </button>
        </div>
      </form>
    </div>

    <!-- Billing rates table -->
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr>
            <th class="text-left px-4 py-2">Name</th>
            <th class="text-left px-4 py-2">Rate</th>
            <th class="text-left px-4 py-2">Description</th>
            <th class="text-center px-4 py-2">Default</th>
            <th class="text-right px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          {#each $billingRates as rate}
            <tr class="hover:bg-white/5">
              <td class="px-4 py-2">
                {#if editingRate?.id === rate.id}
                  <input
                    type="text"
                    bind:value={editingRate.name}
                    class="form-input"
                  />
                {:else}
                  {rate.name}
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if editingRate?.id === rate.id}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editingRate.rate}
                    class="form-input w-32"
                  />
                {:else}
                  ${rate.rate}/hr
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if editingRate?.id === rate.id}
                  <textarea
                    bind:value={editingRate.description}
                    class="form-textarea"
                    rows="2"
                  ></textarea>
                {:else}
                  {rate.description || '—'}
                {/if}
              </td>
              <td class="px-4 py-2 text-center">
                {#if editingRate?.id === rate.id}
                  <input
                    type="checkbox"
                    bind:checked={editingRate.isDefault}
                    class="form-checkbox"
                  />
                {:else}
                  {rate.isDefault ? '✓' : ''}
                {/if}
              </td>
              <td class="px-4 py-2 text-right">
                {#if editingRate?.id === rate.id}
                  <div class="flex justify-end space-x-2">
                    <button
                      class="btn btn-sm btn-primary"
                      on:click={handleUpdateRate}
                    >
                      Save
                    </button>
                    <button
                      class="btn btn-sm"
                      on:click={() => editingRate = null}
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <div class="flex justify-end space-x-2">
                    <button
                      class="btn btn-sm btn-secondary"
                      on:click={() => editingRate = { ...rate }}
                    >
                      Edit
                    </button>
                    <button
                      class="btn btn-sm btn-error"
                      on:click={() => handleDeleteRate(rate)}
                    >
                      Delete
                    </button>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>