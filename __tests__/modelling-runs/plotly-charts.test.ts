import { buildDevcTraces, buildHrrTraces, plotConfig, timeSeriesLayout } from '../../lib/modelling-runs/plotly-charts';

describe('plotly run charts', () => {
  it('draws recorded HRR and a dashed design trace from {t, hrr}', () => {
    const traces = buildHrrTraces(
      [
        { t: 0, v: 10 },
        { t: 20, v: 40 },
      ],
      [
        { t: 0, v: 0 },
        { t: 60, v: 500 },
      ],
    );

    expect(traces).toEqual([
      {
        x: [0, 20],
        y: [10, 40],
        mode: 'lines',
        type: 'scatter',
        name: 'Recorded HRR',
        line: { color: '#4798EA' },
      },
      {
        x: [0, 60],
        y: [0, 500],
        mode: 'lines',
        type: 'scatter',
        name: 'Design HRR',
        line: { color: '#E10600', dash: 'dash' },
      },
    ]);
  });

  it('omits the design trace when hrr.design is null or empty', () => {
    const recorded = [
      {
        x: [1],
        y: [2],
        mode: 'lines',
        type: 'scatter',
        name: 'Recorded HRR',
        line: { color: '#4798EA' },
      },
    ];
    expect(buildHrrTraces([{ t: 1, v: 2 }], null)).toEqual(recorded);
    expect(buildHrrTraces([{ t: 1, v: 2 }], [])).toEqual(recorded);
  });

  it('draws one DEVC scatter for the selected device', () => {
    expect(
      buildDevcTraces('PRESSURE', [
        { t: 0, v: 20 },
        { t: 10, v: 55 },
      ]),
    ).toEqual([
      {
        x: [0, 10],
        y: [20, 55],
        mode: 'lines',
        type: 'scatter',
        name: 'PRESSURE',
        line: { color: '#4798EA' },
      },
    ]);
  });

  it('uses the i-macs Plotly.react config and the page font', () => {
    expect(plotConfig).toEqual({ responsive: true, displaylogo: false });
    const layout = timeSeriesLayout('Time (s)', 'kW');
    expect(layout.font).toEqual({ family: 'Arial, Helvetica, sans-serif' });
    expect(JSON.stringify(layout)).not.toMatch(/Segoe UI/);
    expect(layout.xaxis).toMatchObject({ title: { text: 'Time (s)' }, rangemode: 'tozero' });
    expect(layout.yaxis).toMatchObject({ title: { text: 'kW' }, rangemode: 'tozero' });
    expect(layout.margin).toEqual({ t: 10, r: 20, b: 50, l: 60 });
    expect(layout.legend).toEqual({ orientation: 'h', y: -0.25 });
  });
});
