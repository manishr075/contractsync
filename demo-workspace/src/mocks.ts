import { Spot } from './api.types.js';

/**
 * Mock response data adhering to the Spot contract (v1.1.0)
 * Synchronized by: ContractSync FrontendSync Agent
 */
export const mockSpotResponse: Spot = {
  id: 101,
  name: 'Library',
  availability_state: 'available',
  role: 'admin',
  // Retained for backward compatibility with legacy consumers
  spot_status: 'available',
};

/**
 * Mock API client handler for GET /api/spots
 */
export async function getMockSpots(): Promise<Spot> {
  return Promise.resolve(mockSpotResponse);
}
