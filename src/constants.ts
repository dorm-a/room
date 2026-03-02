import { BuildingData, RoomOccupancy } from './types';

// Initial empty state or sample data
export const INITIAL_BUILDINGS: BuildingData[] = [
  {
    id: 'hwahong',
    name: '화홍관',
    floors: [
      {
        id: 'hwahong-1f',
        name: '1층',
        imageUrl: '', // User will need to upload/set this
        rooms: []
      },
      {
        id: 'hwahong-2f',
        name: '2층',
        imageUrl: '',
        rooms: []
      }
    ]
  },
  {
    id: 'intl',
    name: '국제학사',
    floors: [
      {
        id: 'intl-1f',
        name: '1층',
        imageUrl: '',
        rooms: []
      }
    ]
  }
];

export const MOCK_OCCUPANCY: RoomOccupancy[] = [
  { roomId: '101', current: 2, capacity: 4 },
  { roomId: '102', current: 0, capacity: 2 },
  { roomId: '103', current: 4, capacity: 4 },
];
