/** A concrete surface in the floor-plan renderer that can receive a finish. */
export type SelectedSurface =
  | { kind: 'room-floor'; roomId: string }
  | { kind: 'room-ceiling'; roomId: string }
  | { kind: 'wall'; wallId: string };
