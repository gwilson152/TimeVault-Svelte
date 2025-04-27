<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ticketNoteStore } from '$lib/stores/ticketNoteStore';
  import type { TicketNote } from '$lib/types';
  import GlassCard from './GlassCard.svelte';
  
  export let ticketId: string;
  export let userId: string = ''; // The current user ID for creating notes
  export let showInternalNotes: boolean = true; // Whether to display internal notes (agent/admin only)
  
  let notes: TicketNote[] = [];
  let newNoteContent: string = '';
  let isInternalNote: boolean = false;
  let isLoading: boolean = true;
  let error: string | null = null;
  
  // Subscribe to the store
  const unsubscribe = ticketNoteStore.subscribe((value) => {
    notes = value;
  });
  
  onMount(async () => {
    try {
      await ticketNoteStore.loadForTicket(ticketId);
      isLoading = false;
    } catch (e) {
      error = 'Failed to load ticket notes';
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    unsubscribe();
    ticketNoteStore.clear();
  });
  
  async function addNote() {
    if (!newNoteContent.trim()) return;
    
    try {
      await ticketNoteStore.add({
        ticketId,
        content: newNoteContent,
        isInternal: isInternalNote,
        userId
      });
      
      // Reset form after successful submission
      newNoteContent = '';
      isInternalNote = false;
    } catch (e) {
      error = 'Failed to add note';
    }
  }
  
  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
</script>

<div class="space-y-4">
  <GlassCard className="p-4">
    <h3 class="text-lg font-medium mb-4">Add Note</h3>
    
    <form class="form-group" on:submit|preventDefault={addNote}>
      <div class="form-field">
        <textarea
          class="form-textarea w-full"
          placeholder="Enter your note here..."
          rows="3"
          bind:value={newNoteContent}
        ></textarea>
      </div>
      
      <!-- Internal note toggle -->
      {#if showInternalNotes}
        <div class="form-field">
          <label class="flex items-center space-x-2">
            <input 
              type="checkbox" 
              class="form-checkbox"
              bind:checked={isInternalNote}
            >
            <span>Internal note (only visible to staff)</span>
          </label>
        </div>
      {/if}
      
      <div class="flex justify-end">
        <button type="submit" class="form-submit" disabled={!newNoteContent.trim()}>
          Add Note
        </button>
      </div>
    </form>
  </GlassCard>
  
  <!-- Notes List -->
  <div class="space-y-3">
    <h3 class="text-lg font-medium">Notes</h3>
    
    {#if isLoading}
      <div class="text-center py-8">
        <div class="text-gray-400 animate-pulse">Loading notes...</div>
      </div>
    {:else if error}
      <div class="text-red-500 text-center py-4">
        {error}
      </div>
    {:else if notes.length === 0}
      <div class="text-gray-500 text-center py-8">
        No notes yet.
      </div>
    {:else}
      {#each notes as note}
        <!-- Skip internal notes if showInternalNotes is false -->
        {#if !note.isInternal || showInternalNotes}
          <GlassCard className={note.isInternal ? 'p-4 border-l-4 border-amber-500' : 'p-4'}>
            <div class="flex flex-col space-y-3">
              <div class="flex justify-between">
                <div class="flex items-center space-x-2">
                  <span class="font-medium">{note.user?.name || 'Unknown User'}</span>
                  
                  {#if note.isInternal}
                    <span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                      Internal
                    </span>
                  {/if}
                </div>
                
                <div class="text-sm text-gray-500">
                  {formatDate(note.createdAt)}
                </div>
              </div>
              
              <!-- Note content with line breaks preserved -->
              <div class="whitespace-pre-wrap">
                {note.content}
              </div>
            </div>
          </GlassCard>
        {/if}
      {/each}
    {/if}
  </div>
</div>