import { writable, derived } from 'svelte/store';
import type { TimeEntry, NewTimeEntry } from '$lib/types';
import { v4 as uuidv4 } from 'uuid';
import { clientStore } from './clientStore';

// Sample initial data
const initialTimeEntries: TimeEntry[] = [
  {
    id: '1',
    description: 'Project planning',
    hours: 2.5,
    date: new Date('2025-04-20'),
    clientId: '1',
    billable: true,
    billed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    description: 'Development work',
    hours: 4,
    date: new Date('2025-04-21'),
    clientId: '1',
    billable: true,
    billed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    description: 'Client meeting',
    hours: 1,
    date: new Date('2025-04-22'),
    clientId: '2',
    billable: true,
    billed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    description: 'Internal documentation',
    hours: 3,
    date: new Date('2025-04-23'),
    clientId: null,
    billable: false,
    billed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

function createTimeEntryStore() {
  const { subscribe, update, set } = writable<TimeEntry[]>(initialTimeEntries);

  return {
    subscribe,
    
    add: (newEntry: NewTimeEntry) => {
      const now = new Date();
      const entry: TimeEntry = {
        id: uuidv4(),
        ...newEntry,
        billed: false,
        createdAt: now,
        updatedAt: now
      };
      
      update(entries => [...entries, entry]);
      return entry;
    },
    
    update: (id: string, updatedEntry: Partial<TimeEntry>) => {
      update(entries => 
        entries.map(entry => 
          entry.id === id 
            ? { ...entry, ...updatedEntry, updatedAt: new Date() } 
            : entry
        )
      );
    },
    
    remove: (id: string) => {
      update(entries => entries.filter(entry => entry.id !== id));
    },
    
    getById: (id: string): TimeEntry | undefined => {
      let foundEntry: TimeEntry | undefined;
      update(entries => {
        foundEntry = entries.find(entry => entry.id === id);
        return entries;
      });
      return foundEntry;
    },
    
    getByClientId: (clientId: string): TimeEntry[] => {
      let clientEntries: TimeEntry[] = [];
      update(entries => {
        clientEntries = entries.filter(entry => entry.clientId === clientId);
        return entries;
      });
      return clientEntries;
    },
    
    getUnbilledByClientId: (clientId: string): TimeEntry[] => {
      let unbilledEntries: TimeEntry[] = [];
      update(entries => {
        unbilledEntries = entries.filter(
          entry => entry.clientId === clientId && entry.billable && !entry.billed
        );
        return entries;
      });
      return unbilledEntries;
    },
    
    markAsBilled: (entryIds: string[]) => {
      update(entries => 
        entries.map(entry => 
          entryIds.includes(entry.id) 
            ? { ...entry, billed: true, updatedAt: new Date() } 
            : entry
        )
      );
    },
    
    reset: () => set(initialTimeEntries)
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