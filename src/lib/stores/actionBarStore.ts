import { writable } from 'svelte/store';
import { 
  Home,
  UserGroup,
  Clock,
  Ticket,
  DocumentText,
  Cog6Tooth
} from '@steeze-ui/heroicons';
import type { IconSource } from '@steeze-ui/svelte-icon';

interface Action {
  href: string;
  icon: IconSource;
  tooltip: string;
}

interface ActionBarState {
  currentActions: Action[];
}

const defaultActions: Action[] = [
  { href: '/', icon: Home, tooltip: 'Dashboard' },
  { href: '/clients', icon: UserGroup, tooltip: 'Clients' },
  { href: '/time-entries', icon: Clock, tooltip: 'Time' },
  { href: '/tickets', icon: Ticket, tooltip: 'Tickets' },
  { href: '/invoices', icon: DocumentText, tooltip: 'Invoices' },
  { href: '/settings', icon: Cog6Tooth, tooltip: 'Settings' }
];

function createActionBarStore() {
  const { subscribe, set, update } = writable<ActionBarState>({
    currentActions: defaultActions
  });

  return {
    subscribe,
    setActions: (actions: Action[]) => update(state => ({ ...state, currentActions: actions })),
    reset: () => set({ currentActions: defaultActions })
  };
}

export const actionBarStore = createActionBarStore();