import { writable, derived } from 'svelte/store';
import type { TimeEntry, NewTimeEntry } from '$lib/types';
import * as api from '$lib/services/api';
import { clientStore } from './clientStore';

function createTimeEntryStore() {
  const { subscribe, set, update } = writable<TimeEntry[]>([]);

  return {
    subscribe,
    
    async load() {
      try {
        const entries = await api.getTimeEntries();
        set(entries);
      } catch (error) {
        console.error('Failed to load time entries:', error);
      }
    },
    
    async add(newEntry: NewTimeEntry) {
      try {
        const entry = await api.createTimeEntry(newEntry);
        update(entries => [...entries, entry]);
        return entry;
      } catch (error) {
        console.error('Failed to add time entry:', error);
        throw error;
      }
    },
    
    async update(id: string, updatedEntry: Partial<TimeEntry>) {
      try {
        const entry = await api.updateTimeEntry(id, updatedEntry);
        update(entries => entries.map(e => e.id === id ? entry : e));
        return entry;
      } catch (error) {
        console.error('Failed to update time entry:', error);
        throw error;
      }
    },
    
    async remove(id: string) {
      try {
        await api.deleteTimeEntry(id);
        update(entries => entries.filter(e => e.id !== id));
      } catch (error) {
        console.error('Failed to delete time entry:', error);
        throw error;
      }
    },
    
    getByClientId(clientId: string): TimeEntry[] {
      let clientEntries: TimeEntry[] = [];
      update(entries => {
        clientEntries = entries.filter(entry => entry.clientId === clientId);
        return entries;
      });
      return clientEntries;
    },
    
    getUnbilledByClientId(clientId: string): TimeEntry[] {
      let unbilledEntries: TimeEntry[] = [];
      update(entries => {
        unbilledEntries = entries.filter(
          entry => entry.clientId === clientId && entry.billable && !entry.billed
        );
        return entries;
      });
      return unbilledEntries;
    },
    
    async markAsBilled(entryIds: string[]) {
      try {
        // The API handles marking entries as billed during invoice generation
        update(entries => 
          entries.map(entry => 
            entryIds.includes(entry.id) 
              ? { ...entry, billed: true } 
              : entry
          )
        );
      } catch (error) {
        console.error('Failed to mark entries as billed:', error);
        throw error;
      }
    }
  };
}

export const timeEntryStore = createTimeEntryStore();

// Derived store for entries with client information
export const entriesWithClientInfo = derived(
  [timeEntryStore, clientStore],
  ([$timeEntryStore, $clientStore]) => {
    return $timeEntryStore.map(entry => {
      const client = entry.clientId 
        ? $clientStore.find(c => c.id === entry.clientId) 
        : null;
      
      return {
        ...entry,
        clientName: client?.name || null,
        clientRate: client?.rate || null
      };
    });
  }
);