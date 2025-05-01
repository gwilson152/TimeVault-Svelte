<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Client, NewClient, ClientType, NewBillingRateOverride, ClientBillingRateOverride } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { findParentByEmailDomain, getAvailableContainers } from '$lib/utils/clientUtils';
  
  const props = $props<{
    editClient: Client | null;
    onSave: ((client: Client) => void) | null;
    onCancel: (() => void) | null;
  }>();

  // Initialize form state
  const initialState: NewClient = {
    name: '',
    type: 'individual',
    parentId: null,
    description: '',
    email: '',
    phone: '',
    address: '',
    domains: [],
    rate: 0
  };

  let form = writable<NewClient>(initialState);
  let domainInput = $state('');

  // Update domain list
  function addDomain() {
    if (!domainInput) return;
    $form.domains = [...($form.domains || []), domainInput];
    domainInput = '';
  }

  function removeDomain(domain: string) {
    $form.domains = ($form.domains || []).filter(d => d !== domain);
  }

  $effect(() => {
    if (props.editClient) {
      form.set({
        name: props.editClient.name,
        type: props.editClient.type,
        parentId: props.editClient.parentId,
        description: props.editClient.description || '',
        email: props.editClient.email || '',
        phone: props.editClient.phone || '',
        address: props.editClient.address || '',
        domains: props.editClient.domains || [],
        rate: props.editClient.rate || 0
      });

      const overrides: Record<string, NewBillingRateOverride> = {};
      const types: Record<string, 'percentage' | 'fixed' | ''> = {};
      
      overrideForm.set(overrides);
      overrideTypes.set(types);
    } else {
      form.set(initialState);
      overrideForm.set({});
      overrideTypes.set({});
    }
  });

  // Effect to handle automatic parent assignment based on email
  $effect(() => {
    if ($form.type === 'individual' && $form.email && !$form.parentId) {
      const potentialParent = findParentByEmailDomain($clientStore, $form.email);
      if (potentialParent) {
        $form.parentId = potentialParent.id;
      }
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

  // Get available containers for the current parent
  const availableContainers = $derived(
    $form.parentId ? getAvailableContainers($clientStore, $form.parentId) : []
  );
  
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

      <div class="form-group">
        <label for="description" class="form-label">Description</label>
        <textarea
          id="description"
          class="form-control"
          bind:value={$form.description}
        ></textarea>
      </div>

      <div class="form-group">
        <label for="email" class="form-label">Email</label>
        <input
          id="email"
          type="email"
          class="form-control"
          bind:value={$form.email}
        />
      </div>

      <div class="form-group">
        <label for="phone" class="form-label">Phone</label>
        <input
          id="phone"
          type="tel"
          class="form-control"
          bind:value={$form.phone}
        />
      </div>

      <div class="form-group">
        <label for="address" class="form-label">Address</label>
        <textarea
          id="address"
          class="form-control"
          bind:value={$form.address}
        ></textarea>
      </div>

      <div class="form-group">
        <label for="rate" class="form-label">Rate</label>
        <input
          id="rate"
          type="number"
          class="form-control"
          bind:value={$form.rate}
        />
      </div>

      <div class="form-group">
        <label for="domains" class="form-label">Domains</label>
        <div class="flex items-center space-x-2">
          <input
            id="domainInput"
            type="text"
            class="form-control"
            bind:value={domainInput}
          />
          <button
            type="button"
            class="btn btn-secondary"
            onclick={addDomain}
          >
            Add
          </button>
        </div>
        <ul class="domain-list">
          {#each $form.domains as domain}
            <li class="domain-item">
              {domain}
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick={() => removeDomain(domain)}
              >
                Remove
              </button>
            </li>
          {/each}
        </ul>
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