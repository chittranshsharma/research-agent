'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Entity, Relationship } from '@/lib/types';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

interface KnowledgeGraphProps {
  entities: Entity[];
  relationships: Relationship[];
}

const NODE_COLORS: Record<string, string> = {
  Concept: '#3b82f6',       // blue
  Technology: '#22c55e',    // green
  Person: '#f97316',        // orange
  Organization: '#a855f7',  // purple
  Event: '#eab308',         // yellow
  Place: '#ec4899',         // pink
};

export function KnowledgeGraph({ entities, relationships }: KnowledgeGraphProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Loading graph...
      </div>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No knowledge graph data for this session
      </div>
    );
  }

  const nodeIds = new Set(entities.map(e => e.name));

  const graphData = {
    nodes: entities.map(e => ({
      id: e.name,
      name: e.name,
      type: e.type,
      description: e.description,
      color: NODE_COLORS[e.type] || '#666666',
    })),
    links: relationships
      .filter(r => nodeIds.has(r.source) && nodeIds.has(r.target))
      .map(r => ({
        source: r.source,
        target: r.target,
        label: r.relation,
      })),
  };

  return (
    <ForceGraph2D
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graphData={graphData as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeLabel={(node: any) => `${node.name}: ${node.description || ''}`}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeColor={(node: any) => node.color}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linkLabel={(link: any) => link.label}
      nodeRelSize={6}
      width={320}
      height={300}
      backgroundColor="#0a0a0a"
      linkColor={() => '#374151'}
      nodeCanvasObjectMode={() => 'after'}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = node.name;
        const fontSize = 10 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + 10);
      }}
    />
  );
}
