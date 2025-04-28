<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ticketNoteStore } from '$lib/stores/ticketNoteStore';
  import type { TicketNote } from '$lib/types';
  
  export let ticketId: string;
  export let userId: string = ''; // The current user ID for creating notes
  export let showInternalNotes: boolean = true; // Whether to display internal notes (agent/admin only)
  
  let notes: TicketNote[] = [];
  let newNoteContent: string = '';
  let isInternalNote: boolean = false;
  let isLoading: boolean = true;
  let error: string | null = null;
  
  // We'll avoid using the store subscription directly to prevent circular updates
  function loadNotes() {
    isLoading = true;
    ticketNoteStore.loadForTicket(ticketId)
      .then(() => {
        notes = ticketNoteStore.getForTicket(ticketId);
        isLoading = false;
      })
      .catch(err => {
        console.error('Failed to load ticket notes:', err);
        error = 'Failed to load notes';
        isLoading = false;
      });
  }
  
  onMount(() => {
    loadNotes();
  });
  
  onDestroy(() => {
    ticketNoteStore.clear();
  });
  
  async function addNote() {
    if (!newNoteContent.trim()) return;
    
    try {
      const newNote = await ticketNoteStore.add({
        ticketId,
        content: newNoteContent,
        isInternal: isInternalNote,
        userId
      });
      
      // Manually update our local notes array instead of relying on the store subscription
      notes = [...notes, newNote];
      
      // Reset form after successful submission
      newNoteContent = '';
      isInternalNote = false;
    } catch (err) {
      console.error('Failed to add note:', err);
      error = 'Failed to add note';
    }
  }
  
  function formatDate(date: Date | string) {
    const noteDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - noteDate.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    
    // Today, show time only
    if (noteDate.toDateString() === now.toDateString()) {
      return noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Yesterday
    else if (diffDays === 1) {
      return 'Yesterday at ' + noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // This week, show day name and time
    else if (diffDays < 7) {
      return noteDate.toLocaleDateString([], { weekday: 'short' }) + ' at ' + 
        noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Older, show full date
    else {
      return noteDate.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: noteDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      });
    }
  }
</script>

<!-- Add Note Form -->
<div class="mb-6">
  <form 
    class="form-group bg-gray-800/20 rounded-lg p-4 border border-gray-700" 
    on:submit|preventDefault={addNote}
  >
    <div class="form-field">
      <textarea
        class="form-textarea w-full"
        placeholder="Add a note or reply..."
        rows="2"
        bind:value={newNoteContent}
      ></textarea>
    </div>
    
    <!-- Internal note toggle -->
    {#if showInternalNotes}
      <div class="form-field mt-2">
        <label class="flex items-center space-x-2">
          <input 
            type="checkbox" 
            class="form-checkbox"
            bind:checked={isInternalNote}
          >
          <span class="text-sm text-amber-300">Internal note (only visible to staff)</span>
        </label>
      </div>
    {/if}
    
    <div class="flex justify-end mt-2">
      <button type="submit" class="form-submit text-sm py-1.5 px-4" disabled={!newNoteContent.trim()}>
        Add Note
      </button>
    </div>
  </form>
</div>

<!-- Notes Timeline -->
{#if isLoading}
  <div class="flex justify-center py-6">
    <div class="text-gray-400 animate-pulse">Loading notes...</div>
  </div>
{:else if error}
  <div class="text-red-500 text-center py-4">
    {error}
  </div>
{:else if notes.length === 0}
  <div class="bg-gray-800/20 rounded-lg p-6 text-center border border-gray-700">
    <p class="text-gray-400">No notes yet. Add the first note above.</p>
  </div>
{:else}
  <div class="notes-timeline space-y-4">
    {#each notes as note (note.id)}
      <!-- Skip internal notes if showInternalNotes is false -->
      {#if !note.isInternal || showInternalNotes}
        <div class="flex group">
          <!-- Timeline connector -->
          <div class="mr-4 relative">
            <div class="absolute top-0 bottom-0 left-2.5 w-px bg-gray-700"></div>
            <div class={`w-5 h-5 rounded-full mt-1.5 flex items-center justify-center ${note.isInternal ? 'bg-amber-500' : 'bg-blue-500'}`}>
              {#if note.isInternal}
                <span class="text-xs text-amber-950">i</span>
              {/if}
            </div>
          </div>
          
          <!-- Note content -->
          <div class={`flex-1 pb-4 ${note.isInternal ? 'opacity-80' : ''}`}>
            <div class="flex justify-between items-center mb-1">
              <div class="font-medium">
                {note.user?.name || 'Unknown User'}
                {#if note.isInternal}
                  <span class="ml-2 text-xs font-normal px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    Internal
                  </span>
                {/if}
              </div>
              <div class="text-xs text-gray-400">
                {formatDate(note.createdAt)}
              </div>
            </div>
            <div class="bg-gray-800/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
              {note.content}
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}