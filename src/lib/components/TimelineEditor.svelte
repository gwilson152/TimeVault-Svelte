<script lang="ts">
  import { onMount } from 'svelte';
  import type { TimeEntry } from '$lib/types';
  import { formatTime, minutesToFormatted } from '$lib/utils/timeUtils';
  import { timeEntryStore } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { formatCurrency } from '$lib/utils/invoiceUtils';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Plus, Clock } from '@steeze-ui/heroicons';

  // Props
  export let date: Date = new Date();
  export let workdayStart: string = '09:00';
  export let workdayEnd: string = '17:00';
  export let entries: TimeEntry[] = [];

  // State
  let scrollContainer: HTMLElement;
  let isDragging = false;
  let dragEntry: TimeEntry | null = null;
  let dragStartX = 0;
  let originalStartTime: Date | null = null;
  let tempStartTime: Date | null = null; // Temporary start time during drag
  let timelineWidth = 0;
  let minutesPerPixel = 1;
  let showQuickEntry = false;
  let quickEntryPosition = { x: 0, width: 60 }; // Default 1 hour width

  // Consolidated reactive statements with validation
  $: timelineStart = (() => {
    const start = new Date(date);
    const [hours, minutes] = (workdayStart || '09:00').split(':').map(Number);
    start.setHours(isNaN(hours) ? 9 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
    return start;
  })();

  $: timelineEnd = (() => {
    const end = new Date(date);
    const [hours, minutes] = (workdayEnd || '17:00').split(':').map(Number);
    end.setHours(isNaN(hours) ? 17 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
    return end;
  })();

  $: workdayMinutes = (timelineEnd.getTime() - timelineStart.getTime()) / 1000 / 60;
  
  onMount(() => {
    updateTimelineScale();
    clientStore.load();
  });

  function updateTimelineScale() {
    if (scrollContainer) {
      timelineWidth = scrollContainer.clientWidth;
      minutesPerPixel = workdayMinutes / timelineWidth;
    }
  }

  function getEntryStyle(entry: TimeEntry): string {
    // Use tempStartTime during drag for the dragged entry
    const startTime = dragEntry === entry && tempStartTime ? tempStartTime : new Date(entry.startTime);
    const duration = entry.minutes;
    const offsetMinutes = (startTime.getTime() - timelineStart.getTime()) / 1000 / 60;
    const left = offsetMinutes / minutesPerPixel;
    const width = duration / minutesPerPixel;

    return `
      left: ${left}px;
      width: ${width}px;
    `;
  }

  function getEntryClasses(entry: TimeEntry) {
    const baseClasses = [
      'absolute h-12 top-8 rounded group transition-colors',
      dragEntry === entry ? 'z-10' : ''
    ];
    
    if (!entry.billable) {
      baseClasses.push('bg-blue-500/20 border-blue-500/30');
    } else if (!entry.billed) {
      baseClasses.push('bg-green-500/20 border-green-500/30');
    } else {
      baseClasses.push('bg-amber-500/20 border-amber-500/30');
    }
    
    return baseClasses.filter(Boolean).join(' ');
  }

  function handleTimelineClick(event: MouseEvent) {
    if (isDragging) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const minutes = x * minutesPerPixel;
    const clickTime = new Date(timelineStart.getTime() + minutes * 60 * 1000);

    showQuickEntry = true;
    quickEntryPosition = { x, width: 60 / minutesPerPixel };
  }

  function handleDragStart(event: MouseEvent, entry: TimeEntry) {
    if (entry.locked || entry.billed) return; // Prevent dragging locked entries
    isDragging = true;
    dragEntry = entry;
    dragStartX = event.clientX;
    originalStartTime = new Date(entry.startTime);
    tempStartTime = new Date(entry.startTime); // Initialize temporary start time
    event.preventDefault();
  }

  function handleDragMove(event: MouseEvent) {
    if (!isDragging || !dragEntry || !originalStartTime) return;

    const deltaX = event.clientX - dragStartX;
    const deltaMinutes = Math.round(deltaX * minutesPerPixel);
    tempStartTime = new Date(originalStartTime.getTime() + deltaMinutes * 60 * 1000);
  }

  function handleDragEnd() {
    if (dragEntry && tempStartTime) {
      // Commit the final start time to the store
      timeEntryStore.update(dragEntry.id, {
        startTime: tempStartTime,
        minutes: dragEntry.minutes // Keep duration the same
      });
    }
    isDragging = false;
    dragEntry = null;
    originalStartTime = null;
    tempStartTime = null;
  }

  async function createQuickEntry() {
    if (!showQuickEntry) return;

    const minutes = Math.round(quickEntryPosition.width * minutesPerPixel);
    const startTime = new Date(timelineStart.getTime() + quickEntryPosition.x * minutesPerPixel * 60 * 1000);

    await timeEntryStore.add({
      description: 'Quick entry',
      startTime,
      endTime: null,
      minutes,
      date,
      clientId: null,
      ticketId: null,
      billable: true,
      billingRateId: null,
      billed: false,
      locked: false
    });

    showQuickEntry = false;
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium">Timeline</h3>
    <div class="text-sm text-gray-400">
      {workdayStart} - {workdayEnd}
    </div>
  </div>

  <div
    class="relative h-32 overflow-x-auto rounded-lg bg-gray-800/20"
    bind:this={scrollContainer}
    on:click={handleTimelineClick}
  >
    <!-- Time markers -->
    <div class="absolute inset-0 pointer-events-none">
      {#each Array.from({ length: workdayMinutes / 60 + 1 }) as _, i}
        <div
          class="absolute top-0 bottom-0 border-l border-gray-700/30"
          style="left: {(i * 60) / minutesPerPixel}px"
        >
          <div class="text-xs text-gray-500 px-1">
            {formatTime(new Date(timelineStart.getTime() + i * 60 * 60 * 1000))}
          </div>
        </div>
      {/each}
    </div>

    <!-- Quick entry placeholder -->
    {#if showQuickEntry}
      <div
        class="absolute bg-blue-500/20 border border-blue-500/30 rounded h-12 top-8 cursor-pointer hover:bg-blue-500/30 transition-colors"
        style="left: {quickEntryPosition.x}px; width: {quickEntryPosition.width}px;"
        on:click={createQuickEntry}
      >
        <div class="flex items-center justify-center h-full text-blue-400">
          <Icon src={Plus} class="w-5 h-5" />
        </div>
      </div>
    {/if}

    <!-- Time entries -->
    {#each entries as entry (entry.id)}
      <div
        class={getEntryClasses(entry)}
        style={getEntryStyle(entry)}
      >
        <div
          class="absolute inset-0 p-2 cursor-move flex items-center"
          on:mousedown={(e) => handleDragStart(e, entry)}
        >
          <div class="flex-1 truncate">
            <div class="text-sm font-medium truncate">
              {entry.description}
            </div>
            <div class="text-xs text-gray-400">
              {minutesToFormatted(entry.minutes)}
              {#if entry.billable && entry.billingRate}
                · {formatCurrency(entry.billingRate.rate * (entry.minutes / 60))}
              {/if}
            </div>
          </div>
        </div>

        <!-- Resize handles -->
        <div
          class="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize opacity-0 group-hover:opacity-100 hover:bg-white/10"
        ></div>
        <div
          class="absolute right-0 top-0 bottom-0 w-1 cursor-e-resize opacity-0 group-hover:opacity-100 hover:bg-white/10"
        ></div>
      </div>
    {/each}
  </div>
</div>

<svelte:window
  on:mousemove={handleDragMove}
  on:mouseup={handleDragEnd}
/>

<style>
  /* Prevent text selection while dragging */
  .cursor-move {
    user-select: none;
  }
</style>