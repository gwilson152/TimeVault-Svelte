<script lang="ts">
	import { onMount } from 'svelte';
	import { GlassCard, Modal, StatsCard } from '$lib/components';
	import { formatCurrency, formatDate, formatTime } from '$lib/utils/invoiceUtils';
	import { clientStore } from '$lib/stores/clientStore';
	import * as api from '$lib/services/api';
	import { Icon } from '@steeze-ui/svelte-icon';
	import {
		DocumentText,
		ArrowLeft,
		Printer,
		DocumentArrowDown,
		Eye,
		Pencil,
		Check,
		XMark,
		PlusCircle,
		EnvelopeOpen,
		CreditCard,
		CalendarDays,
		UserCircle,
		Cog,
		Clock,
		CurrencyDollar,
		ShoppingBag,
		ChartPie
	} from '@steeze-ui/heroicons';
	import type { Invoice, InvoiceAddon, TimeEntry } from '$lib/types';
	import { page } from '$app/stores';

	// We need to use the page store to safely access the params during SSR
	const invoiceId = $derived($page.params.id);

	// Use $state for all reactive variables
	let invoice = $state<Invoice | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isPresentationMode = $state(false);
	let isEditMode = $state(false);
	let showPrintDialog = $state(false);
	let showExportDialog = $state(false);
	let showSendDialog = $state(false);
	let editableInvoice = $state<Invoice | null>(null);
	let isSaving = $state(false);
	let exportingPDF = $state(false);
	let isSent = $state(false);
	let showTimeEntryModal = $state(false);
	let currentTimeEntry = $state<TimeEntry | null>(null);

	// Derive calculated values
	const addonTotal = $derived(
		invoice && Array.isArray(invoice.addons)
			? invoice.addons.reduce((sum, addon) => sum + (addon.amount || 0) * (addon.quantity || 1), 0)
			: 0
	);

	const combinedTotal = $derived(invoice ? (invoice.totalAmount || 0) + addonTotal : 0);

	const editableAddonTotal = $derived(
		editableInvoice && Array.isArray(editableInvoice.addons)
			? editableInvoice.addons.reduce(
					(sum, addon) => sum + (addon.amount || 0) * (addon.quantity || 1),
					0
				)
			: 0
	);

	const editableCombinedTotal = $derived(
		editableInvoice ? (editableInvoice.totalAmount || 0) + editableAddonTotal : 0
	);

	function calculateInvoiceTotal(invoice: Invoice): number {
		if (!invoice) return 0;

		const timeEntryTotal = invoice.totalAmount || 0;
		const addonTotal = Array.isArray(invoice.addons)
			? invoice.addons.reduce(
					(sum: number, addon: InvoiceAddon) => sum + addon.amount * addon.quantity,
					0
				)
			: 0;

		return timeEntryTotal + addonTotal;
	}

	onMount(async () => {
		try {
			await clientStore.load();
			const invoices = await api.getInvoices();
			invoice = invoices.find((inv) => inv.id === invoiceId) || null;

			if (!invoice) {
				error = 'Invoice not found';
				return;
			}

			// Determine if invoice has been sent
			isSent = invoice.sent || false;

			isLoading = false;
		} catch (err) {
			console.error('Error loading invoice:', err);
			error = 'Failed to load invoice data. Please try again.';
			isLoading = false;
		}
	});

	// Toggle presentation mode for cleaner view/printing
	function togglePresentationMode() {
		isPresentationMode = !isPresentationMode;
	}

	// Print the invoice
	function printInvoice() {
		showPrintDialog = false;
		setTimeout(() => {
			window.print();
		}, 300);
	}

	// Export to PDF (using browser print to PDF functionality)
	async function exportToPDF() {
		showExportDialog = false;
		exportingPDF = true;

		try {
			// Set presentation mode and wait for DOM to update
			isPresentationMode = true;
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Open print dialog with PDF settings
			const printWindow = window.open('', '_blank');
			if (!printWindow) {
				throw new Error('Popup blocked. Please allow popups for this site.');
			}

			printWindow.document.write(`
				<html>
					<head>
						<title>Invoice ${invoice?.invoiceNumber}</title>
						<style>
							body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
							.invoice-container { max-width: 800px; margin: 0 auto; }
							.invoice-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
							.invoice-id { font-size: 24px; font-weight: bold; }
							.invoice-date { margin-top: 5px; color: #666; }
							.client-info { text-align: right; }
							.section { margin-bottom: 20px; }
							.section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
							table { width: 100%; border-collapse: collapse; }
							th { text-align: left; padding: 10px; background-color: #f2f2f2; border-bottom: 1px solid #ddd; }
							td { padding: 10px; border-bottom: 1px solid #eee; }
							.amount { text-align: right; }
							.invoice-total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
							.payment-terms { margin-top: 30px; font-size: 12px; color: #666; }
						</style>
					</head>
					<body>
						<div class="invoice-container">
							<div class="invoice-header">
								<div>
									<div class="invoice-id">Invoice #${invoice?.invoiceNumber || 'Draft'}</div>
									<div class="invoice-date">Date: ${formatDate(invoice?.date || new Date())}</div>
								</div>
								<div class="client-info">
									<div>${invoice?.client?.name || 'Unknown Client'}</div>
										<div>Contact client for details</div>
								</div>
							</div>
							${generateInvoiceHTML()}
						</div>
					</body>
				</html>
			`);
			printWindow.document.close();
			printWindow.focus();
			printWindow.print();
			printWindow.close();

			// Reset presentation mode
			isPresentationMode = false;
		} catch (error) {
			console.error('Failed to export PDF:', error);
			alert('Failed to export to PDF. Please try again.');
		} finally {
			exportingPDF = false;
		}
	}

	// Generate HTML content for PDF export
	function generateInvoiceHTML() {
		if (!invoice) return '';

		const timeEntriesHTML = `
			<div class="section">
				<div class="section-title">Time Entries</div>
				<table>
					<thead>
						<tr>
							<th>Description</th>
							<th>Date</th>
							<th class="amount">Duration</th>
							<th class="amount">Rate</th>
							<th class="amount">Amount</th>
						</tr>
					</thead>
					<tbody>
						${invoice.entries
							.map(
								(entry) => `
								<tr>
									<td>${entry.description}</td>
									<td>${formatDate(entry.date)}</td>
									<td class="amount">${formatTime(entry.minutes / 60, 'formatted')}</td>
									<td class="amount">${formatCurrency(entry.billingRate?.rate || 0)}/hr</td>
									<td class="amount">${formatCurrency((entry.billingRate?.rate || 0) * (entry.minutes / 60))}</td>
								</tr>
							`
							)
							.join('')}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="2"><strong>Total Time Entries</strong></td>
							<td class="amount"><strong>${formatTime(invoice.totalMinutes / 60, 'formatted')}</strong></td>
							<td></td>
							<td class="amount"><strong>${formatCurrency(invoice.totalAmount)}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>
		`;

		const addonsHTML =
			invoice.addons.length > 0
				? `
			<div class="section">
				<div class="section-title">Additional Items</div>
				<table>
					<thead>
						<tr>
							<th>Description</th>
							<th class="amount">Price</th>
							<th class="amount">Quantity</th>
							<th class="amount">Amount</th>
						</tr>
					</thead>
					<tbody>
						${invoice.addons
							.map(
								(addon) => `
								<tr>
									<td>${addon.description}</td>
									<td class="amount">${formatCurrency(addon.amount)}</td>
									<td class="amount">${addon.quantity}</td>
									<td class="amount">${formatCurrency(addon.amount * addon.quantity)}</td>
								</tr>
							`
							)
							.join('')}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3"><strong>Total Additional Items</strong></td>
							<td class="amount"><strong>${formatCurrency(addonTotal)}</strong></td>
						</tr>
					</tfoot>
				</table>
			</div>
		`
				: '';

		const totalHTML = `
			<div class="invoice-total">
				<div>Invoice Total: ${formatCurrency(combinedTotal)}</div>
			</div>
			<div class="payment-terms">
				<p>Payment is due within 30 days of receipt. Thank you for your business.</p>
			</div>
		`;

		return timeEntriesHTML + addonsHTML + totalHTML;
	}

	// Toggle edit mode
	function toggleEditMode() {
		if (!invoice || isSent) return;

		if (!isEditMode) {
			// Enter edit mode
			editableInvoice = JSON.parse(JSON.stringify(invoice));
			isEditMode = true;
		} else {
			// Exit edit mode without saving
			if (confirm('Discard unsaved changes?')) {
				isEditMode = false;
				editableInvoice = null;
			}
		}
	}

	// Update invoice with edits
	async function saveInvoiceChanges() {
		if (!editableInvoice) return;

		isSaving = true;

		try {
			const updatedInvoice = await api.updateInvoice(editableInvoice.id, editableInvoice);
			invoice = updatedInvoice;
			isEditMode = false;
			editableInvoice = null;

			// Show success message
			const notification = document.createElement('div');
			notification.className =
				'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
			notification.innerText = 'Invoice updated successfully';
			document.body.appendChild(notification);

			setTimeout(() => {
				notification.remove();
			}, 3000);
		} catch (err) {
			console.error('Failed to update invoice:', err);
			alert('Failed to update invoice. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	// Add a new addon item
	function addAddonItem() {
		if (!editableInvoice) return;

		editableInvoice.addons = [
			...editableInvoice.addons,
			{
				id: `temp-${Date.now()}`,
				invoiceId: editableInvoice.id,
				description: '',
				amount: 0,
				cost: 0,
				quantity: 1,
				profit: 0,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		];
	}

	// Remove an addon item
	function removeAddonItem(index: number) {
		if (!editableInvoice) return;

		editableInvoice.addons = editableInvoice.addons.filter((_, i) => i !== index);
	}

	// Update addon item
	function updateAddonItem(index: number, field: keyof InvoiceAddon, value: any) {
		if (!editableInvoice) return;

		editableInvoice.addons = editableInvoice.addons.map((addon, i) => {
			if (i === index) {
				const updatedAddon = { ...addon, [field]: value };

				// Recalculate profit
				if (field === 'amount' || field === 'cost' || field === 'quantity') {
					updatedAddon.profit =
						updatedAddon.amount * updatedAddon.quantity - updatedAddon.cost * updatedAddon.quantity;
				}

				return updatedAddon;
			}
			return addon;
		});
	}

	// Mark invoice as sent
	async function markAsSent() {
		if (!invoice || isSent) return;

		try {
			showSendDialog = false;
			const updatedInvoice = await api.updateInvoice(invoice.id, { ...invoice, sent: true });
			invoice = updatedInvoice;
			isSent = true;

			// Show success message
			const notification = document.createElement('div');
			notification.className =
				'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
			notification.innerText = 'Invoice marked as sent';
			document.body.appendChild(notification);

			setTimeout(() => {
				notification.remove();
			}, 3000);
		} catch (err) {
			console.error('Failed to mark invoice as sent:', err);
			alert('Failed to update invoice. Please try again.');
		}
	}

	// Edit time entry
	function editTimeEntry(entry: TimeEntry) {
		currentTimeEntry = JSON.parse(JSON.stringify(entry));
		showTimeEntryModal = true;
	}

	// Remove time entry from invoice
	async function removeTimeEntryFromInvoice() {
		if (!currentTimeEntry || !invoice || isSent) return;

		try {
			// Update the time entry to disassociate it from invoice
			await api.updateTimeEntry(currentTimeEntry.id, {
				...currentTimeEntry,
				invoiceId: null,
				billed: false,
				locked: false
			});

			// Remove the entry from the current invoice
			if (currentTimeEntry?.id) {
				invoice.entries = invoice.entries.filter((entry) => entry.id !== currentTimeEntry?.id);

				// Recalculate invoice totals
				const totalMinutes = invoice.entries.reduce((sum, entry) => sum + entry.minutes, 0);
				const totalAmount = invoice.entries.reduce(
					(sum, entry) => sum + (entry.billingRate?.rate || 0) * (entry.minutes / 60),
					0
				);
				const totalCost = invoice.entries.reduce(
					(sum, entry) => sum + (entry.billingRate?.cost || 0) * (entry.minutes / 60),
					0
				);

				invoice.totalMinutes = totalMinutes;
				invoice.totalAmount = totalAmount;
				invoice.totalCost = totalCost;
				invoice.totalProfit = totalAmount - totalCost;

				// Update the invoice with new totals
				await api.updateInvoice(invoice.id, invoice);
			}

			showTimeEntryModal = false;
			currentTimeEntry = null;

			// Show success message
			const notification = document.createElement('div');
			notification.className =
				'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
			notification.innerText = 'Time entry removed from invoice';
			document.body.appendChild(notification);
			setTimeout(() => notification.remove(), 3000);
		} catch (err) {
			console.error('Failed to remove time entry from invoice:', err);
			alert('Failed to remove time entry from invoice. Please try again.');
		}
	}
</script>

<svelte:head>
	<title>Invoice {invoice?.invoiceNumber || invoiceId}</title>
	<style media="print">
		body * {
			visibility: hidden;
		}
		.print-section,
		.print-section * {
			visibility: visible;
		}
		.print-section {
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			background-color: white !important;
			color: black !important;
		}
		.print-section .hide-for-print {
			display: none !important;
		}
		.table-action-button {
			display: none !important;
		}
	</style>
</svelte:head>

<div class="container mx-auto space-y-6 px-4 py-8 pb-20">
	<!-- Back button -->
	<div class="hide-for-print">
		<a href="/invoices" class="inline-flex items-center text-gray-400 hover:text-white">
			<Icon src={ArrowLeft} class="mr-2 h-4 w-4" />
			<span>Back to Invoices</span>
		</a>
	</div>

	{#if isLoading}
		<GlassCard className="p-6">
			<div class="flex items-center justify-center py-12">
				<div class="animate-pulse text-gray-400">Loading invoice data...</div>
			</div>
		</GlassCard>
	{:else if error}
		<GlassCard className="p-6">
			<div class="py-8 text-center">
				<div class="mb-4 text-red-400">{error}</div>
				<a href="/invoices" class="text-blue-400 hover:text-blue-300">Return to invoices</a>
			</div>
		</GlassCard>
	{:else if invoice}
		<div class="print-section flex flex-col gap-6">
			<!-- Header - Actions and Status -->
			<GlassCard className="p-6 hide-for-print">
				<div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
					<div class="flex items-center">
						<div class="mr-3 rounded-full bg-blue-500/20 p-2 text-blue-400">
							<Icon src={DocumentText} class="h-6 w-6" />
						</div>
						<div>
							<h1 class="flex items-center text-2xl font-bold">
								Invoice #{invoice.invoiceNumber || 'Draft'}
								{#if isSent}
									<span class="ml-2 rounded bg-green-900/30 px-2 py-1 text-xs text-green-400"
										>Sent</span
									>
								{:else}
									<span class="ml-2 rounded bg-amber-900/30 px-2 py-1 text-xs text-amber-400"
										>Draft</span
									>
								{/if}
							</h1>
							<div class="mt-1 text-sm text-gray-400">
								Created for {invoice?.client?.name || 'Unknown Client'}
							</div>
						</div>
					</div>

					<div class="flex flex-wrap gap-3">
						{#if !isEditMode}
							<button
								class="btn btn-secondary flex items-center gap-2"
								onclick={() => (showPrintDialog = true)}
							>
								<Icon src={Printer} class="h-4 w-4" />
								<span>Print</span>
							</button>
							<button
								class="btn btn-secondary flex items-center gap-2"
								onclick={() => (showExportDialog = true)}
							>
								<Icon src={DocumentArrowDown} class="h-4 w-4" />
								<span>Export</span>
							</button>
							<button
								class="btn btn-secondary flex items-center gap-2"
								onclick={togglePresentationMode}
							>
								<Icon src={Eye} class="h-4 w-4" />
								<span>{isPresentationMode ? 'Edit View' : 'View Mode'}</span>
							</button>

							{#if !isSent}
								<button
									class="btn btn-primary flex items-center gap-2"
									onclick={() => (showSendDialog = true)}
								>
									<Icon src={EnvelopeOpen} class="h-4 w-4" />
									<span>Mark as Sent</span>
								</button>

								<button
									class="btn btn-secondary flex items-center gap-2"
									onclick={toggleEditMode}
									disabled={isSent}
								>
									<Icon src={Pencil} class="h-4 w-4" />
									<span>Edit</span>
								</button>
							{/if}
						{:else}
							<button
								class="btn btn-secondary flex items-center gap-2"
								onclick={toggleEditMode}
								disabled={isSaving}
							>
								<Icon src={XMark} class="h-4 w-4" />
								<span>Cancel</span>
							</button>
							<button
								class="btn btn-primary flex items-center gap-2"
								onclick={saveInvoiceChanges}
								disabled={isSaving}
							>
								<Icon src={Check} class="h-4 w-4" />
								<span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
							</button>
						{/if}
					</div>
				</div>
			</GlassCard>

			<!-- Invoice Content -->
			<GlassCard className="p-0 overflow-hidden">
				<!-- Invoice Details -->
				<div class="container-glass p-6">
					<div class="flex flex-col justify-between gap-8 md:flex-row">
						<!-- Left Side - Invoice Details -->
						<div class="flex-1">
							<div class="mb-6">
								<div class="mb-1 flex items-center text-gray-400">
									<Icon src={DocumentText} class="mr-2 h-4 w-4" />
									<span class="text-sm tracking-wider uppercase">Invoice</span>
								</div>
								<div class="text-3xl font-bold ">
									#{invoice.invoiceNumber || 'Draft'}
								</div>
							</div>

							<div class="space-y-3">
								<div class="flex items-start">
									<div class="mr-3 rounded-full bg-blue-500/10 p-1">
										<Icon src={CalendarDays} class="h-4 w-4 text-blue-400" />
									</div>
									<div>
										<div class="text-xs text-gray-400">Invoice Date</div>
										<div>{formatDate(invoice.date)}</div>
									</div>
								</div>

								<div class="flex items-start">
									<div class="mr-3 rounded-full bg-blue-500/10 p-1">
										<Icon src={CreditCard} class="h-4 w-4 text-blue-400" />
									</div>
									<div>
										<div class="text-xs text-gray-400">Payment Terms</div>
										<div>Net 30 days</div>
									</div>
								</div>

								{#if !isPresentationMode}
									<div class="flex items-start">
										<div class="mr-3 rounded-full bg-blue-500/10 p-1">
											<Icon src={Cog} class="h-4 w-4 text-blue-400" />
										</div>
										<div>
											<div class="text-xs text-gray-400">Invoice ID</div>
											<div class="font-mono text-sm text-gray-500">{invoice.id}</div>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Right Side - Client Information -->
						<div class="flex-1">
							<div class="mb-6">
								<div class="mb-1 flex items-center text-gray-400">
									<Icon src={UserCircle} class="mr-2 h-4 w-4" />
									<span class="text-sm tracking-wider uppercase">Client</span>
								</div>
								<div class="text-xl font-bold">{invoice?.client?.name || 'Unknown Client'}</div>
							</div>

							<div class="space-y-3">
								{#if invoice?.client}
									<div>
										<div class="text-xs text-gray-400">Client ID</div>
										<div class="font-mono text-sm text-gray-500">{invoice.clientId}</div>
									</div>

									{#if !isPresentationMode}
										<div>
											<div class="text-xs text-gray-400">Contact Info</div>
											<div class="text-sm text-gray-500">Contact the client for details</div>
										</div>
									{/if}
								{/if}
							</div>

							<div class="flex items-center justify-between">
								<h2 class="text-xl font-bold">Client</h2>
								{#if invoice?.client}
									<a href="/clients/{invoice.client.id}" class="table-action-button-primary">
										View Client
									</a>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Summary Cards -->
				<div class="border-b border-gray-800/30 p-6">
					<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
						<StatsCard
							title="Total Duration"
							value={formatTime(invoice.totalMinutes / 60, 'formatted')}
							icon={Clock}
							iconColor="blue"
						/>

						<StatsCard
							title="Time Entry Total"
							value={formatCurrency(invoice.totalAmount)}
							icon={CurrencyDollar}
							iconColor="green"
						/>

						<StatsCard
							title="Additional Items"
							value={formatCurrency(addonTotal)}
							icon={ShoppingBag}
							iconColor="yellow"
						/>

						<StatsCard
							title="Total Amount"
							value={formatCurrency(combinedTotal)}
							icon={CreditCard}
							iconColor="purple"
							highlight={true}
						/>
					</div>

					{#if !isPresentationMode}
						<div class="hide-for-print mt-4 grid grid-cols-2 gap-4">
							<StatsCard
								title="Total Cost"
								value={formatCurrency(invoice.totalCost)}
								icon={CurrencyDollar}
								iconColor="red"
							/>

							<StatsCard
								title="Total Profit"
								value={formatCurrency(invoice.totalProfit)}
								valueClassName="text-green-300"
								icon={ChartPie}
								iconColor="green"
							/>
						</div>
					{/if}
				</div>

				<!-- Time Entries Section -->
				<div class="border-b border-gray-800/30 p-6">
					<h3 class="mb-4 flex items-center text-lg font-semibold">
						<span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
						Time Entries
					</h3>
					<div class="overflow-x-auto">
						<table class="data-table w-full">
							<thead class="data-table-header">
								<tr>
									<th>Description</th>
									<th>Date</th>
									<th class="right-aligned">Duration</th>
									<th class="right-aligned">Rate</th>
									<th class="right-aligned">Amount</th>
									<th class="right-aligned">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each invoice.entries as entry}
									<tr class="data-table-row">
										<td>
											<div class="font-medium">{entry.description}</div>
										</td>
										<td>{formatDate(entry.date)}</td>
										<td class="right-aligned">
											{formatTime(entry.minutes / 60, 'formatted')}
										</td>
										<td class="right-aligned">
											{formatCurrency(entry.billingRate?.rate || 0)}/hr
										</td>
										<td class="right-aligned">
											{formatCurrency((entry.billingRate?.rate || 0) * (entry.minutes / 60))}
										</td>
										<td class="right-aligned">
											<button
												class="table-action-button-primary"
												onclick={() => editTimeEntry(entry)}
												disabled={!isEditMode}
											>
												<Icon src={Pencil} class="mr-1 h-4 w-4" />
												Edit
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
							<tfoot class="data-table-footer">
								<tr>
									<td colspan="2">Time Entries Subtotal</td>
									<td class="right-aligned">{formatTime(invoice.totalMinutes / 60, 'formatted')}</td
									>
									<td></td>
									<td class="right-aligned">{formatCurrency(invoice.totalAmount)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>

				<!-- Additional Items Section -->
				<div class="border-b border-gray-800/30 p-6">
					<h3 class="mb-4 flex items-center text-lg font-semibold">
						<span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
						Additional Items
					</h3>

					<!-- View Mode: Display addons or empty state -->
					{#if !isEditMode}
						{#if invoice.addons.length > 0}
							<div class="overflow-x-auto">
								<table class="data-table w-full">
									<thead class="data-table-header">
										<tr>
											<th>Description</th>
											<th class="right-aligned">Price</th>
											<th class="right-aligned">Quantity</th>
											<th class="right-aligned">Amount</th>
										</tr>
									</thead>
									<tbody>
										{#each invoice.addons as addon}
											<tr class="data-table-row">
												<td>
													<div class="font-medium">{addon.description}</div>
												</td>
												<td class="right-aligned">
													{formatCurrency(addon.amount)}
												</td>
												<td class="right-aligned">
													{addon.quantity}
												</td>
												<td class="right-aligned">
													{formatCurrency(addon.amount * addon.quantity)}
												</td>
											</tr>
										{/each}
									</tbody>
									<tfoot class="data-table-footer">
										<tr>
											<td colspan="3">Additional Items Subtotal</td>
											<td class="right-aligned">
												{formatCurrency(addonTotal)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						{:else}
							<div class="rounded-lg bg-white/5 py-6 text-center text-gray-400">
								No additional items
							</div>
						{/if}
						<!-- Edit Mode: Editable Addons -->
					{:else if editableInvoice}
						<div class="overflow-x-auto">
							<table class="data-table w-full">
								<thead class="data-table-header">
									<tr>
										<th>Description</th>
										<th class="right-aligned">Price</th>
										<th class="right-aligned">Cost</th>
										<th class="right-aligned">Quantity</th>
										<th class="right-aligned">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each editableInvoice.addons as addon, i}
										<tr class="data-table-row">
											<td>
												<input
													type="text"
													class="form-input w-full"
													bind:value={addon.description}
													oninput={(e) => updateAddonItem(i, 'description', e.currentTarget.value)}
												/>
											</td>
											<td>
												<input
													type="number"
													class="form-input w-full text-right"
													value={addon.amount}
													oninput={(e) =>
														updateAddonItem(i, 'amount', parseFloat(e.currentTarget.value))}
													min="0"
													step="0.01"
												/>
											</td>
											<td>
												<input
													type="number"
													class="form-input w-full text-right"
													value={addon.cost}
													oninput={(e) =>
														updateAddonItem(i, 'cost', parseFloat(e.currentTarget.value))}
													min="0"
													step="0.01"
												/>
											</td>
											<td>
												<input
													type="number"
													class="form-input w-full text-right"
													value={addon.quantity}
													oninput={(e) =>
														updateAddonItem(i, 'quantity', parseInt(e.currentTarget.value))}
													min="1"
												/>
											</td>
											<td class="right-aligned">
												<button
													class="table-action-button-danger"
													onclick={() => removeAddonItem(i)}
												>
													Remove
												</button>
											</td>
										</tr>
									{/each}
									{#if editableInvoice.addons.length === 0}
										<tr>
											<td colspan="5" class="py-4 text-center text-gray-400">
												No additional items. Click "Add Item" to add one.
											</td>
										</tr>
									{/if}
								</tbody>
								<tfoot class="data-table-footer">
									<tr>
										<td colspan="4">Additional Items Subtotal</td>
										<td class="right-aligned">
											{formatCurrency(editableAddonTotal)}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>

						<div class="mt-4">
							<button class="btn btn-secondary flex items-center gap-2" onclick={addAddonItem}>
								<Icon src={PlusCircle} class="h-4 w-4" />
								<span>Add Item</span>
							</button>
						</div>

						<!-- Edit Mode Invoice Summary -->
						<div class="mt-6 border-t border-gray-800/50 pt-6">
							<h3 class="mb-4 flex items-center text-lg font-semibold">
								<span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
								Invoice Summary
							</h3>

							<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
								<div>
									<div class="mb-1 text-gray-400">Time Entries Total</div>
									<div class="font-medium">{formatCurrency(editableInvoice.totalAmount)}</div>
								</div>
								<div>
									<div class="mb-1 text-gray-400">Additional Items</div>
									<div class="font-medium">
										{formatCurrency(editableAddonTotal)}
									</div>
								</div>
								<div>
									<div class="mb-1 text-gray-400">Total Cost</div>
									<div class="font-medium">
										{formatCurrency(
											editableInvoice.totalCost +
												editableInvoice.addons.reduce(
													(sum, addon) => sum + addon.cost * addon.quantity,
													0
												)
										)}
									</div>
								</div>
								<div>
									<div class="mb-1 text-gray-400">Total Profit</div>
									<div class="font-medium text-green-400">
										{formatCurrency(
											editableInvoice.totalProfit +
												editableInvoice.addons.reduce((sum, addon) => sum + addon.profit, 0)
										)}
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Invoice Combined Total -->
				{#if !isEditMode}
					{#if invoice.addons.length > 0 || invoice.entries.length > 0}
						<div class="overflow-x-auto">
							<table class="data-table w-full">
								<tfoot>
									<tr class="data-table-grand-total">
										<td colspan={invoice.addons.length > 0 ? 3 : 4}>
											<div class="flex items-center">
												<span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
												<span>Invoice Total</span>
											</div>
										</td>
										<td class="right-aligned">{formatCurrency(combinedTotal)}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					{/if}
				{:else if editableInvoice}
					<div class="overflow-x-auto">
						<table class="data-table w-full">
							<tfoot>
								<tr class="data-table-grand-total">
									<td colspan="4">
										<div class="flex items-center">
											<span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
											<span>Invoice Total</span>
										</div>
									</td>
									<td class="right-aligned">{formatCurrency(editableCombinedTotal)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				{/if}

				<!-- Payment Terms Section -->
				<div class="">
					<div class="mb-4 md:mb-0">
						<div class="mb-1 text-sm text-gray-400">Payment Terms</div>
						<p class="">
							Payment is due within 30 days of receipt.<br />
							Thank you for your business.
						</p>
					</div>
				</div>
			</GlassCard>
		</div>
	{/if}
</div>

<!-- Print Dialog Modal -->
<Modal
	open={showPrintDialog}
	title="Print Invoice"
	width="max-w-md"
	on:close={() => (showPrintDialog = false)}
>
	<div>
		<div class="p-6">
			<p class="mb-4">
				Are you sure you want to print invoice #{invoice?.invoiceNumber || 'Draft'}?
			</p>
			<p class="text-sm text-gray-400">
				This will open your browser's print dialog. Choose your printer and settings from there.
			</p>
		</div>
		<div class="px-6 py-4 border-t border-white/10">
			<div class="flex justify-end gap-3">
				<button class="btn btn-secondary" onclick={() => (showPrintDialog = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={printInvoice}>Print</button>
			</div>
		</div>
	</div>
</Modal>

<!-- Export Dialog Modal -->
<Modal
	open={showExportDialog}
	title="Export to PDF"
	width="max-w-md"
	on:close={() => (showExportDialog = false)}
>
	<div>
		<div class="p-6">
			<p class="mb-4">
				Are you ready to export invoice #{invoice?.invoiceNumber || 'Draft'} to PDF?
			</p>
			<p class="text-sm text-gray-400">
				This will prepare a printer-friendly version of your invoice. When the print dialog opens, select "Save as PDF" as your destination.
			</p>
		</div>
		<div class="px-6 py-4 border-t border-white/10">
			<div class="flex justify-end gap-3">
				<button class="btn btn-secondary" onclick={() => (showExportDialog = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={exportToPDF} disabled={exportingPDF}>
					{exportingPDF ? 'Preparing PDF...' : 'Export to PDF'}
				</button>
			</div>
		</div>
	</div>
</Modal>

<!-- Send Dialog Modal -->
<Modal
	open={showSendDialog}
	title="Mark Invoice as Sent"
	width="max-w-md"
	on:close={() => (showSendDialog = false)}
>
	<div>
		<div class="p-6">
			<p class="mb-4">
				Are you sure you want to mark invoice #{invoice?.invoiceNumber || 'Draft'} as sent?
			</p>
			<p class="text-sm text-gray-400 mb-4">
				This will lock the invoice and mark it as sent to the client. You won't be able to edit the invoice after this action.
			</p>
			<div class="bg-amber-900/20 text-amber-400 p-3 rounded">
				<p class="text-sm">
					Note: This action only marks the invoice as sent in the system. You'll still need to actually send the invoice to your client outside of TimeVault.
				</p>
			</div>
		</div>
		<div class="px-6 py-4 border-t border-white/10">
			<div class="flex justify-end gap-3">
				<button class="btn btn-secondary" onclick={() => (showSendDialog = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={markAsSent}>Mark as Sent</button>
			</div>
		</div>
	</div>
</Modal>

<!-- Time Entry Edit Modal -->
<Modal
	open={showTimeEntryModal}
	title="Time Entry Details"
	width="max-w-lg"
	on:close={() => (showTimeEntryModal = false)}
>
	{#if currentTimeEntry}
		<div>
			<div class="p-6">
				<dl class="space-y-4">
					<div>
						<dt class="text-sm text-gray-400">Description</dt>
						<dd>{currentTimeEntry.description}</dd>
					</div>
					<div>
						<dt class="text-sm text-gray-400">Date</dt>
						<dd>{formatDate(currentTimeEntry.date)}</dd>
					</div>
					<div>
						<dt class="text-sm text-gray-400">Duration</dt>
						<dd>{formatTime(currentTimeEntry.minutes / 60, 'formatted')}</dd>
					</div>
					<div>
						<dt class="text-sm text-gray-400">Rate</dt>
						<dd>{formatCurrency(currentTimeEntry.billingRate?.rate || 0)}/hr</dd>
					</div>
					<div>
						<dt class="text-sm text-gray-400">Amount</dt>
						<dd>{formatCurrency((currentTimeEntry.billingRate?.rate || 0) * (currentTimeEntry.minutes / 60))}</dd>
					</div>
					{#if isSent}
						<div class="bg-blue-900/30 text-blue-400 p-3 rounded">
							<p class="text-sm flex items-center">
								<Icon src={EnvelopeOpen} class="w-5 h-5 mr-2" />
								This time entry is locked because the invoice has been sent to the client.
							</p>
						</div>
					{/if}
				</dl>
			</div>
			<div class="px-6 py-4 border-t border-white/10">
				<div class="flex justify-end gap-3">
					<button class="btn btn-secondary" onclick={() => (showTimeEntryModal = false)}>Close</button>
					{#if !isSent}
						<button class="btn btn-danger" onclick={removeTimeEntryFromInvoice} disabled={isSent}>
							Remove from Invoice
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</Modal>
