<script lang="ts">
  import TimeEntryForm from '$lib/components/TimeEntryForm.svelte';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import type { TimeEntry } from '$lib/types';
  import { superForm } from 'sveltekit-superforms/client';
  import type { PageData } from './$types';
  import { clientStore } from '$lib/stores/clientStore';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { onMount } from 'svelte';

  const { data } = $props<{ data: PageData }>();

  let showForm = $state(false);
  let editEntry = $state<TimeEntry | null>(null);
  let superFormData = $state(superForm(data.form));
  
  // Calculate total hours
  const totalHours = $derived(
    $timeEntryStore.reduce((sum, entry) => sum + entry.hours, 0)
  );

  // Load data when component mounts
  onMount(async () => {
    await Promise.all([
      timeEntryStore.load(),
      clientStore.load()
    ]);
  });

  // Handle create new entry
  function handleCreateEntry() {
    editEntry = null;
    showForm = true;
    // Scroll to form
    setTimeout(() => {
      document.getElementById('entry-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Handle edit button click from the list
  function handleEdit(entry: TimeEntry) {
    editEntry = entry;
    showForm = true;
    // Scroll to form
    setTimeout(() => {
      document.getElementById('entry-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Handle save completion
  function handleSave() {
    editEntry = null;
    showForm = false;
  }

  // Handle cancel edit
  function handleCancel() {
    editEntry = null;
    showForm = false;
  }
</script>

<div class="container mx-auto px-4">
  <section class="mb-8">
    <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card-glass">
        <h3 class="text-xl font-semibold mb-3">Time Entries</h3>
        <div class="text-4xl font-bold mb-2">{$timeEntryStore.length}</div>
        <p class="text-text-blue-300">Total entries tracked</p>
      </div>
      
      <div class="card-glass">
        <h3 class="text-xl font-semibold mb-3">Clients</h3>
        <div class="text-4xl font-bold mb-2">{$clientStore.length}</div>
        <p class="text-text-blue-300">Active clients</p>
      </div>
      
      <div class="card-glass">
        <h3 class="text-xl font-semibold mb-3">Hours Tracked</h3>
        <div class="text-4xl font-bold mb-2">{totalHours.toFixed(1)}</div>
        <p class="text-text-blue-300">Total hours logged</p>
      </div>
    </div>
  </section>

  <section>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-semibold">Recent Time Entries</h2>
      <button class="btn btn-primary" onclick={handleCreateEntry}>
        New Entry
      </button>
    </div>
    
    {#if showForm}
      <div class="card-glass mb-6" id="entry-form">
        <TimeEntryForm 
          form={superFormData}
          editEntry={editEntry}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    {/if}
    
    <div class="card-glass">
      <TimeEntryList onEdit={handleEdit} />
    </div>
  </section>
</div>