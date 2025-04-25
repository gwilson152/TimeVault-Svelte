// Define the core types for the TimeVault application

import { z } from 'zod';

export type ClientType = 'business' | 'individual';

export interface Client {
  id: string;
  name: string;
  rate: number;
  type: ClientType;
  parentId: string | null;
  children: Client[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  date: Date;
  clientId: string | null;
  ticketId: string | null;
  billable: boolean;
  billed: boolean;
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewClient {
  name: string;
  rate: number;
  type: ClientType;
  parentId?: string | null;
}

export interface NewTimeEntry {
  description: string;
  hours: number;
  date: Date;
  clientId: string | null;
  ticketId: string | null;
  billable: boolean;
}

export interface Invoice {
  clientId: string;
  entries: TimeEntry[];
  totalHours: number;
  totalAmount: number;
  date: Date;
}

export type TicketStatus = 'open' | 'in-progress' | 'closed';

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTicket = Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>;

export const timeEntrySchema = z.object({
  description: z.string().min(1, 'Description is required'),
  hours: z.number().min(0.01, 'Hours must be greater than 0'),
  date: z.date(),
  clientId: z.string().min(1, 'Client is required'),
  ticketId: z.string().nullable(),
  billable: z.boolean().default(true)
});