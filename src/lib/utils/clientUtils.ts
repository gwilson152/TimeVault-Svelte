import type { Client, TimeEntry, ClientBillingRateOverride } from '$lib/types';

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

/**
 * Get the effective billing rate override for a client by checking both the client
 * and its parent hierarchy. Child overrides take precedence over parent overrides.
 * 
 * @param clients All clients in the system
 * @param clientId The ID of the client to check
 * @param baseRateId The ID of the billing rate to get the override for
 * @returns The most specific billing rate override or undefined if none exists
 */
export function getEffectiveBillingRateOverride(
  clients: Client[], 
  clientId: string | null,
  baseRateId: string
): ClientBillingRateOverride | undefined {
  if (!clientId) return undefined;
  
  // Get the client's hierarchy (from current to root)
  const hierarchy = getClientHierarchyPath(clients, clientId);
  
  // Check each client in the hierarchy, starting from the most specific (child)
  for (const client of hierarchy) {
    const override = client.billingRateOverrides?.find(o => o.baseRateId === baseRateId);
    if (override) {
      return override;
    }
  }
  
  return undefined;
}

/**
 * Get the full client hierarchy path from the client to the root
 * Returns an array with the client itself first, followed by its parent, etc.
 *
 * @param clients All clients in the system
 * @param clientId The ID of the client to get the hierarchy for
 * @returns Array of clients from specific to general (child to parent)
 */
export function getClientHierarchyPath(clients: Client[], clientId: string): Client[] {
  const result: Client[] = [];
  let currentClientId = clientId;
  
  while (currentClientId) {
    const client = clients.find(c => c.id === currentClientId);
    if (!client) break;
    
    result.push(client);
    currentClientId = client.parentId || '';
  }
  
  return result;
}

/**
 * Find potential parent business client by email domain
 */
export function findParentByEmailDomain(clients: Client[], email: string): Client | undefined {
  if (!email) return undefined;
  
  const domain = email.split('@')[1];
  if (!domain) return undefined;

  const businessClients = clients.filter(c => c.type === 'business' && c.domains?.length > 0);
  return businessClients.find(client => 
    client.domains.some(clientDomain => 
      domain.toLowerCase().endsWith(clientDomain.toLowerCase())
    )
  );
}

/**
 * Get available container options for a client within a business
 */
export function getAvailableContainers(clients: Client[], businessId: string): Client[] {
  const business = clients.find(c => c.id === businessId);
  if (!business) return [];

  return getClientHierarchy(clients, businessId)
    .filter(c => c.type === 'container')
    .sort((a, b) => a.name.localeCompare(b.name));
}