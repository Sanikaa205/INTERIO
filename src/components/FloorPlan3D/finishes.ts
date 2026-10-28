import { OUTSIDE_FACE } from './model/wallFaces';
import type { FinishMaterialId, RoomFinishOverrides, SurfaceFinish } from '../../types';

const FINISH_MATERIAL_IDS: readonly FinishMaterialId[] = [
  'paint', 'tile', 'marble', 'wood', 'granite', 'concrete', 'brick', 'stone', 'wallpaper', 'plaster',
];
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

/** Finish stored for one face of a wall (`faceKey` is a room id or `OUTSIDE_FACE`). */
export function getWallFaceFinishOverride(
  finishes: unknown,
  wallId: string,
  faceKey: string,
): SurfaceFinish | undefined {
  if (!isRecord(finishes) || !isRecord(finishes.wallFaces)) return undefined;
  const faces = finishes.wallFaces[wallId];
  return isRecord(faces) ? sanitizeFinish(faces[faceKey]) : undefined;
}

/**
 * Finish that applies to a wall face: its own override, else the legacy
 * whole-wall finish, else undefined (the renderer then uses its default).
 */
export function resolveWallFaceFinish(
  finishes: unknown,
  wallId: string,
  faceKey: string,
): SurfaceFinish | undefined {
  return getWallFaceFinishOverride(finishes, wallId, faceKey) ?? getWallFinishOverride(finishes, wallId);
}

export { OUTSIDE_FACE };

export function resolveSurfaceFinish(
  override: SurfaceFinish | undefined,
  fallback: SurfaceFinish,
): SurfaceFinish {
  return override ? { ...fallback, ...override } : { ...fallback };
}
