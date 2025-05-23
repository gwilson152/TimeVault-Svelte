import type { Client, TimeEntry, NewTimeEntry, Invoice, Ticket, TicketStatus, Settings, BillingRate, NewBillingRate } from '$lib/types';
import { env } from '$env/dynamic/public';

const API_URL = '/api'; // Updated to use SvelteKit API routes

interface ApiResponse<T> {
  data: T;
  status?: number;
}

// Generic API calls 
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'API request failed');
  }
  return response.json();
}

export async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    credentials: 'include'
  });
  return handleResponse<T>(response);
}

export async function post<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<T>(response);
}

export async function put<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<T>(response);
}

export async function del<T = void>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return handleResponse<T>(response);
}

// Client-specific API calls
export async function getClients(): Promise<Client[]> {
  return get<Client[]>('/clients');
}

export async function createClient(client: unknown): Promise<Client> {
  return post<Client>('/clients', client);
}

export async function updateClient(id: string, client: unknown): Promise<Client> {
  return put<Client>(`/clients/${id}`, client);
}

export async function deleteClient(id: string): Promise<void> {
  return del(`/clients/${id}`);
}

// Time Entry API calls
interface RawTimeEntry extends Omit<TimeEntry, 'date' | 'startTime' | 'endTime'> {
  date: string;
  startTime: string;
  endTime: string | null;
}

function convertTimeEntry(entry: RawTimeEntry): TimeEntry {
  return {
    ...entry,
    date: new Date(entry.date),
    startTime: new Date(entry.startTime),
    endTime: entry.endTime ? new Date(entry.endTime) : null
  };
}

export async function getTimeEntries(): Promise<TimeEntry[]> {
  const entries = await get<RawTimeEntry[]>('/time-entries');
  return entries.map(convertTimeEntry);
}

export async function createTimeEntry(entry: NewTimeEntry): Promise<TimeEntry> {
  console.log('🔍 createTimeEntry - Original entry data:', entry);
  console.log('🔍 Date fields types:', {
    date: entry.date instanceof Date ? 'Date object' : typeof entry.date,
    startTime: entry.startTime instanceof Date ? 'Date object' : typeof entry.startTime,
    endTime: entry.endTime instanceof Date ? 'Date object' : typeof entry.endTime
  });
  
  // Create a clean object with ISO string dates
  const data: Record<string, any> = {
    ...entry
  };
  
  // Handle date fields explicitly
  if (entry.date) {
    data.date = entry.date instanceof Date 
      ? entry.date.toISOString() 
      : new Date(entry.date).toISOString();
    console.log('🔍 Processed date field:', data.date);
  }
  
  if (entry.startTime) {
    data.startTime = entry.startTime instanceof Date 
      ? entry.startTime.toISOString() 
      : new Date(entry.startTime).toISOString();
    console.log('🔍 Processed startTime field:', data.startTime);
  }
  
  if (entry.endTime) {
    data.endTime = entry.endTime instanceof Date 
      ? entry.endTime.toISOString() 
      : new Date(entry.endTime).toISOString();
    console.log('🔍 Processed endTime field:', data.endTime);
  } else {
    data.endTime = null;
  }
  
  console.log('🔍 Final data object to be sent:', data);
  
  try {
    const rawEntry = await post<RawTimeEntry>('/time-entries', data);
    console.log('✅ API response received successfully');
    return convertTimeEntry(rawEntry);
  } catch (error) {
    console.error('❌ API createTimeEntry error:', error);
    throw error;
  }
}

export async function updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<TimeEntry> {
  // Create a new object for modifications
  const data: Record<string, any> = { ...entry };
  
  // Convert all date fields to ISO strings if they are Date objects
  if (data.date instanceof Date) {
    data.date = data.date.toISOString();
  }
  
  if (data.startTime instanceof Date) {
    data.startTime = data.startTime.toISOString();
  }
  
  if (data.endTime instanceof Date) {
    data.endTime = data.endTime.toISOString();
  }
  
  const rawEntry = await put<RawTimeEntry>(`/time-entries/${id}`, data);
  return convertTimeEntry(rawEntry);
}

export async function deleteTimeEntry(id: string): Promise<void> {
  return del(`/time-entries/${id}`);
}

// Invoice API calls
interface RawInvoice extends Omit<Invoice, 'date'> {
  date: string;
}

interface InvoiceFilters {
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  const searchParams = new URLSearchParams();
  
  if (filters?.clientId) {
    searchParams.set('clientId', filters.clientId);
  }
  if (filters?.dateFrom) {
    searchParams.set('dateFrom', filters.dateFrom);
  }
  if (filters?.dateTo) {
    searchParams.set('dateTo', filters.dateTo);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/invoices?${queryString}` : '/invoices';
  
  const invoices = await get<RawInvoice[]>(url);
  return invoices.map(invoice => ({
    ...invoice,
    date: new Date(invoice.date)
  }));
}

export async function getInvoice(id: string): Promise<Invoice> {
  const rawInvoice = await get<RawInvoice>(`/invoices/${id}`);
  return {
    ...rawInvoice,
    date: new Date(rawInvoice.date)
  };
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
  // Convert Date objects to ISO strings before sending to API
  const data: Record<string, any> = { ...invoice };
  
  if (data.date instanceof Date) {
    data.date = data.date.toISOString();
  }
  
  // Handle entries date objects if present
  if (data.entries) {
    data.entries = data.entries.map((entry: any) => {
      const newEntry = { ...entry };
      if (newEntry.date instanceof Date) {
        newEntry.date = newEntry.date.toISOString();
      }
      if (newEntry.startTime instanceof Date) {
        newEntry.startTime = newEntry.startTime.toISOString();
      }
      if (newEntry.endTime instanceof Date) {
        newEntry.endTime = newEntry.endTime?.toISOString() || null;
      }
      return newEntry;
    });
  }
  
  const rawInvoice = await put<RawInvoice>(`/invoices/${id}`, data);
  return {
    ...rawInvoice,
    date: new Date(rawInvoice.date)
  };
}

export async function deleteInvoice(id: string): Promise<void> {
  return del(`/invoices/${id}`);
}

export async function generateInvoice(
  clientId: string, 
  entries: TimeEntry[], 
  options?: { 
    invoiceNumber?: string;
    addons?: Array<{ description: string; amount: number; }>
  }
): Promise<Invoice> {
  const rawInvoice = await post<RawInvoice>('/invoices', {
    clientId,
    entries,
    invoiceNumber: options?.invoiceNumber,
    addons: options?.addons
  });
  return {
    ...rawInvoice,
    date: new Date(rawInvoice.date)
  };
}

// Ticket API calls
interface RawTicket extends Omit<Ticket, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export async function getTickets(): Promise<Ticket[]> {
  const tickets = await get<RawTicket[]>('/tickets');
  return tickets.map(ticket => ({
    ...ticket,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt)
  }));
}

export async function createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
  const rawTicket = await post<RawTicket>('/tickets', ticket);
  return {
    ...rawTicket,
    createdAt: new Date(rawTicket.createdAt),
    updatedAt: new Date(rawTicket.updatedAt)
  };
}

export async function updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket> {
  const rawTicket = await put<RawTicket>(`/tickets/${id}`, ticket);
  return {
    ...rawTicket,
    createdAt: new Date(rawTicket.createdAt),
    updatedAt: new Date(rawTicket.updatedAt)
  };
}

export async function deleteTicket(id: string): Promise<void> {
  return del(`/tickets/${id}`);
}

// Ticket Status API calls
interface RawTicketStatus extends Omit<TicketStatus, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

function convertTicketStatus(status: RawTicketStatus): TicketStatus {
  return {
    ...status,
    createdAt: new Date(status.createdAt),
    updatedAt: new Date(status.updatedAt)
  };
}

export async function getTicketStatuses(): Promise<TicketStatus[]> {
  const statuses = await get<RawTicketStatus[]>('/ticket-statuses');
  return statuses.map(convertTicketStatus);
}

export async function createTicketStatus(status: Omit<TicketStatus, 'id' | 'createdAt' | 'updatedAt'>): Promise<TicketStatus> {
  const rawStatus = await post<RawTicketStatus>('/ticket-statuses', status);
  return convertTicketStatus(rawStatus);
}

export async function updateTicketStatus(id: string, status: Partial<TicketStatus>): Promise<TicketStatus> {
  const rawStatus = await put<RawTicketStatus>(`/ticket-statuses/${id}`, status);
  return convertTicketStatus(rawStatus);
}

export async function deleteTicketStatus(id: string): Promise<void> {
  return del(`/ticket-statuses/${id}`);
}

// Settings API calls
interface RawSettings extends Omit<Settings, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

function convertSettings(setting: RawSettings): Settings {
  return {
    ...setting,
    createdAt: new Date(setting.createdAt),
    updatedAt: new Date(setting.updatedAt)
  };
}

export async function getSettings(category?: string): Promise<Settings[]> {
  const url = category ? `/settings?category=${category}` : '/settings';
  const settings = await get<RawSettings[]>(url);
  return settings.map(convertSettings);
}

export async function createSetting(setting: Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>): Promise<Settings> {
  const rawSetting = await post<RawSettings>('/settings', setting);
  return convertSettings(rawSetting);
}

export async function updateSetting(key: string, setting: Partial<Settings>): Promise<Settings> {
  const rawSetting = await put<RawSettings>(`/settings/${key}`, setting);
  return convertSettings(rawSetting);
}

// Billing Rates API calls
interface RawBillingRate extends Omit<BillingRate, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

function convertBillingRate(rate: RawBillingRate): BillingRate {
  return {
    ...rate,
    createdAt: new Date(rate.createdAt),
    updatedAt: new Date(rate.updatedAt)
  };
}

export async function getBillingRates(): Promise<BillingRate[]> {
  const rates = await get<RawBillingRate[]>('/billing-rates');
  return rates.map(convertBillingRate);
}

export async function createBillingRate(rate: NewBillingRate): Promise<BillingRate> {
  const newRate = await post<RawBillingRate>('/billing-rates', rate);
  return convertBillingRate(newRate);
}

export async function updateBillingRate(id: string, rate: Partial<BillingRate>): Promise<BillingRate> {
  const updatedRate = await put<RawBillingRate>(`/billing-rates/${id}`, rate);
  return convertBillingRate(updatedRate);
}

export async function deleteBillingRate(id: string): Promise<void> {
  await del(`/billing-rates/${id}`);
}