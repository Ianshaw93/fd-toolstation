"""Run the REAL warehouse_smoke_layer.py loop as an oracle.

The point of this file is that it does not retype the physics. It loads the
Dropbox script verbatim, substitutes only the user-input assignments, truncates
at the plotting section, and execs the remaining original text. Every arithmetic
line the oracle runs is the author's, not a transcription of it.

Two source files are combined, both from Dropbox
(07 Technical Tools/1. Internal/Base Warehouse Smoke Depth/):

- warehouse_smoke_layer.py (27 Aug 2026) provides the loop. It still carries
  the old two-height logic (a fixed 2 m ASET plus a tracked reference height).
- WebApp Files/warehouse_smoke_layer_func.py (3 Sep 2026) provides the ASET
  rule: ASET triggers when the layer reaches reference_height, which is the one
  and only tenability height. Its block between the comment lines
  "# check if reference height has been breached" and "# save results to lists"
  is spliced into the standalone loop in place of the old block. Both files use
  those exact comment lines. The func file cannot be run on its own because its
  zone_model hard-codes a 1 s timestep and the cases below include sub-second ones.
"""
import gzip
import json
import os
import re
import sys
from pathlib import Path

# The authored script lives in Dropbox:
#   07 Technical Tools/1. Internal/Base Warehouse Smoke Depth/warehouse_smoke_layer.py
# Point SMOKE_LAYER_SRC at a local copy to regenerate the fixture.
SRC = Path(
    os.environ.get("SMOKE_LAYER_SRC")
    or (Path(__file__).resolve().parent / "warehouse_smoke_layer.py")
)
# The web-app function file with the 3 Sep ASET rule (see module docstring).
FUNC_SRC = Path(
    os.environ.get("SMOKE_LAYER_FUNC_SRC")
    or (Path(__file__).resolve().parent / "warehouse_smoke_layer_func.py")
)
CUT = "time = np.arange(tstep, t, tstep)"
ASET_BLOCK_START = "# check if reference height has been breached"
ASET_BLOCK_END = "# save results to lists"

# Names the script assigns as bare numeric literals at module level.
INPUT_NAMES = [
    "room_area", "racking_perc", "room_height", "fgr",
    "detection_time", "pre_movement_time", "maximum_travel_distance",
    "walking_speed", "total_exit_width", "flow_rate",
    "assessment_time", "reference_height", "tstep",
]


def prepare(source: str) -> str:
    """Strip plotting imports and truncate at the plotting section."""
    head, sep, _ = source.partition(CUT)
    if not sep:
        raise SystemExit("cut marker not found: " + repr(CUT))

    # Drop imports the loop does not need (plotnine may not be installed).
    head = re.sub(r"^from plotnine import \([^)]*\)\s*$", "", head, flags=re.M)
    head = re.sub(r"^import (numpy as np|pandas as pd)\s*$", "", head, flags=re.M)
    return head


def _block(source: str, indent: int) -> str:
    """The ASET block of `source` (between the two marker comments), re-indented."""
    start = source.index(ASET_BLOCK_START)
    end = source.index(ASET_BLOCK_END, start)
    lines = source[start:end].splitlines()
    out = []
    for line in lines:
        if line.strip() == "":
            out.append("")
            continue
        stripped = line[indent:] if line[:indent].strip() == "" else line.lstrip()
        out.append(stripped)
    return "\n".join(out)


def splice_aset_rule(source: str, func_source: str) -> str:
    """Replace the standalone script's ASET block with the func file's."""
    start = source.index(ASET_BLOCK_START)
    end = source.index(ASET_BLOCK_END, start)
    # Indentation of the standalone block (module-level loop body, 4 spaces).
    line_start = source.rfind("\n", 0, start) + 1
    indent = start - line_start
    new_block = _block(func_source, 8)  # the func file's loop sits inside a def
    new_block = "\n".join((" " * indent + l) if l else l for l in new_block.splitlines())
    return source[:line_start] + new_block + "\n" + " " * indent + source[end:]


def substitute(source: str, values: dict) -> str:
    """Replace only `name = <numeric literal>` lines, asserting each one hits."""
    out = source
    for name in INPUT_NAMES:
        pattern = re.compile(
            r"^[ \t]*" + re.escape(name) + r"[ \t]*=[ \t]*"
            r"(?P<num>\d+\.?\d*)[ \t]*(?P<comment>#.*)?$",
            flags=re.M,
        )
        hits = pattern.findall(out)
        if len(hits) != 1:
            raise SystemExit(
                "expected exactly 1 literal assignment for %r, found %d" % (name, len(hits))
            )
        out = pattern.sub("%s = %r" % (name, values[name]), out)

    # occupancy is derived, not a literal — replace its exact expression.
    occ = re.compile(r"^occupancy = room_area / 30\s*$", flags=re.M)
    if len(occ.findall(out)) != 1:
        raise SystemExit("occupancy assignment not found exactly once")
    out = occ.sub("occupancy = %r" % (values["occupancy"],), out)

    return out


def run(values: dict) -> dict:
    code = splice_aset_rule(prepare(SRC.read_text(encoding="utf-8")), FUNC_SRC.read_text(encoding="utf-8"))
    code = substitute(code, values)
    ns = {"__name__": "__oracle__"}
    exec(compile(code, str(SRC), "exec"), ns)  # noqa: S102 - deliberate

    return {
        "rset": ns["rset"],
        "aset": ns["aset"],
        "asetTriggered": ns["aset_triggered"],
        "finalClearHeight": ns["z_list"][-1],
        "totalPreEvac": ns["total_pre_evac"],
        "peoplePerSecond": ns["people_per_second"],
        "queueTime": ns["queue_time"],
        "stepCount": len(ns["z_list"]),
        "steps": {
            "hrr": ns["hrr"],
            "convectiveHrr": ns["convective_hrr"],
            "smokeLayerTemp": ns["smoke_layer_temp"],
            "addedSmokeTemp": ns["added_smoke_temp"],
            "clearHeight": ns["z_list"],
            "depthChange": ns["dz_list"],
        },
    }


CASES = {
    # The shape the tool was written for: large shed, reference height above 2 m.
    "project_shed": dict(
        room_area=43047, racking_perc=0.33, room_height=15, fgr=0.188,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=115,
        walking_speed=1.2, total_exit_width=17, flow_rate=1.33,
        occupancy=1431, assessment_time=1200, reference_height=5.3, tstep=1),
    # Small plan area: ASET fires early, so the run-on-30s branch is exercised.
    "small_unit_fast_aset": dict(
        room_area=25, racking_perc=0.0, room_height=15, fgr=0.188,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=2.5,
        walking_speed=1.2, total_exit_width=1, flow_rate=1.33,
        occupancy=25 / 30, assessment_time=1200, reference_height=2, tstep=1),
    # Slow fire in a big shed: nothing is ever breached.
    "no_breach": dict(
        room_area=43047, racking_perc=0.0, room_height=15, fgr=0.0117,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=115,
        walking_speed=1.2, total_exit_width=17, flow_rate=1.33,
        occupancy=1431, assessment_time=1200, reference_height=5.3, tstep=1),
    # Heavy racking: plan area shrinks to a fifth, layer drops fast.
    "heavy_racking": dict(
        room_area=20000, racking_perc=0.8, room_height=12, fgr=0.047,
        detection_time=30, pre_movement_time=120, maximum_travel_distance=60,
        walking_speed=1.0, total_exit_width=9.6, flow_rate=1.33,
        occupancy=666, assessment_time=1800, reference_height=3, tstep=1),
    # Low headroom: 2 m is close to the ceiling, breach is prompt.
    "low_headroom": dict(
        room_area=1200, racking_perc=0.25, room_height=4, fgr=0.188,
        detection_time=45, pre_movement_time=60, maximum_travel_distance=25,
        walking_speed=1.2, total_exit_width=2.1, flow_rate=1.33,
        occupancy=40, assessment_time=900, reference_height=2.5, tstep=1),
    # Sub-second timestep: checks the loop accumulates t identically.
    "half_second_step": dict(
        room_area=8000, racking_perc=0.5, room_height=10, fgr=0.188,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=70,
        walking_speed=1.2, total_exit_width=5.4, flow_rate=1.33,
        occupancy=266, assessment_time=600, reference_height=4, tstep=0.5),
    # Coarse timestep.
    "two_second_step": dict(
        room_area=8000, racking_perc=0.5, room_height=10, fgr=0.188,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=70,
        walking_speed=1.2, total_exit_width=5.4, flow_rate=1.33,
        occupancy=266, assessment_time=600, reference_height=4, tstep=2),
    # Non-binary timestep: t accumulates float error - must drift identically.
    "tenth_second_step": dict(
        room_area=5000, racking_perc=0.4, room_height=9, fgr=0.188,
        detection_time=60, pre_movement_time=180, maximum_travel_distance=50,
        walking_speed=1.2, total_exit_width=4, flow_rate=1.33,
        occupancy=166, assessment_time=300, reference_height=3, tstep=0.1),
    # Medium growth rate, tall shed, reference height below 2 m.
    "medium_fire_tall": dict(
        room_area=30000, racking_perc=0.6, room_height=20, fgr=0.0117,
        detection_time=90, pre_movement_time=240, maximum_travel_distance=140,
        walking_speed=1.2, total_exit_width=12, flow_rate=1.33,
        occupancy=1000, assessment_time=3600, reference_height=1.5, tstep=1),
    # Plume cap: very fast fire in a tall narrow space drives the 900 K clamp.
    "plume_temp_cap": dict(
        room_area=400, racking_perc=0.0, room_height=25, fgr=0.188,
        detection_time=30, pre_movement_time=60, maximum_travel_distance=30,
        walking_speed=1.2, total_exit_width=1.6, flow_rate=1.33,
        occupancy=13, assessment_time=1200, reference_height=2, tstep=1),
}

if __name__ == "__main__":
    if not SRC.exists():
        raise SystemExit(
            "source script not found at %s - set SMOKE_LAYER_SRC to a local copy" % SRC
        )
    if not FUNC_SRC.exists():
        raise SystemExit(
            "web-app function file not found at %s - set SMOKE_LAYER_FUNC_SRC to a local copy" % FUNC_SRC
        )
    out = {"_source": SRC.name, "_aset_rule_source": FUNC_SRC.name, "cases": {}, "inputs": {}}
    for name, values in CASES.items():
        out["cases"][name] = run(values)
        out["inputs"][name] = values
        print("  %s: %d steps" % (name, out["cases"][name]["stepCount"]), file=sys.stderr)

    dest = Path(__file__).resolve().parent / "python-oracle.json.gz"
    with gzip.open(dest, "wb", compresslevel=9) as fh:
        fh.write(json.dumps(out).encode("utf-8"))
    print("wrote %s (%d bytes)" % (dest, dest.stat().st_size), file=sys.stderr)
