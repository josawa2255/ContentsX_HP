"""改ざん・乗っ取り監視（tools/security/monitor.py）の判定の検査。ネットワークは使わない（API・HTTP を差し替える）。
python3 -m unittest discover -s tests -p test_monitor.py"""
import importlib.util
import os
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("security_monitor", ROOT / "tools" / "security" / "monitor.py")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)

NOW = datetime.now(timezone.utc)


def ts(hours_ago, aware=True):
    t = NOW - timedelta(hours=hours_ago)
    return t.isoformat().replace("+00:00", "Z") if aware else t.replace(tzinfo=None).isoformat()


def act(after, before, hours_ago, kind="pr_merge", actor="josawa2255", aware=True):
    return {"after": after, "before": before, "timestamp": ts(hours_ago, aware), "activity_type": kind,
            "actor": {"login": actor}}


class Base(unittest.TestCase):
    def setUp(self):
        monitor.problems.clear()
        monitor.warnings.clear()
        monitor.notes.clear()
        monitor._main_activity = None


class StaleDeploy(Base):
    def run_check(self, acts, live="aaa", head=None):
        def fake_github(path):
            if path.startswith("/activity"):
                return 200, acts
            if path == "/commits/main":
                return (200, {"sha": head}) if head else (404, None)
            return 404, None
        with mock.patch.object(monitor, "github", fake_github), mock.patch.dict(os.environ, {"LIVE_SHA": live}):
            monitor.check_stale_deploy()

    def test_live_is_latest(self):
        self.run_check([act("aaa", "zzz", 5)])
        self.assertEqual(monitor.problems, [])

    def test_continuous_pushes_do_not_hide_the_delay(self):
        # 本番 aaa の後に3回マージ。最新は10分前だが、最初の未反映は2.5時間前 → 異常
        acts = [act("ddd", "ccc", 0.2), act("ccc", "bbb", 1.0), act("bbb", "aaa", 2.5), act("aaa", "zzz", 3)]
        self.run_check(acts)
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("2.5 時間", monitor.problems[0])
        self.assertIn("未反映の操作 3 件", monitor.problems[0])

    def test_recent_push_is_not_reported(self):
        self.run_check([act("bbb", "aaa", 0.3), act("aaa", "zzz", 2)])
        self.assertEqual(monitor.problems, [])

    def test_naive_timestamp_is_treated_as_utc(self):
        self.run_check([act("bbb", "aaa", 2, aware=False), act("aaa", "zzz", 3, aware=False)])
        self.assertEqual(len(monitor.problems), 1)

    def test_live_older_than_the_activity_window(self):
        self.run_check([act("ccc", "bbb", 5), act("bbb", "xxx", 8)])
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("少なくとも", monitor.problems[0])

    def test_no_activity_but_main_differs(self):
        self.run_check([], head="bbb")
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("少なくとも1日", monitor.problems[0])

    def test_no_activity_and_main_is_live(self):
        self.run_check([], head="aaa")
        self.assertEqual(monitor.problems, [])

    def test_missing_live_sha_is_recorded(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            monitor.check_stale_deploy()
        self.assertEqual(monitor.problems, [])
        self.assertTrue(any("LIVE_SHA" in w for w in monitor.warnings))

    def test_reuses_activity_from_check_github(self):
        monitor._main_activity = [act("aaa", "zzz", 1)]
        calls = []
        with mock.patch.object(monitor, "github", lambda p: calls.append(p) or (500, None)), \
                mock.patch.dict(os.environ, {"LIVE_SHA": "aaa"}):
            monitor.check_stale_deploy()
        self.assertEqual(calls, [])
        self.assertEqual(monitor.problems, [])


class GitHubSettings(Base):
    def run_check(self, pages, acts=()):
        def fake_github(path):
            if path == "/pages":
                return 200, pages
            if path.startswith("/activity"):
                return 200, list(acts)
            return 404, None
        with mock.patch.object(monitor, "github", fake_github):
            monitor.check_github()

    def good_pages(self, **kw):
        p = {"cname": "contentsx.jp", "https_enforced": True, "build_type": "workflow"}
        p.update(kw)
        return p

    def test_ok(self):
        self.run_check(self.good_pages(), [act("b", "a", 1)])
        self.assertEqual(monitor.problems, [])

    def test_legacy_build_type_is_a_problem(self):
        self.run_check(self.good_pages(build_type="legacy"))
        self.assertTrue(any("公開方式" in p for p in monitor.problems))

    def test_direct_push_and_force_push(self):
        self.run_check(self.good_pages(), [act("c", "b", 1, kind="push", actor="someone"),
                                          act("b", "a", 2, kind="force_push", actor="github-actions[bot]"),
                                          act("a", "z", 3, kind="push", actor="github-actions[bot]")])
        self.assertEqual(len(monitor.problems), 2)


class WordPressCors(Base):
    def run_check(self, responses):
        def fake_http(url, method="GET", data=None, headers=None, timeout=20):
            origin = (headers or {}).get("Origin")
            return 200, b"{}", responses.get(origin, {})
        with mock.patch.object(monitor, "http", fake_http), \
                mock.patch.dict(monitor.EXPECTED["wordpress"], {"cors_dev_without_credentials": True}):
            monitor.check_wordpress()

    def test_dev_origins_without_credentials_are_ok(self):
        self.run_check({"http://localhost:3000": {"Access-Control-Allow-Origin": "http://localhost:3000"},
                        "http://127.0.0.1:5500": {"Access-Control-Allow-Origin": "http://127.0.0.1:5500"}})
        self.assertEqual(monitor.problems, [])

    def test_credentials_on_either_dev_origin_is_a_problem(self):
        self.run_check({"http://127.0.0.1:5500": {"Access-Control-Allow-Origin": "http://127.0.0.1:5500",
                                                  "Access-Control-Allow-Credentials": "true"}})
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("127.0.0.1:5500", monitor.problems[0])

    def test_unrelated_origin_allowed_is_a_problem(self):
        self.run_check({"https://cxmon-probe.invalid": {"Access-Control-Allow-Origin": "*"}})
        self.assertEqual(len(monitor.problems), 1)


if __name__ == "__main__":
    unittest.main()
