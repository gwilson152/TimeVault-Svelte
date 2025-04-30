<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import { TicketStatusSettings, BillingRatesSettings, GlassCard } from '$lib/components';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Cog } from '@steeze-ui/heroicons';
  import { onMount } from 'svelte';

  let loading = true;
  let activeTab = 'tickets'; // or 'billing'

  onMount(async () => {
    try {
      await settingsStore.load();
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <GlassCard className="p-6">
    <div class="flex items-center space-x-3">
      <Icon src={Cog} class="w-8 h-8 text-blue-500" />
      <h1 class="text-2xl font-bold">Settings</h1>
    </div>
  </GlassCard>

  {#if loading}
    <GlassCard className="p-6">
      <div class="animate-pulse text-gray-400 text-center">Loading settings...</div>
    </GlassCard>
  {:else}
    <!-- Navigation Tabs -->
    <GlassCard className="p-4">
      <div class="flex gap-4 border-b border-white/10">
        <button
          class="px-4 py-2 font-medium transition-colors relative {activeTab === 'tickets' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}"
          onclick={() => activeTab = 'tickets'}
        >
          Ticket Settings
          {#if activeTab === 'tickets'}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          {/if}
        </button>
        <button
          class="px-4 py-2 font-medium transition-colors relative {activeTab === 'billing' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}"
          onclick={() => activeTab = 'billing'}
        >
          Billing Settings
          {#if activeTab === 'billing'}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          {/if}
        </button>
      </div>
    </GlassCard>

    <!-- Content Section -->
    <div class="space-y-6">
      {#if activeTab === 'tickets'}
        <TicketStatusSettings />
      {:else}
        <BillingRatesSettings />
      {/if}
    </div>
  {/if}
</div>