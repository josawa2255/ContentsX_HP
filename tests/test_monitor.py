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
        monitor.main_activity.cache_clear()


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
        self.assertIn("少なくとも1日", monitor.problems[0])

    def test_one_fresh_push_after_a_long_outage_is_still_reported(self):
        # 本番 aaa は直近1日の記録に無い。10分前のマージ1件だけが見える → 1日以上遅れとして即座に知らせる
        self.run_check([act("ccc", "bbb", 0.2)])
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("少なくとも1日", monitor.problems[0])

    def test_first_pending_push_directly_after_live(self):
        # 本番 aaa の直後の操作が記録の最古（before == 本番）→ その時刻から測る
        self.run_check([act("ccc", "bbb", 0.2), act("bbb", "aaa", 2)])
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("2.0 時間", monitor.problems[0])

    def test_no_activity_but_main_differs(self):
        self.run_check([], head="bbb")
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("少なくとも1日", monitor.problems[0])

    def test_full_page_without_live_is_a_warning(self):
        acts = [act(f"s{i}", f"s{i+1}", 0.1) for i in range(monitor.ACTIVITY_PAGE)]
        self.run_check(acts)
        self.assertEqual(monitor.problems, [])
        self.assertTrue(any("件以上" in w for w in monitor.warnings))

    def test_no_activity_and_main_is_live(self):
        self.run_check([], head="aaa")
        self.assertEqual(monitor.problems, [])

    def test_missing_live_sha_is_recorded(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            monitor.check_stale_deploy()
        self.assertEqual(monitor.problems, [])
        self.assertTrue(any("LIVE_SHA" in w for w in monitor.warnings))

    def test_activity_is_fetched_once_per_run(self):
        calls = []
        def fake_github(path):
            calls.append(path)
            if path == "/pages":
                return 200, {"cname": "contentsx.jp", "https_enforced": True, "build_type": "workflow"}
            return (200, [act("aaa", "zzz", 1)]) if path.startswith("/activity") else (404, None)
        with mock.patch.object(monitor, "github", fake_github), mock.patch.dict(os.environ, {"LIVE_SHA": "aaa"}):
            monitor.check_github()
            monitor.check_stale_deploy()
        self.assertEqual(sum(p.startswith("/activity") for p in calls), 1)
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
    def run_check(self, status, headers):
        # 基準値ファイル（expected.json）の中身に左右されないよう、点検の設定をこのテスト用に丸ごと置き換える
        wp = {"api": "https://cms.example.test", "cors_unknown_origin_blocked": True}
        with mock.patch.object(monitor, "http", lambda url, **kw: (status, b"{}", headers)), \
                mock.patch.dict(monitor.EXPECTED["wordpress"], wp, clear=True):
            monitor.check_wordpress()

    def test_unknown_origin_not_allowed_is_ok(self):
        self.run_check(200, {"Vary": "Origin"})
        self.assertEqual(monitor.problems, [])
        self.assertEqual(monitor.warnings, [])

    def test_unknown_origin_echoed_is_a_problem(self):
        self.run_check(200, {"Access-Control-Allow-Origin": "https://cxmon-probe.invalid"})
        self.assertEqual(len(monitor.problems), 1)

    def test_wildcard_is_a_problem(self):
        self.run_check(200, {"Access-Control-Allow-Origin": "*"})
        self.assertEqual(len(monitor.problems), 1)

    def test_unreachable_is_a_warning_not_silence(self):
        self.run_check(0, {})
        self.assertEqual(monitor.problems, [])
        self.assertTrue(any("確認できない" in w for w in monitor.warnings))

if __name__ == "__main__":
    unittest.main()
