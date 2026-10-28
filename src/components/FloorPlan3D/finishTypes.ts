/** A concrete surface in the floor-plan renderer that can receive a finish. */
export type SelectedSurface =
  | { kind: 'room-floor'; roomId: string }
  | { kind: 'room-ceiling'; roomId: string }
  /** Whole wall segment (legacy): applies to every face. */
  | { kind: 'wall'; wallId: string }
  /** One face of a wall segment; `faceKey` is a room id or '@outside'. */
  | { kind: 'wall-face'; wallId: string; faceKey: string };
