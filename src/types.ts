import { Building, Users, Map, Settings, Upload } from 'lucide-react';

export const NAVIGATION = [
  { name: 'Dashboard', href: '/', icon: Building },
  { name: 'Map Viewer', href: '/viewer', icon: Map },
  { name: 'Map Editor', href: '/editor', icon: Settings },
  { name: 'Data Upload', href: '/data', icon: Upload },
];

export interface RoomCoordinate {
  id: string;
  points: { x: number; y: number }[]; // Array of points for polygon
  label: string;
  // Deprecated rectangle props (optional for backward compatibility if needed, but better to migrate)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface FloorData {
  id: string;
  name: string;
  imageUrl: string;
  rooms: RoomCoordinate[];
}

export interface BuildingData {
  id: string;
  name: string;
  floors: FloorData[];
}

export interface RoomOccupancy {
  roomId: string;
  buildingName?: string;
  roomLabel?: string;
  current: number;
  capacity: number;
  occupants?: { id: string; name: string; major: string; }[]; // Detailed occupant list
  remarks?: string;
}
