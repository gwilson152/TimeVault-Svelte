<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import type { Client } from '$lib/types';
  import { clientStore } from '$lib/stores/clientStore';
  import { GlassCard } from '$lib/components';
  import ClientList from '$lib/components/ClientList.svelte';
  import ClientForm from '$lib/components/ClientForm.svelte';

  // State
  let editingClient = writable<Client | null>(null);
  let showForm = writable<boolean>(false);
  let isLoading = writable<boolean>(true);

  // Load client data on component mount
  onMount(async () => {
    try {
      await clientStore.load();
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

<div class="container mx-auto px-4 py-8 space-y-6">
  <GlassCard class="p-6">
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
  
  {#if $showForm}
    <GlassCard class="p-6">
      <ClientForm
        editClient={$editingClient}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </GlassCard>
  {/if}
  
  {#if $isLoading}
    <GlassCard class="p-6">
      <div class="text-center py-12">
        <div class="text-gray-400 animate-pulse">Loading clients...</div>
      </div>
    </GlassCard>
  {:else}
    <GlassCard class="p-0 overflow-hidden">
      <ClientList onEdit={handleEdit} />
    </GlassCard>
  {/if}
</div>