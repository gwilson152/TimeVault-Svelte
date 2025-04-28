import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { TimeEntry, Client } from '$lib/types';

// Create base stores
export const baseTimeEntryStore = writable<TimeEntry[]>([]);
export const baseClientStore = writable<Client[]>([]);

// Create derived stores for shared functionality
export const clientsWithTimeEntries = derived<[Readable<Client[]>, Readable<TimeEntry[]>], Client[]>(
  [baseClientStore, baseTimeEntryStore],
  ([$clients, $timeEntries]) => {
    return $clients.filter(client => {
      const hasEntries = $timeEntries.some(entry => 
        entry.clientId === client.id && 
        entry.billable && 
        !entry.billed
      );
      return hasEntries;
    });
  }
);