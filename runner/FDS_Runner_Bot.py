# -*- coding: utf-8 -*-
"""
FDS Runner Bot — Enhanced with dashboard status reporting.

Loops through .fds files in the current directory, runs FDS simulations,
and reports status to a hosted dashboard via HTTPS POST.

Original script by sambe (2022). Enhanced with dashboard integration.

Usage:
    python FDS_Runner_Bot.py          # Loop forever, pick up new files
    python FDS_Runner_Bot.py --once   # Run one check cycle and exit
    python FDS_Runner_Bot.py --mock   # Simulate FDS for testing (no real FDS needed)
"""

import os
import platform
import re
import shutil
import sys
import time
import threading
import argparse
from subprocess import Popen, PIPE

MACHINE_NAME = platform.node()

try:
    import requests
except ImportError:
    requests = None
    print("Warning: 'requests' not installed. Dashboard updates disabled.")
    print("Install with: pip install requests")

try:
    import keyring
except ImportError:
    keyring = None

# --- Configuration: prefer keyring (encrypted), fall back to env vars ---
KEYRING_SERVICE = "fds-runner"

def _get_secret(keyring_key: str, env_var: str) -> str:
    """Load a secret from Windows Credential Manager, falling back to env var."""
    if keyring is not None:
        val = keyring.get_password(KEYRING_SERVICE, keyring_key)
        if val:
            return val
    return os.environ.get(env_var, "")

DASHBOARD_URL = _get_secret("dashboard_url", "FDS_DASHBOARD_URL")
API_KEY = _get_secret("api_key", "FDS_API_KEY")
POLL_INTERVAL = 30  # seconds between checking for new files
PROGRESS_INTERVAL = 30  # seconds between progress updates


def post_status(event: str, data: dict) -> None:
    """Post a status update to the dashboard. Never raises — network errors are swallowed."""
    if not DASHBOARD_URL or not API_KEY or requests is None:
        return
    try:
        requests.post(
            f"{DASHBOARD_URL}/cfd-dashboard/status",
            json={"event": event, "data": {**data, "machine_name": MACHINE_NAME}},
            headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
            timeout=10,
        )
    except Exception as e:
        print(f"  [Dashboard] Failed to post {event}: {e}")


def parse_t_end(fds_path: str) -> float | None:
    """Extract T_END from an FDS input file."""
    try:
        with open(fds_path, "r") as f:
            content = f.read()
        match = re.search(r"&TIME.*?T_END\s*=\s*([\d.]+)", content)
        if match:
            return float(match.group(1))
    except Exception:
        pass
    return None


def parse_chid(fds_path: str) -> str | None:
    """Extract CHID from an FDS input file. FDS names .out files after CHID."""
    try:
        with open(fds_path, "r") as f:
            content = f.read()
        match = re.search(r"&HEAD\s+CHID\s*=\s*'([^']+)'", content)
        if match:
            return match.group(1)
    except Exception:
        pass
    return None


def parse_progress(out_path: str, t_end: float) -> float | None:
    """Parse the latest simulation time from an FDS .out file and return progress %."""
    if not os.path.exists(out_path) or t_end <= 0:
        return None
    try:
        with open(out_path, "r", errors="ignore") as f:
            # Read last 8KB to find the most recent Total Time line
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 8192))
            tail = f.read()
        matches = re.findall(r"Total Time:\s+([\d.]+)\s*s", tail)
        if matches:
            current_time = float(matches[-1])
            return min(100.0, (current_time / t_end) * 100)
    except Exception:
        pass
    return None


def count_meshes(fds_path: str) -> int:
    """Count the number of meshes in an FDS input file."""
    with open(fds_path, "r") as f:
        data = f.read()
    return data.count("&MESH ID=")


def progress_reporter(sim_name: str, out_path: str, t_end: float, stop_event: threading.Event):
    """Daemon thread that polls the .out file and reports progress to the dashboard."""
    while not stop_event.is_set():
        stop_event.wait(PROGRESS_INTERVAL)
        if stop_event.is_set():
            break
        progress = parse_progress(out_path, t_end)
        if progress is not None:
            print(f"  Progress: {progress:.1f}%")
            post_status("sim_progress", {"name": sim_name, "progress_pct": round(progress, 1)})


def check_interrupted_sims(base_dir: str):
    """On startup, detect simulations that were interrupted (folder with .fds but no .end file)."""
    for item in os.listdir(base_dir):
        item_path = os.path.join(base_dir, item)
        if not os.path.isdir(item_path):
            continue
        fds_files = [f for f in os.listdir(item_path) if f.endswith(".fds")]
        if not fds_files:
            continue
        # Check for .end file (FDS writes this on completion)
        end_files = [f for f in os.listdir(item_path) if f.endswith(".end")]
        if not end_files:
            print(f"  Detected interrupted simulation: {item}")
            post_status("sim_error", {
                "name": fds_files[0],
                "error_msg": "Interrupted (PC restart or crash)",
            })


def run_mock_simulation(sim_name: str, fds_path: str, dest_dir: str, t_end: float):
    """Simulate an FDS run for testing — writes fake .out file with incrementing time."""
    chid = parse_chid(fds_path) or sim_name.replace(".fds", "")
    out_path = os.path.join(dest_dir, f"{chid}.out")

    print(f"  [MOCK] Simulating {sim_name} (T_END={t_end}s)")
    post_status("sim_started", {"name": sim_name, "meshes": 1, "t_end": t_end})

    steps = 20
    dt = (t_end or 100) / steps
    for i in range(1, steps + 1):
        current_time = dt * i
        with open(out_path, "a") as f:
            f.write(f" Time Step  {i * 100}   March 27, 2026  12:00:00\n")
            f.write(f" Step Size:  0.100E+00 s, Total Time:     {current_time:.3f} s\n\n")
        progress = parse_progress(out_path, t_end or 100)
        if progress is not None:
            print(f"  [MOCK] Progress: {progress:.1f}%")
            post_status("sim_progress", {"name": sim_name, "progress_pct": round(progress, 1)})
        time.sleep(2)

    # Write .end file
    end_path = os.path.join(dest_dir, f"{chid}.end")
    with open(end_path, "w") as f:
        f.write("STOP\n")

    post_status("sim_completed", {"name": sim_name})
    print(f"  [MOCK] Completed {sim_name}")


def main():
    parser = argparse.ArgumentParser(description="FDS Runner Bot with dashboard reporting")
    parser.add_argument("--once", action="store_true", help="Run one check cycle and exit")
    parser.add_argument("--mock", action="store_true", help="Simulate FDS for testing")
    args = parser.parse_args()

    base = os.getcwd()
    cmd = "cmd.exe"

    print(f"FDS Runner Bot starting in: {base}")
    if DASHBOARD_URL:
        print(f"Dashboard URL: {DASHBOARD_URL}")
    else:
        print("No FDS_DASHBOARD_URL set — running without dashboard reporting")

    # Check for interrupted sims from previous runs
    check_interrupted_sims(base)

    while True:
        files = os.listdir()
        fds_files = [f for f in files if f.endswith(".fds")]

        print(f"\nFound FDS files: {fds_files}")

        if not fds_files:
            post_status("runner_idle", {})
            if args.once:
                print("No files found. Exiting (--once mode).")
                break
            print(f"No files found. Waiting {POLL_INTERVAL}s...")
            time.sleep(POLL_INTERVAL)
            continue

        # Report pending files to dashboard
        post_status("runner_started", {"pending_files": fds_files})

        for fds_file in fds_files:
            meshes = count_meshes(fds_file)
            t_end = parse_t_end(fds_file) or 0
            chid = parse_chid(fds_file)
            print(f"\nRunning: {fds_file} ({meshes} meshes, T_END={t_end}s, CHID={chid})")

            # Create folder and move file
            foldername = fds_file.replace(".fds", "")
            os.mkdir(foldername)
            dest_dir = foldername
            shutil.copy(fds_file, dest_dir)
            os.remove(fds_file)

            if args.mock:
                fds_in_folder = os.path.join(dest_dir, fds_file)
                run_mock_simulation(fds_file, fds_in_folder, dest_dir, t_end)
                continue

            # Report sim started
            post_status("sim_started", {"name": fds_file, "meshes": meshes, "t_end": t_end})

            # Determine .out file path
            out_name = chid if chid else foldername
            out_path = os.path.join(base, dest_dir, f"{out_name}.out")

            # Start progress reporter thread
            stop_event = threading.Event()
            reporter = threading.Thread(
                target=progress_reporter,
                args=(fds_file, out_path, t_end, stop_event),
                daemon=True,
            )
            reporter.start()

            # Run FDS
            sim_dir = os.path.join(base, foldername)
            os.chdir(sim_dir)
            fds_cmd = f"fds_local -p {meshes} -o {32 - meshes} {fds_file}\n"
            p = Popen(cmd, stdin=PIPE, stdout=PIPE, bufsize=0, shell=True)
            p.stdin.write(b"fdsinit\n")
            p.stdin.write(fds_cmd.encode())
            p.stdin.close()
            return_code = p.wait()
            os.chdir(base)

            # Stop progress reporter
            stop_event.set()
            reporter.join(timeout=5)

            # Report result
            if return_code == 0:
                # Final progress update
                final_progress = parse_progress(out_path, t_end)
                if final_progress is not None:
                    post_status("sim_progress", {"name": fds_file, "progress_pct": round(final_progress, 1)})
                post_status("sim_completed", {"name": fds_file})
                print(f"  Completed: {fds_file}")
            else:
                post_status("sim_error", {
                    "name": fds_file,
                    "error_msg": f"FDS exited with code {return_code}",
                })
                print(f"  Error: {fds_file} (exit code {return_code})")

        if args.once:
            break


if __name__ == "__main__":
    main()
