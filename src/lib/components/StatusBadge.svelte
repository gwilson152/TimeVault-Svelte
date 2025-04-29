<script lang="ts">
  import type { TicketStatus } from '$lib/types';
  
  const props = $props<{
    status?: TicketStatus | null | undefined;
    color?: string;
    text?: string;
    fallbackText?: string;
    className?: string;
  }>();

  let status = $state(props.status);
  let color = $state(props.color);
  let text = $state(props.text);
  let fallbackText = $state(props.fallbackText ?? 'No Status');
  let className = $state(props.className ?? '');
  
  // Safe getter for color with fallback
  const getColor = () => {
    if (color) return color.replace('#', '');
    if (!status?.color) return '718096'; // Default slate gray
    return status.color.replace('#', '');
  };
  
  // Safe getter for name with fallback
  const getName = () => {
    if (text) return text;
    return status?.name ?? fallbackText;
  };
</script>

<span 
  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-{getColor()}-500/10 text-{getColor()}-400 {className}"
>
  {getName()}
</span>