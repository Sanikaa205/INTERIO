export interface QwenRenovationInput {
  roomType: string;
  conditionAndRequirements: string;
  style: string;
  budget: string;
  preferredColors?: string[];
  preferredMaterials?: string[];
  furniturePreferences?: string;
  dimensions?: { width: number; length: number; height?: number; area?: number };
  existingFurniture?: { name: string; category: string; width?: number; depth?: number }[];
  existingConstraints?: string[];
}

export interface QwenRenovationRecommendations {
  designConcept: string;
  colorPalette: { hex: string; name: string; role: string; description: string }[];
  materials: string[];
  furnitureChanges: string[];
  lightingChanges: string[];
  renovationTasks: { step: string; details: string }[];
  estimatedCost: { min: number; max: number; currency: string; basis: string } | null;
}

const asText = (value: unknown, max = 500): string | null =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;

export function validateQwenRecommendations(value: unknown): QwenRenovationRecommendations {
  if (!value || typeof value !== 'object') throw new Error('Qwen returned an invalid renovation plan.');
  const data = value as Record<string, unknown>;
  const designConcept = asText(data.designConcept, 1200);
  if (!designConcept) throw new Error('Qwen returned an incomplete renovation plan.');

  const strings = (input: unknown, maxItems: number): string[] | null => {
    if (!Array.isArray(input) || input.length > maxItems || input.some((x) => !asText(x, 500))) return null;
    return input.map((x) => (x as string).trim());
  };
  const colorPalette = Array.isArray(data.colorPalette) && data.colorPalette.length <= 8
    ? data.colorPalette.map((swatch: any) => {
        if (!swatch || !/^#[0-9a-f]{6}$/i.test(swatch.hex || '') || !asText(swatch.name, 80) || !asText(swatch.role, 40) || !asText(swatch.description, 240)) return null;
        return { hex: swatch.hex, name: swatch.name.trim(), role: swatch.role.trim(), description: swatch.description.trim() };
      })
    : null;
  const renovationTasks = Array.isArray(data.renovationTasks) && data.renovationTasks.length <= 12
    ? data.renovationTasks.map((task: any) => {
        const step = asText(task?.step, 120);
        const details = asText(task?.details, 500);
        return step && details ? { step, details } : null;
      })
    : null;
  const estimatedCost = data.estimatedCost === null ? null : (() => {
    const cost = data.estimatedCost as any;
    if (!cost || !Number.isFinite(cost.min) || !Number.isFinite(cost.max) || cost.min < 0 || cost.max < cost.min || cost.max > 1_000_000_000 || !asText(cost.currency, 12) || !asText(cost.basis, 300)) return undefined;
    return { min: cost.min, max: cost.max, currency: cost.currency.trim(), basis: cost.basis.trim() };
  })();

  const materials = strings(data.materials, 12);
  const furnitureChanges = strings(data.furnitureChanges, 12);
  const lightingChanges = strings(data.lightingChanges, 10);
  if (!colorPalette || colorPalette.some((x) => !x) || !renovationTasks || renovationTasks.some((x) => !x) || estimatedCost === undefined || !materials || !furnitureChanges || !lightingChanges) {
    throw new Error('Qwen returned a renovation plan with invalid or missing fields.');
  }
  return { designConcept, colorPalette: colorPalette as QwenRenovationRecommendations['colorPalette'], materials, furnitureChanges, lightingChanges, renovationTasks: renovationTasks as QwenRenovationRecommendations['renovationTasks'], estimatedCost };
}

export function createQwenRenovationPrompt(input: QwenRenovationInput): string {
  return `Create practical renovation recommendations from the user-provided details. Do not infer unprovided structural facts or dimensions. Do not provide exact costs; provide a clearly qualified range only when the room dimensions and budget permit a useful estimate, otherwise set estimatedCost to null. Do not create furniture coordinates. Return JSON only with fields designConcept (string), colorPalette (array of {hex,name,role,description}), materials (string[]), furnitureChanges (string[]), lightingChanges (string[]), renovationTasks (array of {step,details}), estimatedCost ({min,max,currency,basis}|null).\n\nRoom and preferences:\n${JSON.stringify(input)}`;
}
