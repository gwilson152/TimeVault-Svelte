<!--
  Component for managing ticket status settings
  Follows project form styling conventions and glass effect classes
-->
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import type { TicketStatus } from '$lib/types';
  import { GlassCard, Modal } from '$lib/components';

  // Form state
  let editingStatus: TicketStatus | null = null;
  let showForm = false;
  let formStatus = {
    name: '',
    color: '#718096',
    isDefault: false,
    isClosed: false,
    sortOrder: 0
  };
  let error = '';

  const { ticketSettings } = settingsStore;

  // Reactive values for form binding
  $: currentName = editingStatus?.name ?? formStatus.name;
  $: currentColor = editingStatus?.color ?? formStatus.color;
  $: currentSortOrder = editingStatus?.sortOrder ?? formStatus.sortOrder;
  $: currentIsDefault = editingStatus?.isDefault ?? formStatus.isDefault;
  $: currentIsClosed = editingStatus?.isClosed ?? formStatus.isClosed;

  // Update the appropriate object based on which mode we're in
  function updateField<K extends keyof typeof formStatus>(field: K, value: typeof formStatus[K]) {
    if (editingStatus) {
      (editingStatus as any)[field] = value;
    } else {
      formStatus[field] = value;
    }
  }

  async function handleCreateStatus() {
    if (!formStatus.name) return;
    error = '';

    try {
      await settingsStore.createTicketStatus({
        name: formStatus.name,
        color: formStatus.color,
        isDefault: formStatus.isDefault,
        isClosed: formStatus.isClosed,
        sortOrder: formStatus.sortOrder
      });

      // Reset form and close modal
      formStatus = {
        name: '',
        color: '#718096',
        isDefault: false,
        isClosed: false,
        sortOrder: 0
      };
      showForm = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create ticket status';
      console.error('Failed to create ticket status:', err);
    }
  }

  async function handleUpdateStatus() {
    if (!editingStatus) return;
    error = '';

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
      showForm = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update ticket status';
      console.error('Failed to update ticket status:', err);
    }
  }

  async function handleDeleteStatus(status: TicketStatus) {
    if (!confirm(`Are you sure you want to delete the "${status.name}" status?`)) {
      return;
    }

    error = '';
    try {
      await settingsStore.deleteTicketStatus(status.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete ticket status';
      console.error('Failed to delete ticket status:', err);
    }
  }

  function startEdit(status: TicketStatus) {
    editingStatus = { ...status };
    showForm = true;
  }

  function cancelForm() {
    editingStatus = null;
    showForm = false;
    formStatus = {
      name: '',
      color: '#718096',
      isDefault: false,
      isClosed: false,
      sortOrder: 0
    };
  }
</script>

<GlassCard>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-semibold">Ticket Status Settings</h2>
    <button
      class="btn btn-primary"
      on:click={() => showForm = true}
    >
      Add New Status
    </button>
  </div>

  {#if error}
    <div class="form-error mb-4">{error}</div>
  {/if}

  <!-- Status list -->
  <div class="space-y-4">
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead class="data-table-header">
          <tr>
            <th>Name</th>
            <th>Color</th>
            <th>Sort Order</th>
            <th class="text-center">Default</th>
            <th class="text-center">Closed</th>
            <th class="right-aligned">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each $ticketSettings.statuses || [] as status}
            <tr class="data-table-row">
              <td>{status.name}</td>
              <td>
                <div
                  class="w-6 h-6 rounded"
                  style="background-color: {status.color}"
                ></div>
              </td>
              <td>{status.sortOrder}</td>
              <td class="text-center">{status.isDefault ? '✓' : ''}</td>
              <td class="text-center">{status.isClosed ? '✓' : ''}</td>
              <td class="right-aligned">
                <div class="flex justify-end space-x-2">
                  <button
                    class="table-action-button-primary"
                    on:click={() => startEdit(status)}
                  >
                    Edit
                  </button>
                  <button
                    class="table-action-button-danger"
                    on:click={() => handleDeleteStatus(status)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</GlassCard>

<Modal
  open={showForm}
  title={editingStatus ? 'Edit Status' : 'New Status'}
  width="max-w-lg"
  hasFooter={false}
  on:close={cancelForm}
>
  <form on:submit|preventDefault={editingStatus ? handleUpdateStatus : handleCreateStatus} class="p-6">
    <div class="form-group space-y-4">
      <div class="form-field">
        <label for="statusName" class="form-label">Name</label>
        <input
          id="statusName"
          type="text"
          bind:value={currentName}
          on:input={(e) => updateField('name', e.currentTarget.value)}
          class="form-input"
          required
        />
      </div>

      <div class="form-field">
        <label for="statusColor" class="form-label">Color</label>
        <input
          id="statusColor"
          type="color"
          bind:value={currentColor}
          on:input={(e) => updateField('color', e.currentTarget.value)}
          class="form-input h-[42px]"
        />
      </div>

      <div class="form-field">
        <label for="statusSortOrder" class="form-label">Sort Order</label>
        <input
          id="statusSortOrder"
          type="number"
          bind:value={currentSortOrder}
          on:input={(e) => updateField('sortOrder', parseInt(e.currentTarget.value))}
          class="form-input"
          min="0"
        />
      </div>

      <div class="form-field flex gap-6">
        <label class="inline-flex items-center">
          <input
            type="checkbox"
            bind:checked={currentIsDefault}
            on:change={(e) => updateField('isDefault', e.currentTarget.checked)}
            class="form-checkbox"
          />
          <span class="ml-2">Default Status</span>
        </label>

        <label class="inline-flex items-center">
          <input
            type="checkbox"
            bind:checked={currentIsClosed}
            on:change={(e) => updateField('isClosed', e.currentTarget.checked)}
            class="form-checkbox"
          />
          <span class="ml-2">Closed Status</span>
        </label>
      </div>
    </div>

    <div class="flex justify-end gap-3 mt-6">
      <button type="button" class="btn btn-secondary" on:click={cancelForm}>
        Cancel
      </button>
      <button type="submit" class="btn btn-primary">
        {editingStatus ? 'Save Changes' : 'Create Status'}
      </button>
    </div>
  </form>
</Modal>