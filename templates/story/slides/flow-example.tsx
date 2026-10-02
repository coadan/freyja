import React, {useId} from 'react';
import {Icon, type IconName, type Tone} from '@freyja/sdk';
export type FlowNode = {id: string; label: string; icon?: IconName; iconSrc?: string; x: number; y: number; value?: string; tone?: Tone; visible?: boolean};
export type FlowEdge = {id: string; from: string; to: string; label?: string; tone?: Tone; visible?: boolean};
export type FlowState = {nodes?: Record<string, Partial<Pick<FlowNode, 'value' | 'tone' | 'visible'>>>; edges?: Record<string, Partial<Pick<FlowEdge, 'label' | 'tone' | 'visible'>>>};
export default function StateFlow({nodes, edges, states, step, label = 'System flow'}: {nodes: FlowNode[]; edges: FlowEdge[]; states: FlowState[]; step: number; label?: string}) {
  const state = states[Math.min(step, states.length - 1)] ?? {}, unique = useId().replace(/:/g, '');
  const resolved = nodes.map(n => ({...n, ...state.nodes?.[n.id]}));
  return <div className="f-flow" role="img" aria-label={label}>
    <svg viewBox="0 0 1000 380" aria-hidden="true"><defs>{['neutral','active','success','warning','danger','muted'].map(tone => <marker key={tone} id={`${unique}-${tone}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" className={`fill-${tone}`}/></marker>)}</defs>{edges.map(edge => {
      const e = {...edge, ...state.edges?.[edge.id]}, from = resolved.find(n => n.id === e.from), to = resolved.find(n => n.id === e.to);
      if (!from || !to || e.visible === false || from.visible === false || to.visible === false) return null;
      const x1 = from.x + 110, y1 = from.y + 55, x2 = to.x + 110, y2 = to.y + 55;
      const dx = x2 - x1, dy = y2 - y1, horizontal = Math.abs(dx) >= Math.abs(dy);
      const sx = x1 + (horizontal ? Math.sign(dx) * 110 : 0), sy = y1 + (horizontal ? 0 : Math.sign(dy) * 55);
      const tx = x2 - (horizontal ? Math.sign(dx) * 118 : 0), ty = y2 - (horizontal ? 0 : Math.sign(dy) * 62);
      return <g key={e.id} className={`stroke-${e.tone ?? 'neutral'}`}><path d={`M${sx} ${sy} L${tx} ${ty}`} markerEnd={`url(#${unique}-${e.tone ?? 'neutral'})`}/>{e.label && <text x={(sx + tx) / 2} y={(sy + ty) / 2 - 14}>{e.label}</text>}</g>;
    })}</svg>
    {resolved.map(n => <article key={n.id} className={`f-flow-node tone-${n.tone ?? 'neutral'}`} style={{left: `${n.x / 10}%`, top: `${n.y / 3.8}%`, visibility: n.visible === false ? 'hidden' : 'visible'}}><div><Icon name={n.icon} src={n.iconSrc} size={29}/><strong>{n.label}</strong></div>{n.value && <span>{n.value}</span>}</article>)}
  </div>;
}
