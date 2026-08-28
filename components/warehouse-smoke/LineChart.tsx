'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartThreshold {
  /** Value on the y axis to draw the line at. */
  value: number;
  label: string;
}

export interface ChartMarker {
  /** Value on the x axis to draw the line at. */
  value: number;
  label: string;
}

interface LineChartProps {
  title: string;
  data: Record<string, number>[];
  xKey: string;
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  /** Horizontal reference lines, e.g. the 2 m tenability limit. */
  thresholds?: ChartThreshold[];
  /** Vertical reference lines, e.g. ASET. */
  markers?: ChartMarker[];
  /** Force the y axis to include zero even if the data does not reach it. */
  yFromZero?: boolean;
  /** Anchor the x axis at zero. Time series start one timestep in, not at zero. */
  xFromZero?: boolean;
  height?: number;
  decimals?: number;
  unit?: string;
}

const MARGIN = { top: 16, right: 20, bottom: 42, left: 62 };
const DEFAULT_WIDTH = 640;

/** Round an axis range out to clean tick values. */
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = (normalised >= 5 ? 10 : normalised >= 2 ? 5 : normalised >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return ticks;
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  // Small values read better as decimals than in exponential notation — an axis
  // tick of "0.005" is instantly legible where "5.0e-3" is not.
  if (abs !== 0 && abs < 0.01) return value.toLocaleString('en-GB', { maximumSignificantDigits: 2 });
  if (abs >= 1000) return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

const TICK_STYLE = { fontSize: 11, fontVariantNumeric: 'tabular-nums' as const };
const LABEL_STYLE = { fontSize: 11 };
const ANNOTATION_STYLE = { fontSize: 10 };

export default function LineChart({
  title,
  data,
  xKey,
  series,
  xLabel,
  yLabel,
  thresholds = [],
  markers = [],
  yFromZero = false,
  xFromZero = false,
  height = 260,
  decimals = 2,
  unit = '',
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const xs = data.map((d) => d[xKey]);
    const ys: number[] = [];
    for (const d of data) {
      for (const s of series) ys.push(d[s.key]);
    }
    for (const t of thresholds) ys.push(t.value);

    let lo = ys.length ? Math.min(...ys) : 0;
    let hi = ys.length ? Math.max(...ys) : 1;
    if (yFromZero) lo = Math.min(lo, 0);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    } else {
      const pad = (hi - lo) * 0.06;
      lo -= pad;
      hi += pad;
    }
    const rawXMin = xs.length ? Math.min(...xs) : 0;
    return {
      xMin: xFromZero ? Math.min(rawXMin, 0) : rawXMin,
      xMax: xs.length ? Math.max(...xs) : 1,
      yMin: lo,
      yMax: hi,
    };
  }, [data, xKey, series, thresholds, yFromZero, xFromZero]);

  const xScale = useCallback(
    (v: number) => (xMax === xMin ? 0 : ((v - xMin) / (xMax - xMin)) * plotWidth),
    [xMin, xMax, plotWidth],
  );
  const yScale = useCallback(
    (v: number) =>
      yMax === yMin ? plotHeight : plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight,
    [yMin, yMax, plotHeight],
  );

  const yTicks = useMemo(() => niceTicks(yMin, yMax), [yMin, yMax]);
  const xTicks = useMemo(() => niceTicks(xMin, xMax), [xMin, xMax]);

  const paths = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        d: data
          .map(
            (row, i) =>
              `${i === 0 ? 'M' : 'L'}${xScale(row[xKey]).toFixed(2)},${yScale(row[s.key]).toFixed(2)}`,
          )
          .join(' '),
      })),
    [series, data, xKey, xScale, yScale],
  );

  const handleMove = (event: React.MouseEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (data.length === 0 || rect.width <= 0) return;
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setHoverIndex(Math.round(ratio * (data.length - 1)));
  };

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverX = hovered ? MARGIN.left + xScale(hovered[xKey]) : 0;
  const flipTooltip = hoverX > width * 0.6;

  return (
    <figure className="border border-gray-200 rounded-xl p-4 bg-white m-0">
      <figcaption>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </figcaption>

      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative w-full mt-2">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: ${yLabel} against ${xLabel}`}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map((t) => (
              <line
                key={`grid-${t}`}
                x1={0}
                x2={plotWidth}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke="#eceae5"
                strokeWidth={1}
              />
            ))}

            <line
              x1={0}
              x2={plotWidth}
              y1={plotHeight}
              y2={plotHeight}
              stroke="#d6d3cc"
              strokeWidth={1}
            />
            <line x1={0} x2={0} y1={0} y2={plotHeight} stroke="#d6d3cc" strokeWidth={1} />

            {yTicks.map((t) => (
              <text
                key={`yt-${t}`}
                x={-8}
                y={yScale(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500"
                style={TICK_STYLE}
              >
                {formatTick(t)}
              </text>
            ))}
            {xTicks.map((t) => (
              <text
                key={`xt-${t}`}
                x={xScale(t)}
                y={plotHeight + 16}
                textAnchor="middle"
                className="fill-gray-500"
                style={TICK_STYLE}
              >
                {formatTick(t)}
              </text>
            ))}

            {thresholds.map((t) => (
              <g key={`threshold-${t.label}`}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={yScale(t.value)}
                  y2={yScale(t.value)}
                  stroke="#8a8781"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text x={4} y={yScale(t.value) - 5} className="fill-gray-500" style={ANNOTATION_STYLE}>
                  {t.label}
                </text>
              </g>
            ))}

            {markers.map((m) => (
              <g key={`marker-${m.label}`}>
                <line
                  x1={xScale(m.value)}
                  x2={xScale(m.value)}
                  y1={0}
                  y2={plotHeight}
                  stroke="#8a8781"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={xScale(m.value) - 4}
                  y={10}
                  textAnchor="end"
                  className="fill-gray-500"
                  style={ANNOTATION_STYLE}
                >
                  {m.label}
                </text>
              </g>
            ))}

            {paths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {hovered && (
              <g pointerEvents="none">
                <line
                  x1={xScale(hovered[xKey])}
                  x2={xScale(hovered[xKey])}
                  y1={0}
                  y2={plotHeight}
                  stroke="#b5b2ab"
                  strokeWidth={1}
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={xScale(hovered[xKey])}
                    cy={yScale(hovered[s.key])}
                    r={4}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}

            <rect
              x={0}
              y={0}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onMouseMove={handleMove}
              onMouseLeave={() => setHoverIndex(null)}
            />

            <text
              x={plotWidth / 2}
              y={plotHeight + 36}
              textAnchor="middle"
              className="fill-gray-500"
              style={LABEL_STYLE}
            >
              {xLabel}
            </text>
          </g>

          <text
            transform={`translate(14,${MARGIN.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-gray-500"
            style={LABEL_STYLE}
          >
            {yLabel}
          </text>
        </svg>

        {hovered && (
          <div
            className="absolute top-2 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs whitespace-nowrap"
            style={
              flipTooltip
                ? { right: Math.max(width - hoverX + 10, 0) }
                : { left: hoverX + 10 }
            }
          >
            <div className="font-medium text-gray-900 mb-1 tabular-nums">
              {formatTick(hovered[xKey])} s
            </div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-gray-600">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span>{s.label}</span>
                <span className="ml-auto pl-3 tabular-nums text-gray-900">
                  {hovered[s.key].toFixed(decimals)}
                  {unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
