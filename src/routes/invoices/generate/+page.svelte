<script lang="ts">
  import { page } from '$app/stores';
  import { GlassCard } from '$lib/components';
  import { InvoiceGenerator } from '$lib/components';

  const clientId = $derived($page.url.searchParams.get('clientId') || undefined);
</script>

<div class="container mx-auto px-4 py-8">
  <GlassCard className="p-6 mb-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold">Generate Invoice</h1>
        <p class="text-gray-400">Create a new invoice from unbilled time entries and additional items</p>
      </div>
    </div>
  </GlassCard>

  <InvoiceGenerator {clientId} />
</div>