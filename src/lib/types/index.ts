// Define the core types for the TimeVault application

import { z } from 'zod';

export type ClientType = 'business' | 'individual' | 'organization';

export interface ClientBillingRateOverride {
  id: string;
  clientId: string;
  baseRateId: string;
  overrideType: 'percentage' | 'fixed';
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewBillingRate {
  name: string;
  rate: number;
  description?: string;
  isDefault: boolean;
}

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  parentId: string | null;
  children: Client[];
  billingRateOverrides: ClientBillingRateOverride[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  description: string;
  hours: number; // Stored in database as decimal hours
  minutes?: number; // For UI representation in minutes (not stored)
  timeFormatted?: string; // For UI representation in hh:mm format (not stored)
  date: Date;
  clientId: string | null;
  ticketId: string | null;
  billable: boolean;
  billed: boolean;
  invoiceId: string | null;
  billingRateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntryWithClient extends TimeEntry {
  clientName: string;
  billingRate?: BillingRate;
}

export type NewClient = Omit<Client, 'id' | 'children' | 'billingRateOverrides' | 'createdAt' | 'updatedAt'> & {
  billingRateOverrides?: NewBillingRateOverride[];
};

export interface NewBillingRateOverride {
  baseRateId: string;
  overrideType: 'percentage' | 'fixed';
  value: number;
}

export interface NewTimeEntry {
  description: string;
  hours: number; // Stored in database as decimal hours
  minutes?: number; // For UI input in minutes
  timeFormatted?: string; // For UI input in hh:mm format
  date: Date;
  clientId: string | null;
  ticketId: string | null;
  billable: boolean;
  billingRateId: string | null;
}

export interface InvoiceAddon {
  id: string;
  invoiceId: string;
  description: string;
  amount: number; // Price per unit
  cost: number; // Cost per unit
  quantity: number; // Number of units
  profit: number; // Calculated field (amount * quantity) - (cost * quantity)
  ticketAddonId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId: string;
  totalHours: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  date: Date;
  entries: TimeEntry[];
  addons: InvoiceAddon[];
  client?: Client;
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  statusId: string;
  status: TicketStatus;
  clientId: string;
  addons: TicketAddon[];
  createdAt: Date;
  updatedAt: Date;
}

export type NewTicket = Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>;

export interface TicketStatus {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isClosed: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketAddon {
  id: string;
  ticketId: string;
  name: string;
  amount: number;
  description?: string;
  billed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketSettings {
  statuses: string[];
  defaultStatus: string;
  priorities: string[];
  defaultPriority: string;
  addonTypes: {
    name: string;
    defaultAmount: number;
    description?: string;
  }[];
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  category: string;
  label: string;
  description?: string;
  type: 'string' | 'number';
  createdAt: Date;
  updatedAt: Date;
}

export const timeEntrySchema = z.object({
  description: z.string().min(1, 'Description is required'),
  hours: z.number().min(0.01, 'Hours must be greater than 0'),
  date: z.date(),
  clientId: z.string().min(1, 'Client is required'),
  ticketId: z.string().nullable(),
  billable: z.boolean().default(true),
  billingRateId: z.string().nullable()
});