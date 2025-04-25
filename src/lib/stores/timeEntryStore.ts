import { writable, derived } from 'svelte/store';
import type { TimeEntry, NewTimeEntry } from '$lib/types';
import * as api from '$lib/services/api';
import { clientStore } from './clientStore';

function createTimeEntryStore() {
  const store = writable<TimeEntry[]>([]);
  let initialized = false;

  const { subscribe, set, update } = store;

  return {
    subscribe,
    
    async load() {
      if (initialized) {
        console.log('Time entries already loaded, skipping');
        return;
      }
      
      try {
        console.log('Loading time entries...');
        const entries = await api.getTimeEntries();
        console.log(`Loaded ${entries.length} time entries:`, entries);
        
        // Ensure entries have proper Date objects
        const processedEntries = entries.map(entry => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        }));
        
        set(processedEntries);
        initialized = true;
      } catch (error) {
        console.error('Failed to load time entries:', error);
        throw error;
      }
    },
    
    async add(newEntry: NewTimeEntry) {
      try {
        console.log('Adding new time entry:', newEntry);
        const entry = await api.createTimeEntry(newEntry);
        
        // Ensure dates are proper Date objects
        const processedEntry = {
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt)
        };
        
        update(entries => {
          const updated = [...entries, processedEntry];
          console.log('Store updated with new entry:', updated);
          return updated;
        });
        return processedEntry;
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
    const entriesWithInfo = $timeEntryStore.map(entry => {
      const client = entry.clientId 
        ? $clientStore.find(c => c.id === entry.clientId) 
        : null;
      
      return {
        ...entry,
        clientName: client?.name || null,
        clientRate: client?.rate || null
      };
    });

    console.log('Updated entriesWithClientInfo:', {
      timeEntries: $timeEntryStore.length,
      clients: $clientStore.length,
      derivedEntries: entriesWithInfo.length
    });

    return entriesWithInfo;
  }
);