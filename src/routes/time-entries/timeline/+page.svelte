<script lang="ts">
  import { onMount } from 'svelte';
  import { GlassCard } from '$lib/components';
  import type { TimeEntry, TimeEntryWithClient } from '$lib/types';
  import { formatTime, minutesToFormatted } from '$lib/utils/timeUtils';
  import { timeEntryStore, entriesWithClientInfo } from '$lib/stores/timeEntryStore';
  import { clientStore } from '$lib/stores/clientStore';
  import { formatCurrency, formatDate } from '$lib/utils/invoiceUtils';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Plus, Clock, ArrowPath, CalendarDays } from '@steeze-ui/heroicons';

  // Page state
  let date = $state(new Date());
  let workdayStart = $state('09:00');
  let workdayEnd = $state('17:00');
  let filter = $state('unbilled');
  let entries = $state<TimeEntryWithClient[]>([]);
  let filteredEntries = $state<TimeEntryWithClient[]>([]);
  let isLoading = $state(true);

  // Timeline interaction state
  let scrollContainer: HTMLElement;
  let isDragging = $state(false);
  let dragEntry = $state<TimeEntry | null>(null);
  let dragStartX = $state(0);
  let originalStartTime = $state<Date | null>(null);
  let tempStartTime = $state<Date | null>(null); // Temporary start time during drag
  let timelineWidth = $state(0);
  let minutesPerPixel = $state(1);
  let showQuickEntry = $state(false);
  let quickEntryPosition = $state({ x: 0, width: 60 }); // Default 1 hour width

  // Validate date using $derived with robust checks
  const validDate = $derived(() => {
    const fallback = new Date();
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return fallback;
    }
    return date;
  });

  // Derived ISO string for date input
  const dateInputValue = $derived(
    validDate instanceof Date && !isNaN(validDate.getTime())
      ? validDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );

  // Derived timeline values with validation
  const timelineStart = $derived(() => {
    const startDate = new Date(validDate);
    const startStr = typeof workdayStart === 'string' && workdayStart.match(/^\d{2}:\d{2}$/) ? workdayStart : '09:00';
    const [hours, minutes] = startStr.split(':').map(Number);
    startDate.setHours(isNaN(hours) ? 9 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
    return startDate;
  });

  const timelineEnd = $derived(() => {
    const endDate = new Date(validDate);
    const endStr = typeof workdayEnd === 'string' && workdayEnd.match(/^\d{2}:\d{2}$/) ? workdayEnd : '17:00';
    const [hours, minutes] = endStr.split(':').map(Number);
    endDate.setHours(isNaN(hours) ? 17 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
    // Ensure end is after start
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    return endDate;
  });

  const workdayMinutes = $derived(() => {
    if (!(timelineStart instanceof Date) || !(timelineEnd instanceof Date)) {
      return 8 * 60; // Default to 8 hours
    }
    const minutes = (timelineEnd.getTime() - timelineStart.getTime()) / 1000 / 60;
    return minutes > 0 ? minutes : 8 * 60; // Ensure positive duration
  });

  const totalHours = $derived(
    filteredEntries.reduce((sum, entry) => sum + (entry.minutes / 60 || 0), 0)
  );

  const totalAmount = $derived(
    filteredEntries
      .filter((entry) => entry.billable && entry.billingRate)
      .reduce(
        (sum, entry) => sum + ((entry.minutes / 60) || 0) * (entry.billingRate?.rate || 0),
        0
      )
  );

  // Load data on mount
  onMount(async () => {
    try {
      await Promise.all([clientStore.load(), timeEntryStore.load()]);
      updateTimelineScale();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      isLoading = false;
    }
  });

  // Consolidated effect for store and filter updates with debouncing
  let debounceTimeout: NodeJS.Timeout | null = null;
  $effect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(() => {
      const validEntries = ($entriesWithClientInfo || [])
        .filter((entry): entry is NonNullable<typeof entry> => {
          if (!entry) return false;
          // Validate entry.date
          if (!entry.date || (typeof entry.date !== 'string' && !(entry.date instanceof Date))) {
            console.warn('Invalid entry date type in effect:', { id: entry.id, date: entry.date, type: typeof entry.date, value: JSON.stringify(entry.date) });
            return false;
          }
          const entryDate = new Date(entry.date);
          const isValid = entryDate instanceof Date && !isNaN(entryDate.getTime()) && typeof entryDate.getFullYear === 'function';
          if (!isValid) {
            console.warn('Invalid entry date value in effect:', { id: entry.id, date: entry.date, entryDate });
          }
          return isValid;
        })
        .map((entry) => ({
          ...entry,
          durationHours: entry.minutes / 60,
          client: entry.client || undefined
        }));

      // Only update if entries have changed
      if (JSON.stringify(validEntries) !== JSON.stringify(entries)) {
        console.log('Updating entries:', { validEntriesCount: validEntries.length });
        entries = validEntries;
      }

      filteredEntries = filterEntries(entries, filter);
    }, 200);
  });

  // Update scale when container size or workday changes
  $effect(() => {
    if (scrollContainer && workdayMinutes > 0) {
      updateTimelineScale();
    }
  });

  function updateTimelineScale() {
    if (!scrollContainer) return;
    
    const width = scrollContainer.clientWidth;
    if (width <= 0 || workdayMinutes <= 0) return;
    
    timelineWidth = width;
    minutesPerPixel = workdayMinutes / width;
  }

  function filterEntries(allEntries: TimeEntryWithClient[], activeFilter: string): TimeEntryWithClient[] {
    // First filter by the selected date
    const sameDay = allEntries.filter(entry => {
      // Validate entry.date type and value
      if (!entry.date || (typeof entry.date !== 'string' && !(entry.date instanceof Date))) {
        console.warn('Invalid entry date type:', { id: entry.id, date: entry.date, type: typeof entry.date, value: JSON.stringify(entry.date) });
        return false;
      }
      const entryDate = new Date(entry.date);
      if (!(entryDate instanceof Date) || isNaN(entryDate.getTime()) || typeof entryDate.getFullYear !== 'function') {
        console.warn('Invalid entry date value:', { id: entry.id, date: entry.date, entryDate: JSON.stringify(entryDate) });
        return false;
      }
      return (
        entryDate.getFullYear() === validDate.getFullYear() &&
        entryDate.getMonth() === validDate.getMonth() &&
        entryDate.getDate() === validDate.getDate()
      );
    });

    // Then apply additional filtering
    switch (activeFilter) {
      case 'billable':
        return sameDay.filter((entry) => entry.billable);
      case 'unbilled':
        return sameDay.filter((entry) => entry.billable && !entry.billed);
      case 'billed':
        return sameDay.filter((entry) => entry.billed);
      default:
        return sameDay;
    }
  }

  function getEntryClasses(entry: TimeEntryWithClient) {
    const baseClasses = [
      'absolute h-12 top-8 rounded group transition-colors',
      dragEntry?.id === entry.id ? 'z-10' : ''
    ];
    
    if (!entry.billable) {
      baseClasses.push('bg-blue-500/20 border border-blue-500/30');
    } else if (!entry.billed) {
      baseClasses.push('bg-green-500/20 border border-green-500/30');
    } else {
      baseClasses.push('bg-amber-500/20 border border-amber-500/30');
    }
    
    return baseClasses.filter(Boolean).join(' ');
  }

  function getEntryStyle(entry: TimeEntryWithClient): string {
    const startTime = dragEntry?.id === entry.id && tempStartTime ? tempStartTime : new Date(entry.startTime);
    const duration = entry.minutes;
    const offsetMinutes = (startTime.getTime() - timelineStart.getTime()) / 1000 / 60;
    const left = Math.max(0, offsetMinutes / minutesPerPixel);
    const width = Math.max(20, duration / minutesPerPixel); // Ensure at least 20px width

    return `
      left: ${left}px;
      width: ${width}px;
    `;
  }

  function handleTimelineClick(event: MouseEvent) {
    if (isDragging) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const minutes = x * minutesPerPixel;
    
    const clickTime = new Date(timelineStart.getTime() + minutes * 60 * 1000);
    
    // Don't create entry if click is outside workday
    if (clickTime < timelineStart || clickTime > timelineEnd) return;

    showQuickEntry = true;
    quickEntryPosition = { x, width: 60 / minutesPerPixel };
  }

  function handleDragStart(event: MouseEvent, entry: TimeEntryWithClient) {
    if (entry.locked || entry.billed) return; // Prevent dragging locked entries
    isDragging = true;
    dragEntry = entry;
    dragStartX = event.clientX;
    originalStartTime = new Date(entry.startTime);
    tempStartTime = new Date(entry.startTime);
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

    const newEntry = await timeEntryStore.add({
      description: 'Quick entry',
      startTime,
      endTime: null,
      minutes,
      date: validDate,
      clientId: null,
      ticketId: null,
      billable: true,
      billingRateId: null,
      billed: false,
      locked: false
    });

    // Manually update entries to avoid full store refresh
    entries = [
      ...entries,
      {
        ...newEntry,
        durationHours: newEntry.minutes / 60,
        client: undefined,
        clientName: 'Unknown Client'
      }
    ];
    filteredEntries = filterEntries(entries, filter);

    showQuickEntry = false;
  }

  function handleDateChange(newDate: string) {
    const parsedDate = new Date(newDate);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  }

  function refreshEntries() {
    isLoading = true;
    timeEntryStore.load().then(() => {
      isLoading = false;
    });
  }

  function setFilter(newFilter: string) {
    filter = newFilter;
  }

  function handleResize() {
    updateTimelineScale();
  }
</script>

<svelte:window
  onresize={handleResize}
  onmousemove={handleDragMove}
  onmouseup={handleDragEnd}
/>

<div class="space-y-6">
  <!-- Page Header -->
  <GlassCard className="p-6">
    <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div class="flex items-center space-x-3">
        <Icon src={Clock} class="h-8 w-8 text-blue-500" />
        <h1 class="text-2xl font-bold">Timeline View</h1>
      </div>

      <div class="flex w-full flex-col gap-3 md:w-auto md:flex-row">
        <!-- Stats Summary -->
        <div class="flex flex-wrap gap-3">
          <div class="rounded-full bg-white/5 px-4 py-2 text-sm">
            <span class="font-semibold">{totalHours.toFixed(1)}</span> hours
          </div>
          <div class="rounded-full bg-white/5 px-4 py-2 text-sm">
            <span class="font-semibold">{formatCurrency(totalAmount)}</span> billable
          </div>
        </div>

        <!-- Action buttons -->
        <div class="ml-auto flex gap-2">
          <button class="btn btn-secondary flex items-center gap-2" onclick={refreshEntries}>
            <Icon src={ArrowPath} class="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <a href="/time-entries" class="btn btn-secondary">
            <Icon src={Clock} class="mr-2 h-4 w-4" />
            List View
          </a>
        </div>
      </div>
    </div>
  </GlassCard>

  <!-- Filters -->
  <GlassCard className="p-4">
    <div class="flex flex-col justify-between gap-4 md:flex-row">
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {filter === 'all'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => setFilter('all')}
        >
          All
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {filter === 'billable'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => setFilter('billable')}
        >
          Billable
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {filter === 'unbilled'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => setFilter('unbilled')}
        >
          Unbilled
        </button>
        <button
          class="rounded-full px-3 py-1.5 text-sm transition-colors {filter === 'billed'
            ? 'bg-blue-500 text-white'
            : 'bg-container-glass hover:bg-container-glass-hover'}"
          onclick={() => setFilter('billed')}
        >
          Billed
        </button>
      </div>

      <!-- Date selector -->
      <div class="flex items-center gap-2">
        <label for="dateSelector" class="flex items-center gap-1">
          <Icon src={CalendarDays} class="h-5 w-5 text-blue-500" />
          <span>Date:</span>
        </label>
        <input
          id="dateSelector"
          type="date"
          class="form-input"
          value={dateInputValue}
          onchange={(e) => handleDateChange(e.currentTarget.value)}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>
    </div>
  </GlassCard>

  <!-- Timeline View -->
  <GlassCard className="p-4">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-medium">Time Entries</h3>
          {#if isLoading}
            <span class="text-sm text-gray-400">Loading...</span>
          {/if}
        </div>
        <div class="text-sm text-gray-400">
          {workdayStart} - {workdayEnd}
        </div>
      </div>

      <div
        class="relative h-64 overflow-x-auto rounded-lg bg-gray-800/20 border border-gray-700/30"
        bind:this={scrollContainer}
        onclick={handleTimelineClick}
      >
        <!-- Empty state message -->
        {#if filteredEntries.length === 0 && !isLoading}
          <div class="absolute inset-0 flex items-center justify-center text-gray-400">
            <div class="text-center">
              <p>No time entries found for this date.</p>
              <p class="text-sm mt-2">Click anywhere on the timeline to create an entry.</p>
            </div>
          </div>
        {/if}
        
        <!-- Time markers -->
        <div class="absolute inset-0 pointer-events-none">
          {#if timelineStart instanceof Date}
            {#each Array.from({ length: Math.ceil(workdayMinutes / 60) + 1 }) as _, i}
              <div
                class="absolute top-0 bottom-0 border-l border-gray-700/30"
                style="left: {(i * 60) / minutesPerPixel}px"
              >
                <div class="text-xs text-gray-500 px-1">
                  {formatTime(new Date(timelineStart.getTime() + i * 60 * 60 * 1000))}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Current time indicator -->
        {#if timelineStart instanceof Date && ((new Date().getTime() - timelineStart.getTime()) / 1000 / 60) / minutesPerPixel > 0 && ((new Date().getTime() - timelineStart.getTime()) / 1000 / 60) / minutesPerPixel < timelineWidth}
          <div
            class="absolute top-0 bottom-0 border-l border-red-500 z-20"
            style="left: {((new Date().getTime() - timelineStart.getTime()) / 1000 / 60) / minutesPerPixel}px"
          >
            <div class="text-xs text-red-500 px-1 bg-gray-900/50 rounded">
              Now
            </div>
          </div>
        {/if}

        <!-- Quick entry placeholder -->
        {#if showQuickEntry}
          <div
            class="absolute bg-blue-500/20 border border-blue-500/30 rounded h-12 top-16 cursor-pointer hover:bg-blue-500/30 transition-colors"
            style="left: {quickEntryPosition.x}px; width: {quickEntryPosition.width}px;"
            onclick={createQuickEntry}
          >
            <div class="flex items-center justify-center h-full text-blue-400">
              <Icon src={Plus} class="w-5 h-5" />
              <span class="ml-1">Create Entry</span>
            </div>
          </div>
        {/if}

        <!-- Time entries -->
        {#each filteredEntries as entry (entry.id)}
          <div
            class={getEntryClasses(entry)}
            style={getEntryStyle(entry)}
          >
            <div
              class="absolute inset-0 p-2 cursor-move flex items-center"
              onmousedown={(e) => handleDragStart(e, entry)}
            >
              <div class="flex-1 truncate">
                <div class="text-sm font-medium truncate">
                  {entry.description}
                </div>
                <div class="text-xs text-gray-400 flex items-center justify-between">
                  <span>{formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : '?'}</span>
                  <span>{minutesToFormatted(entry.minutes)}</span>
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

      <!-- Time entries summary -->
      {#if filteredEntries.length > 0}
        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-gray-400">Entries</div>
            <div class="font-medium text-lg">{filteredEntries.length}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-gray-400">Total Hours</div>
            <div class="font-medium text-lg">{totalHours.toFixed(1)}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4">
            <div class="text-sm text-gray-400">Total Amount</div>
            <div class="font-medium text-lg">{formatCurrency(totalAmount)}</div>
          </div>
        </div>
      {/if}
    </div>
  </GlassCard>
</div>

<style>
  /* Prevent text selection while dragging */
  .cursor-move {
    user-select: none;
  }
</style>