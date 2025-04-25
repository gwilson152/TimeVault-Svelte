import type { Client, NewClient, TimeEntry, NewTimeEntry, Invoice, Ticket, NewTicket } from '$lib/types';

const API_URL = import.meta.env.PUBLIC_API_URL || 'https://api.timevault.drivenw.com/api';

// Client API calls
export async function getClients(): Promise<Client[]> {
  const response = await fetch(`${API_URL}/clients`);
  if (!response.ok) throw new Error('Failed to fetch clients');
  return response.json();
}

export async function createClient(client: NewClient): Promise<Client> {
  const response = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client)
  });
  if (!response.ok) throw new Error('Failed to create client');
  return response.json();
}

export async function updateClient(id: string, client: Partial<Client>): Promise<Client> {
  const response = await fetch(`${API_URL}/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client)
  });
  if (!response.ok) throw new Error('Failed to update client');
  return response.json();
}

export async function deleteClient(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/clients/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete client');
}

// Time Entry API calls
export async function getTimeEntries(): Promise<TimeEntry[]> {
  const response = await fetch(`${API_URL}/time-entries`);
  if (!response.ok) throw new Error('Failed to fetch time entries');
  return response.json();
}

export async function createTimeEntry(entry: NewTimeEntry): Promise<TimeEntry> {
  const response = await fetch(`${API_URL}/time-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error('Failed to create time entry');
  return response.json();
}

export async function updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<TimeEntry> {
  const response = await fetch(`${API_URL}/time-entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error('Failed to update time entry');
  return response.json();
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/time-entries/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete time entry');
}

// Invoice API calls
export async function getInvoices(clientId?: string): Promise<Invoice[]> {
  const url = clientId ? `${API_URL}/invoices?clientId=${clientId}` : `${API_URL}/invoices`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch invoices');
  const data = await response.json();
  return data.map((invoice: any) => ({
    ...invoice,
    date: new Date(invoice.date)
  }));
}

export async function generateInvoice(clientId: string, entries: TimeEntry[]): Promise<Invoice> {
  const response = await fetch(`${API_URL}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, entries })
  });
  if (!response.ok) throw new Error('Failed to generate invoice');
  return response.json();
}

// Ticket API calls
export async function getTickets(): Promise<Ticket[]> {
  const response = await fetch(`${API_URL}/tickets`);
  const data = await response.json();
  return data.map((ticket: any) => ({
    ...ticket,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt)
  }));
}

export async function createTicket(ticket: NewTicket): Promise<Ticket> {
  const response = await fetch(`${API_URL}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket)
  });
  const data = await response.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt)
  };
}

export async function updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket> {
  const response = await fetch(`${API_URL}/tickets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket)
  });
  const data = await response.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt)
  };
}

export async function deleteTicket(id: string): Promise<void> {
  await fetch(`${API_URL}/tickets/${id}`, {
    method: 'DELETE'
  });
}