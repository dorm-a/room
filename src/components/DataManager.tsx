import { useState } from 'react';
import { RoomOccupancy } from '../types';
import { Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface DataManagerProps {
  occupancyData: RoomOccupancy[];
  onUpdateData: (data: RoomOccupancy[]) => void;
}

export function DataManager({ occupancyData, onUpdateData }: DataManagerProps) {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(occupancyData, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error('Data must be an array');
      onUpdateData(parsed);
      setError(null);
      alert('Data updated successfully!');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { roomId: "room-id-1", current: 5, capacity: 10 },
      { roomId: "room-id-2", current: 0, capacity: 4 }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'occupancy-template.json';
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-green-600" />
          Data Management
        </h2>
        
        <div className="prose prose-sm text-gray-500 mb-6">
          <p>
            Here you can manage the occupancy data. In a real production app, this would be connected to your Excel file or database.
            For now, you can edit the JSON data directly below.
          </p>
          <p>
            <strong>Format:</strong> Array of objects with <code>roomId</code> (must match the ID you set in the Map Editor), <code>current</code> (occupancy), and <code>capacity</code>.
          </p>
        </div>

        <div className="flex gap-4 mb-4">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <div className="relative">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-96 font-mono text-sm p-4 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {error && (
            <div className="absolute bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleUpdate}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            <Upload className="w-4 h-4" />
            Update Data
          </button>
        </div>
      </div>
    </div>
  );
}
