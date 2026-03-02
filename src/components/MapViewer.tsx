import React, { useState } from 'react';
import { BuildingData, RoomOccupancy, FloorData } from '../types';
import { Search, User, Users } from 'lucide-react';

interface MapViewerProps {
  buildings: BuildingData[];
  occupancyData: RoomOccupancy[];
  selectedBuildingId?: string | null;
  onSelectBuilding?: (id: string) => void;
}

interface FloorMapProps {
  floor: FloorData;
  occupancyData: RoomOccupancy[];
  searchTerm: string;
}

const FloorMap: React.FC<FloorMapProps> = ({ floor, occupancyData, searchTerm }) => {
  const imageRef = React.useRef<HTMLImageElement>(null);
  const [imageRatio, setImageRatio] = React.useState(1);
  const getRoomColor = (roomId: string) => {
    const data = occupancyData.find(d => d.roomId === roomId);
    if (!data) return 'bg-gray-200/50 border-gray-400 text-gray-500'; // No data

    if (data.current >= data.capacity) return 'bg-red-500/40 border-red-600 text-red-900'; // Full
    if (data.current / data.capacity > 0.8) return 'bg-orange-400/40 border-orange-600 text-orange-900'; // Almost full
    return 'bg-green-500/40 border-green-600 text-green-900'; // Available
  };

  const getRoomData = (roomId: string) => {
    return occupancyData.find(d => d.roomId === roomId);
  };

  if (!floor.imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <Users className="w-12 h-12 text-gray-300 mb-2" />
        <p className="text-gray-500 font-medium">{floor.name}</p>
        <p className="text-sm text-gray-400">No floor plan available</p>
      </div>
    );
  }

  // Helper to convert points to SVG polygon points string
  const pointsToString = (points: { x: number; y: number }[]) => {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  return (
    <div className="relative inline-block w-full" style={{ minHeight: '400px' }}>
      <div className="mb-2 font-bold text-gray-700 px-2">{floor.name}</div>
      <div className="relative inline-block" style={{ maxWidth: '100%' }}>
        <img
          ref={imageRef}
          src={floor.imageUrl}
          alt={`${floor.name} Plan`}
          className="max-w-full object-contain"
          onLoad={() => {
            if (imageRef.current) {
              setImageRatio(imageRef.current.clientWidth / imageRef.current.clientHeight);
            }
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ zIndex: 10 }}
        >
          {floor.rooms.map(room => {
            const data = getRoomData(room.id);
            const isMatch = searchTerm && room.label.toLowerCase().includes(searchTerm.toLowerCase());

            // Backward compatibility for rectangles
            let points = room.points;
            if (!points && room.x !== undefined && room.width !== undefined) {
              points = [
                { x: room.x!, y: room.y! },
                { x: room.x! + room.width!, y: room.y! },
                { x: room.x! + room.width!, y: room.y! + room.height! },
                { x: room.x!, y: room.y! + room.height! }
              ];
            }

            if (!points) return null;

            // Calculate bounding box for dynamic font sizing
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));

            // Calculate center for label (top 1/3)
            const centerX = (minX + maxX) / 2;
            const centerY = minY + (maxY - minY) * 0.33;
            const bboxW = maxX - minX;
            const bboxH = maxY - minY;

            let polygonArea = 0;
            for (let i = 0; i < points.length; i++) {
              const p1 = points[i];
              const p2 = points[(i + 1) % points.length];
              polygonArea += (p1.x * p2.y) - (p2.x * p1.y);
            }
            polygonArea = Math.abs(polygonArea / 2);

            const baseFontSize = Math.min(bboxW / Math.max(room.label.length * 0.65, 1), bboxH * 0.5, Math.sqrt(polygonArea) * 0.3, 3);
            const dynamicFontSize = baseFontSize * 0.8;

            // Determine fill color based on occupancy
            let fillColor = "rgba(16, 185, 129, 0.4)"; // Green (Available)
            let strokeColor = "#059669";

            if (data) {
              if (data.current >= data.capacity) {
                fillColor = "rgba(239, 68, 68, 0.4)"; // Red (Full)
                strokeColor = "#dc2626";
              } else if (data.current / data.capacity > 0.8) {
                fillColor = "rgba(251, 146, 60, 0.4)"; // Orange (Almost Full)
                strokeColor = "#ea580c";
              }
            } else {
              fillColor = "rgba(255, 255, 255, 1)"; // White (No Data)
              strokeColor = "#9ca3af";
            }

            return (
              <g
                key={room.id}
                className="pointer-events-auto group"
              >
                <title>{`${room.label}: ${data ? `${data.current}/${data.capacity}` : 'No Data'}`}</title>
                {/* Opaque white base to completely hide background map text */}
                <polygon
                  points={pointsToString(points)}
                  fill="#ffffff"
                  stroke="none"
                />
                <polygon
                  points={pointsToString(points)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isMatch ? "0.6" : "0.2"}
                  className={`transition-all duration-200 ${isMatch ? 'fill-opacity-70' : 'hover:fill-opacity-60'}`}
                  style={isMatch ? { filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.5))' } : {}}
                />
                <text
                  x={centerX}
                  y={data ? centerY - dynamicFontSize * 0.4 : centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1f2937"
                  fontSize={dynamicFontSize}
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                  style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.9)' }}
                  transform={`translate(${centerX}, ${centerY}) scale(1, ${imageRatio}) translate(${-centerX}, ${-centerY})`}
                >
                  {room.label}
                </text>
                {data && (
                  <text
                    x={centerX}
                    y={centerY + dynamicFontSize * 0.8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#4b5563"
                    fontSize={dynamicFontSize * 0.8}
                    className="pointer-events-none select-none"
                    style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.9)' }}
                    transform={`translate(${centerX}, ${centerY}) scale(1, ${imageRatio}) translate(${-centerX}, ${-centerY})`}
                  >
                    {data.current}/{data.capacity}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function MapViewer({ buildings, occupancyData, selectedBuildingId, onSelectBuilding }: MapViewerProps) {
  const [internalBuildingId, setInternalBuildingId] = useState(buildings[0]?.id);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('all'); // Default to 'all' or first floor
  const [searchTerm, setSearchTerm] = useState('');

  const currentBuildingId = selectedBuildingId !== undefined ? selectedBuildingId : internalBuildingId;
  const currentBuilding = buildings.find(b => b.id === currentBuildingId);

  // Sync internal state if prop changes (optional, but good for consistency)
  React.useEffect(() => {
    if (selectedBuildingId && selectedBuildingId !== internalBuildingId) {
      setInternalBuildingId(selectedBuildingId);
      setSelectedFloorId('all');
    }
  }, [selectedBuildingId]);

  const handleBuildingChange = (id: string) => {
    if (onSelectBuilding) {
      onSelectBuilding(id);
    } else {
      setInternalBuildingId(id);
    }
    setSelectedFloorId('all');
  };

  const sortedFloors = currentBuilding?.floors.slice().sort((a, b) => {
    const numA = parseInt(a.name.replace(/[^-\d]/g, '')) || 0;
    const numB = parseInt(b.name.replace(/[^-\d]/g, '')) || 0;
    return numA - numB;
  }) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Controls */}
      <div className="mb-4 flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm gap-4">
        <div className="flex gap-4 w-full md:w-auto">
          <select
            value={currentBuildingId || ''}
            onChange={(e) => handleBuildingChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full md:w-48"
          >
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full md:w-48"
          >
            <option value="all">전체 (All Floors)</option>
            {sortedFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search room..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4">
        <div className="flex flex-col gap-8 items-center">
          {selectedFloorId === 'all' ? (
            sortedFloors.map(floor => (
              <FloorMap
                key={floor.id}
                floor={floor}
                occupancyData={occupancyData}
                searchTerm={searchTerm}
              />
            ))
          ) : (
            (() => {
              const floor = currentBuilding?.floors.find(f => f.id === selectedFloorId);
              return floor ? (
                <FloorMap
                  floor={floor}
                  occupancyData={occupancyData}
                  searchTerm={searchTerm}
                />
              ) : null;
            })()
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-6 justify-center text-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500/40 border border-green-600 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-400/40 border border-orange-600 rounded"></div>
          <span>Almost Full (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500/40 border border-red-600 rounded"></div>
          <span>Full</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white border border-gray-400 rounded"></div>
          <span>No Data</span>
        </div>
      </div>
    </div>
  );
}
