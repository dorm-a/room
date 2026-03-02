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

  // Fetch buildings from Supabase on mount
  useEffect(() => {
    async function fetchBuildings() {
      try {
        const { data, error } = await supabase
          .from('building_plans')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          // Map DB records to BuildingData format
          const mappedBuildings: BuildingData[] = data.map(item => ({
            id: item.id,
            name: item.name,
            floors: item.data.floors || []
          }));
          setBuildings(mappedBuildings);
        } else {
          // If no data in DB, use initial constants as fallback
          setBuildings(INITIAL_BUILDINGS);
        }
      } catch (err) {
        console.error('Error fetching buildings:', err);
        setBuildings(INITIAL_BUILDINGS);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchBuildings();
  }, []);

  const renderContent = () => {
    if (isLoading || isLoadingData) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    // [TEMPORARILY DISABLED] Google Login is disabled until the production URL is ready.
    // if (!user || isAllowed === false) {
    //   return <Login />;
    // }

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

  // [TEMPORARILY DISABLED] Google Login is disabled until the production URL is ready.
  // if (!isLoading && (!user || isAllowed === false)) {
  //   return <Login />;
  // }

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
