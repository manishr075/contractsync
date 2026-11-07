import { Spot, GetSpotsResponse } from './api.types.js';
import { getMockSpots, mockSpotResponse } from './mocks.js';

export async function renderSpotCard(): Promise<string> {
  const spot: Spot = await getMockSpots();
  return `Spot #${spot.id}: ${spot.name}`;
}

export { mockSpotResponse };
