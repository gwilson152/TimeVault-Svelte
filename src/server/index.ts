import type { Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import prisma from './db.js';
import type { TimeEntry } from '$lib/types';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Load environment variables
config();

const app = express();
const SERVER_PORT = Number(process.env.SERVER_PORT) || 5600;
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const CLIENT_PORT = Number(process.env.PUBLIC_CLIENT_PORT) || 2100;
const CLIENT_HOST = process.env.PUBLIC_CLIENT_HOST || 'localhost';

// Configure CORS with environment-based origins
app.use(cors({
  origin: [
    `http://${CLIENT_HOST}:${CLIENT_PORT}`,
    `http://127.0.0.1:${CLIENT_PORT}`
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Client routes
app.get('/api/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(clients);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to fetch clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', async (req: Request, res: Response) => {
  try {
    const client = await prisma.client.create({
      data: {
        name: req.body.name,
        rate: req.body.rate
      }
    });
    res.json(client);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to create client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/api/clients/:id', async (req: Request, res: Response) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        rate: req.body.rate
      }
    });
    res.json(client);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to update client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', async (req: Request, res: Response) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to delete client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Time Entry routes
app.get('/api/time-entries', async (_req: Request, res: Response) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      include: { client: true, ticket: true },
      orderBy: { date: 'desc' }
    });
    res.json(entries);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to fetch time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

app.post('/api/time-entries', async (req: Request, res: Response): Promise<void> => {
  try {
    const date = new Date(req.body.date);
    if (isNaN(date.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    const entry = await prisma.timeEntry.create({
      data: {
        description: req.body.description,
        hours: req.body.hours,
        date: date,
        clientId: req.body.clientId || null,
        billable: req.body.billable,
        ticketId: req.body.ticketId || null
      },
      include: { client: true, ticket: true }
    });
    res.json(entry);
  } catch (err: unknown) {
    const error = err as Error | PrismaClientKnownRequestError;
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: error.message || 'Failed to create time entry' });
  }
});

app.put('/api/time-entries/:id', async (req: Request, res: Response) => {
  try {
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        description: req.body.description,
        hours: req.body.hours,
        date: new Date(req.body.date),
        clientId: req.body.clientId,
        billable: req.body.billable,
        ticketId: req.body.ticketId
      },
      include: { client: true, ticket: true }
    });
    res.json(entry);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to update time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

app.delete('/api/time-entries/:id', async (req: Request, res: Response) => {
  try {
    await prisma.timeEntry.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to delete time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Invoice routes
app.post('/api/invoices', async (req: Request, res: Response) => {
  try {
    const { clientId, entries } = req.body;

    const totalHours = entries.reduce((sum: number, entry: TimeEntry) => sum + entry.hours, 0);
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');
    const totalAmount = totalHours * client.rate;

    const invoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          clientId,
          totalHours,
          totalAmount,
          entries: {
            connect: entries.map((entry: TimeEntry) => ({ id: entry.id }))
          }
        }
      });

      await tx.timeEntry.updateMany({
        where: { id: { in: entries.map((e: TimeEntry) => e.id) } },
        data: { billed: true }
      });

      return invoice;
    });

    res.json(invoice);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice' });
  }
});

// Ticket routes
app.get('/api/tickets', async (_req: Request, res: Response) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { client: true }
    });
    res.json(tickets);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to fetch tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.post('/api/tickets', async (req: Request, res: Response) => {
  try {
    const ticket = await prisma.ticket.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        clientId: req.body.clientId
      },
      include: { client: true }
    });
    res.json(ticket);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to create ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.put('/api/tickets/:id', async (req: Request, res: Response) => {
  try {
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        description: req.body.description,
        clientId: req.body.clientId
      },
      include: { client: true }
    });
    res.json(ticket);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to update ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.delete('/api/tickets/:id', async (req: Request, res: Response) => {
  try {
    await prisma.ticket.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to delete ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

function startServer(portToTry: number) {
  const server = app.listen(portToTry, SERVER_HOST)
    .on('listening', () => {
      console.log(`Server running at http://${SERVER_HOST}:${portToTry}`);

      server.on('error', (error) => {
        console.error('Server error:', error);
      });

      process.on('SIGTERM', () => {
        console.log('SIGTERM signal received. Closing server...');
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('SIGINT signal received. Closing server...');
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      });

      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        server.close(() => {
          console.log('Server closed due to uncaught exception');
          process.exit(1);
        });
      });
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${portToTry} is in use, trying ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error('Server error:', err);
      }
    });
}

startServer(SERVER_PORT);