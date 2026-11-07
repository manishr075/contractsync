import { Spot } from './api.types.js';

/**
 * Mock response data adhering to the Spot contract (v1.0.0)
 */
export const mockSpotResponse: Spot = {
  id: 101,
  name: 'Library',
  spot_status: 'available',
};

/**
 * Mock API client handler for GET /api/spots
 */
export async function getMockSpots(): Promise<Spot> {
  return Promise.resolve(mockSpotResponse);
}
