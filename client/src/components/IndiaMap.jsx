import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import topology from '../assets/india-states.topo.json';

/* ─── Boundary name → app state id ─────────────────────────── */
const NAME_TO_ID = {
  'Jammu and Kashmir': 'jammu-kashmir',
  'Ladakh': 'ladakh',
  'Punjab': 'punjab',
  'Himachal Pradesh': 'himachal-pradesh',
  'Chandigarh': 'chandigarh',
  'Haryana': 'haryana',
  'Uttarakhand': 'uttarakhand',
  'Delhi': 'delhi',
  'Rajasthan': 'rajasthan',
  'Uttar Pradesh': 'uttar-pradesh',
  'Bihar': 'bihar',
  'Sikkim': 'sikkim',
  'Arunachal Pradesh': 'arunachal-pradesh',
  'Assam': 'assam',
  'Nagaland': 'nagaland',
  'Meghalaya': 'meghalaya',
  'Manipur': 'manipur',
  'Tripura': 'tripura',
  'Mizoram': 'mizoram',
  'West Bengal': 'west-bengal',
  'Jharkhand': 'jharkhand',
  'Odisha': 'odisha',
  'Chhattisgarh': 'chhattisgarh',
  'Madhya Pradesh': 'madhya-pradesh',
  'Gujarat': 'gujarat',
  'Dadra and Nagar Haveli and Daman and Diu': 'dadra-nagar-haveli-daman-diu',
  'Maharashtra': 'maharashtra',
  'Goa': 'goa',
  'Telangana': 'telangana',
  'Andhra Pradesh': 'andhra-pradesh',
  'Karnataka': 'karnataka',
  'Kerala': 'kerala',
  'Tamil Nadu': 'tamil-nadu',
  'Puducherry': 'puducherry',
  'Lakshadweep': 'lakshadweep',
  'Andaman and Nicobar Islands': 'andaman-nicobar',
};

const W = 520;
const H = 600;
const PAD = 10;
const MINE_COLOR = '#00e676';
const ENEMY_COLOR = '#ff4b4b';
const NEUTRAL_STROKE = '#52525b';
const NEUTRAL_FILL = '#16162a';
const SMALL_AREA = 140; // px² below which a state gets a tap-marker
const MIN_K = 1;
const MAX_K = 8;

/* Project all 36 boundaries once at module load (static data). */
const SHAPES = (() => {
  const fc = feature(topology, topology.objects.states);
  const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], fc);
  const pathGen = geoPath(projection);
  return fc.features
    .map(f => ({
      id: NAME_TO_ID[f.properties.name],
      d: pathGen(f),
      centroid: pathGen.centroid(f),
      area: pathGen.area(f),
    }))
    .filter(s => s.id && s.d);
})();

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const MapOfIndia = ({ states, myConquests = [], onStateClick, selectedId = null }) => {
  const mySet = useMemo(() => new Set(myConquests.map(c => c.stateId)), [myConquests]);
  const byId = useMemo(() => Object.fromEntries(states.map(s => [s.id, s])), [states]);

  /* ── Pan & zoom ──────────────────────────────────────────── */
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map());
  const dragged = useRef(false);
  const tapTargetId = useRef(null);

  const toViewBox = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [
      (clientX - rect.left) * (W / rect.width),
      (clientY - rect.top) * (H / rect.height),
    ];
  }, []);

  const zoomAt = useCallback((px, py, factor) => {
    setView(v => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      if (k === v.k) return v;
      const ratio = k / v.k;
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  /* Wheel zoom (manual listener: React's onWheel can't preventDefault) */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const [px, py] = toViewBox(e.clientX, e.clientY);
      zoomAt(px, py, e.deltaY < 0 ? 1.25 : 0.8);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toViewBox, zoomAt]);

  const onPointerDown = (e) => {
    svgRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    // Pointer capture retargets click events to the svg, so remember what was
    // pressed and fire the tap ourselves on pointer-up if no drag happened.
    tapTargetId.current = e.target.closest?.('[data-state-id]')?.getAttribute('data-state-id') || null;
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);

    if (pts.size === 1) {
      // Pan
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged.current = true;
      const rect = svgRef.current.getBoundingClientRect();
      const f = W / rect.width;
      setView(v => ({ ...v, x: v.x + dx * f, y: v.y + dy * f }));
    } else if (pts.size === 2) {
      // Pinch zoom
      dragged.current = true;
      const [a, b] = [...pts.values()];
      const other = pts.get(e.pointerId) === a ? b : a;
      const distPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
      const distNow = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (distPrev > 0) {
        const [mx, my] = toViewBox((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
        zoomAt(mx, my, distNow / distPrev);
      }
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerEnd = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (!dragged.current && tapTargetId.current) {
        const state = byId[tapTargetId.current];
        if (state) onStateClick(state);
      }
      tapTargetId.current = null;
    }
  };

  const resetView = () => setView({ x: 0, y: 0, k: 1 });

  /* ── Render helpers ──────────────────────────────────────── */
  const now = new Date();
  const rendered = SHAPES.map(shape => {
    const state = byId[shape.id];
    if (!state) return null;
    const mine = mySet.has(state.id);
    const conquered = state.conquered;
    const shieldActive = state.shieldUntil && new Date(state.shieldUntil) > now;
    const color = mine ? MINE_COLOR : conquered ? ENEMY_COLOR : NEUTRAL_STROKE;
    const small = shape.area < SMALL_AREA;
    const selected = selectedId === state.id;
    return { shape, state, mine, conquered, shieldActive, color, small, selected };
  }).filter(Boolean);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-lg mx-auto select-none touch-none cursor-grab active:cursor-grabbing"
        xmlns="http://www.w3.org/2000/svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>

          {/* ── State boundaries ── */}
          {rendered.map(({ shape, state, conquered, color, selected }) => (
            <path
              key={shape.id}
              d={shape.d}
              fill={conquered ? `${color}30` : NEUTRAL_FILL}
              stroke={selected ? '#ffffff' : color}
              strokeWidth={selected ? 2 : conquered ? 1.4 : 0.7}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              className={`cursor-pointer transition-[fill] duration-300 ${conquered ? 'opacity-95' : 'opacity-80'} hover:opacity-100 hover:brightness-150`}
              style={conquered ? { filter: `drop-shadow(0 0 6px ${color}55)` } : {}}
              data-state-id={state.id}
            >
              <title>{state.name}</title>
            </path>
          ))}

          {/* ── Labels & badges for regular states ── */}
          {rendered.filter(r => !r.small).map(({ shape, state, conquered, shieldActive, color }) => {
            const [cx, cy] = shape.centroid;
            return (
              <g key={`lbl-${shape.id}`} className="pointer-events-none">
                <text x={cx} y={conquered ? cy - 6 : cy} textAnchor="middle" dominantBaseline="central"
                  fontSize="9" fontWeight="800"
                  fill={conquered ? '#ffffff' : '#a1a1aa'}
                  style={{ paintOrder: 'stroke', stroke: '#0b0b18', strokeWidth: 2.5 }}>
                  {state.abbr}
                </text>
                {conquered && (
                  <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central" fontSize="9">
                    🏰
                    <tspan fontSize="7" fontWeight="800" fill={color} dy="-1"> L{state.castleLevel}</tspan>
                  </text>
                )}
                {shieldActive && (
                  <text x={cx + 12} y={cy - 12} textAnchor="middle" dominantBaseline="central" fontSize="8">🛡️</text>
                )}
              </g>
            );
          })}

          {/* ── Tap-markers for tiny states & UTs ── */}
          {rendered.filter(r => r.small).map(({ shape, state, conquered, shieldActive, color }) => {
            const [cx, cy] = shape.centroid;
            return (
              <g key={`mk-${shape.id}`} className="cursor-pointer group" data-state-id={state.id}>
                <circle cx={cx} cy={cy} r="9"
                  fill={conquered ? `${color}30` : NEUTRAL_FILL}
                  stroke={selectedId === state.id ? '#ffffff' : color}
                  strokeWidth={conquered ? 1.6 : 1}
                  vectorEffect="non-scaling-stroke"
                  className="opacity-90 group-hover:opacity-100"
                  style={conquered ? { filter: `drop-shadow(0 0 5px ${color}66)` } : {}}
                />
                {conquered ? (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="8" className="pointer-events-none">🏰</text>
                ) : (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="6" fontWeight="800"
                    fill="#a1a1aa" className="pointer-events-none">
                    {state.abbr}
                  </text>
                )}
                {conquered && (
                  <text x={cx + 8} y={cy - 7} textAnchor="middle" dominantBaseline="central" fontSize="6"
                    fontWeight="800" fill={color} className="pointer-events-none"
                    style={{ paintOrder: 'stroke', stroke: '#0b0b18', strokeWidth: 2 }}>
                    L{state.castleLevel}
                  </text>
                )}
                {shieldActive && (
                  <text x={cx - 8} y={cy - 8} textAnchor="middle" dominantBaseline="central" fontSize="7" className="pointer-events-none">🛡️</text>
                )}
                <title>{state.name}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Zoom controls ── */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        {[
          { label: '+', action: () => zoomAt(W / 2, H / 2, 1.4), title: 'Zoom in' },
          { label: '−', action: () => zoomAt(W / 2, H / 2, 0.7), title: 'Zoom out' },
          { label: '⌂', action: resetView, title: 'Reset view' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            title={btn.title}
            className="w-9 h-9 rounded-xl bg-dh-card border-2 border-b-4 border-dh-border text-dh-text
              font-heading font-black text-base leading-none flex items-center justify-center
              hover:border-dh-accent/60 active:translate-y-[2px] active:border-b-2 transition-all"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs font-heading font-bold">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: MINE_COLOR, backgroundColor: `${MINE_COLOR}26` }} />
          <span className="text-dh-text-muted">Your Empire</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: ENEMY_COLOR, backgroundColor: `${ENEMY_COLOR}26` }} />
          <span className="text-dh-text-muted">Enemy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: NEUTRAL_STROKE, backgroundColor: NEUTRAL_FILL }} />
          <span className="text-dh-text-muted">Unclaimed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🛡️</span>
          <span className="text-dh-text-muted">Shielded</span>
        </div>
      </div>
      <p className="text-center text-dh-text-muted text-[10px] mt-1 font-body">
        Scroll or pinch to zoom · drag to pan · tap a state to act
      </p>
    </div>
  );
};

export default MapOfIndia;
