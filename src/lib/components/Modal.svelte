<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
	type ModalVariant = 'default' | 'drawer' | 'fullscreen';

	interface ModalProps {
		open?: boolean;
		title?: string;
		size?: ModalSize;
		variant?: ModalVariant;
		onclose?: () => void;
		children: () => import('svelte').ComponentType | HTMLElement | string;
		footer?: () => import('svelte').ComponentType | HTMLElement | string;
	}

	// Destructure props with fallback values
	let {
		open = false,
		title = '',
		size = 'md' as ModalSize,
		variant = 'default' as ModalVariant,
		onclose = () => {},
		children,
		footer
	}: ModalProps = $props<ModalProps>();

	// Generate unique IDs for accessibility
	const modalId = $props.id();
	const titleId = `${modalId}-title`;

	// Local state
	let isOpen = $state(open);
	let modalTitle = $state(title);
	let modalSize = $state(size);
	let modalVariant = $state(variant);
	// Effect to sync prop changes to local state
	$effect(() => {
		isOpen = open;
		modalTitle = title;
		modalSize = size;
		modalVariant = variant;
	});

	// Map size to tailwind width class
	const sizeToWidth = $derived(() => {
		switch (modalSize) {
			case 'sm':
				return 'max-w-sm';
			case 'md':
				return 'max-w-md';
			case 'lg':
				return 'max-w-lg';
			case 'xl':
				return 'max-w-xl';
			case 'full':
				return 'max-w-4xl';
			default:
				return 'max-w-2xl';
		}
	});

	// Close modal
	function closeModal() {
		onclose?.();
	}

	// Event handlers
	function handleEscapeKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			closeModal();
		}
	}

	// Handle backdrop interactions
	function handleModalInteraction(e: MouseEvent | KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isBackdropClick =
			target.classList.contains('modal-backdrop') || target.classList.contains('modal-overlay');

		if (isBackdropClick && isOpen) {
			closeModal();
			e.stopPropagation();
		}
	}

	// Keyboard accessible backdrop handler
	function handleBackdropKeyDown(e: KeyboardEvent) {
		if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
			e.preventDefault();
			closeModal();
		}
	}

	// Helper classes for variants
	const variantClasses = $derived(() => {
		switch (modalVariant) {
			case 'drawer':
				return 'fixed right-0 top-0 h-full rounded-l-lg ' + (modalSize === 'full' ? 'w-full' : 'w-full sm:w-3/4 md:w-1/2 lg:w-1/3');
			case 'fullscreen':
				return 'fixed inset-0 h-full w-full m-0 rounded-none';
			default:
				return `relative ${sizeToWidth} w-full mx-auto my-4 md:my-8 rounded-lg`;
		}
	});
</script>

<svelte:window onkeydown={handleEscapeKey} />

{#if isOpen}
	<div
		class="modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-transparent"
		id={modalId}
		role="dialog"
		tabindex="-1"
		aria-labelledby={titleId}
		aria-modal="true"
		onclick={handleModalInteraction}
		onkeydown={handleBackdropKeyDown}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="flex min-h-screen items-center justify-center {modalVariant === 'drawer'
				? 'justify-end'
				: 'px-4'}"
		>
			<!-- Backdrop overlay -->
			<div
				class="bg-opacity-50 modal-overlay fixed inset-0 backdrop-blur-sm"
				role="presentation"
				transition:fade={{ duration: 400 }}
			/>

			<!-- Modal container -->
			<div
				class="bg-white text-gray-900 shadow-lg dark:bg-gray-100 {variantClasses} z-100"
				role="document"
				transition:fly={{
					y: modalVariant === 'drawer' ? 0 : 20,
					x: modalVariant === 'drawer' ? 20 : 0,
					duration: 400
				}}
				onclick={(e) => e.stopPropagation()}
			>
				<div class="flex h-full flex-col">
					<div class="border-b border-gray-200 px-6 py-4">
						<div class="flex items-center justify-between">
							<h2 id={titleId} class="text-lg font-medium text-gray-900">{modalTitle}</h2>
							<button
								type="button"
								class="rounded-full p-2 transition-colors hover:bg-gray-100"
								onclick={closeModal}
								aria-label="Close modal"
							>
								<svg class="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="none">
									<path
										d="M6 18L18 6M6 6l12 12"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						</div>
					</div>

					<div class="flex-1 overflow-auto p-6">
						{@render children()}
					</div>

					{#if footer}
						<div class="border-t border-gray-200 px-6 py-4">
							{@render footer()}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
