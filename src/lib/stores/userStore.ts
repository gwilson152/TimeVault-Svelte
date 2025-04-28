import { writable, derived } from 'svelte/store';
import type { User, UserRole } from '$lib/types';
import { get as httpGet, post, put, del } from '$lib/services/api';

// Define the authentication state interface
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null
};

function createUserStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);
  
  return {
    subscribe,
    
    // Load all users
    async getUsers() {
      try {
        const users = await httpGet<User[]>('/users');
        return users;
      } catch (error) {
        console.error('Failed to load users:', error);
        throw error;
      }
    },
    
    // Get users by role
    async getUsersByRole(role: UserRole) {
      try {
        const users = await httpGet<User[]>(`/users?role=${role}`);
        return users;
      } catch (error) {
        console.error(`Failed to load ${role} users:`, error);
        throw error;
      }
    },
    
    // Get users by client
    async getUsersByClient(clientId: string) {
      try {
        const users = await httpGet<User[]>(`/users?clientId=${clientId}`);
        return users;
      } catch (error) {
        console.error('Failed to load client users:', error);
        throw error;
      }
    },
    
    // Create a new user
    async createUser(userData: { email: string; name: string; password: string; role: UserRole; clientId?: string | null }) {
      try {
        const newUser = await post<User>('/users', userData);
        return newUser;
      } catch (error) {
        console.error('Failed to create user:', error);
        throw error;
      }
    },
    
    // Update a user
    async updateUser(id: string, userData: Partial<User & { password?: string }>) {
      try {
        const updatedUser = await put<User>(`/users/${id}`, userData);
        return updatedUser;
      } catch (error) {
        console.error('Failed to update user:', error);
        throw error;
      }
    },
    
    // Delete a user
    async deleteUser(id: string) {
      try {
        await del(`/users/${id}`);
      } catch (error) {
        console.error('Failed to delete user:', error);
        throw error;
      }
    },
    
    // Login - This would be connected to an API endpoint for authentication
    async login(email: string, password: string) {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        // This would call an actual authentication endpoint
        // For now, we just simulate it with a timeout
        
        // TODO: Replace with actual API call when authentication endpoint is implemented
        const user = await new Promise<User>((resolve, reject) => {
          // Simulate API call
          setTimeout(() => {
            if (email === 'admin@example.com' && password === 'password') {
              resolve({
                id: 'admin-user-id',
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'ADMIN',
                clientId: null,
                active: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLoginAt: new Date()
              });
            } else {
              reject(new Error('Invalid credentials'));
            }
          }, 500);
        });
        
        update(state => ({
          ...state,
          isAuthenticated: true,
          user,
          isLoading: false,
          error: null
        }));
        
        return user;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        update(state => ({ 
          ...state, 
          isLoading: false, 
          error: errorMessage
        }));
        
        throw error;
      }
    },
    
    // Logout the current user
    logout() {
      set(initialState);
    },
    
    // Check if the current user has a specific role
    hasRole(role: UserRole) {
      let result = false;
      subscribe(state => {
        if (state.isAuthenticated && state.user) {
          result = state.user.role === role;
        }
      });
      return result;
    },
    
    // Get the current user ID (useful for creating notes, time entries, etc.)
    getCurrentUserId() {
      let userId: string | null = null;
      subscribe(state => {
        userId = state.user?.id || null;
      });
      return userId;
    }
  };
}

export const userStore = createUserStore();

// Derived store for checking permissions based on roles
export const userPermissions = derived(
  userStore,
  ($userStore) => {
    const isAdmin = $userStore.user?.role === 'ADMIN';
    const isAgent = $userStore.user?.role === 'AGENT' || isAdmin;
    const isClientAdmin = $userStore.user?.role === 'CLIENT_ADMIN' || isAgent;
    const isAuthenticated = $userStore.isAuthenticated;
    
    const clientId = $userStore.user?.clientId;
    
    return {
      isAuthenticated,
      isAdmin,
      isAgent,
      isClientAdmin,
      clientId,
      
      // Generic permission checkers
      canManageUsers: isAdmin,
      canManageClients: isAgent,
      canManageTickets: isAgent || isClientAdmin,
      canManageBilling: isAgent,
      
      // Specific action permissions
      canViewInternalNotes: isAgent,
      canCreateInternalNotes: isAgent,
      
      // Client-specific checks
      canAccessClient(id: string) {
        return isAgent || clientId === id;
      },
      
      // Ticket-specific checks
      canEditTicket(ticket: { clientId: string }) {
        return isAgent || (isClientAdmin && clientId === ticket.clientId);
      },
      
      // User-specific checks
      canEditUser(user: { id: string, clientId: string | null }) {
        return isAdmin || (isClientAdmin && user.clientId === clientId && user.id !== $userStore.user?.id);
      }
    };
  }
);