// Define the core types for the TimeVault application

export interface Client {
  id: string;
  name: string;
  rate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  date: Date;
  clientId: string | null;
  billable: boolean;
  billed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewClient {
  name: string;
  rate: number;
}

export interface NewTimeEntry {
  description: string;
  hours: number;
  date: Date;
  clientId: string | null;
  billable: boolean;
}

export interface Invoice {
  clientId: string;
  entries: TimeEntry[];
  totalHours: number;
  totalAmount: number;
  date: Date;
}