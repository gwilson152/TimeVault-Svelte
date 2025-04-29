<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import type { TicketNote, NewTicketNote } from '$lib/types';
  import { userStore, userPermissions } from '$lib/stores/userStore';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { PaperAirplane, LockClosed } from '@steeze-ui/heroicons';
  import * as api from '$lib/services/api';
  
  const props = $props<{
    ticketId: string;
    userId: string;
    showInternalNotes: boolean;
  }>();
  
  // State
  let notes = $state<TicketNote[]>([]);
  let newNote = $state('');
  let isInternal = $state(false);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  
  // Load notes on component mount
  onMount(async () => {
    if (!props.ticketId) return;
    await loadNotes();
  });
  
  // Refresh notes when ticketId changes
  $effect(() => {
    if (props.ticketId) {
      loadNotes();
    }
  });
  
  // Check user permissions
  const canCreateInternalNote = $derived(
    props.showInternalNotes && $userPermissions.canViewInternalNotes
  );
  
  // Load notes for the current ticket
  async function loadNotes() {
    if (!props.ticketId) return;
    
    try {
      isLoading = true;
      error = null;
      
      const response = await fetch(`/api/tickets/${props.ticketId}/notes`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load notes' }));
        throw new Error(errorData.error || 'Failed to load notes');
      }
      
      const loadedNotes = await response.json();
      notes = loadedNotes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      }));
    } catch (err) {
      console.error('Failed to load notes:', err);
      error = err instanceof Error ? err.message : 'Failed to load notes';
    } finally {
      isLoading = false;
    }
  }
  
  // Submit a new note
  async function handleSubmit() {
    if (!newNote.trim() || !props.ticketId || !props.userId) return;
    
    try {
      isSubmitting = true;
      error = null;
      
      const noteData: NewTicketNote = {
        ticketId: props.ticketId,
        content: newNote.trim(),
        isInternal,
        userId: props.userId
      };
      
      const response = await fetch(`/api/tickets/${props.ticketId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add note' }));
        throw new Error(errorData.error || 'Failed to add note');
      }
      
      // Reset form and reload notes
      newNote = '';
      isInternal = false;
      await loadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
      error = err instanceof Error ? err.message : 'Failed to add note';
    } finally {
      isSubmitting = false;
    }
  }
  
  // Format date for display
  function formatDate(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div>
  {#if error}
    <div class="bg-red-500/20 border border-red-400 text-red-300 px-4 py-3 rounded mb-4">
      <p>{error}</p>
    </div>
  {/if}
  
  <form onsubmit={handleSubmit} class="mb-6">
    <div class="form-field">
      <textarea
        bind:value={newNote}
        placeholder="Add a note or comment..."
        rows="3"
        class="form-textarea"
      ></textarea>
    </div>
    
    <div class="mt-2 flex items-center justify-between">
      {#if canCreateInternalNote}
        <label class="flex items-center text-sm">
          <input 
            type="checkbox" 
            bind:checked={isInternal}
            class="form-checkbox mr-2"
          />
          <span class="flex items-center gap-1">
            <Icon src={LockClosed} class="h-3 w-3" /> Internal note (only visible to staff)
          </span>
        </label>
      {:else}
        <div></div>
      {/if}
      
      <button 
        type="submit" 
        class="btn btn-primary btn-sm flex items-center gap-1 {isSubmitting ? 'loading' : ''}"
        disabled={!newNote.trim() || isSubmitting}
      >
        <Icon src={PaperAirplane} class="h-4 w-4" />
        Add Note
      </button>
    </div>
  </form>
  
  {#if isLoading}
    <div class="py-8 text-center">
      <span class="loading loading-spinner"></span>
      <p class="mt-2 text-gray-400">Loading notes...</p>
    </div>
  {:else if notes.length === 0}
    <div class="py-8 text-center text-gray-400">
      No notes or comments yet.
    </div>
  {:else}
    <div class="space-y-4">
      {#each notes.filter(note => !note.isInternal || props.showInternalNotes) as note (note.id)}
        <div class="border border-gray-700/50 rounded-lg p-4 {note.isInternal ? 'bg-blue-900/20 border-blue-800/30' : 'bg-gray-800/30'}">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium">{note.user?.name || 'Unknown user'}</div>
              <div class="text-sm text-gray-400">{formatDate(note.createdAt)}</div>
            </div>
            
            {#if note.isInternal}
              <span class="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                <Icon src={LockClosed} class="h-3 w-3" />
                <span>Internal</span>
              </span>
            {/if}
          </div>
          
          <div class="mt-2 whitespace-pre-wrap">
            {note.content}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>