<script lang="ts">
  import { writable } from 'svelte/store';
  import type { Client } from '$lib/types';
  import ClientList from '$lib/components/ClientList.svelte';
  import ClientForm from '$lib/components/ClientForm.svelte';

  // State
  let editingClient = writable<Client | null>(null);
  let showForm = writable<boolean>(false);

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

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Clients</h1>
    <button
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      onclick={() => showForm.set(true)}
    >
      Add New Client
    </button>
  </div>
  
  {#if $showForm}
    <div class="mb-8">
      <ClientForm
        editClient={$editingClient}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  {/if}
  
  <ClientList onEdit={handleEdit} />
</div>