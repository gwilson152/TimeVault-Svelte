// Define the core types for the TimeVault application

import { z } from 'zod';

export type ClientType = 'business' | 'container' | 'individual';

// User role types matching Prisma enum
export type UserRole = 'ADMIN' | 'AGENT' | 'CLIENT_ADMIN' | 'CLIENT_USER';

// User model interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  client?: Client;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// New user creation schema with password validation
export const userSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'AGENT', 'CLIENT_ADMIN', 'CLIENT_USER']),
  clientId: z.string().nullable(),
  active: z.boolean().default(true)
});

export type NewUser = Omit<z.infer<typeof userSchema>, 'password'> & { 
  passwordHash: string 
};

// Ticket note interface
export interface TicketNote {
  id: string;
  ticketId: string;
  content: string;
  isInternal: boolean;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTicketNote {
  ticketId: string;
  content: string;
  isInternal: boolean;
  userId: string;
}

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
  cost: number;
  description?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  overrides?: ClientBillingRateOverride[];
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
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  domains: string[];
  type: ClientType;
  parentId: string | null;
  rate: number;
  children?: Client[];
  billingRateOverrides?: ClientBillingRateOverride[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  description: string;
  startTime: Date;
  endTime: Date | null;
  minutes: number; // Duration in minutes
  date: Date;
  clientId: string | null;
  ticketId: string | null;
  ticket?: Ticket | null; // Add the ticket relation
  billable: boolean;
  billed: boolean;
  locked: boolean;
  invoiceId: string | null;
  billingRateId: string | null;
  client?: Client;
  billingRate?: BillingRate;
  userId?: string | null; // Add the user ID who created this entry
  user?: User | null; // Add the user relation
  billedRate?: number; // Store the effective rate at time of invoicing
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntryWithClient extends TimeEntry {
  clientName: string;
  durationHours: number;
  billingRate?: BillingRate & { rate: number };
  invoice?: {
    id: string;
    invoiceNumber?: string;
  };
}

export type NewClient = Omit<Client, 'id' | 'children' | 'billingRateOverrides' | 'createdAt' | 'updatedAt' | 'domains'> & {
  billingRateOverrides?: NewBillingRateOverride[];
  domains?: string[];
};

export interface NewBillingRateOverride {
  baseRateId: string;
  overrideType: 'percentage' | 'fixed';
  value: number;
}

export const timeEntrySchema = z.object({
  description: z.string().min(1, 'Description is required'),
  startTime: z.date(),
  endTime: z.date().nullable(),
  minutes: z.number().min(1, 'Duration must be greater than 0').optional(),
  duration: z.number().min(0.01, 'Duration must be greater than 0').optional(),
  date: z.date(),
  clientId: z.string().nullable(),
  ticketId: z.string().nullable(),
  billable: z.boolean().default(true),
  billingRateId: z.string().nullable(),
  billed: z.boolean().optional().default(false),
  billedRate: z.number().optional(),
  locked: z.boolean().optional().default(false)
}).refine(data => data.minutes !== undefined || data.duration !== undefined, {
  message: "Either minutes or duration must be provided",
  path: ["minutes"]
});

export type NewTimeEntry = z.infer<typeof timeEntrySchema>;

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
  totalMinutes: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  date: Date;
  entries: TimeEntry[];
  addons: InvoiceAddon[];
  client?: Client;
  sent?: boolean; // Add sent property to track if invoice has been sent
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  statusId: string;
  status: TicketStatus;
  clientId: string;
  addons: TicketAddon[];
  notes?: TicketNote[]; // Add the notes relation
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