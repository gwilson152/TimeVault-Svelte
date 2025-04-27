import { writable } from 'svelte/store';
import type { TicketNote, NewTicketNote } from '$lib/types';
import { get as httpGet, post } from '$lib/services/api';

function createTicketNoteStore() {
  const { subscribe, set, update } = writable<TicketNote[]>([]);
  
  return {
    subscribe,
    
    // Load all notes for a specific ticket
    async loadForTicket(ticketId: string) {
      try {
        const notes = await httpGet<TicketNote[]>(`/tickets/${ticketId}/notes`);
        set(notes);
        return notes;
      } catch (error) {
        console.error('Failed to load ticket notes:', error);
        set([]);
        throw error;
      }
    },
    
    // Add a new note to a ticket
    async add(note: NewTicketNote) {
      try {
        const newNote = await post<TicketNote>(`/tickets/${note.ticketId}/notes`, note);
        update(notes => [newNote, ...notes]);
        return newNote;
      } catch (error) {
        console.error('Failed to add ticket note:', error);
        throw error;
      }
    },
    
    // Clear the store (used when changing tickets or unmounting)
    clear() {
      set([]);
    }
  };
}

export const ticketNoteStore = createTicketNoteStore();