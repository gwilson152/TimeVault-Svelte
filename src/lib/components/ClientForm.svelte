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
    type: 'business',
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
      
      props.editClient.billingRateOverrides.forEach((override: ClientBillingRateOverride) => {
        overrides[override.baseRateId] = {
          baseRateId: override.baseRateId,
          overrideType: override.overrideType,
          value: override.value
        };
        types[override.baseRateId] = override.overrideType;
      });
      
      overrideForm.set(overrides);
      overrideTypes.set(types);
    } else {
      form.set(initialState);
      overrideForm.set({});
      overrideTypes.set({});
    }
  });

  // Get potential parent clients (avoid circular references and filter individual clients)
  const availableParents = $derived($clientStore.filter(c => {
    // Filter out individual clients as they cannot be parents
    if (c.type === 'individual') return false;
    
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

  // Add reactivity to ensure type and parentId are properly set
  $effect(() => {
    // If client type is individual, ensure parentId is null
    if ($form.type === 'individual' && $form.parentId) {
      form.update(f => ({...f, parentId: null}));
    }
  });

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

  const clientTypes: ClientType[] = ['business', 'individual', 'organization'];
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
          disabled={$form.type === 'individual'}
        >
          <option value="">No parent client</option>
          {#each availableParents as client}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
        {#if $form.type === 'individual'}
          <span class="form-hint">Individual clients cannot have a parent.</span>
        {/if}
      </div>
    </div>

    {#if $clientStore.length > 0}
      <div class="form-section mt-6">
        <h3 class="text-lg font-medium mb-4">Billing Rate Overrides</h3>
        <p class="form-helper mb-4">
          Set custom billing rates for specific clients. You can override the standard rate with either a percentage or fixed amount.
        </p>
        
        <div class="space-y-4">
          {#each $clientStore as client}
            <div class="card-dense mb-3">
              <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex-1">
                  <label for="client-{client.id}-name" class="text-sm font-medium text-gray-700 mb-1 block">
                    {client.name}
                  </label>
                  <input type="hidden" id="client-{client.id}-name" value={client.name} />
                  <div class="text-xs text-gray-500">Standard rate: {formatCurrency(client.rate)}/hr</div>
                </div>
                
                <div class="flex gap-3 items-start">
                  <div class="w-32">
                    <label for="override-type-{client.id}" class="text-sm font-medium text-gray-700 mb-1 block">
                      Type
                    </label>
                    <select
                      id="override-type-{client.id}"
                      class="form-control"
                      value={$overrideTypes[client.id] || ''}
                      onchange={(e) => {
                        const type = e.currentTarget.value as 'percentage' | 'fixed' | '';
                        if (type === '') {
                          overrideForm.update(form => ({
                            ...form,
                            [client.id]: undefined
                          }));
                        } else {
                          overrideForm.update(form => ({
                            ...form,
                            [client.id]: {
                              baseRateId: client.id,
                              overrideType: type,
                              value: 0
                            }
                          }));
                        }
                        overrideTypes.update(types => ({
                          ...types,
                          [client.id]: type
                        }));
                      }}
                    >
                      <option value="">No override</option>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Rate</option>
                    </select>
                  </div>
                  
                  <div class="w-32">
                    <label for="override-value-{client.id}" class="text-sm font-medium text-gray-700 mb-1 block">
                      {$overrideTypes[client.id] === 'percentage' ? 'Percentage' : 'Amount'}
                    </label>
                    <div class="relative">
                      <input
                        id="override-value-{client.id}"
                        type="number"
                        step="0.01"
                        class="form-control pr-6"
                        disabled={!$overrideTypes[client.id]}
                        value={$overrideForm[client.id]?.value ?? 0}
                        onchange={(e) => {
                          if ($overrideForm[client.id]) {
                            overrideForm.update(form => ({
                              ...form,
                              [client.id]: {
                                ...form[client.id]!,
                                value: parseFloat(e.currentTarget.value)
                              }
                            }));
                          }
                        }}
                      />
                      {#if $overrideTypes[client.id] === 'percentage'}
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      {/if}
                    </div>
                    {#if $overrideForm[client.id]?.overrideType === 'percentage' && $overrideForm[client.id]?.value !== undefined}
                      <div class="text-xs text-gray-500 mt-1">
                        = {formatCurrency(($overrideForm[client.id]?.value ?? 0) * client.rate / 100)}/hr
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
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