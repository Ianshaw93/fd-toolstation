"""Test that the runner can send HTTP requests concurrently with a running subprocess."""

import os
import sys
import time
import threading
import tempfile
from unittest.mock import patch, MagicMock
from http.server import HTTPServer, BaseHTTPRequestHandler

# Add runner dir to path
sys.path.insert(0, os.path.dirname(__file__))

from FDS_Runner_Bot import (
    parse_t_end,
    parse_chid,
    parse_progress,
    count_meshes,
    progress_reporter,
    post_status,
)


def test_parse_t_end(tmp_path):
    fds_file = tmp_path / "test.fds"
    fds_file.write_text("&HEAD CHID='test'/\n&TIME T_END=300/\n&MESH ID='M1' IJK=10,10,10/\n")
    assert parse_t_end(str(fds_file)) == 300.0


def test_parse_chid(tmp_path):
    fds_file = tmp_path / "test.fds"
    fds_file.write_text("&HEAD CHID='FS11_corridor_test'/\n&TIME T_END=300/\n")
    assert parse_chid(str(fds_file)) == "FS11_corridor_test"


def test_parse_progress(tmp_path):
    out_file = tmp_path / "test.out"
    out_file.write_text(
        " Time Step  100   March 27, 2026  12:00:00\n"
        " Step Size:  0.100E+00 s, Total Time:     150.000 s\n\n"
        " Time Step  200   March 27, 2026  12:01:00\n"
        " Step Size:  0.100E+00 s, Total Time:     200.000 s\n"
    )
    # 200 / 300 = 66.67%
    result = parse_progress(str(out_file), 300.0)
    assert result is not None
    assert abs(result - 66.67) < 0.1


def test_parse_progress_no_file():
    assert parse_progress("/nonexistent/path.out", 300.0) is None


def test_count_meshes(tmp_path):
    fds_file = tmp_path / "test.fds"
    fds_file.write_text(
        "&HEAD CHID='test'/\n"
        "&MESH ID='M1' IJK=10,10,10/\n"
        "&MESH ID='M2' IJK=10,10,10/\n"
        "&MESH ID='M3' IJK=10,10,10/\n"
    )
    assert count_meshes(str(fds_file)) == 3


def test_progress_reporter_sends_updates(tmp_path):
    """Test that the progress reporter thread reads .out and calls post_status."""
    out_file = tmp_path / "test.out"
    out_file.write_text(
        " Time Step  100   March 27, 2026  12:00:00\n"
        " Step Size:  0.100E+00 s, Total Time:     150.000 s\n"
    )

    posted = []
    original_post = post_status.__wrapped__ if hasattr(post_status, '__wrapped__') else None

    with patch("FDS_Runner_Bot.post_status") as mock_post:
        mock_post.side_effect = lambda event, data: posted.append((event, data))

        stop_event = threading.Event()
        # Use a very short interval for testing
        with patch("FDS_Runner_Bot.PROGRESS_INTERVAL", 1):
            reporter = threading.Thread(
                target=progress_reporter,
                args=("test.fds", str(out_file), 300.0, stop_event),
                daemon=True,
            )
            reporter.start()
            time.sleep(2.5)  # Allow at least 2 polling cycles
            stop_event.set()
            reporter.join(timeout=5)

    assert len(posted) >= 1, f"Expected at least 1 progress update, got {len(posted)}"
    assert posted[0][0] == "sim_progress"
    assert abs(posted[0][1]["progress_pct"] - 50.0) < 0.1


def test_concurrent_http_and_subprocess():
    """
    Test that HTTP requests can be sent from a thread while a subprocess is running.
    This is the key integration test — simulates the real scenario where p.wait()
    blocks main thread while progress_reporter sends HTTP POSTs.
    """
    received_requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            received_requests.append(body)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"ok": true}')

        def log_message(self, format, *args):
            pass  # Suppress server log output

    # Start a local HTTP server
    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        # Create a temp .out file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".out", delete=False) as f:
            f.write(
                " Time Step  50   March 27, 2026  12:00:00\n"
                " Step Size:  0.100E+00 s, Total Time:     100.000 s\n"
            )
            out_path = f.name

        # Patch the dashboard URL and API key to point at our local server
        with patch("FDS_Runner_Bot.DASHBOARD_URL", f"http://127.0.0.1:{port}"), \
             patch("FDS_Runner_Bot.API_KEY", "test-key"), \
             patch("FDS_Runner_Bot.PROGRESS_INTERVAL", 1):

            stop_event = threading.Event()
            reporter = threading.Thread(
                target=progress_reporter,
                args=("test.fds", out_path, 300.0, stop_event),
                daemon=True,
            )
            reporter.start()

            # Simulate p.wait() blocking with a subprocess
            import subprocess
            # Run a command that takes a few seconds (like the real FDS would)
            proc = subprocess.Popen(
                ["python", "-c", "import time; time.sleep(3)"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            proc.wait()  # This blocks, just like in the real runner

            # Give the reporter one more cycle
            time.sleep(1.5)
            stop_event.set()
            reporter.join(timeout=5)

        os.unlink(out_path)

    finally:
        server.shutdown()

    assert len(received_requests) >= 2, (
        f"Expected at least 2 HTTP requests sent during subprocess, got {len(received_requests)}. "
        "This means the progress reporter thread couldn't send HTTP requests while the subprocess was running."
    )
    print(f"  Received {len(received_requests)} HTTP requests during subprocess — threading works!")


def test_keyring_fallback_to_env(monkeypatch):
    """Test that _get_secret falls back to env vars when keyring has no value."""
    import FDS_Runner_Bot
    from unittest.mock import MagicMock

    mock_keyring = MagicMock()
    mock_keyring.get_password.return_value = None
    FDS_Runner_Bot.keyring = mock_keyring
    try:
        monkeypatch.setenv("TEST_SECRET", "from-env")
        assert FDS_Runner_Bot._get_secret("nonexistent", "TEST_SECRET") == "from-env"
    finally:
        FDS_Runner_Bot.keyring = None


def test_keyring_preferred_over_env(monkeypatch):
    """Test that _get_secret prefers keyring over env vars."""
    import FDS_Runner_Bot
    from unittest.mock import MagicMock

    mock_keyring = MagicMock()
    mock_keyring.get_password.side_effect = lambda svc, key: "from-keyring" if key == "api_key" else None
    FDS_Runner_Bot.keyring = mock_keyring
    try:
        monkeypatch.setenv("FDS_API_KEY", "from-env")
        assert FDS_Runner_Bot._get_secret("api_key", "FDS_API_KEY") == "from-keyring"
    finally:
        FDS_Runner_Bot.keyring = None


def test_keyring_unavailable_falls_back(monkeypatch):
    """Test that _get_secret works when keyring module is not installed."""
    import FDS_Runner_Bot

    original_keyring = FDS_Runner_Bot.keyring
    FDS_Runner_Bot.keyring = None
    try:
        monkeypatch.setenv("FDS_API_KEY", "env-only")
        assert FDS_Runner_Bot._get_secret("api_key", "FDS_API_KEY") == "env-only"
    finally:
        FDS_Runner_Bot.keyring = original_keyring


def test_mock_runner_e2e(tmp_path):
    """
    E2E test: run the mock runner against a local HTTP server and verify
    the full event sequence (runner_started → sim_started → sim_progress... → sim_completed).
    """
    import json
    from http.server import HTTPServer, BaseHTTPRequestHandler

    received_events = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            received_events.append(body)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"ok": true}')

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # Create a minimal .fds file in tmp_path
    fds_file = tmp_path / "test_sim.fds"
    fds_file.write_text(
        "&HEAD CHID='test_sim'/\n"
        "&TIME T_END=100/\n"
        "&MESH ID='M1' IJK=10,10,10/\n"
    )

    try:
        with patch("FDS_Runner_Bot.DASHBOARD_URL", f"http://127.0.0.1:{port}"), \
             patch("FDS_Runner_Bot.API_KEY", "test-key"):
            # Run the bot in --mock --once mode from the tmp directory
            original_dir = os.getcwd()
            os.chdir(str(tmp_path))
            try:
                import subprocess
                result = subprocess.run(
                    [
                        sys.executable,
                        os.path.join(os.path.dirname(__file__), "FDS_Runner_Bot.py"),
                        "--mock", "--once",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    env={
                        **os.environ,
                        "FDS_DASHBOARD_URL": f"http://127.0.0.1:{port}",
                        "FDS_API_KEY": "test-key",
                    },
                )
                print("STDOUT:", result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)
                if result.returncode != 0:
                    print("STDERR:", result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)
            finally:
                os.chdir(original_dir)
    finally:
        server.shutdown()

    # Verify the event sequence
    event_types = [e["event"] for e in received_events]
    print(f"Events received: {event_types}")

    assert "runner_started" in event_types, f"Missing runner_started. Got: {event_types}"
    assert "sim_started" in event_types, f"Missing sim_started. Got: {event_types}"
    assert "sim_progress" in event_types, f"Missing sim_progress. Got: {event_types}"
    assert "sim_completed" in event_types, f"Missing sim_completed. Got: {event_types}"

    # Verify runner_started comes first
    assert event_types[0] == "runner_started"

    # Verify sim_started has correct data
    started = next(e for e in received_events if e["event"] == "sim_started")
    assert started["data"]["name"] == "test_sim.fds"
    assert started["data"]["t_end"] == 100.0

    # Verify final progress is 100%
    progress_events = [e for e in received_events if e["event"] == "sim_progress"]
    assert progress_events[-1]["data"]["progress_pct"] == 100.0

    # Verify sim folder was created (file moved into subfolder)
    assert (tmp_path / "test_sim").is_dir()
    assert not fds_file.exists()  # original file moved


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
