import { FloorPlanResult, FloorPlanRoom } from '../types';

type RoomRequest = { name?: string; type?: string; minSize?: number; id?: string };

const margin = 0.3;
const hallWidth = 1.05;
const corridorDepth = 0.95;

/** Builds a deterministic double-loaded house plan from the actual brief. */
export function generateArchitecturalLayout(plotWidth: number, plotLength: number, requestedRooms: RoomRequest[], requirements = ''): FloorPlanResult {
  if (!Number.isFinite(plotWidth) || !Number.isFinite(plotLength) || plotWidth < 5 || plotLength < 5) {
    throw new Error('Plot dimensions must be at least 5 m in both directions.');
  }
  const requests = requestedRooms.length ? requestedRooms : [
    { name: 'Living Room', type: 'living-room', minSize: 22 },
    { name: 'Kitchen', type: 'kitchen', minSize: 12 },
    { name: 'Master Bedroom', type: 'master-bedroom', minSize: 16 },
    { name: 'Bedroom', type: 'bedroom', minSize: 12 },
    { name: 'Bathroom', type: 'bathroom', minSize: 5 },
  ];
  const wingWidth = plotWidth - margin * 2 - hallWidth;
  if (wingWidth < 2.4) throw new Error('The plot is too narrow to fit a 1.05 m circulation hall and usable rooms. Increase the plot width.');
  const preference = requirements.toLowerCase();
  const entryPreference = /entry|entrance|door/.test(preference) ?
    (/(south|bottom)/.test(preference) ? 'south' : /(north|top)/.test(preference) ? 'north' : /(west|left)/.test(preference) ? 'west' : /(east|right)/.test(preference) ? 'east' : 'south') : 'south';
  const columns = wingWidth >= 9 && entryPreference !== 'west' && entryPreference !== 'east' ? 2 : 1;
  const cellWidth = wingWidth / columns;
  const sorted = requests.map((input, index) => {
    const requestedArea = Number(input.minSize);
    const minArea = Number.isFinite(requestedArea) && requestedArea > 0 ? Math.max(4, requestedArea) : 10;
    const name = String(input.name || `Room ${index + 1}`);
    const type = canonicalType(String(input.type || name));
    const hint = `${type} ${name}`.toLowerCase();
    const dimensions = roomMinimums(hint);
    const area = Math.max(minArea, dimensions.width * dimensions.depth);
    const preferredWidth = Math.max(dimensions.width, Math.sqrt(area * dimensions.ratio));
    const width = Math.min(cellWidth, preferredWidth);
    const height = Math.max(dimensions.depth, area / width);
    const zone = /bath|powder|laundry|utility/.test(hint) ? 0 : /bedroom|sleep/.test(hint) ? 1 : /living|kitchen|dining|office|study/.test(hint) ? 3 : 2;
    return { input, index, name, type, hint, area, width, height, zone };
  }).sort((a, b) => a.zone - b.zone || a.index - b.index);

  // Each row is a connected pair of rooms. A continuous hall spine and a cross hall
  // at every row provide a direct, non-overlapping route to every room and the entry.
  const rows: typeof sorted[] = [];
  for (let i = 0; i < sorted.length; i += columns) rows.push(sorted.slice(i, i + columns));
  const rowDepths = rows.map(row => Math.max(...row.map(room => room.height)));
  const hallCount = rows.length;
  const minimumLength = rowDepths.reduce((sum, depth) => sum + depth, 0) + Math.max(0, hallCount - 1) * corridorDepth;
  const availableLength = plotLength - margin * 2;
  if (minimumLength > availableLength) {
    throw new Error(`The requested rooms need about ${minimumLength.toFixed(1)} m of house length, but the plot allows ${availableLength.toFixed(1)} m after circulation and setbacks. Increase the plot length or reduce room areas.`);
  }
  // Use the plot efficiently like a real house plan; the entered room areas are
  // minimums, so spare depth enlarges the non-wet room bays proportionally.
  const targetLength = Math.max(minimumLength, availableLength * .933);
  const extraLength = targetLength - minimumLength;
  const expandable = rows.map((row, index) => row.some(room => !/bath|powder|laundry|utility/.test(room.hint)) ? index : -1).filter(index => index >= 0);
  const expandWeight = expandable.reduce((sum, index) => sum + rowDepths[index], 0);
  expandable.forEach(index => { rowDepths[index] += extraLength * rowDepths[index] / expandWeight; });

  const rooms: FloorPlanRoom[] = [];
  const paths: NonNullable<FloorPlanResult['circulationPaths']> = [];
  const houseX = margin;
  const spineX = entryPreference === 'west' ? houseX : entryPreference === 'east' ? plotWidth - margin - hallWidth :
    columns === 2 ? houseX + wingWidth / 2 : houseX;
  // For narrow lots, move the spine to one side; otherwise the wings are balanced.
  const leftWingX = houseX;
  const leftWingWidth = spineX - houseX;
  const rightWingX = spineX + hallWidth;
  const rightWingWidth = plotWidth - margin - rightWingX;
  let y = margin;
  let roomNumber = 0;

  rows.forEach((row, rowIndex) => {
    const depth = round(rowDepths[rowIndex]);
    row.forEach((item, colIndex) => {
      roomNumber += 1;
      const left = colIndex === 0;
      const singleBay = columns === 2 && row.length === 1;
      const width = columns === 1 ? (entryPreference === 'east' ? leftWingWidth : rightWingWidth) : (singleBay ? rightWingWidth : left ? leftWingWidth : rightWingWidth);
      const x = columns === 1 ? (entryPreference === 'east' ? leftWingX : rightWingX) : (singleBay ? rightWingX : left ? leftWingX : rightWingX);
      const doorSide = columns === 1 ? (entryPreference === 'east' ? 'right' : 'left') : (singleBay ? 'left' : left ? 'right' : 'left');
      const windowSide = columns === 1 ? (entryPreference === 'east' ? 'left' : 'right') : (singleBay ? 'right' : left ? 'left' : 'right');
      rooms.push({
        id: item.input.id || `room_${roomNumber}`,
        name: item.name,
        type: item.type as FloorPlanRoom['type'],
        x: round(x), y: round(y), width: round(width), height: round(depth),
        area: round(width * depth),
        doorSide,
        windowSide,
        color: roomColor(item.hint),
        adjacentTo: ['Hallway'],
      });
    });
    if (columns === 2 && row.length === 1) {
      paths.push({ x: round(houseX), y: round(y), width: round(leftWingWidth), height: round(depth), kind: 'main-hall' });
    }
    y = round(y + depth);
    if (rowIndex < rows.length - 1) {
      if (columns === 2) {
        paths.push({ x: round(houseX), y: round(y), width: round(spineX - houseX), height: corridorDepth, kind: 'main-hall' });
        const rightHallX = round(spineX + hallWidth);
        paths.push({ x: rightHallX, y: round(y), width: round(plotWidth - margin - rightHallX), height: corridorDepth, kind: 'main-hall' });
      } else {
        paths.push({ x: round(spineX + hallWidth), y: round(y), width: round(plotWidth - margin - spineX - hallWidth), height: corridorDepth, kind: 'main-hall' });
      }
      y += corridorDepth;
    }
  });
  const buildingLength = round(y - margin);
  paths.push({ x: round(spineX), y: margin, width: hallWidth, height: buildingLength, kind: 'main-hall' });

  const area = rooms.reduce((sum, room) => sum + room.width * room.height, 0);
  const circulationArea = paths.reduce((sum, path) => sum + path.width * path.height, 0);
  return {
    plotWidth, plotLength, rooms,
    totalBuiltArea: round(area + circulationArea),
    openSpaceArea: round(Math.max(0, plotWidth * plotLength - area - circulationArea)),
    architecturalStyle: 'Contemporary double-loaded corridor plan',
    designNotes: `Room zones follow the requested types and minimum areas. Every room opens to a continuous circulation spine, with cross halls connecting the paired room bays. The main entrance is placed on the ${entryPreference} side.`,
    circulationEfficiency: Math.round(area / Math.max(1, area + circulationArea) * 100),
    circulationPaths: paths,
    entrance: entryPreference === 'north'
      ? { x: round(spineX + hallWidth / 2), y: margin, side: 'top' }
      : entryPreference === 'west'
        ? { x: spineX, y: round(margin + buildingLength / 2), side: 'left' }
        : entryPreference === 'east'
          ? { x: round(spineX + hallWidth), y: round(margin + buildingLength / 2), side: 'right' }
          : { x: round(spineX + hallWidth / 2), y: round(margin + buildingLength), side: 'bottom' },
  };
}

function canonicalType(value: string): string {
  const v = value.toLowerCase();
  if (v.includes('powder')) return 'powder-room';
  if (v.includes('bath')) return 'bathroom';
  if (v.includes('master') && v.includes('bed')) return 'master-bedroom';
  if (v.includes('bed') || v.includes('sleep')) return 'bedroom';
  if (v.includes('kitchen')) return 'kitchen';
  if (v.includes('dining')) return 'dining-room';
  if (v.includes('living') || v.includes('lounge') || v.includes('family')) return 'living-room';
  if (v.includes('hall') || v.includes('foyer')) return 'hallway';
  if (v.includes('office') || v.includes('study')) return 'office';
  if (v.includes('laundry')) return 'laundry';
  if (v.includes('utility')) return 'utility';
  return 'bedroom';
}

function roomMinimums(hint: string) {
  if (/powder|bath/.test(hint)) return { width: 1.8, depth: 2.1, ratio: 1.05 };
  if (/bedroom|sleep/.test(hint)) return { width: 2.8, depth: 3.2, ratio: 1.12 };
  if (/kitchen/.test(hint)) return { width: 2.4, depth: 2.7, ratio: 1.25 };
  if (/living|lounge|family/.test(hint)) return { width: 3.2, depth: 3.4, ratio: 1.3 };
  if (/dining/.test(hint)) return { width: 2.8, depth: 2.8, ratio: 1.15 };
  return { width: 2.2, depth: 2.4, ratio: 1.1 };
}

function roomColor(hint: string) {
  if (/bath|powder|utility|laundry/.test(hint)) return '#d9e6e2';
  if (/bedroom|sleep/.test(hint)) return '#eee3d2';
  if (/kitchen/.test(hint)) return '#e6e2d7';
  if (/living|lounge|family/.test(hint)) return '#e2e8e4';
  return '#e9e5dc';
}
function round(value: number) { return Math.round(value * 100) / 100; }
