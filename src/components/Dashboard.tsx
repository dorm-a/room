import { BuildingData, RoomOccupancy } from '../types';
import { Users, AlertCircle, CheckCircle, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface DashboardProps {
  buildings: BuildingData[];
  occupancyData: RoomOccupancy[];
  onChangeView: (view: 'dashboard' | 'viewer' | 'editor') => void;
  onUpdateBuildings?: (buildings: BuildingData[]) => void;
}

export function Dashboard({ buildings, occupancyData, onChangeView, onUpdateBuildings }: DashboardProps) {
  // Calculate some stats
  const totalRooms = occupancyData.length;
  const totalCapacity = occupancyData.reduce((acc, curr) => acc + curr.capacity, 0);
  const currentOccupants = occupancyData.reduce((acc, curr) => acc + curr.current, 0);
  const occupancyRate = totalCapacity > 0 ? ((currentOccupants / totalCapacity) * 100).toFixed(1) : "0.0";

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !onUpdateBuildings) return;

    const items = Array.from(buildings);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onUpdateBuildings(items);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <span className="text-sm text-gray-500">Overview of all buildings</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Occupancy</p>
              <p className="text-2xl font-bold text-gray-900">{occupancyRate}%</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {currentOccupants.toLocaleString()} / {totalCapacity.toLocaleString()} people
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Available Rooms</p>
              <p className="text-2xl font-bold text-gray-900">
                {occupancyData.filter(r => r.current < r.capacity).length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Full Rooms</p>
              <p className="text-2xl font-bold text-gray-900">
                {occupancyData.filter(r => r.current >= r.capacity).length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Buildings</h3>
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="buildings-list">
            {(provided) => (
              <div
                className="divide-y divide-gray-100"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {buildings.map((building, index) => {
                  const DraggableAny = Draggable as any;
                  return (
                    <DraggableAny key={building.id} draggableId={building.id} index={index}>
                      {(provided: any, snapshot: any) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`p-6 hover:bg-gray-50 transition-colors bg-white ${snapshot.isDragging ? 'shadow-lg border-y border-indigo-200 z-10' : ''}`}
                          style={provided.draggableProps.style}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                {...provided.dragHandleProps}
                                className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-2 -ml-2 rounded-md hover:bg-gray-100"
                                title="Drag to reorder"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{building.name}</h4>
                                <p className="text-sm text-gray-500">{building.floors.length} Floors</p>
                              </div>
                            </div>
                            <button
                              onClick={() => onChangeView('viewer')}
                              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                            >
                              View Map
                            </button>
                          </div>
                        </div>
                      )}
                    </DraggableAny>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
