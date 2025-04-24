<script lang="ts">
  import { writable } from 'svelte/store';
  import TimeEntryForm from '$lib/components/TimeEntryForm.svelte';
  import TimeEntryList from '$lib/components/TimeEntryList.svelte';
  import type { TimeEntry } from '$lib/types';

  // State for editing an entry
  let editingEntry = writable<TimeEntry | null>(null);

  // Handle edit button click from the list
  function handleEdit(entry: TimeEntry) {
    editingEntry.set(entry);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('entry-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Handle save completion
  function handleSave() {
    editingEntry.set(null);
  }

  // Handle cancel edit
  function handleCancel() {
    editingEntry.set(null);
  }
</script>

<div class="space-y-8">
  <h1 class="text-2xl font-bold text-gray-800">Time Entries</h1>
  
  <section id="entry-form">
    <TimeEntryForm 
      editEntry={$editingEntry} 
      onSave={handleSave} 
      onCancel={handleCancel} 
    />
  </section>
  
  <section>
    <TimeEntryList onEdit={handleEdit} />
  </section>
</div>