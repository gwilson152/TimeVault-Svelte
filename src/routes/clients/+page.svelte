<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard, ClientForm, ClientList, Modal } from '$lib/components';

  // State
  let editingClient = writable<Client | null>(null);
  let showForm = writable<boolean>(false);
  let isLoading = writable<boolean>(true);

  // Load client data on component mount
  onMount(async () => {
    try {
      await clientStore.load(true); // Force refresh
      isLoading.set(false);
    } catch (error) {
      console.error('Failed to load clients:', error);
      isLoading.set(false);
    }
  });

  // Event handlers
  function handleEdit(client: Client) {
    editingClient.set(client);
    showForm.set(true);
  }

  function handleSave() {
    editingClient.set(null);
    showForm.set(false);
  }

  function handleCancel() {
    editingClient.set(null);
    showForm.set(false);
  }
</script>

<div class="space-y-6">
  <GlassCard className="p-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h1 class="text-2xl font-bold">Clients</h1>
      <button
        class="btn btn-primary"
        on:click={() => showForm.set(true)}
      >
        Add New Client
      </button>
    </div>
  </GlassCard>
  
  {#if $isLoading}
    <GlassCard className="p-6">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading clients...</div>
      </div>
    </GlassCard>
  {:else}
    <GlassCard className="p-0 overflow-hidden">
      <ClientList onEdit={handleEdit} />
    </GlassCard>
  {/if}
</div>

<Modal
  open={$showForm}
  title={$editingClient ? 'Edit Client' : 'New Client'}
  width="max-w-2xl"
  on:close={handleCancel}
>
  <div class="p-6">
    <ClientForm
      editClient={$editingClient}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  </div>
</Modal>