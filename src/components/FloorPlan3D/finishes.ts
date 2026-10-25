import type { FinishMaterialId, RoomFinishOverrides, SurfaceFinish } from '../../types';

const FINISH_MATERIAL_IDS: readonly FinishMaterialId[] = ['paint', 'tile', 'marble', 'wood'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function isValidScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isValidRoughness(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isFinishMaterialId(value: unknown): value is FinishMaterialId {
  return typeof value === 'string' && FINISH_MATERIAL_IDS.includes(value as FinishMaterialId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeFinish(value: unknown): SurfaceFinish | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<SurfaceFinish>;
  if (!isFinishMaterialId(candidate.materialId)) return undefined;

  const finish: SurfaceFinish = { materialId: candidate.materialId };
  if (isValidHexColor(candidate.color)) finish.color = candidate.color;
  if (typeof candidate.variantId === 'string' && candidate.variantId.length > 0) {
    finish.variantId = candidate.variantId;
  }
  if (isValidScale(candidate.scale)) finish.scale = candidate.scale;
  if (typeof candidate.rotation === 'number' && Number.isFinite(candidate.rotation)) {
    finish.rotation = candidate.rotation;
  }
  if (isValidRoughness(candidate.roughness)) finish.roughness = candidate.roughness;
  return finish;
}

export function getRoomFinishOverride(
  finishes: unknown,
  roomId: string,
  surface: keyof RoomFinishOverrides,
): SurfaceFinish | undefined {
  if (!isRecord(finishes) || !isRecord(finishes.rooms)) return undefined;
  const room = finishes.rooms[roomId];
  return isRecord(room) ? sanitizeFinish(room[surface]) : undefined;
}

export function getWallFinishOverride(
  finishes: unknown,
  wallId: string,
): SurfaceFinish | undefined {
  if (!isRecord(finishes) || !isRecord(finishes.walls)) return undefined;
  return sanitizeFinish(finishes.walls[wallId]);
}

export function resolveSurfaceFinish(
  override: SurfaceFinish | undefined,
  fallback: SurfaceFinish,
): SurfaceFinish {
  return override ? { ...fallback, ...override } : { ...fallback };
}
