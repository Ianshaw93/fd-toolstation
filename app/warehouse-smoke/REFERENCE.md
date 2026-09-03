# Warehouse Smoke Layer — Reference

## Original Python project

- **Path:** `Fire Dynamics Group Dropbox/07 Technical Tools/1. Internal/Base Warehouse Smoke Depth`
- **Main script:** `warehouse_smoke_layer.py` (authors: sambe, kkleijn; updated 19 Aug 2026)
- **Ancestor:** `shedzone_U1_khrk.py` (the original 2024 script)

The folder is not in the local Dropbox selective sync — reach it with the
`dropbox-cli` skill (`rclone lsf "dropbox:07 Technical Tools/1. Internal/Base Warehouse Smoke Depth"`).

### Variants in that folder

| Folder | What it changes |
|---|---|
| `Whole_Layer_Assumption/` | The model shipped here: layer depth recomputed from the whole accumulated mass at the new temperature, so the old smoke re-expands as the layer heats. Conservative. |
| `Addition_Assumption/` | New smoke added beneath a frozen older layer (`dz = ṁ·Δt / (ρ·A)`). Descends more slowly. **Not implemented in this tool.** |
| `Verification/` | FDS comparison case — PyroSim 2026.2 / FDS 6.10.1, 5×5×15.4 m shaft, 25×25×77 cells, SFPE polyurethane GM27, `HRRPUA=835.56`, `TAU_Q=-120`, four low-level open vents, 120 s. |
| `Verification/volume_test/` | Layer-volume balance check at a 0.5 s timestep. |

## The model

Single-zone plume model integrated explicitly at `tstep`:

- Convective heat release: `Qc = 0.7 · fgr · t²`
- Plume mass flow: `ṁ = 0.2 · ((g·ρ∞²)/(cp·T∞))^(1/3) · Qc^(1/3) · z^(5/3)`
- Plume temperature: `Qc/(ṁ·cp) + T∞`, capped at 900 K above ambient
- Layer temperature: mass-weighted mix of the existing layer and the incoming smoke
- Layer density: `ρ = ρ∞·T∞/T_upper`
- Layer depth: `m_upper / (ρ_upper · A)` — the **whole** accumulated mass at the **new** temperature
- Racking is treated as displacing volume uniformly over the full height, so it reduces the plan
  area available to the smoke: `A = floor area · (1 − racking)`

Constants are fixed at 20 °C / 293 K ambient: `E = 0.2`, `g = 9.81`, `ρ∞ = 1.195 kg/m³`,
`cp = 1.016 kJ/kg/K`, convective fraction `0.7`.

ASET is the time the layer reaches the tenability height (2 m head height by default, CIBSE Guide E); the run then continues 30 s further so the charts show the
layer still descending. RSET is detection + pre-movement + travel + queuing.

Reported temperatures subtract 273 (not 273.15), matching the original script.

## Where the calculation lives

**In the browser, in TypeScript** — `lib/smoke-layer-calc.ts`. The backend never recomputes it.
`POST /smoke-layer/report` is handed the results that were on screen and only formats them, so the
Word document and the charts the engineer signed off cannot disagree. Keeping a second
implementation of the loop in Python purely for the report would invite exactly that drift.

The Python script remains the reference implementation:
`__tests__/warehouse-smoke/smoke-layer-calc.test.ts` asserts against values produced by running the
original loop unchanged (with Kathryn's 3 Sep 2026 ASET rule spliced in), to 1e-10, across three regimes (tenability height never breached, fast ASET, nothing
breached at all).

## Known issues in the original script

Both are fixed here, and are worth carrying back if the Python is ever revised:

1. **Blank template crashes.** With `total_exit_width = 0` the script does `math.ceil(0 / 0)` and
   raises `ZeroDivisionError` before any smoke calculation runs. `validate()` in
   `lib/smoke-layer-calc.ts` rejects the input with a message instead.
2. **Statement-order dependency.** `occupancy = room_area / 30` is evaluated *before*
   `room_area *= (1 - racking_perc)`, so the default occupancy is based on the gross floor area.
   That is the intended behaviour, but moving the racking reduction up would silently cut occupancy
   by a third. Here occupancy is an explicit input, seeded from the gross area.

## Backend

- `POST /smoke-layer/report` — renders the Word report from supplied inputs and results
- `GET|POST /smoke-layer/runs`, `DELETE /smoke-layer/runs/{id}` — named saved input sets
- Backend repo: https://github.com/Ianshaw93/backendForNextApp
