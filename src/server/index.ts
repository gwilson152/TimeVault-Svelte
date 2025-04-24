import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import prisma from './db.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const client = await prisma.client.create({
      data: {
        name: req.body.name,
        rate: req.body.rate
      }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        rate: req.body.rate
      }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Time Entry routes
app.get('/api/time-entries', async (req, res) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      include: { client: true },
      orderBy: { date: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

app.post('/api/time-entries', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.create({
      data: {
        description: req.body.description,
        hours: req.body.hours,
        date: new Date(req.body.date),
        clientId: req.body.clientId,
        billable: req.body.billable
      },
      include: { client: true }
    });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

app.put('/api/time-entries/:id', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        description: req.body.description,
        hours: req.body.hours,
        date: new Date(req.body.date),
        clientId: req.body.clientId,
        billable: req.body.billable
      },
      include: { client: true }
    });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

app.delete('/api/time-entries/:id', async (req, res) => {
  try {
    await prisma.timeEntry.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// Invoice routes
app.post('/api/invoices', async (req, res) => {
  try {
    const { clientId, entries } = req.body;
    
    // Calculate totals
    const totalHours = entries.reduce((sum: number, entry: any) => sum + entry.hours, 0);
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');
    const totalAmount = totalHours * client.rate;

    // Create invoice and update entries
    const invoice = await prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          clientId,
          totalHours,
          totalAmount,
          entries: {
            connect: entries.map((entry: any) => ({ id: entry.id }))
          }
        }
      });

      // Mark entries as billed
      await tx.timeEntry.updateMany({
        where: { id: { in: entries.map((e: any) => e.id) } },
        data: { billed: true }
      });

      return invoice;
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

function startServer(portToTry: number) {
  const server = app.listen(portToTry, SERVER_HOST)
    .on('listening', () => {
      console.log(`Server running at http://${SERVER_HOST}:${portToTry}`);
      
      // Handle server errors
      server.on('error', (error) => {
        console.error('Server error:', error);
      });

      // Handle process termination
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

      // Handle uncaught exceptions
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