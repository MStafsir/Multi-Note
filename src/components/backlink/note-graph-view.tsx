// ============================================================
// MODUL 34.5: Note Graph View — Force-directed graph visualization
// Uses Canvas API with basic d3-force-like physics simulation
// Nodes sized proportional to backlink count (centrality)
// Edges connect linked notes
// Hover shows tooltip with node name + backlink count
// Click navigates to note
// "Load more" button when >200 nodes
// Color: active notes = emerald, deleted = gray, broken = dotted red
// ============================================================

'use client';

import { useRef, useEffect, useState } from 'react';
import { Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGraphData } from '@/hooks/use-backlinks';
import type { GraphNode, GraphEdge } from '@/types';

interface NoteGraphViewProps {
  onNavigateToNote?: (noteId: string, noteName: string) => void;
}

// Physics simulation node type
interface SimNode {
  id: string;
  name: string;
  backlinkCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isDeleted?: boolean;
  isOwner?: boolean;
  color: string;
}

interface SimEdge {
  source: string;
  target: string;
}

export function NoteGraphView({ onNavigateToNote }: NoteGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const dragNodeRef = useRef<SimNode | null>(null);
  const hoveredNodeRef = useRef<SimNode | null>(null);

  // Simulation state stored outside of React hooks to avoid
  // the react-hooks/immutability lint rule
  const simStateRef = useRef<{
    nodes: SimNode[];
    edges: SimEdge[];
    zoom: number;
    offset: { x: number; y: number };
  }>({ nodes: [], edges: [], zoom: 1, offset: { x: 0, y: 0 } });

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, error, hasNextPage } = useGraphData(page);

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  const extendedInfo = data?.extendedNodeInfo || [];
  const total = data?.total || 0;

  // Sync zoom/offset to sim state ref (in useEffect to avoid ref write during render)
  useEffect(() => {
    simStateRef.current.zoom = zoom;
    simStateRef.current.offset = offset;
  }, [zoom, offset]);

  // Force simulation step — mutates nodes in ref directly
  // This is intentional for Canvas-based animation performance
  function simulateStep(simNodes: SimNode[], simEdges: SimEdge[], canvasWidth: number, canvasHeight: number) {
    if (simNodes.length === 0) return;

    const currentZoom = simStateRef.current.zoom;
    const currentOffset = simStateRef.current.offset;
    const alpha = 0.3;
    const repulsionForce = 200;
    const attractionForce = 0.01;
    const centerForce = 0.01;
    const damping = 0.85;

    const centerX = canvasWidth / 2 / currentZoom + currentOffset.x;
    const centerY = canvasHeight / 2 / currentZoom + currentOffset.y;

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // Repulsion: push nodes apart
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsionForce / (dist * dist);
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;

        if (a !== dragNodeRef.current) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b !== dragNodeRef.current) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // Attraction: pull connected nodes together
    for (const edge of simEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attractionForce * alpha;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== dragNodeRef.current) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== dragNodeRef.current) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Center gravity
    for (const node of simNodes) {
      if (node === dragNodeRef.current) continue;
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * centerForce * alpha;
      node.vy += dy * centerForce * alpha;
    }

    // Apply velocity with damping
    for (const node of simNodes) {
      if (node === dragNodeRef.current) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Render canvas — called from animation loop
  function renderCanvas(
    canvas: HTMLCanvasElement,
    simNodes: SimNode[],
    simEdges: SimEdge[]
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentZoom = simStateRef.current.zoom;
    const currentOffset = simStateRef.current.offset;
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and offset transforms
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-canvas.width / 2 + currentOffset.x * currentZoom, -canvas.height / 2 + currentOffset.y * currentZoom);

    // Draw edges first (below nodes)
    for (const edge of simEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const sourceIsDeleted = source.isDeleted;
      const targetIsDeleted = target.isDeleted;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (sourceIsDeleted || targetIsDeleted) {
        // Broken/deleted links: dotted red line
        ctx.strokeStyle = '#ef444480';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
      } else {
        // Active links: solid emerald line
        ctx.strokeStyle = '#10b98140';
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (const node of simNodes) {
      const isHovered = hoveredNodeRef.current === node;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

      // Fill color
      if (node.isDeleted) {
        ctx.fillStyle = isHovered ? '#6b7280' : '#9ca3af';
      } else if (isHovered) {
        ctx.fillStyle = '#059669';
      } else {
        ctx.fillStyle = node.color;
      }

      ctx.fill();

      // Border
      ctx.strokeStyle = isHovered ? '#047857' : '#ffffff30';
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.stroke();

      // Node label (name) — only show for hovered or large nodes
      if (isHovered || node.radius > 16) {
        ctx.fillStyle = node.isDeleted ? '#4b5563' : '#f9fafb';
        ctx.font = isHovered ? 'bold 12px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxLen = isHovered ? 20 : 10;
        const displayName = node.name.length > maxLen
          ? node.name.slice(0, maxLen) + '...'
          : node.name;

        ctx.fillText(displayName, node.x, node.y + node.radius + 12);
      }
    }

    ctx.restore();

    // Run simulation step
    simulateStep(simNodes, simEdges, canvas.width, canvas.height);
  }

  // Initialize simulation nodes from API data
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Map extended info for color/status
    const infoMap = new Map(extendedInfo.map(n => [n.id, n]));

    // Create simulation nodes
    const simNodes: SimNode[] = nodes.map((node, i) => {
      const info = infoMap.get(node.id);
      const maxBacklinks = Math.max(...nodes.map(n => n.backlinkCount), 1);
      const normalizedCount = node.backlinkCount / maxBacklinks;
      const radius = 8 + normalizedCount * 24;

      let color = '#10b981'; // emerald-500
      const isDeleted = info?.isDeleted ?? false;
      if (isDeleted) color = '#9ca3af'; // gray-400

      const angle = (2 * Math.PI * i) / nodes.length;
      const spread = Math.min(canvas.width, canvas.height) * 0.3;

      return {
        id: node.id,
        name: node.name,
        backlinkCount: node.backlinkCount,
        x: centerX + Math.cos(angle) * spread + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * spread + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        radius,
        isDeleted,
        isOwner: info?.isOwner ?? true,
        color,
      };
    });

    const simEdges: SimEdge[] = edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    simStateRef.current.nodes = simNodes;
    simStateRef.current.edges = simEdges;
  }, [nodes, edges, extendedInfo]);

  // Canvas resize handler
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isFullscreen]);

  // Animation loop — uses requestAnimationFrame directly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || simStateRef.current.nodes.length === 0) return;

    const animate = () => {
      const simNodes = simStateRef.current.nodes;
      const simEdges = simStateRef.current.edges;

      if (simNodes.length > 0) {
        renderCanvas(canvas, simNodes, simEdges);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [nodes, edges, extendedInfo]);

  // Mouse interaction handlers
  const getSimNodeAtPoint = (clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const currentZoom = zoom;
    const currentOffset = offset;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) - canvas.width / 2) / currentZoom + canvas.width / 2 - currentOffset.x * currentZoom;
    const y = ((clientY - rect.top) - canvas.height / 2) / currentZoom + canvas.height / 2 - currentOffset.y * currentZoom;

    const simNodes = simStateRef.current.nodes;
    for (const node of simNodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius) {
        return node;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getSimNodeAtPoint(e.clientX, e.clientY);
    if (node && !node.isDeleted) {
      dragNodeRef.current = node;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragNodeRef.current) {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) - canvas.width / 2) / zoom + canvas.width / 2 - offset.x * zoom;
      const y = ((e.clientY - rect.top) - canvas.height / 2) / zoom + canvas.height / 2 - offset.y * zoom;
      dragNodeRef.current.x = x;
      dragNodeRef.current.y = y;
    } else {
      const node = getSimNodeAtPoint(e.clientX, e.clientY);
      hoveredNodeRef.current = node;
      setHoveredNode(node);
    }
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragNodeRef.current) {
      dragNodeRef.current = null;
      return;
    }

    const node = getSimNodeAtPoint(e.clientX, e.clientY);
    if (node && !node.isDeleted) {
      if (onNavigateToNote) {
        onNavigateToNote(node.id, node.name);
      } else {
        const event = new CustomEvent('note-link-click', {
          detail: { noteId: node.id, noteName: node.name },
          bubbles: true,
        });
        document.dispatchEvent(event);
      }
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.2));
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleLoadMore = () => {
    if (hasNextPage) {
      setPage(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-background p-4">
        <Skeleton className="h-[400px] w-full rounded" />
      </div>
    );
  }

  if (error || nodes.length === 0) {
    return (
      <div className="border rounded-lg bg-background p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {error ? 'Failed to load graph data' : 'No linked notes to display in the graph'}
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Note Graph</span>
          <Badge variant="secondary" className="text-xs">
            {nodes.length} of {total} notes
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset view</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFullscreen(!isFullscreen)}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className={`relative ${
          isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-[400px] md:h-[500px]'
        }`}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          role="img"
          aria-label="Interactive note graph visualization — drag nodes to rearrange, click to navigate to note"
        />

        {/* Hover tooltip overlay */}
        {hoveredNode && (
          <div
            className="absolute bg-popover border rounded-md px-3 py-2 shadow-md pointer-events-none z-10 text-sm"
            style={{
              left: '16px',
              top: '16px',
            }}
          >
            <div className="font-medium">{hoveredNode.name}</div>
            <div className="text-xs text-muted-foreground">
              {hoveredNode.backlinkCount} backlinks
              {hoveredNode.isDeleted && ' — Deleted'}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-gray-400" />
            <span>Deleted</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-red-500 opacity-60" style={{ borderTop: '2px dotted #ef4444' }} />
            <span>Broken link</span>
          </div>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border">
          Zoom: {Math.round(zoom * 100)}%
        </div>

        {/* Close fullscreen button */}
        {isFullscreen && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-3 right-3"
            onClick={() => setIsFullscreen(false)}
          >
            <Minimize2 className="h-4 w-4 mr-1" />
            Close
          </Button>
        )}
      </div>

      {/* Load more button */}
      {hasNextPage && (
        <div className="flex justify-center px-4 py-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : null}
            Load more nodes ({total - nodes.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
