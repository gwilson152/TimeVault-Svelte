<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Client, NewClient, ClientType, NewBillingRateOverride, ClientBillingRateOverride } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  
  const props = $props<{
    editClient: Client | null;
    onSave: ((client: Client) => void) | null;
    onCancel: (() => void) | null;
  }>();

  // Initialize form state
  const initialState: NewClient = {
    name: '',
    type: 'individual',
    parentId: null
  };

  let form = writable<NewClient>(initialState);
  
  $effect(() => {
    if (props.editClient) {
      form.set({
        name: props.editClient.name,
        type: props.editClient.type,
        parentId: props.editClient.parentId
      });

      const overrides: Record<string, NewBillingRateOverride> = {};
      const types: Record<string, 'percentage' | 'fixed' | ''> = {};
      
      // props.editClient.billingRateOverrides.forEach((override: ClientBillingRateOverride) => {
      //   overrides[override.baseRateId] = {
      //     baseRateId: override.baseRateId,
      //     overrideType: override.overrideType,
      //     value: override.value
      //   };
      //   types[override.baseRateId] = override.overrideType;
      // });
      
      overrideForm.set(overrides);
      overrideTypes.set(types);
    } else {
      form.set(initialState);
      overrideForm.set({});
      overrideTypes.set({});
    }
  });

  // Filter out current client from available parents
  const availableParents = $derived($clientStore.filter(c => {
    // Filter to only show business or container clients 
    if (!['business', 'container'].includes(c.type)) return false;
    
    if (!props.editClient) return true;

    // Can't select self or any descendants as parent
    const isDescendant = (parentId: string | null): boolean => {
      if (!parentId) return false;
      if (parentId === props.editClient?.id) return true;
      const parent = $clientStore.find(c => c.id === parentId);
      return parent ? isDescendant(parent.parentId) : false;
    };
    return c.id !== props.editClient.id && !isDescendant(c.id);
  }));
  
  let overrideForm = writable<Record<string, NewBillingRateOverride | undefined>>({});
  let overrideTypes = writable<Record<string, 'percentage' | 'fixed' | ''>>({});

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    
    if (!$form.name) {
      alert('Please enter a client name');
      return;
    }
    
    try {
      // Ensure parentId is null if empty string
      const parentId = $form.parentId === '' ? null : $form.parentId;
      
      const clientData = {
        ...$form,
        parentId: parentId, // Explicitly set the properly formatted parentId
        billingRateOverrides: Object.values($overrideForm).filter((o): o is NewBillingRateOverride => o !== undefined)
      };

      const result = props.editClient 
        ? await clientStore.update(props.editClient.id, clientData)
        : await clientStore.add(clientData);
      
      form.set(initialState);
      overrideForm.set({});
      overrideTypes.set({});
      
      if (props.onSave) {
        props.onSave(result);
      }
    } catch (err) {
      console.error('Failed to save client:', err);
      alert('Failed to save client. Please try again.');
    }
  }
  
  function handleCancel() {
    form.set(initialState);
    overrideForm.set({});
    overrideTypes.set({});
    if (props.onCancel) {
      props.onCancel();
    }
  }

  const clientTypes: ClientType[] = ['business', 'container', 'individual'];
</script>

<div class="form-section">
  <form onsubmit={handleSubmit} class="form-container">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="form-group">
        <label for="name" class="form-label">Client Name</label>
        <input
          id="name"
          type="text"
          class="form-control"
          bind:value={$form.name}
          required
        />
      </div>

      <div class="form-group">
        <label for="type" class="form-label">Client Type</label>
        <select
          id="type"
          class="form-control"
          bind:value={$form.type}
          required
        >
          {#each clientTypes as type}
            <option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
          {/each}
        </select>
        {#if $form.type === 'individual'}
          <span class="form-hint">Individual clients cannot have child clients.</span>
        {/if}
      </div>

      <div class="form-group">
        <label for="parentId" class="form-label">Parent Client</label>
        <select
          id="parentId"
          class="form-control"
          bind:value={$form.parentId}
        >
          <option value="">No parent client</option>
          {#each availableParents as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
        <span class="form-hint">Only business and container clients can be parent clients.</span>
      </div>
    </div>
    
    <div class="flex justify-end space-x-3 mt-6">
      {#if props.editClient}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleCancel}
        >
          Cancel
        </button>
      {/if}
      
      <button
        type="submit"
        class="btn btn-primary"
      >
        {props.editClient ? 'Save Changes' : 'Create Client'}
      </button>
    </div>
  </form>
</div>