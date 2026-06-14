'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { Entity, Relationship } from '@/lib/types';


const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface KnowledgeGraphProps {
  entities: Entity[];
  relationships: Relationship[];
}

const TYPE_COLORS: Record<string, string> = {
  Concept: '#8b5cf6',      // purple
  Person: '#3b82f6',       // blue
  Organization: '#10b981', // green
  Technology: '#f59e0b',   // amber
  Place: '#ec4899',        // pink
  Event: '#ef4444',        // red
  Entity: '#6b7280',       // gray
};

export function KnowledgeGraph({ entities, relationships }: KnowledgeGraphProps) {
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 400 });

  useEffect(() => {
    setMounted(true);
    
    // Simple responsive resize logic for the container
    const updateDimensions = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: 400,
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    // small delay to let layout settle
    setTimeout(updateDimensions, 100);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const graphData = useMemo(() => {
    if (!entities.length) return { nodes: [], links: [] };

    const nodes = entities.map((e) => ({
      id: e.name,
      name: e.name,
      type: e.type,
      description: e.description,
      val: 2, // node size
      color: TYPE_COLORS[e.type] || TYPE_COLORS['Entity'],
    }));

    const nodeIds = new Set(nodes.map(n => n.id));

    const links = relationships
      .filter(r => nodeIds.has(r.source) && nodeIds.has(r.target))
      .map((r) => ({
        source: r.source,
        target: r.target,
        label: r.relation,
      }));

    return { nodes, links };
  }, [entities, relationships]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

    ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
    ctx.fillRect(
      node.x - bckgDimensions[0] / 2,
      node.y - bckgDimensions[1] / 2,
      bckgDimensions[0],
      bckgDimensions[1]
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = node.color;
    ctx.fillText(label, node.x, node.y);

    node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
  }, []);

  if (!mounted) return <div className="h-[400px] w-full animate-pulse bg-muted rounded-md" />;

  if (entities.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-md border border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">No graph data yet</p>
      </div>
    );
  }

  return (
    <div id="graph-container" className="h-[400px] w-full overflow-hidden rounded-md border border-border bg-background relative">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeLabel={(node: any) => `${node.name} (${node.type})\n${node.description}`}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeColor={(node: any) => node.color}
        nodeCanvasObject={paintNode}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          if (bckgDimensions) {
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2,
              bckgDimensions[0],
              bckgDimensions[1]
            );
          }
        }}
        linkColor={() => '#333333'}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
