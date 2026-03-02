import React, { useState, useRef, useEffect } from 'react';
import { BuildingData, RoomCoordinate, FloorData } from '../types';
import { Plus, Save, Trash2, MousePointer, Square, Upload, Hexagon, Check, Copy, Building, Layers, Edit2, X, AlertTriangle, ImagePlus, XCircle, Maximize } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MapEditorProps {
    buildings: BuildingData[];
    onUpdateBuildings: (buildings: BuildingData[]) => void;
    selectedBuildingId?: string | null;
    onSelectBuilding?: (id: string) => void;
}

export function MapEditor({ buildings, onUpdateBuildings, selectedBuildingId: propBuildingId, onSelectBuilding }: MapEditorProps) {
    const [internalBuildingId, setInternalBuildingId] = useState(buildings[0]?.id);
    const selectedBuildingId = propBuildingId || internalBuildingId;
    const setSelectedBuildingId = (id: string) => {
        setInternalBuildingId(id);
        if (onSelectBuilding) onSelectBuilding(id);
    };

    const [selectedFloorId, setSelectedFloorId] = useState(buildings[0]?.floors[0]?.id);
    const [mode, setMode] = useState<'select' | 'draw_poly' | 'draw_rect'>('select');
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
    const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isCopyDrag, setIsCopyDrag] = useState(false);

    // Undo stack: stores snapshots of rooms array before each action
    const [undoStack, setUndoStack] = useState<RoomCoordinate[][]>([]);
    // Box selection state
    const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number; mode: 'window' | 'crossing' } | null>(null);
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [boxSelectStart, setBoxSelectStart] = useState({ x: 0, y: 0 });
    const [stagedImage, setStagedImage] = useState<{ file: File; preview: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [imageLoadCount, setImageLoadCount] = useState(0);

    // Viewport State (Zoom & Pan)
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panDragStart, setPanDragStart] = useState({ x: 0, y: 0 });
    const [isSpaceDown, setIsSpaceDown] = useState(false);

    // Handle Spacebar for panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                // Only trigger space-pan if we aren't typing in an input
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
                e.preventDefault(); // Prevent page scroll
                setIsSpaceDown(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpaceDown(false);
                setIsPanning(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Management Modals State
    const [showBuildingModal, setShowBuildingModal] = useState(false);
    const [showFloorModal, setShowFloorModal] = useState(false);
    const [editingItem, setEditingItem] = useState<{ type: 'building' | 'floor', id: string, name: string } | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [modalError, setModalError] = useState('');

    // Delete Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'building' | 'floor' | 'room', id: string, name?: string } | null>(null);

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const justBoxSelected = useRef(false);
    const justDragged = useRef(false);

    const currentBuilding = buildings.find(b => b.id === selectedBuildingId);
    const currentFloor = currentBuilding?.floors.find(f => f.id === selectedFloorId);

    // --- Undo System ---
    const pushUndo = () => {
        if (!currentFloor) return;
        const snapshot = currentFloor.rooms.map(r => ({ ...r, points: r.points?.map(p => ({ ...p })) }));
        setUndoStack(prev => [...prev.slice(-29), snapshot]); // keep max 30
    };

    const popUndo = () => {
        if (undoStack.length === 0 || !currentFloor) return;
        const prevRooms = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return {
                    ...b,
                    floors: b.floors.map(f => {
                        if (f.id === selectedFloorId) {
                            return { ...f, rooms: prevRooms };
                        }
                        return f;
                    })
                };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);
        setSelectedRoomId(null);
        setSelectedRoomIds([]);
    };

    // Ctrl+Z listener
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                popUndo();
            } else if (e.key === 'Escape') {
                // Cancel drawing/selection
                setIsDrawing(false);
                setCurrentPoints([]);
                setPreviewPoint(null);
                setCurrentRect(null);
                if (mode !== 'select') setMode('select');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

    // Ensure valid selection when buildings/floors change
    useEffect(() => {
        if (!currentBuilding && buildings.length > 0) {
            setSelectedBuildingId(buildings[0].id);
        }
        if (currentBuilding && !currentFloor && currentBuilding.floors.length > 0) {
            setSelectedFloorId(currentBuilding.floors[0].id);
        }
    }, [buildings, currentBuilding, currentFloor]);

    const handleDeleteClick = (type: 'building' | 'floor' | 'room', id: string, name?: string) => {
        if (type === 'building' && buildings.length <= 1) {
            alert("Cannot delete the last building.");
            return;
        }
        setDeleteConfirmation({ type, id, name });
    };

    const confirmDelete = () => {
        if (!deleteConfirmation) return;
        const { type, id } = deleteConfirmation;

        if ((type as string) === 'image') {
            executeImageDelete();
        } else if (type === 'building') {
            const newBuildings = buildings.filter(b => b.id !== id);
            onUpdateBuildings(newBuildings);
            if (selectedBuildingId === id) {
                setSelectedBuildingId(newBuildings[0].id);
            }
        } else if (type === 'floor') {
            const newBuildings = buildings.map(b => {
                if (b.id === selectedBuildingId) {
                    return {
                        ...b,
                        floors: b.floors.filter(f => f.id !== id)
                    };
                }
                return b;
            });
            onUpdateBuildings(newBuildings);
        } else if (type === 'room') {
            pushUndo();
            const newBuildings = buildings.map(b => {
                if (b.id === selectedBuildingId) {
                    return {
                        ...b,
                        floors: b.floors.map(f => {
                            if (f.id === selectedFloorId) {
                                return {
                                    ...f,
                                    rooms: f.rooms.filter(r => r.id !== id)
                                };
                            }
                            return f;
                        })
                    };
                }
                return b;
            });
            onUpdateBuildings(newBuildings);
            setSelectedRoomId(null);
        }
        setDeleteConfirmation(null);
    };

    // --- Building Management ---
    const addBuilding = () => {
        if (!newItemName.trim()) return;
        const newBuilding: BuildingData = {
            id: `bld-${Date.now()}`,
            name: newItemName,
            floors: []
        };
        onUpdateBuildings([...buildings, newBuilding]);
        setSelectedBuildingId(newBuilding.id);
        setNewItemName('');
        setShowBuildingModal(false);
    };

    const updateBuilding = () => {
        if (!editingItem || !newItemName.trim()) return;
        const newBuildings = buildings.map(b =>
            b.id === editingItem.id ? { ...b, name: newItemName } : b
        );
        onUpdateBuildings(newBuildings);
        setEditingItem(null);
        setNewItemName('');
    };



    // --- Floor Management ---
    const addFloor = () => {
        if (!newItemName.trim() || !currentBuilding) return;

        // Duplicate name check
        const isDuplicate = currentBuilding.floors.some(
            f => f.name.trim().toLowerCase() === newItemName.trim().toLowerCase()
        );
        if (isDuplicate) {
            setModalError('이미 존재하는 층수입니다.');
            return;
        }
        setModalError('');

        const newFloor: FloorData = {
            id: `flr-${Date.now()}`,
            name: newItemName,
            imageUrl: '',
            rooms: []
        };
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return { ...b, floors: [...b.floors, newFloor] };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);
        setSelectedFloorId(newFloor.id);
        setNewItemName('');
        setShowFloorModal(false);
    };

    const updateFloor = () => {
        if (!editingItem || !newItemName.trim() || !currentBuilding) return;
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return {
                    ...b,
                    floors: b.floors.map(f => f.id === editingItem.id ? { ...f, name: newItemName } : f)
                };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);
        setEditingItem(null);
        setNewItemName('');
    };



    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && currentFloor) {
            const preview = URL.createObjectURL(file);
            setStagedImage({ file, preview });
        }
    };

    const saveBuildingToSupabase = async (building: BuildingData) => {
        try {
            const { error } = await supabase
                .from('building_plans')
                .upsert({
                    id: building.id,
                    name: building.name,
                    data: { floors: building.floors },
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error saving to Supabase:', error);
            return false;
        }
    };

    // ===== [Plan A] Image Confirmation (캔버스 내 도면 확정) =====
    const handleConfirmImage = async () => {
        if (!stagedImage || !currentFloor || !currentBuilding) return;

        try {
            setIsSaving(true);

            const fileExt = stagedImage.file.name.split('.').pop() || 'png';
            const fileName = `${currentBuilding.id}_${currentFloor.id}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('floor_plan_imgs')
                .upload(fileName, stagedImage.file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

            const { data: { publicUrl } } = supabase.storage
                .from('floor_plan_imgs')
                .getPublicUrl(fileName);

            const imageUrl = publicUrl;

            const updatedBuildings = buildings.map(b => {
                if (b.id === selectedBuildingId) {
                    return {
                        ...b,
                        floors: b.floors.map(f => f.id === selectedFloorId ? { ...f, imageUrl } : f)
                    };
                }
                return b;
            });

            // Also persist to Supabase immediately
            const buildingToSave = updatedBuildings.find(b => b.id === selectedBuildingId);
            if (buildingToSave) await saveBuildingToSupabase(buildingToSave);

            onUpdateBuildings(updatedBuildings);
            setStagedImage(null);
            alert('도면이 확정 저장되었습니다! ✅');
        } catch (error) {
            console.error('Image confirm error:', error);
            alert('도면 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelImage = () => {
        if (stagedImage) {
            URL.revokeObjectURL(stagedImage.preview);
            setStagedImage(null);
        }
    };

    // ===== [Plan A] Vector Data Save (좌표/라벨 전용) =====
    const handleSaveVectorData = async () => {
        if (!currentBuilding) return;

        try {
            setIsSaving(true);

            const buildingToSave = buildings.find(b => b.id === selectedBuildingId);
            if (buildingToSave) {
                const success = await saveBuildingToSupabase(buildingToSave);
                if (!success) throw new Error('Supabase save failed');
            }

            alert('방 좌표 데이터가 저장되었습니다! 💾');
        } catch (error) {
            console.error('Vector save error:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Image Delete Manually (from UI)
    const handleDeleteImage = () => {
        if (!currentFloor) return;

        // Clear staged image immediately if present (no confirmation needed)
        if (stagedImage) {
            URL.revokeObjectURL(stagedImage.preview);
            setStagedImage(null);
            return;
        }

        if (!currentFloor.imageUrl) return;

        // Use the existing deleteConfirmation modal
        setDeleteConfirmation({ type: 'image' as any, id: selectedFloorId || '', name: '도면 이미지' });
    };

    const executeImageDelete = async () => {
        if (!currentFloor) return;

        const imageUrl = currentFloor.imageUrl;

        // 1. Optimistic UI: remove image from state first
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return {
                    ...b,
                    floors: b.floors.map(f =>
                        f.id === selectedFloorId ? { ...f, imageUrl: '' } : f
                    )
                };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);

        // 2. Server file deletion (best-effort)
        if (imageUrl) {
            try {
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                if (filename) {
                    const { error } = await supabase.storage
                        .from('floor_plan_imgs')
                        .remove([filename]);
                    if (error) console.warn('Supabase storage delete failed:', error);
                }
            } catch (e) {
                console.warn('Supabase storage delete error:', e);
            }
        }

        // 3. Supabase sync (best-effort)
        try {
            const buildingToSave = newBuildings.find(b => b.id === selectedBuildingId);
            if (buildingToSave) {
                await saveBuildingToSupabase(buildingToSave);
            }
        } catch (e) {
            console.warn('Supabase 동기화 실패:', e);
        }
    };

    // --- Geometry Helpers for Box Selection ---
    const isPointInRect = (px: number, py: number, rx: number, ry: number, rw: number, rh: number) => {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    };

    const isPolygonFullyInsideRect = (points: { x: number; y: number }[], rx: number, ry: number, rw: number, rh: number) => {
        return points.every(p => isPointInRect(p.x, p.y, rx, ry, rw, rh));
    };

    const segmentsIntersect = (ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number) => {
        const d1x = ax2 - ax1, d1y = ay2 - ay1;
        const d2x = bx2 - bx1, d2y = by2 - by1;
        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 1e-10) return false;
        const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / cross;
        const u = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / cross;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    const doesPolygonIntersectRect = (points: { x: number; y: number }[], rx: number, ry: number, rw: number, rh: number) => {
        // Check if any polygon point is inside the rect
        if (points.some(p => isPointInRect(p.x, p.y, rx, ry, rw, rh))) return true;
        // Check if any polygon edge intersects any rect edge
        const rectEdges: [number, number, number, number][] = [
            [rx, ry, rx + rw, ry], [rx + rw, ry, rx + rw, ry + rh],
            [rx + rw, ry + rh, rx, ry + rh], [rx, ry + rh, rx, ry]
        ];
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            for (const [ex1, ey1, ex2, ey2] of rectEdges) {
                if (segmentsIntersect(points[i].x, points[i].y, points[j].x, points[j].y, ex1, ey1, ex2, ey2)) return true;
            }
        }
        return false;
    };

    // Drawing Logic
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate percentage based coordinates (0-100) matching SVG viewBox
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        return { x, y };
    };

    const getSnappedCoords = (rawCoords: { x: number; y: number }, e: React.MouseEvent | KeyboardEvent) => {
        if (!e.shiftKey || currentPoints.length === 0) return rawCoords;
        if (!containerRef.current) return rawCoords;

        const rect = containerRef.current.getBoundingClientRect();
        const W = rect.width;
        const H = rect.height;

        // Convert to pixel space for visual math
        const toPx = (p: { x: number, y: number }) => ({ x: (p.x / 100) * W, y: (p.y / 100) * H });
        const toPct = (p: { x: number, y: number }) => ({ x: (p.x / W) * 100, y: (p.y / H) * 100 });

        const rawPx = toPx(rawCoords);
        const lastPx = toPx(currentPoints[currentPoints.length - 1]);

        const dx = rawPx.x - lastPx.x;
        const dy = rawPx.y - lastPx.y;

        if (currentPoints.length === 1) {
            if (Math.abs(dx) > Math.abs(dy)) return toPct({ x: rawPx.x, y: lastPx.y });
            return toPct({ x: lastPx.x, y: rawPx.y });
        }

        const prevPx = toPx(currentPoints[currentPoints.length - 2]);
        const sdx = lastPx.x - prevPx.x;
        const sdy = lastPx.y - prevPx.y;

        if (sdx === 0 && sdy === 0) {
            if (Math.abs(dx) > Math.abs(dy)) return toPct({ x: rawPx.x, y: lastPx.y });
            return toPct({ x: lastPx.x, y: rawPx.y });
        }

        const len = Math.sqrt(sdx * sdx + sdy * sdy);
        const ux = sdx / len;
        const uy = sdy / len;

        const dot = dx * ux + dy * uy;
        const projX = dot * ux;
        const projY = dot * uy;

        const perpDot = dx * (-uy) + dy * ux;
        const perpX = perpDot * (-uy);
        const perpY = perpDot * ux;

        if (Math.abs(dot) > Math.abs(perpDot)) {
            return toPct({ x: lastPx.x + projX, y: lastPx.y + projY });
        } else {
            return toPct({ x: lastPx.x + perpX, y: lastPx.y + perpY });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isSpaceDown) return; // Let wrapper handle panning

        const coords = getRelativeCoords(e);

        // Reset stale click-prevention flags on new interaction
        justBoxSelected.current = false;
        justDragged.current = false;

        if (mode === 'draw_rect') {
            setIsDrawing(true);
            setStartPos(coords);
            setCurrentRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
        } else if (mode === 'select') {
            // Check if clicking ON any room to start drag-move (left-button only)
            if (e.button === 0 && currentFloor) {
                for (const room of currentFloor.rooms) {
                    let pts = room.points;
                    if (!pts && room.x !== undefined && room.width !== undefined) {
                        pts = [
                            { x: room.x!, y: room.y! },
                            { x: room.x! + room.width!, y: room.y! },
                            { x: room.x! + room.width!, y: room.y! + room.height! },
                            { x: room.x!, y: room.y! + room.height! }
                        ];
                    }
                    if (!pts) continue;

                    // Point-in-polygon (ray casting)
                    let inside = false;
                    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                        if ((pts[i].y > coords.y) !== (pts[j].y > coords.y) &&
                            coords.x < (pts[j].x - pts[i].x) * (coords.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) {
                            inside = !inside;
                        }
                    }
                    if (inside) {
                        setSelectedRoomId(room.id);
                        setSelectedRoomIds([room.id]);
                        setDragStart(coords);
                        setIsDragging(true);
                        return;
                    }
                }
            }
            // No room hit — start box selection (left=window, right=crossing)
            const selMode = e.button === 2 ? 'crossing' : 'window';
            setIsBoxSelecting(true);
            setBoxSelectStart(coords);
            setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0, mode: selMode });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSpaceDown || isPanning) return;

        const coords = getRelativeCoords(e);

        if (mode === 'draw_rect' && isDrawing) {
            const width = coords.x - startPos.x;
            const height = coords.y - startPos.y;

            setCurrentRect({
                x: width > 0 ? startPos.x : coords.x,
                y: height > 0 ? startPos.y : coords.y,
                w: Math.abs(width),
                h: Math.abs(height)
            });
        } else if (mode === 'draw_poly' && isDrawing) {
            setPreviewPoint(getSnappedCoords(coords, e));
        } else if (mode === 'select' && isBoxSelecting) {
            // Update box selection rectangle
            const w = coords.x - boxSelectStart.x;
            const h = coords.y - boxSelectStart.y;
            const selMode = selectionRect?.mode || 'window';
            setSelectionRect({
                x: w > 0 ? boxSelectStart.x : coords.x,
                y: h > 0 ? boxSelectStart.y : coords.y,
                w: Math.abs(w),
                h: Math.abs(h),
                mode: selMode
            });
        } else if (mode === 'select' && isDragging && dragStart && selectedRoomId && currentFloor) {
            // Real-time drag offset for smooth visual feedback
            let dx = coords.x - dragStart.x;
            let dy = coords.y - dragStart.y;
            if (e.shiftKey) {
                if (Math.abs(dx) > Math.abs(dy)) dy = 0;
                else dx = 0;
            }
            setDragOffset({ x: dx, y: dy });
            setIsCopyDrag(e.ctrlKey);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isSpaceDown || isPanning) return;

        if (mode === 'draw_rect' && isDrawing && currentRect && currentFloor) {
            setIsDrawing(false);
            if (currentRect.w < 1 || currentRect.h < 1) {
                setCurrentRect(null);
                return;
            }

            const points = [
                { x: currentRect.x, y: currentRect.y },
                { x: currentRect.x + currentRect.w, y: currentRect.y },
                { x: currentRect.x + currentRect.w, y: currentRect.y + currentRect.h },
                { x: currentRect.x, y: currentRect.y + currentRect.h }
            ];

            const newRoom: RoomCoordinate = {
                id: `room-${Date.now()}`,
                label: 'New Room',
                points: points
            };

            pushUndo();
            addRoom(newRoom);
            setCurrentRect(null);
            setMode('select');
            setSelectedRoomId(newRoom.id);
            setSelectedRoomIds([newRoom.id]);
        } else if (mode === 'select' && isBoxSelecting && selectionRect && currentFloor) {
            // Finish box selection
            setIsBoxSelecting(false);
            if (selectionRect.w < 0.5 && selectionRect.h < 0.5) {
                // Too small = just a click on empty space, deselect
                setSelectionRect(null);
                setSelectedRoomId(null);
                setSelectedRoomIds([]);
                return;
            }

            const { x: rx, y: ry, w: rw, h: rh, mode: selMode } = selectionRect;
            const matched: string[] = [];

            for (const room of currentFloor.rooms) {
                let pts = room.points;
                if (!pts && room.x !== undefined && room.width !== undefined) {
                    pts = [
                        { x: room.x!, y: room.y! },
                        { x: room.x! + room.width!, y: room.y! },
                        { x: room.x! + room.width!, y: room.y! + room.height! },
                        { x: room.x!, y: room.y! + room.height! }
                    ];
                }
                if (!pts) continue;

                if (selMode === 'window') {
                    if (isPolygonFullyInsideRect(pts, rx, ry, rw, rh)) matched.push(room.id);
                } else {
                    if (doesPolygonIntersectRect(pts, rx, ry, rw, rh) || isPolygonFullyInsideRect(pts, rx, ry, rw, rh)) matched.push(room.id);
                }
            }

            setSelectedRoomIds(matched);
            setSelectedRoomId(matched.length === 1 ? matched[0] : null);
            setSelectionRect(null);
            justBoxSelected.current = true;
        } else if (mode === 'select' && isDragging && dragStart && selectedRoomId && currentFloor) {
            const coords = getRelativeCoords(e);
            let dx = coords.x - dragStart.x;
            let dy = coords.y - dragStart.y;

            // Horizontal/Vertical constraint (Shift)
            if (e.shiftKey) {
                if (Math.abs(dx) > Math.abs(dy)) dy = 0;
                else dx = 0;
            }

            const room = currentFloor.rooms.find(r => r.id === selectedRoomId);
            if (room && room.points) {
                const newPoints = room.points.map(p => ({ x: p.x + dx, y: p.y + dy }));

                pushUndo(); // save state before mutation

                if (e.ctrlKey) {
                    // Copy
                    const newRoom: RoomCoordinate = {
                        id: `room-${Date.now()}`,
                        label: `${room.label} (Copy)`,
                        points: newPoints
                    };
                    addRoom(newRoom);
                    setSelectedRoomId(newRoom.id);
                } else {
                    // Move
                    updateRoom(selectedRoomId, { points: newPoints });
                }
            }

            setIsDragging(false);
            setDragStart(null);
            setDragOffset({ x: 0, y: 0 });
            setIsCopyDrag(false);
            justDragged.current = true;
        }
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (isSpaceDown || isPanning) return;

        // Skip deselect if we just finished a box selection (onClick fires after mouseUp)
        if (justBoxSelected.current) {
            justBoxSelected.current = false;
            return;
        }
        if (justDragged.current) {
            justDragged.current = false;
            return;
        }
        if (mode === 'select') {
            // Deselect when clicking empty area (not on a room)
            setSelectedRoomId(null);
            setSelectedRoomIds([]);
            return;
        }
        if (mode !== 'draw_poly') return;

        const rawCoords = getRelativeCoords(e);
        const coords = (currentPoints.length > 0 && e.shiftKey) ? getSnappedCoords(rawCoords, e) : rawCoords;

        // Check if clicking near the first point to close the polygon
        if (currentPoints.length > 2) {
            const firstPoint = currentPoints[0];
            const dist = Math.sqrt(Math.pow(coords.x - firstPoint.x, 2) + Math.pow(coords.y - firstPoint.y, 2));

            if (dist < 2) {
                finishPolygon();
                return;
            }
        }

        setCurrentPoints([...currentPoints, coords]);
        setPreviewPoint(coords);
        setIsDrawing(true);
    };

    const finishPolygon = () => {
        if (currentPoints.length < 3 || !currentFloor) return;

        const newRoom: RoomCoordinate = {
            id: `room-${Date.now()}`,
            label: 'New Room',
            points: currentPoints
        };

        pushUndo();
        addRoom(newRoom);
        setCurrentPoints([]);
        setPreviewPoint(null);
        setIsDrawing(false);
        setMode('select');
        setSelectedRoomId(newRoom.id);
    };

    const addRoom = (newRoom: RoomCoordinate) => {
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return {
                    ...b,
                    floors: b.floors.map(f => {
                        if (f.id === selectedFloorId) {
                            return { ...f, rooms: [...f.rooms, newRoom] };
                        }
                        return f;
                    })
                };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);
    };

    const updateRoom = (roomId: string, updates: Partial<RoomCoordinate>) => {
        const newBuildings = buildings.map(b => {
            if (b.id === selectedBuildingId) {
                return {
                    ...b,
                    floors: b.floors.map(f => {
                        if (f.id === selectedFloorId) {
                            return {
                                ...f,
                                rooms: f.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r)
                            };
                        }
                        return f;
                    })
                };
            }
            return b;
        });
        onUpdateBuildings(newBuildings);
    };

    // --- Zoom & Pan Logic ---
    const handleWheel = (e: React.WheelEvent) => {
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        let newZoom = zoom * scaleFactor;
        newZoom = Math.min(Math.max(newZoom, 0.2), 5); // Limit zoom between 0.2x and 5x

        if (newZoom === zoom) return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            const uX = cursorX / zoom;
            const uY = cursorY / zoom;

            setPan({
                x: pan.x + cursorX - uX * newZoom,
                y: pan.y + cursorY - uY * newZoom
            });
        }
        setZoom(newZoom);
    };

    const handleWrapperMouseDown = (e: React.MouseEvent) => {
        if (isSpaceDown && e.button === 0) {
            e.preventDefault();
            setIsPanning(true);
            setPanDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleWrapperMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan({ x: e.clientX - panDragStart.x, y: e.clientY - panDragStart.y });
        }
    };

    const handleWrapperMouseUp = () => {
        if (isPanning) setIsPanning(false);
    };

    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };


    const pointsToString = (points: { x: number; y: number }[]) => {
        return points.map(p => `${p.x},${p.y}`).join(' ');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Top Bar with Controls */}
            <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
                <div className="flex gap-4 items-center">
                    {/* Building Selector */}
                    <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-500" />
                        <select
                            value={selectedBuildingId}
                            onChange={(e) => {
                                setSelectedBuildingId(e.target.value);
                                const b = buildings.find(b => b.id === e.target.value);
                                if (b && b.floors.length > 0) setSelectedFloorId(b.floors[0].id);
                            }}
                            className="border rounded-lg px-3 py-2 text-sm min-w-[150px]"
                        >
                            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <button
                            onClick={() => setShowBuildingModal(true)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            title="Add Building"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                if (currentBuilding) {
                                    setEditingItem({ type: 'building', id: currentBuilding.id, name: currentBuilding.name });
                                    setNewItemName(currentBuilding.name);
                                }
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            title="Edit Building Name"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => currentBuilding && handleDeleteClick('building', currentBuilding.id, currentBuilding.name)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
                            title="Delete Building"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-gray-300 mx-2" />

                    {/* Floor Selector */}
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-gray-500" />
                        <select
                            value={selectedFloorId}
                            onChange={(e) => setSelectedFloorId(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm min-w-[100px]"
                        >
                            {currentBuilding?.floors
                                .slice()
                                .sort((a, b) => {
                                    const numA = parseInt(a.name.replace(/[^-\d]/g, '')) || 0;
                                    const numB = parseInt(b.name.replace(/[^-\d]/g, '')) || 0;
                                    return numA - numB;
                                })
                                .map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <button
                            onClick={() => setShowFloorModal(true)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            title="Add Floor"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                if (currentFloor) {
                                    setEditingItem({ type: 'floor', id: currentFloor.id, name: currentFloor.name });
                                    setNewItemName(currentFloor.name);
                                }
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            title="Edit Floor Name"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => currentFloor && handleDeleteClick('floor', currentFloor.id, currentFloor.name)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
                            title="Delete Floor"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <label className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer" title="Import Config">
                        <Upload className="w-5 h-5 text-gray-600" />
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const data = JSON.parse(event.target?.result as string);
                                            onUpdateBuildings(data);
                                            alert('Configuration loaded successfully!');
                                        } catch (err) {
                                            alert('Invalid configuration file');
                                        }
                                    };
                                    reader.readAsText(file);
                                }
                            }}
                        />
                    </label>
                    <button
                        onClick={handleSaveVectorData}
                        disabled={isSaving}
                        className={`p-2 rounded-lg transition-all duration-300 flex items-center gap-2 hover:bg-indigo-50 ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                        title="방 좌표 데이터 저장 (Ctrl+S)"
                    >
                        <Save className={`w-5 h-5 ${isSaving ? 'animate-spin text-indigo-600' : 'text-gray-600'}`} />
                        {isSaving && <span className="text-xs font-semibold text-indigo-600 animate-pulse">저장 중...</span>}
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                    <button
                        onClick={() => {
                            setMode('select');
                            setIsDrawing(false);
                            setCurrentPoints([]);
                        }}
                        className={`p-2 rounded-lg ${mode === 'select' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
                        title="Select Mode"
                    >
                        <MousePointer className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            setMode('draw_rect');
                            setIsDrawing(false);
                            setCurrentPoints([]);
                        }}
                        className={`p-2 rounded-lg ${mode === 'draw_rect' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
                        title="Draw Rectangle"
                    >
                        <Square className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            setMode('draw_poly');
                            setIsDrawing(false);
                            setCurrentPoints([]);
                        }}
                        className={`p-2 rounded-lg ${mode === 'draw_poly' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
                        title="Draw Polygon"
                    >
                        <Hexagon className="w-5 h-5" />
                    </button>
                    {mode === 'draw_poly' && isDrawing && (
                        <button
                            onClick={finishPolygon}
                            className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                            title="Finish Polygon"
                            disabled={currentPoints.length < 3}
                        >
                            <Check className="w-5 h-5" />
                        </button>
                    )}

                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                </div>
            </div>

            {/* Modals for Building/Floor Management */}
            {(showBuildingModal || showFloorModal || editingItem) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">
                            {editingItem
                                ? `Edit ${editingItem.type === 'building' ? 'Building' : 'Floor'} Name`
                                : showBuildingModal ? 'Add New Building' : 'Add New Floor'
                            }
                        </h3>
                        <input
                            type="text"
                            value={newItemName}
                            placeholder="Enter name..."
                            className="w-full border rounded-lg px-3 py-2 mb-4"
                            autoFocus
                            onChange={(e) => { setNewItemName(e.target.value); setModalError(''); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (editingItem) editingItem.type === 'building' ? updateBuilding() : updateFloor();
                                    else if (showBuildingModal) addBuilding();
                                    else addFloor();
                                }
                            }}
                        />
                        {modalError && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                {modalError}
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowBuildingModal(false);
                                    setShowFloorModal(false);
                                    setEditingItem(null);
                                    setNewItemName('');
                                    setModalError('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (editingItem) editingItem.type === 'building' ? updateBuilding() : updateFloor();
                                    else if (showBuildingModal) addBuilding();
                                    else addFloor();
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                {editingItem ? 'Save' : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">Confirm Deletion</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete {deleteConfirmation.type}
                            {deleteConfirmation.name ? ` "${deleteConfirmation.name}"` : ''}?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Map Area */}
                <div
                    className="flex-1 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200 flex items-center justify-center group/maparea"
                    onWheel={handleWheel}
                    onMouseDown={handleWrapperMouseDown}
                    onMouseMove={handleWrapperMouseMove}
                    onMouseUp={handleWrapperMouseUp}
                    onMouseLeave={handleWrapperMouseUp}
                    style={{ cursor: isSpaceDown ? (isPanning ? 'grabbing' : 'grab') : undefined }}
                >
                    {(currentFloor?.imageUrl || stagedImage) ? (
                        <>
                            {/* Reset View Button */}
                            <button
                                onClick={resetView}
                                className="absolute top-4 left-4 z-50 p-2.5 bg-white/90 text-gray-700 rounded-lg shadow-md hover:bg-white hover:text-indigo-600 transition-colors flex items-center gap-2 backdrop-blur-sm border border-gray-200/50"
                                title="화면 맞춤 핏 (원상복구)"
                            >
                                <Maximize className="w-4 h-4" />
                                <span className="text-sm font-bold">Reset View</span>
                            </button>
                            {/* Delete Image floating button */}
                            <button
                                onClick={handleDeleteImage}
                                className="absolute top-4 right-4 z-50 p-2 bg-white/90 text-red-600 rounded-lg shadow-md hover:bg-red-50 hover:text-red-700 transition-colors opacity-0 group-hover/maparea:opacity-100"
                                title="Delete Floor Plan Image"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>

                            {/* [Plan A] Image Confirmation Overlay */}
                            {stagedImage && (
                                <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 pt-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-white">
                                            <ImagePlus className="w-5 h-5 text-yellow-300 animate-pulse" />
                                            <span className="text-sm font-semibold">새 도면이 로드되었습니다 (미저장)</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCancelImage}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors backdrop-blur-sm text-sm font-medium"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                취소
                                            </button>
                                            <button
                                                onClick={handleConfirmImage}
                                                disabled={isSaving}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-lg text-sm font-semibold disabled:opacity-50"
                                            >
                                                <Check className="w-4 h-4" />
                                                {isSaving ? '저장 중...' : '도면 확정'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div
                                ref={containerRef}
                                className="relative inline-block shadow-lg bg-white"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: '0 0'
                                }}
                                onClick={handleCanvasClick}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={(e) => { handleMouseUp(e as any); setIsBoxSelecting(false); setSelectionRect(null); }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <img
                                    ref={imageRef}
                                    src={stagedImage ? stagedImage.preview : currentFloor.imageUrl}
                                    alt="Floor Plan"
                                    className="max-w-full max-h-[70vh] object-contain pointer-events-none select-none"
                                    draggable={false}
                                    onLoad={() => setImageLoadCount(c => c + 1)}
                                />

                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    style={{ zIndex: 10 }}
                                >
                                    {/* Existing Rooms */}
                                    {currentFloor.rooms.map(room => {
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

                                        const isSelected = selectedRoomId === room.id || selectedRoomIds.includes(room.id);
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

                                        const imgRatio = imageRef.current ? imageRef.current.clientWidth / Math.max(1, imageRef.current.clientHeight) : 1;

                                        const clipId = `clip-${room.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

                                        const isBeingDragged = isDragging && selectedRoomId === room.id;
                                        // For copy-drag: original stays in place, ghost moves
                                        // For move-drag: original moves with cursor
                                        const applyTransform = isBeingDragged && !isCopyDrag;

                                        return (
                                            <g
                                                key={room.id}
                                                transform={applyTransform ? `translate(${dragOffset.x}, ${dragOffset.y})` : undefined}
                                                onMouseDown={(e) => {
                                                    if (mode === 'select' && e.button === 0) {
                                                        e.stopPropagation();
                                                        const coords = getRelativeCoords(e as any);
                                                        setSelectedRoomId(room.id);
                                                        setSelectedRoomIds([room.id]);
                                                        setDragStart(coords);
                                                        setIsDragging(true);
                                                    }
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (mode === 'select') {
                                                        setSelectedRoomId(room.id);
                                                        setSelectedRoomIds([room.id]);
                                                    }
                                                }}
                                                className="cursor-pointer pointer-events-auto"
                                            >
                                                <defs>
                                                    <clipPath id={clipId}>
                                                        <polygon points={pointsToString(points)} />
                                                    </clipPath>
                                                </defs>
                                                {/* Opaque white base to completely hide background map text */}
                                                <polygon
                                                    points={pointsToString(points)}
                                                    fill="#ffffff"
                                                    stroke="none"
                                                />
                                                <polygon
                                                    points={pointsToString(points)}
                                                    fill={isSelected ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.5)"}
                                                    stroke={isSelected ? "#ef4444" : "#4f46e5"}
                                                    strokeWidth="0.3"
                                                    className="transition-colors"
                                                />
                                                <text
                                                    x={centerX}
                                                    y={centerY}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fill={isSelected ? "#7f1d1d" : "#1e1b4b"}
                                                    fontSize={dynamicFontSize}
                                                    fontWeight="bold"
                                                    className="pointer-events-none select-none"
                                                    transform={`translate(${centerX}, ${centerY}) scale(1, ${imgRatio}) translate(${-centerX}, ${-centerY})`}
                                                >
                                                    {room.label}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Copy-drag ghost: shows the copy at cursor position */}
                                    {isDragging && isCopyDrag && selectedRoomId && currentFloor && (() => {
                                        const room = currentFloor.rooms.find(r => r.id === selectedRoomId);
                                        if (!room?.points) return null;
                                        const points = room.points;
                                        const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
                                        const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
                                        return (
                                            <g transform={`translate(${dragOffset.x}, ${dragOffset.y})`} opacity={0.6}>
                                                <polygon
                                                    points={pointsToString(points)}
                                                    fill="#86efac"
                                                    stroke="#22c55e"
                                                    strokeWidth="0.3"
                                                    strokeDasharray="1 0.5"
                                                />
                                                <text
                                                    x={centerX}
                                                    y={centerY}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fill="#166534"
                                                    fontSize={Math.min(
                                                        (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) / Math.max(room.label.length * 0.65, 1),
                                                        (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * 0.5,
                                                        3
                                                    )}
                                                    fontWeight="bold"
                                                    className="pointer-events-none select-none"
                                                    transform={`translate(${centerX}, ${centerY}) scale(1, ${imageRef.current ? imageRef.current.clientWidth / Math.max(1, imageRef.current.clientHeight) : 1}) translate(${-centerX}, ${-centerY})`}
                                                >
                                                    {room.label} (Copy)
                                                </text>
                                            </g>
                                        );
                                    })()}

                                    {/* Currently Drawing Polygon */}
                                    {mode === 'draw_poly' && currentPoints.length > 0 && (() => {
                                        const aspectRatio = imageRef.current ? imageRef.current.clientWidth / Math.max(1, imageRef.current.clientHeight) : 1;
                                        return (
                                            <g>
                                                <polyline
                                                    points={pointsToString(currentPoints)}
                                                    fill="none"
                                                    stroke="#4f46e5"
                                                    strokeWidth="0.2"
                                                    strokeDasharray="1 1"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                                {previewPoint && (
                                                    <line
                                                        x1={currentPoints[currentPoints.length - 1].x}
                                                        y1={currentPoints[currentPoints.length - 1].y}
                                                        x2={previewPoint.x}
                                                        y2={previewPoint.y}
                                                        stroke="#ef4444"
                                                        strokeWidth="0.2"
                                                        strokeDasharray="1 1"
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                )}
                                                {currentPoints.map((p, i) => (
                                                    <ellipse
                                                        key={i}
                                                        cx={p.x}
                                                        cy={p.y}
                                                        rx={0.2}
                                                        ry={0.2 * aspectRatio}
                                                        fill="#ffffff"
                                                        stroke={i === 0 ? "#10b981" : "#4f46e5"}
                                                        strokeWidth="0.2"
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                ))}
                                            </g>
                                        );
                                    })()}

                                    {/* Currently Drawing Rectangle */}
                                    {mode === 'draw_rect' && currentRect && (
                                        <rect
                                            x={currentRect.x}
                                            y={currentRect.y}
                                            width={currentRect.w}
                                            height={currentRect.h}
                                            fill="rgba(99, 102, 241, 0.3)"
                                            stroke="#4f46e5"
                                            strokeWidth="0.3"
                                        />
                                    )}

                                    {/* Box Selection Rectangle */}
                                    {selectionRect && isBoxSelecting && (
                                        <rect
                                            x={selectionRect.x}
                                            y={selectionRect.y}
                                            width={selectionRect.w}
                                            height={selectionRect.h}
                                            fill={selectionRect.mode === 'window' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)'}
                                            stroke={selectionRect.mode === 'window' ? '#3b82f6' : '#22c55e'}
                                            strokeWidth="0.25"
                                            strokeDasharray={selectionRect.mode === 'crossing' ? '1 0.5' : 'none'}
                                        />
                                    )}
                                </svg>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-8">
                            <p className="text-gray-500 mb-4">
                                {currentFloor ? "No floor plan image uploaded" : "Select or create a floor"}
                            </p>
                            {currentFloor && (
                                <div className="flex flex-col items-center gap-3">
                                    <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
                                        Upload Image File
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>

                                    <div className="flex items-center gap-2 w-full max-w-xs">
                                        <div className="h-px bg-gray-300 flex-1"></div>
                                        <span className="text-xs text-gray-400 font-medium">OR USE URL</span>
                                        <div className="h-px bg-gray-300 flex-1"></div>
                                    </div>

                                    <div className="flex gap-2 w-full max-w-xs">
                                        <input
                                            type="text"
                                            placeholder="Enter Image URL (e.g. NAS link)"
                                            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const url = e.currentTarget.value;
                                                    if (url.trim()) {
                                                        const newBuildings = buildings.map(b => {
                                                            if (b.id === selectedBuildingId) {
                                                                return {
                                                                    ...b,
                                                                    floors: b.floors.map(f => {
                                                                        if (f.id === selectedFloorId) {
                                                                            return { ...f, imageUrl: url };
                                                                        }
                                                                        return f;
                                                                    })
                                                                };
                                                            }
                                                            return b;
                                                        });
                                                        onUpdateBuildings(newBuildings);
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        * Supports public URLs from NAS or Cloud Storage
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Properties Panel */}
                <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-y-auto">
                    <h3 className="font-semibold text-gray-900 mb-4">Properties</h3>

                    {selectedRoomId ? (
                        <div className="space-y-4">
                            {(() => {
                                const room = currentFloor?.rooms.find(r => r.id === selectedRoomId);
                                if (!room) return null;
                                return (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Room Label</label>
                                            <input
                                                type="text"
                                                value={room.label}
                                                onChange={(e) => updateRoom(room.id, { label: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Room ID (for Excel)</label>
                                            <input
                                                type="text"
                                                value={room.id.startsWith('room-') ? '' : room.id}
                                                onChange={(e) => {
                                                    const newId = e.target.value || room.id;
                                                    updateRoom(room.id, { id: newId });
                                                    setSelectedRoomId(newId);
                                                    setSelectedRoomIds([newId]);
                                                }}
                                                placeholder="1111"
                                                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="pt-4 border-t">
                                            <button
                                                onClick={() => handleDeleteClick('room', room.id, room.label)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Room
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : selectedRoomIds.length > 1 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-700 font-bold text-sm">{selectedRoomIds.length}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-indigo-900">Rooms Selected</p>
                                    <p className="text-xs text-indigo-600">Click empty area to deselect</p>
                                </div>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {selectedRoomIds.map(rid => {
                                    const room = currentFloor?.rooms.find(r => r.id === rid);
                                    if (!room) return null;
                                    return (
                                        <div
                                            key={rid}
                                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 transition-colors"
                                            onClick={() => { setSelectedRoomId(rid); setSelectedRoomIds([rid]); }}
                                        >
                                            <span className="font-medium text-gray-700">{room.label}</span>
                                            <span className="text-xs text-gray-400 font-mono">{rid.startsWith('room-') ? '—' : rid}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-8">
                            Select a room to edit its properties
                        </p>
                    )}

                    <div className="mt-8 pt-4 border-t">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
                        <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                            <li><strong>Building/Floor:</strong> Use the top bar to add (+), edit (pencil), or delete (trash) buildings and floors.</li>
                            <li><strong>Select Mode:</strong> Click to select. Drag to move.</li>
                            <li><strong>Box Select (Window):</strong> Left-drag on empty area — selects rooms <em>fully inside</em> the box.</li>
                            <li><strong>Box Select (Crossing):</strong> Right-drag on empty area — selects rooms <em>partially overlapping</em> the box.</li>
                            <li><strong>Copy:</strong> Hold <code>Ctrl</code> + Drag to copy a room.</li>
                            <li><strong>Align Copy:</strong> Hold <code>Ctrl + Shift</code> + Drag to copy horizontally/vertically.</li>
                            <li><strong>Draw Rect:</strong> Click and drag to create a rectangle room.</li>
                            <li><strong>Draw Poly:</strong> Click points to create a custom shape.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
