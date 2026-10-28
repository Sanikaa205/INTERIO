import type { FloorPlanResult } from '../../../types';

/**
 * Stable key over the plan fields that affect house geometry. Finish edits
 * only change `plan.finishes`, so they leave this key (and the model) alone.
 */
export function houseGeometryKey(plan: Pick<FloorPlanResult, 'rooms' | 'circulation' | 'plotWidth' | 'plotLength'>): string {
  return JSON.stringify({ rooms: plan.rooms, circulation: plan.circulation, plotWidth: plan.plotWidth, plotLength: plan.plotLength });
}
