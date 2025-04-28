import type { Client, TimeEntry } from '$lib/types';

export function getChildClients(clients: Client[], parentId: string): Client[] {
  const children = clients.filter(c => c.parentId === parentId);
  let allChildren: Client[] = [...children];
  
  for (const child of children) {
    allChildren = [...allChildren, ...getChildClients(clients, child.id)];
  }
  
  return allChildren;
}

export function hasUnbilledTime(entries: TimeEntry[], clients: Client[], clientId: string): boolean {
  const directEntries = entries.some(entry => 
    entry.clientId === clientId && 
    entry.billable && 
    !entry.billed
  );
  if (directEntries) return true;
  
  const children = clients.filter(c => c.parentId === clientId);
  return children.some(child => hasUnbilledTime(entries, clients, child.id));
}

export function getClientHierarchy(clients: Client[], clientId: string): Client[] {
  const client = clients.find(c => c.id === clientId);
  if (!client) return [];
  
  return [client, ...getChildClients(clients, clientId)];
}