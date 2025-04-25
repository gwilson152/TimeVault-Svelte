<script lang="ts">
  import { page } from '$app/stores';
  import { clientStore } from '$lib/stores/clientStore';
  import ClientForm from '$lib/components/ClientForm.svelte';
  import type { Client } from '$lib/types';
  import { goto } from '$app/navigation';

  $: client = $clientStore.find(c => c.id === $page.params.id);

  function handleSave(client: Client) {
    goto(`/clients/${client.id}`);
  }

  function handleCancel() {
    goto(`/clients/${$page.params.id}`);
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a 
      href="/clients/{$page.params.id}"
      class="text-blue-600 hover:text-blue-800"
    >
      ← Back to Client
    </a>
  </div>

  {#if client}
    <ClientForm 
      editClient={client}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  {:else}
    <div class="text-center py-12">
      <h1 class="text-2xl font-bold text-gray-900">Client not found</h1>
      <a href="/clients" class="mt-4 text-blue-600 hover:underline">Back to Clients</a>
    </div>
  {/if}
</div>