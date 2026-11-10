import type { Config, Data, Layout } from 'plotly.js';
import type { SeriesPoint } from './series';

/** Mid blue from the CFD report charts. */
const RECORDED_BLUE = '#4798EA';
/** Dashed design curve. */
const DESIGN_RED = '#E10600';

/** Same call options the i-macs charts pass to Plotly.react. */
export const plotConfig: Partial<Config> = { responsive: true, displaylogo: false };

function scatter(name: string, points: SeriesPoint[], color: string, dash?: 'dash'): Data {
  return {
    x: points.map((point) => point.t),
    y: points.map((point) => point.v),
    mode: 'lines',
    type: 'scatter',
    name,
    line: dash ? { color, dash } : { color },
  };
}

export function buildHrrTraces(recorded: SeriesPoint[], design: SeriesPoint[] | null): Data[] {
  const traces = [scatter('Recorded HRR', recorded, RECORDED_BLUE)];
  if (design && design.length > 0) {
    traces.push(scatter('Design HRR', design, DESIGN_RED, 'dash'));
  }
  return traces;
}

export function buildDevcTraces(quantity: string, points: SeriesPoint[]): Data[] {
  return [scatter(quantity, points, RECORDED_BLUE)];
}

/** Page font from globals.css. Plotly's own default is Open Sans, not Segoe UI. */
export function timeSeriesLayout(xLabel: string, yLabel: string): Partial<Layout> {
  return {
    margin: { t: 10, r: 20, b: 50, l: 60 },
    font: { family: 'Arial, Helvetica, sans-serif' },
    xaxis: { title: { text: xLabel }, rangemode: 'tozero' },
    yaxis: { title: { text: yLabel }, rangemode: 'tozero' },
    showlegend: true,
    legend: { orientation: 'h', y: -0.25 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
  };
}
