-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'business',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "minutes" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "ticketId" TEXT,
    "billingRateId" TEXT,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "clientId" TEXT NOT NULL,
    "totalMinutes" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_addons" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketAddonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_addons" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "statusId" TEXT NOT NULL DEFAULT 'open',
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#718096',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'string',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_billing_rate_overrides" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "baseRateId" TEXT NOT NULL,
    "overrideType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_billing_rate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_parentId_idx" ON "clients"("parentId");

-- CreateIndex
CREATE INDEX "time_entries_ticketId_idx" ON "time_entries"("ticketId");

-- CreateIndex
CREATE INDEX "time_entries_clientId_idx" ON "time_entries"("clientId");

-- CreateIndex
CREATE INDEX "time_entries_invoiceId_idx" ON "time_entries"("invoiceId");

-- CreateIndex
CREATE INDEX "time_entries_billingRateId_idx" ON "time_entries"("billingRateId");

-- CreateIndex
CREATE INDEX "invoices_clientId_idx" ON "invoices"("clientId");

-- CreateIndex
CREATE INDEX "invoice_addons_invoiceId_idx" ON "invoice_addons"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_addons_ticketAddonId_idx" ON "invoice_addons"("ticketAddonId");

-- CreateIndex
CREATE INDEX "ticket_addons_ticketId_idx" ON "ticket_addons"("ticketId");

-- CreateIndex
CREATE INDEX "Ticket_clientId_idx" ON "Ticket"("clientId");

-- CreateIndex
CREATE INDEX "Ticket_statusId_idx" ON "Ticket"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_statuses_name_key" ON "ticket_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_rates_name_key" ON "billing_rates"("name");

-- CreateIndex
CREATE INDEX "client_billing_rate_overrides_clientId_idx" ON "client_billing_rate_overrides"("clientId");

-- CreateIndex
CREATE INDEX "client_billing_rate_overrides_baseRateId_idx" ON "client_billing_rate_overrides"("baseRateId");

-- CreateIndex
CREATE UNIQUE INDEX "client_billing_rate_overrides_clientId_baseRateId_key" ON "client_billing_rate_overrides"("clientId", "baseRateId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_billingRateId_fkey" FOREIGN KEY ("billingRateId") REFERENCES "billing_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_addons" ADD CONSTRAINT "invoice_addons_ticketAddonId_fkey" FOREIGN KEY ("ticketAddonId") REFERENCES "ticket_addons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_addons" ADD CONSTRAINT "invoice_addons_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_addons" ADD CONSTRAINT "ticket_addons_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ticket_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_billing_rate_overrides" ADD CONSTRAINT "client_billing_rate_overrides_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_billing_rate_overrides" ADD CONSTRAINT "client_billing_rate_overrides_baseRateId_fkey" FOREIGN KEY ("baseRateId") REFERENCES "billing_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
