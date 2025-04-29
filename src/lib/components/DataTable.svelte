<script context="module" lang="ts">
  export interface Column {
    key: string;
    title: string;
    sortable?: boolean;
    class?: string;
    cellClass?: string | ((value: any, row: any) => string);
    headerClass?: string;
    formatter?: (value: any, row: any) => string;
    render?: (value: any, row: any) => any;
    width?: string;
    align?: 'left' | 'right' | 'center';
    searchable?: boolean;
  }
  
  export interface FooterColumn {
    colSpan?: number;
    content: string | number;
    align?: 'left' | 'right' | 'center';
    highlight?: boolean;
    className?: string;
  }
</script>

<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import { MagnifyingGlass, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from '@steeze-ui/heroicons';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  
  const dispatch = createEventDispatcher<{
    rowClick: { row: any; id: string };
    rowToggle: { id: string; expanded: boolean };
    sort: { key: string; direction: 'asc' | 'desc' };
    selection: { ids: string[]; rows: any[] };
    pageChange: { page: number };
    pageSizeChange: { size: number };
  }>();

  export let data: any[] = [];
  export let columns: Column[] = [];
  export let title: string = '';
  export let searchable: boolean = true;
  export let pageable: boolean = true;
  export let selectable: boolean = false;
  export let pageSize: number = 10;
  export let pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  export let currentPage: number = 1;
  export let loading: boolean = false;
  export let emptyMessage: string = 'No data found';
  export let searchPlaceholder: string = 'Search...';
  
  // Footer options
  export let footerContent: string = '';
  export let footerRows: FooterColumn[][] = [];
  export let showGrandTotal: boolean = false;
  export let grandTotalLabel: string = 'Grand Total';
  export let grandTotalValue: string | number = '';
  export let grandTotalColSpan: number = 1;
  
  // Nested data support
  export let nestedKey: string = ''; // Key for children/nested items (e.g., "children")
  export let nestedIndent: number = 24; // Indentation for nested rows in pixels
  export let defaultCollapsed: boolean = true; // Whether nested rows should be collapsed initially

  // Optional custom template to render above the table
  let customHeader = $$slots.header;
  // Optional custom template to render at the bottom of the card
  let customFooter = $$slots.footer;
  // Optional custom template to render in the table footer
  let customTableFooter = $$slots.tableFooter;

  // Local state
  let searchTerm: string = '';
  let sortKey: string | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';
  let selectedRows = new Set<string>();
  let expandedRows = new Set<string>();
  let allSelected: boolean = false;
  let processedData: any[] = [];
  
  // Initialize expanded state based on defaultCollapsed setting
  onMount(() => {
    if (!defaultCollapsed && nestedKey) {
      initializeExpandedState(data);
    }
    processData();
  });
  
  // Watch for data changes
  $: {
    if (data) {
      processData();
    }
  }
  
  // Watch for changes to search, sort, or expanded state
  $: {
    if (searchTerm !== undefined || sortKey !== undefined || expandedRows) {
      processData();
    }
  }
  
  // Process all data operations in sequence
  function processData() {
    processedData = flattenData();
    
    // Apply filtering
    if (searchTerm) {
      processedData = filterData(processedData);
    }
    
    // Apply sorting
    if (sortKey) {
      processedData = sortData(processedData);
    }
  }
  
  // Computed values for pagination
  $: paginatedData = paginate(processedData);
  $: totalPages = Math.ceil(processedData.length / pageSize);
  
  // Reset pagination when filters change
  $: if (searchTerm !== undefined) {
    currentPage = 1;
  }
  
  // Initialize expanded state for nested data
  function initializeExpandedState(items: any[], pathPrefix: string = '') {
    if (!items || !Array.isArray(items) || !nestedKey) return;
    
    items.forEach((item, index) => {
      const path = pathPrefix ? `${pathPrefix}-${index}` : `${index}`;
      
      if (item[nestedKey] && Array.isArray(item[nestedKey]) && item[nestedKey].length > 0) {
        expandedRows.add(path);
        initializeExpandedState(item[nestedKey], path);
      }
    });
    
    // Create a new Set to trigger reactivity
    expandedRows = new Set([...expandedRows]);
  }

  // Flatten hierarchical data with nested children
  function flattenData(): any[] {
    if (!data || !Array.isArray(data)) return [];
    
    function processItems(items: any[], parentPath = '', level = 0): any[] {
      if (!items || !Array.isArray(items)) return [];
      
      let result: any[] = [];
      
      items.forEach((item, index) => {
        const path = parentPath ? `${parentPath}-${index}` : `${index}`;
        const hasChildren = nestedKey && 
          item[nestedKey] && 
          Array.isArray(item[nestedKey]) && 
          item[nestedKey].length > 0;
        
        // Add the item with metadata
        result.push({
          ...item,
          _dataTableId: path,
          _dataTableParentId: parentPath,
          _dataTableLevel: level,
          _dataTableHasChildren: hasChildren,
          _dataTableVisible: level === 0 || isParentExpanded(parentPath)
        });
        
        // Add children if this node is expanded
        if (hasChildren && expandedRows.has(path)) {
          const children = processItems(item[nestedKey], path, level + 1);
          result = result.concat(children);
        }
      });
      
      return result;
    }
    
    return processItems(data);
  }
  
  // Check if all parents in the path are expanded
  function isParentExpanded(path: string): boolean {
    if (!path) return true;
    
    // Check all parent paths to see if they're expanded
    const segments = path.split('-');
    let currentPath = '';
    
    for (let i = 0; i < segments.length; i++) {
      if (i === 0) {
        currentPath = segments[i];
      } else {
        currentPath += `-${segments[i]}`;
      }
      
      if (!expandedRows.has(currentPath)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Filter data based on search term
  function filterData(data: any[]): any[] {
    if (!searchTerm) return data;
    
    // First, find rows that match the search
    const matchingRows = data.filter(row => {
      return columns.some(column => {
        if (column.searchable === false) return false;
        const value = getValue(row, column.key);
        if (value == null) return false;
        
        const formattedValue = column.formatter 
          ? column.formatter(value, row) 
          : String(value).toLowerCase();
          
        return String(formattedValue).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
    
    // Collect all parent paths of matching rows to keep them visible
    const requiredParentPaths = new Set<string>();
    matchingRows.forEach(row => {
      let parentPath = row._dataTableParentId;
      while (parentPath) {
        requiredParentPaths.add(parentPath);
        const parts = parentPath.split('-');
        parts.pop();
        parentPath = parts.join('-');
      }
    });
    
    // Include rows that either match or are parents of matches
    return data.filter(row => {
      const isDirectMatch = columns.some(column => {
        if (column.searchable === false) return false;
        const value = getValue(row, column.key);
        if (value == null) return false;
        
        const formattedValue = column.formatter 
          ? column.formatter(value, row) 
          : String(value).toLowerCase();
          
        return String(formattedValue).toLowerCase().includes(searchTerm.toLowerCase());
      });
      
      const isRequiredParent = requiredParentPaths.has(row._dataTableId);
      
      return isDirectMatch || isRequiredParent;
    });
  }
  
  // Sort data while respecting hierarchy
  function sortData(data: any[]): any[] {
    if (!sortKey) return data;
    
    const sortedData = [...data];
    const parentGroups = new Map<string, any[]>();
    
    // Group rows by parent ID
    sortedData.forEach(row => {
      const parentId = row._dataTableParentId || 'root';
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, []);
      }
      parentGroups.get(parentId)?.push(row);
    });
    
    // Sort each group
    for (const [parentId, group] of parentGroups.entries()) {
      group.sort((a, b) => {
        // Make sure sortKey is not null before using it
        if (!sortKey) return 0;
        
        const aValue = getValue(a, sortKey);
        const bValue = getValue(b, sortKey);
        
        // Handle null/undefined
        if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
        if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
        
        // String comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        // Numeric comparison
        return sortDirection === 'asc' 
          ? (aValue > bValue ? 1 : -1) 
          : (aValue > bValue ? -1 : 1);
      });
    }
    
    // Reconstruct the sorted array maintaining hierarchy
    function reconstructSorted(parentId = 'root', level = 0): any[] {
      const group = parentGroups.get(parentId) || [];
      let result: any[] = [];
      
      group.forEach(row => {
        result.push(row);
        if (row._dataTableHasChildren && expandedRows.has(row._dataTableId)) {
          const children = reconstructSorted(row._dataTableId, level + 1);
          result = result.concat(children);
        }
      });
      
      return result;
    }
    
    return reconstructSorted();
  }
  
  // Paginate data
  function paginate(data: any[]): any[] {
    if (!pageable) return data;
    
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }
  
  // Handle row toggle expansion
  function toggleRowExpansion(id: string): void {
    if (expandedRows.has(id)) {
      expandedRows.delete(id);
    } else {
      expandedRows.add(id);
    }
    
    // Create a new set to trigger reactivity
    expandedRows = new Set([...expandedRows]);
    
    // Re-process data to update visibility
    processData();
    
    dispatch('rowToggle', { id, expanded: expandedRows.has(id) });
  }
  
  // Helper functions
  function toggleSort(column: Column): void {
    if (!column.sortable) return;
    
    if (sortKey === column.key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = column.key;
      sortDirection = 'asc';
    }
    
    dispatch('sort', { key: sortKey, direction: sortDirection });
  }
  
  function handleRowSelect(id: string): void {
    if (selectedRows.has(id)) {
      selectedRows.delete(id);
    } else {
      selectedRows.add(id);
    }
    selectedRows = new Set([...selectedRows]); // Create new set for reactivity
    
    const selectedItems = processedData.filter(row => selectedRows.has(row._dataTableId));
    
    dispatch('selection', { 
      ids: Array.from(selectedRows),
      rows: selectedItems
    });
  }
  
  function toggleSelectAll(): void {
    allSelected = !allSelected;
    
    if (allSelected) {
      selectedRows = new Set(processedData.map(row => row._dataTableId));
    } else {
      selectedRows = new Set();
    }
    
    const selectedItems = processedData.filter(row => selectedRows.has(row._dataTableId));
    
    dispatch('selection', { 
      ids: Array.from(selectedRows),
      rows: selectedItems
    });
  }
  
  function handlePageChange(page: number): void {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    dispatch('pageChange', { page });
  }
  
  function handlePageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    pageSize = parseInt(select.value);
    currentPage = 1;
    dispatch('pageSizeChange', { size: pageSize });
  }
  
  function getValue(obj: any, path: string): any {
    if (!obj || !path) return null;
    const keys = path.split('.');
    return keys.reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
  }
  
  function getNestedIndentStyle(level: number): string {
    return `padding-left: ${level * nestedIndent}px`;
  }
  
  // Determine if we need to display a footer
  $: hasFooter = footerContent || footerRows.length > 0 || showGrandTotal || customTableFooter || $$slots.tableFooter;

  // Calculate effective colspan for each footer column
  function getEffectiveColspan(column: FooterColumn, index: number, row: FooterColumn[]): number {
    if (column.colSpan !== undefined) return column.colSpan;
    
    // If not specified, calculate the colspan to make the row fill the table width
    const totalSpecifiedColSpans = row.reduce((sum, col, i) => {
      return sum + (i !== index && col.colSpan !== undefined ? col.colSpan : 0);
    }, 0);
    
    const remainingCols = columns.length - totalSpecifiedColSpans;
    const unspecifiedCols = row.filter((col, i) => i !== index && col.colSpan === undefined).length;
    
    return Math.max(1, Math.floor(remainingCols / (unspecifiedCols + 1)));
  }
</script>

<div class="container-glass overflow-hidden">
  {#if title || searchable || customHeader}
    <div class="p-4 border-b border-gray-700/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      {#if title}
        <div class="text-lg font-medium">{title}</div>
      {/if}
      
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
        {#if customHeader}
          <slot name="header"></slot>
        {/if}
        
        {#if searchable}
          <div class="relative w-full sm:w-64">
            <input
              type="text"
              class="form-input pl-9 w-full"
              placeholder={searchPlaceholder}
              bind:value={searchTerm}
            />
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon src={MagnifyingGlass} class="w-4 h-4" />
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <div class="overflow-x-auto">
    {#if loading}
      <div class="flex items-center justify-center p-8" in:fade={{ duration: 200 }}>
        <div class="animate-pulse text-gray-400">Loading...</div>
      </div>
    {:else if data.length === 0 || processedData.length === 0}
      <div class="text-center py-8" in:fade={{ duration: 200 }}>
        <div class="text-gray-400">{emptyMessage}</div>
      </div>
    {:else}
      <table class="data-table">
        <thead class="data-table-header">
          <tr>
            {#if nestedKey}
              <th class="w-10"></th>
            {/if}
            
            {#if selectable}
              <th class="w-10">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  checked={allSelected}
                  on:change={toggleSelectAll}
                />
              </th>
            {/if}
            
            {#each columns as column}
              <th 
                class="{column.sortable ? 'cursor-pointer' : ''} {column.headerClass || ''}"
                class:right-aligned={column.align === 'right'}
                class:text-center={column.align === 'center'}
                style={column.width ? `width: ${column.width}` : ''}
                on:click={() => toggleSort(column)}
              >
                <div class="flex items-center {column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}">
                  <span>{column.title}</span>
                  {#if column.sortable && sortKey === column.key}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        
        <tbody>
          {#each paginatedData as row}
            {#if row._dataTableVisible !== false}
              <tr 
                class="data-table-row" 
                class:selected={selectable && selectedRows.has(row._dataTableId)}
                on:click={() => dispatch('rowClick', { row, id: row._dataTableId })}
              >
                {#if nestedKey}
                  <td class="w-10" on:click|stopPropagation>
                    <div style={getNestedIndentStyle(row._dataTableLevel)} class="flex">
                      {#if row._dataTableHasChildren}
                        <button 
                          class="p-1 rounded-full hover:bg-white/10 transition-colors"
                          on:click={() => toggleRowExpansion(row._dataTableId)}
                        >
                          <Icon src={expandedRows.has(row._dataTableId) ? ChevronDown : ChevronRightIcon} class="w-4 h-4" />
                        </button>
                      {/if}
                    </div>
                  </td>
                {/if}
                
                {#if selectable}
                  <td class="w-10" on:click|stopPropagation>
                    <input
                      type="checkbox"
                      class="form-checkbox"
                      checked={selectedRows.has(row._dataTableId)}
                      on:change={() => handleRowSelect(row._dataTableId)}
                    />
                  </td>
                {/if}
                
                {#each columns as column}
                  <td 
                    class="{typeof column.cellClass === 'function' ? column.cellClass(getValue(row, column.key), row) : column.cellClass || ''}"
                    class:right-aligned={column.align === 'right'}
                    class:text-center={column.align === 'center'}
                  >
                    {#if column.render}
                      {@html column.render(getValue(row, column.key), row)}
                    {:else if column.formatter}
                      {@html column.formatter(getValue(row, column.key), row)}
                    {:else}
                      {getValue(row, column.key) ?? ''}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/if}
          {/each}
        </tbody>
        
        {#if hasFooter}
          <tfoot class="data-table-footer">
            {#if customTableFooter || $$slots.tableFooter}
              <slot name="tableFooter"></slot>
            {/if}
            
            {#if footerContent}
              {@html footerContent}
            {/if}
            
            {#each footerRows as row, rowIndex}
              <tr class:data-table-subtotal={!showGrandTotal || rowIndex < footerRows.length - 1}>
                {#if nestedKey}
                  <td></td>
                {/if}
                
                {#if selectable}
                  <td></td>
                {/if}
                
                {#each row as column, colIndex}
                  <td 
                    colspan={getEffectiveColspan(column, colIndex, row)}
                    class:right-aligned={column.align === 'right'}
                    class:text-center={column.align === 'center'}
                    class:font-medium={column.highlight}
                    class={column.className || ''}
                  >
                    {column.content}
                  </td>
                {/each}
              </tr>
            {/each}
            
            {#if showGrandTotal}
              <tr class="data-table-grand-total">
                <td colspan={grandTotalColSpan}>
                  <div class="flex items-center">
                    <span class="mr-2 inline-block h-4 w-1 rounded bg-blue-500"></span>
                    <span>{grandTotalLabel}</span>
                  </div>
                </td>
                <td 
                  colspan={columns.length - grandTotalColSpan + (nestedKey ? 1 : 0) + (selectable ? 1 : 0)}
                  class="right-aligned font-medium"
                >
                  {grandTotalValue}
                </td>
              </tr>
            {/if}
          </tfoot>
        {/if}
      </table>
    {/if}
  </div>
  
  {#if pageable && totalPages > 1}
    <div class="p-4 border-t border-gray-700/20 flex flex-col sm:flex-row justify-between items-center gap-3">
      <div class="text-sm text-gray-400">
        Showing {Math.min((currentPage - 1) * pageSize + 1, processedData.length)} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
      </div>
      
      <div class="flex items-center gap-2">
        <div class="hidden sm:flex items-center">
          <select 
            class="form-select mr-2 text-sm py-1 px-2" 
            on:change={handlePageSizeChange}
            value={pageSize}
          >
            {#each pageSizeOptions as option}
              <option value={option}>{option} per page</option>
            {/each}
          </select>
        </div>
        
        <button
          class="table-action-button"
          disabled={currentPage === 1}
          on:click={() => handlePageChange(currentPage - 1)}
        >
          <Icon src={ChevronLeft} class="w-4 h-4" />
        </button>
        
        <div class="flex">
          {#if totalPages <= 7}
            {#each Array(totalPages) as _, i}
              <button
                class="table-action-button {currentPage === i + 1 ? 'bg-blue-500/20 text-blue-300' : ''}"
                on:click={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            {/each}
          {:else}
            <!-- First page -->
            <button
              class="table-action-button {currentPage === 1 ? 'bg-blue-500/20 text-blue-300' : ''}"
              on:click={() => handlePageChange(1)}
            >
              1
            </button>
            
            <!-- Ellipsis start -->
            {#if currentPage > 4}
              <span class="table-action-button">...</span>
            {/if}
            
            <!-- Middle pages -->
            {#each Array(5) as _, i}
              {#if currentPage > 3 && currentPage < totalPages - 2}
                {#if i + currentPage - 2 > 1 && i + currentPage - 2 < totalPages}
                  <button
                    class="table-action-button {currentPage === i + currentPage - 2 ? 'bg-blue-500/20 text-blue-300' : ''}"
                    on:click={() => handlePageChange(i + currentPage - 2)}
                  >
                    {i + currentPage - 2}
                  </button>
                {/if}
              {:else if currentPage <= 3}
                {#if i + 2 < totalPages}
                  <button
                    class="table-action-button {currentPage === i + 2 ? 'bg-blue-500/20 text-blue-300' : ''}"
                    on:click={() => handlePageChange(i + 2)}
                  >
                    {i + 2}
                  </button>
                {/if}
              {:else}
                {#if i + totalPages - 5 > 1}
                  <button
                    class="table-action-button {currentPage === i + totalPages - 5 ? 'bg-blue-500/20 text-blue-300' : ''}"
                    on:click={() => handlePageChange(i + totalPages - 5)}
                  >
                    {i + totalPages - 5}
                  </button>
                {/if}
              {/if}
            {/each}
            
            <!-- Ellipsis end -->
            {#if currentPage < totalPages - 3}
              <span class="table-action-button">...</span>
            {/if}
            
            <!-- Last page -->
            <button
              class="table-action-button {currentPage === totalPages ? 'bg-blue-500/20 text-blue-300' : ''}"
              on:click={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </button>
          {/if}
        </div>
        
        <button
          class="table-action-button"
          disabled={currentPage === totalPages}
          on:click={() => handlePageChange(currentPage + 1)}
        >
          <Icon src={ChevronRight} class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}
  
  {#if customFooter || $$slots.footer}
    <div class="p-4 border-t border-gray-700/20">
      <slot name="footer"></slot>
    </div>
  {/if}
</div>