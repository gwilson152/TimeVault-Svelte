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
	}: ModalProps = $props();

	// Generate unique IDs for accessibility
	const modalId = $props.id();
	const titleId = `${modalId}-title`;

	// Local state
	let isOpen = $state(open);
	let modalTitle = $state(title);

	// Effect to sync prop changes to local state
	$effect(() => {
		isOpen = open;
		modalTitle = title;
	});

	// Handle escape key press
	function handleEscapeKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			closeModal();
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('modal-backdrop')) {
			closeModal();
		}
	}

	// Handle backdrop keydown for accessibility
	function handleBackdropKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			closeModal();
		}
	}

	// Close modal helper
	function closeModal() {
		isOpen = false;
		onclose();
	}

	// Helper classes for variants
	const variantClasses = $derived(() => {
		switch (variant) {
			case 'drawer':
				return 'modal-drawer ' + (size === 'full' ? 'w-full' : 'w-full sm:w-3/4 md:w-1/2 lg:w-1/3');
			case 'fullscreen':
				return 'modal-fullscreen';
			default:
				return 'modal-default';
		}
	});
</script>

<svelte:window on:keydown={handleEscapeKey} />

{#if isOpen}
	<div
		class="modal-backdrop"
		id={modalId}
		role="dialog"
		tabindex="-1"
		aria-labelledby={titleId}
		aria-modal="true"
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKeyDown}
		transition:fade={{ duration: 200 }}
	>
		<div class="flex min-h-screen items-center justify-center {variant === 'drawer' ? 'justify-end' : 'px-4'}">
			<div
				class="modal-overlay"
				role="presentation"
				transition:fade={{ duration: 400 }}
			/>

			<div
				class="modal-container modal-{size} modal-{variant}"
				role="document"
				transition:fly={{
					y: variant === 'drawer' ? 0 : 20,
					x: variant === 'drawer' ? 20 : 0,
					duration: 400
				}}
				on:click|stopPropagation={() => {}}
			>
				<div class="flex h-full flex-col">
					<div class="modal-header">
						<div class="flex items-center justify-between">
							<h2 id={titleId} class="modal-title">{modalTitle}</h2>
							<button
								type="button"
								class="modal-close"
								on:click={closeModal}
								aria-label="Close modal"
							>
								<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none">
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

					<div class="modal-content">
						{@render children()}
					</div>

					{#if footer}
						<div class="modal-footer">
							{@render footer()}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
