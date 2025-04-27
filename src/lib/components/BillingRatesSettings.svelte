<!--
  Component for managing billing rates settings
  Follows project form styling conventions and glass effect classes
-->
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import type { BillingRate } from '$lib/types';
  import { GlassCard, Modal } from '$lib/components';

  // Form state
  let editingRate: BillingRate | null = null;
  let showForm = false;
  let formRate = {
    name: '',
    rate: 0,
    description: '',
    isDefault: false
  };
  let error = '';

  const { billingRates } = settingsStore;

  // Reactive values for form binding
  $: currentName = editingRate?.name ?? formRate.name;
  $: currentRate = editingRate?.rate ?? formRate.rate;
  $: currentDescription = editingRate?.description ?? formRate.description;
  $: currentIsDefault = editingRate?.isDefault ?? formRate.isDefault;

  // Update the appropriate object based on which mode we're in
  function updateField<K extends keyof typeof formRate>(field: K, value: typeof formRate[K]) {
    if (editingRate) {
      (editingRate as any)[field] = value;
    } else {
      formRate[field] = value;
    }
  }

  async function handleCreateRate() {
    if (!formRate.name || formRate.rate <= 0) return;
    error = '';

    try {
      await settingsStore.createBillingRate({
        name: formRate.name,
        rate: formRate.rate,
        description: formRate.description || undefined,
        isDefault: formRate.isDefault
      });

      // Reset form and close modal
      formRate = {
        name: '',
        rate: 0,
        description: '',
        isDefault: false
      };
      showForm = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create billing rate';
      console.error('Failed to create billing rate:', err);
    }
  }

  async function handleUpdateRate() {
    if (!editingRate) return;
    error = '';

    try {
      await settingsStore.updateBillingRate(editingRate.id, {
        name: editingRate.name,
        rate: editingRate.rate,
        description: editingRate.description,
        isDefault: editingRate.isDefault
      });
      showForm = false;
      editingRate = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update billing rate';
      console.error('Failed to update billing rate:', err);
    }
  }

  async function handleDeleteRate(rate: BillingRate) {
    if (!confirm(`Are you sure you want to delete the "${rate.name}" billing rate?`)) {
      return;
    }

    error = '';
    try {
      await settingsStore.deleteBillingRate(rate.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete billing rate';
      console.error('Failed to delete billing rate:', err);
    }
  }

  function startEdit(rate: BillingRate) {
    editingRate = { ...rate };
    showForm = true;
  }

  function cancelForm() {
    editingRate = null;
    showForm = false;
    formRate = {
      name: '',
      rate: 0,
      description: '',
      isDefault: false
    };
  }
</script>

<GlassCard>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-semibold">Billing Rates</h2>
    <button
      class="btn btn-primary"
      on:click={() => showForm = true}
    >
      Add New Rate
    </button>
  </div>

  {#if error}
    <div class="form-error mb-4">{error}</div>
  {/if}

  <!-- Billing rates table -->
  <div class="space-y-4">
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
              <td class="px-4 py-2">{rate.name}</td>
              <td class="px-4 py-2">
                <div class="flex gap-4">
                  <span class="text-sm">
                    Rate: ${rate.rate}/hr (${(rate.rate / 60).toFixed(2)}/min)
                  </span>
                </div>
              </td>
              <td class="px-4 py-2">{rate.description || '—'}</td>
              <td class="px-4 py-2 text-center">{rate.isDefault ? '✓' : ''}</td>
              <td class="px-4 py-2 text-right">
                <div class="flex justify-end space-x-2">
                  <button
                    class="table-action-button-primary"
                    on:click={() => startEdit(rate)}
                  >
                    Edit
                  </button>
                  <button
                    class="table-action-button-danger"
                    on:click={() => handleDeleteRate(rate)}
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
  title={editingRate ? 'Edit Billing Rate' : 'New Billing Rate'}
  width="max-w-lg"
  on:close={cancelForm}
>
  <form on:submit|preventDefault={editingRate ? handleUpdateRate : handleCreateRate} class="p-6">
    <div class="form-group space-y-4">
      <div class="form-field">
        <label for="rateName" class="form-label">Name</label>
        <input
          id="rateName"
          type="text"
          bind:value={currentName}
          on:input={(e) => updateField('name', e.currentTarget.value)}
          class="form-input"
          required
        />
      </div>

      <div class="form-field">
        <label for="rateAmount" class="form-label">Rate ($/hr)</label>
        <input
          id="rateAmount"
          type="number"
          step="0.01"
          min="0"
          bind:value={currentRate}
          on:input={(e) => updateField('rate', parseFloat(e.currentTarget.value))}
          class="form-input"
          required
        />
      </div>

      <div class="form-field">
        <label for="rateDescription" class="form-label">Description</label>
        <textarea
          id="rateDescription"
          bind:value={currentDescription}
          on:input={(e) => updateField('description', e.currentTarget.value)}
          class="form-textarea"
          rows="2"
        ></textarea>
      </div>

      <div class="form-field">
        <label class="inline-flex items-center">
          <input
            type="checkbox"
            bind:checked={currentIsDefault}
            on:change={(e) => updateField('isDefault', e.currentTarget.checked)}
            class="form-checkbox"
          />
          <span class="ml-2">Default Rate</span>
        </label>
      </div>
    </div>

    <div class="flex justify-end gap-3 mt-6">
      <button type="button" class="btn btn-secondary" on:click={cancelForm}>
        Cancel
      </button>
      <button type="submit" class="btn btn-primary">
        {editingRate ? 'Save Changes' : 'Create Rate'}
      </button>
    </div>
  </form>
</Modal>