import { writable } from 'svelte/store';
import type { Client, NewClient } from '$lib/types';
import * as api from '$lib/services/api';

function createClientStore() {
  const { subscribe, set, update } = writable<Client[]>([]);

  return {
    subscribe,
    
    async load() {
      try {
        const clients = await api.getClients();
        set(clients);
      } catch (error) {
        console.error('Failed to load clients:', error);
      }
    },
    
    async add(newClient: NewClient) {
      try {
        const client = await api.createClient(newClient);
        update(clients => [...clients, client]);
        return client;
      } catch (error) {
        console.error('Failed to add client:', error);
        throw error;
      }
    },
    
    async update(id: string, updatedClient: Partial<Client>) {
      try {
        const client = await api.updateClient(id, updatedClient);
        update(clients => clients.map(c => c.id === id ? client : c));
        return client;
      } catch (error) {
        console.error('Failed to update client:', error);
        throw error;
      }
    },
    
    async remove(id: string) {
      try {
        await api.deleteClient(id);
        update(clients => clients.filter(c => c.id !== id));
      } catch (error) {
        console.error('Failed to delete client:', error);
        throw error;
      }
    },
    
    // Helper method to get client by ID (synchronous, uses local store state)
    getById(id: string): Client | undefined {
      let foundClient: Client | undefined;
      update(clients => {
        foundClient = clients.find(c => c.id === id);
        return clients;
      });
      return foundClient;
    }
  };
}

export const clientStore = createClientStore();