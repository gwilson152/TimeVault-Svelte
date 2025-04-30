<script lang="ts">
	import '../app.css';
	import ActionBar from '$lib/components/ActionBar.svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { themeStore } from '$lib/stores/themeStore';
	import { onMount } from 'svelte';

	// Initialize the theme system on client-side
	onMount(() => {
		themeStore.initialize();
	});
</script>

<div class="flex min-h-screen flex-col">
	<!-- Transparent Header -->
	<header class="fixed top-0 right-0 left-0 z-50 px-4 py-2">
		<div class="container mx-auto flex items-center justify-between">
			<a href="/" class="text-default text-xl font-bold">TimeVault</a>

			<div class="flex items-center space-x-2">
				<button class="rounded-full p-2 hover:bg-gray-100/10">
					<span class="text-default">User</span>
				</button>
			</div>
		</div>
	</header>

	<main class="flex-grow pt-24 pb-24">
		{#key $page.url.pathname}
			<div class="responsive-container mx-auto" in:fade={{ duration: 150, delay: 100 }}>
				<slot />
			</div>
		{/key}
	</main>

	<ActionBar />
</div>

<style>
	:global(body) {
		overflow-y: scroll;
	}
</style>
