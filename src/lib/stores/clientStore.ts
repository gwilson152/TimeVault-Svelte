import { writable } from 'svelte/store';
import type { Client, NewClient } from '$lib/types';
import { v4 as uuidv4 } from 'uuid';

// Sample initial data
const initialClients: Client[] = [
  {
    id: '1',
    name: 'Acme Corp',
    rate: 150,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Globex Industries',
    rate: 175,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    name: 'Initech',
    rate: 125,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

function createClientStore() {
  const { subscribe, update, set } = writable<Client[]>(initialClients);

  return {
    subscribe,
    
    add: (newClient: NewClient) => {
      const now = new Date();
      const client: Client = {
        id: uuidv4(),
        ...newClient,
        createdAt: now,
        updatedAt: now
      };
      
      update(clients => [...clients, client]);
      return client;
    },
    
    update: (id: string, updatedClient: Partial<Client>) => {
      update(clients => 
        clients.map(client => 
          client.id === id 
            ? { ...client, ...updatedClient, updatedAt: new Date() } 
            : client
        )
      );
    },
    
    remove: (id: string) => {
      update(clients => clients.filter(client => client.id !== id));
    },
    
    getById: (id: string): Client | undefined => {
      let foundClient: Client | undefined;
      update(clients => {
        foundClient = clients.find(client => client.id === id);
        return clients;
      });
      return foundClient;
    },
    
    reset: () => set(initialClients)
  };
}

export const clientStore = createClientStore();