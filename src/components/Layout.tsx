import React from 'react';
import { NAVIGATION, BuildingData } from '../types';
import { Layout as LayoutIcon, Menu, ChevronLeft, ChevronRight, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: any) => void;
  buildings?: BuildingData[];
  onUpdateBuildings?: (buildings: BuildingData[]) => void;
  activeBuildingId?: string | null;
  onSelectBuilding?: (id: string) => void;
}

export function Layout({ children, currentView, onChangeView, buildings, onUpdateBuildings, activeBuildingId, onSelectBuilding }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({
    viewer: currentView === 'viewer',
    editor: currentView === 'editor'
  });

  const toggleMenuExpansion = (e: React.MouseEvent, menuPath: string) => {
    e.stopPropagation();
    setExpandedMenus(prev => ({ ...prev, [menuPath]: !prev[menuPath] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className={`p-4 border-b border-gray-100 flex items-center h-20 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
            <LayoutIcon className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">
              생활관 공간관리
            </h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
            title={isSidebarOpen ? "메뉴 접기" : "메뉴 펼치기"}
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto space-y-1 ${isSidebarOpen ? 'p-4' : 'p-2 flex flex-col items-center'}`}>
          {NAVIGATION.map((item) => {
            const path = item.href.replace('/', '') || 'dashboard';
            const isActive = currentView === path;
            const isEditor = path === 'editor';

            return (
              <React.Fragment key={item.name}>
                <div className="relative">
                  <button
                    onClick={() => {
                      onChangeView(path);
                      if ((path === 'viewer' || path === 'editor') && !expandedMenus[path]) {
                        setExpandedMenus(prev => ({ ...prev, [path]: true }));
                      }
                    }}
                    title={!isSidebarOpen ? item.name : undefined}
                    className={`flex items-center justify-between rounded-lg transition-colors ${isSidebarOpen ? 'w-full px-4 py-3' : 'justify-center w-12 h-12 mb-2'} inline-flex ${isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <div className={`flex items-center ${isSidebarOpen ? 'gap-3' : ''}`}>
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
                    </div>
                    {isSidebarOpen && (path === 'viewer' || path === 'editor') && (
                      <div
                        onClick={(e) => toggleMenuExpansion(e, path)}
                        className="p-1 rounded hover:bg-indigo-100/50 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {expandedMenus[path] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    )}
                  </button>
                </div>

                {/* Building Expandable Lists */}
                {isSidebarOpen && expandedMenus[path] && buildings && (
                  <div className="pl-6 mt-1 mb-4 space-y-1">
                    {path === 'editor' && onUpdateBuildings ? (
                      // Draggable list for Editor
                      <DragDropContext onDragEnd={(result: DropResult) => {
                        if (!result.destination) return;
                        const items = Array.from(buildings);
                        const [reorderedItem] = items.splice(result.source.index, 1);
                        items.splice(result.destination.index, 0, reorderedItem);
                        onUpdateBuildings(items);
                      }}>
                        <Droppable droppableId="sidebar-buildings-editor">
                          {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                              {buildings.map((building, index) => {
                                return (
                                  // @ts-ignore
                                  <Draggable key={building.id} draggableId={building.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        onClick={() => {
                                          window.location.hash = `#editor/${building.id}`;
                                        }}
                                        className={`flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer transition-colors ${isActive && activeBuildingId === building.id
                                          ? 'bg-indigo-100 text-indigo-900 font-medium'
                                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                                          } ${snapshot.isDragging ? 'bg-white shadow-md ring-1 ring-indigo-500 z-50' : ''}`}
                                        style={provided.draggableProps.style}
                                      >
                                        <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600 p-0.5 -ml-1 flex-shrink-0 rounded">
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <span className="truncate">{building.name}</span>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    ) : path === 'viewer' ? (
                      // Clickable list for Viewer
                      <div className="space-y-1 border-l-2 border-indigo-100/50 ml-2 pl-2">
                        {buildings.map(building => (
                          <div
                            key={building.id}
                            onClick={() => {
                              window.location.hash = `#viewer/${building.id}`;
                            }}
                            className={`flex items-center p-2 rounded-md text-sm cursor-pointer transition-colors ${isActive && activeBuildingId === building.id
                              ? 'bg-indigo-100/50 text-indigo-900 font-medium'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                              }`}
                          >
                            <span className="truncate">{building.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <LayoutIcon className="w-5 h-5 text-indigo-600" />
          Room Manager
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-10 bg-gray-800/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <nav className="space-y-1 mt-12">
              {NAVIGATION.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    onChangeView(item.href.replace('/', '') || 'dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg ${(currentView === (item.href.replace('/', '') || 'dashboard'))
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
