import { writable, derived } from 'svelte/store';
import type { Ticket, NewTicket } from '$lib/types';
import { getTickets, createTicket, updateTicket, deleteTicket } from '$lib/services/api';
import { clientStore } from './clientStore';

function createTicketStore() {
  const { subscribe, set, update } = writable<Ticket[]>([]);

  return {
    subscribe,
    
    async load() {
      const tickets = await getTickets();
      set(tickets);
    },

    async add(ticket: NewTicket) {
      const newTicket = await createTicket(ticket);
      update(tickets => [...tickets, newTicket]);
      return newTicket;
    },

    async update(id: string, ticket: Partial<NewTicket>) {
      const updatedTicket = await updateTicket(id, ticket);
      update(tickets => tickets.map(t => t.id === id ? updatedTicket : t));
      return updatedTicket;
    },

    async remove(id: string) {
      await deleteTicket(id);
      update(tickets => tickets.filter(t => t.id !== id));
    }
  };
}

export const ticketStore = createTicketStore();

// Derived store that includes client information
export const ticketsWithClientInfo = derived(
  [ticketStore, clientStore],
  ([$tickets, $clients]) => {
    return $tickets.map(ticket => {
      const client = $clients.find(c => c.id === ticket.clientId);
      return {
        ...ticket,
        clientName: client?.name || 'Unknown Client'
      };
    });
  }
);