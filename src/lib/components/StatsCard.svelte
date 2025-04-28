<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import type { IconSource } from '@steeze-ui/svelte-icon/types';

  // Props definition
  export let title: string;
  export let value: string | number;
  export let subtitle: string = '';
  export let icon: IconSource;
  export let iconColor: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'indigo' = 'blue';
  export let highlight: boolean = false;
  export let className: string = '';
  export let valueClassName: string = '';

  // Color mapping for icon backgrounds
  const iconColorMap = {
    blue: {
      bg: 'bg-blue-500/30',
      text: 'text-blue-300'
    },
    green: {
      bg: 'bg-green-500/30',
      text: 'text-green-300'
    },
    purple: {
      bg: 'bg-purple-500/30',
      text: 'text-purple-300'
    },
    yellow: {
      bg: 'bg-yellow-500/30',
      text: 'text-yellow-300'
    },
    red: {
      bg: 'bg-red-500/30',
      text: 'text-red-300'
    },
    indigo: {
      bg: 'bg-indigo-500/30',
      text: 'text-indigo-300'
    }
  };

  // Get color classes based on the iconColor prop
  $: iconBgClass = iconColorMap[iconColor].bg;
  $: iconTextClass = iconColorMap[iconColor].text;
  
  // Determine background class based on highlight prop
  $: bgGradient = highlight 
    ? `from-purple-500/50 to-blue-600/40` 
    : `from-${iconColor}-500/50 to-${iconColor}-600/40`;
</script>

<div class="bg-gray-900/60 bg-gradient-to-br {bgGradient} backdrop-blur-sm rounded-lg p-4 border border-white/10 shadow-lg {className}">
  <div class="flex items-start justify-between">
    <div>
      <div class="text-sm font-medium text-white/90">{title}</div>
      <div class="mt-1 text-2xl font-medium text-white {valueClassName}">{value}</div>
      {#if subtitle}
        <div class="text-xs text-white/70 mt-1">
          {@html subtitle}
        </div>
      {/if}
      <slot name="footer"></slot>
    </div>
    <div class="{iconBgClass} {iconTextClass} rounded-full p-2 shadow-md">
      <Icon src={icon} class="w-5 h-5" />
    </div>
  </div>
  <slot></slot>
</div>