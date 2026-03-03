import { useState, useEffect } from 'react';
import { BuildingData, RoomOccupancy } from './types';
import { INITIAL_BUILDINGS, MOCK_OCCUPANCY } from './constants';
import { Layout } from './components/Layout';
import { MapViewer } from './components/MapViewer';
import { MapEditor } from './components/MapEditor';
import { Dashboard } from './components/Dashboard';
import { DataManager } from './components/DataManager';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { supabase } from './lib/supabase';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'viewer' | 'editor' | 'data'>('dashboard');
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [occupancyData, setOccupancyData] = useState<RoomOccupancy[]>(MOCK_OCCUPANCY);
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const currentBuildingId = activeBuildingId || (buildings.length > 0 ? buildings[0].id : null);
  const { user, isAllowed, isLoading } = useAuth();

  // Fetch data from Supabase on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [buildingsRes] = await Promise.all([
          supabase.from('building_plans').select('*').order('name', { ascending: true })
        ]);

        if (buildingsRes.error) throw buildingsRes.error;

        if (buildingsRes.data && buildingsRes.data.length > 0) {
          const mappedBuildings: BuildingData[] = buildingsRes.data.map(item => ({
            id: item.id,
            name: item.name,
            floors: item.data.floors || []
          }));
          setBuildings(mappedBuildings);
        } else {
          setBuildings(INITIAL_BUILDINGS);
        }

        // Fetch all rooms using pagination to avoid 1000 limit
        const allRooms: any[] = [];
        let rFrom = 0;
        const rStep = 1000;
        while (true) {
          const res = await supabase.from('rooms').select('건물, 호실, 인실, 비고, "Tel."').range(rFrom, rFrom + rStep - 1);
          if (res.data && res.data.length > 0) {
            allRooms.push(...res.data);
            if (res.data.length < rStep) break;
            rFrom += rStep;
          } else {
            break;
          }
        }

        // Fetch all registrations using pagination to avoid 1000 limit
        const allRegistrations: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const res = await supabase.from('registrations').select('건물, 호실, 학번, 이름, 학부').eq('선발상태', '등록').range(from, from + step - 1);
          if (res.data && res.data.length > 0) {
            allRegistrations.push(...res.data);
            if (res.data.length < step) break;
            from += step;
          } else {
            break;
          }
        }

        // Process occupancy data
        const occupancyMap = new Map<string, RoomOccupancy>();

        // 1. Map capacities from rooms
        allRooms.forEach((room: any) => {
          if (!room.건물 || !room.호실) return;
          const key = `${room.건물}_${room.호실}`;
          const capacityMatch = room.인실 ? String(room.인실).match(/\d+/) : null;
          const capacity = capacityMatch ? parseInt(capacityMatch[0], 10) : 0;

          occupancyMap.set(key, {
            roomId: key,
            buildingName: room.건물,
            roomLabel: String(room.호실),
            current: 0,
            capacity: capacity,
            occupants: [],
            remarks: room.비고,
            tel: room['Tel.']
          });
        });

        // 2. Count current occupants from registrations
        allRegistrations.forEach((reg: any) => {
          if (!reg.건물 || !reg.호실) return;
          const key = `${reg.건물}_${reg.호실}`;
          const occupant = {
            id: reg.학번 || 'Unknown',
            name: reg.이름 || 'Unknown',
            major: reg.학부 || 'Unknown'
          };

          if (occupancyMap.has(key)) {
            const entry = occupancyMap.get(key)!;
            entry.current += 1;
            if (entry.occupants) {
              entry.occupants.push(occupant);
            } else {
              entry.occupants = [occupant];
            }
            occupancyMap.set(key, entry);
          } else {
            occupancyMap.set(key, {
              roomId: key,
              buildingName: reg.건물,
              roomLabel: String(reg.호실),
              current: 1,
              capacity: 0, // Unknown capacity
              occupants: [occupant]
            });
          }
        });

        setOccupancyData(Array.from(occupancyMap.values()));

      } catch (err) {
        console.error('Error fetching data:', err);
        setBuildings(INITIAL_BUILDINGS);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchData();
  }, []);

  const renderContent = () => {
    if (isLoading || isLoadingData) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    // Google Login enabled
    if (!user || isAllowed === false) {
      return <Login />;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard buildings={buildings} onUpdateBuildings={setBuildings} occupancyData={occupancyData} onChangeView={setCurrentView} />;
      case 'viewer':
        return <MapViewer
          buildings={buildings}
          occupancyData={occupancyData}
          selectedBuildingId={currentBuildingId}
          onSelectBuilding={setActiveBuildingId}
        />;
      case 'editor':
        return <MapEditor
          buildings={buildings}
          onUpdateBuildings={setBuildings}
          selectedBuildingId={currentBuildingId}
          onSelectBuilding={setActiveBuildingId}
        />;
      case 'data':
        return <DataManager occupancyData={occupancyData} onUpdateData={setOccupancyData} />;
      default:
        return <Dashboard buildings={buildings} onUpdateBuildings={setBuildings} occupancyData={occupancyData} onChangeView={setCurrentView} />;
    }
  };

  // Google Login enabled
  if (!isLoading && (!user || isAllowed === false)) {
    return <Login />;
  }

  return (
    <Layout
      currentView={currentView}
      onChangeView={setCurrentView}
      buildings={buildings}
      onUpdateBuildings={setBuildings}
      activeBuildingId={currentBuildingId}
      onSelectBuilding={setActiveBuildingId}
    >
      {renderContent()}
    </Layout>
  );
}
