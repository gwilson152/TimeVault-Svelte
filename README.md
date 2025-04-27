# TimeVault

TimeVault is a modern time management system built with SvelteKit and Svelte 5, designed to help freelancers, consultants, and small businesses track time, manage clients, and generate invoices.

## Features

- **Time Entry Management**: Track hours with detailed descriptions, dates, and optional client associations
- **Client Management**: Maintain a database of clients with customized hourly rates
- **Invoice Generation**: Create invoices for billable time entries
- **Responsive Design**: Works on desktop and mobile devices
- **TypeScript**: Full type safety throughout the application
- **Svelte 5**: Built with the latest Svelte features

## Technologies

- **SvelteKit**: Modern web framework with server-side rendering
- **Svelte 5**: Latest version with reactive primitives
- **TypeScript**: Type-safe JavaScript
- **TailwindCSS**: Utility-first CSS framework
- **UUID**: For unique identifier generation

## Project Structure

```
timevault/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ClientForm.svelte
│   │   │   ├── ClientList.svelte
│   │   │   ├── InvoiceGenerator.svelte
│   │   │   ├── TimeEntryForm.svelte
│   │   │   └── TimeEntryList.svelte
│   │   ├── stores/
│   │   │   ├── clientStore.ts
│   │   │   └── timeEntryStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── invoiceUtils.ts
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   ├── clients/
│   │   │   └── +page.svelte
│   │   └── invoices/
│   │       └── +page.svelte
│   └── app.d.ts
├── static/
│   └── favicon.png
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/timevault.git
   cd timevault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Visit `http://localhost:5173` in your browser

## Building for Production

```bash
npm run build
```

## Key Concepts

### Time Entries
Time entries represent blocks of work that can be associated with clients. Each entry includes:
- Description
- Hours
- Date
- Client association (optional)
- Billable status
- Billed status

### Clients
Clients are businesses or individuals who you perform work for. Each client has:
- Name
- Hourly rate

### Invoices
Invoices are generated from unbilled time entries for a specific client. When an invoice is generated, the associated time entries are marked as billed.

## License

MIT