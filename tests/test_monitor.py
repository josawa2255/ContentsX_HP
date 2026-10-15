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
        with mock.patch.object(monitor, "github", fake_github), mock.patch.dict(os.environ, {"LIVE_SHA": "aaa"}), \
                mock.patch.dict(monitor.EXPECTED["github"], GitHubSettings.EXPECTED_GITHUB, clear=True):
            monitor.check_github()
            monitor.check_stale_deploy()
        self.assertEqual(sum(p.startswith("/activity") for p in calls), 1)
        self.assertEqual(monitor.problems, [])


class GitHubSettings(Base):
    # 基準値ファイル（expected.json）の中身に左右されないよう、点検の設定をこのテスト用に丸ごと置き換える
    EXPECTED_GITHUB = {"pages_cname": "contentsx.jp", "pages_https_enforced": True,
                       "pages_build_type": "workflow", "direct_push_allowed": ["github-actions[bot]"]}

    def run_check(self, pages, acts=()):
        def fake_github(path):
            if path == "/pages":
                return 200, pages
            if path.startswith("/activity"):
                return 200, list(acts)
            return 404, None
        with mock.patch.object(monitor, "github", fake_github), \
                mock.patch.dict(monitor.EXPECTED["github"], self.EXPECTED_GITHUB, clear=True):
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


class WordPress(Base):
    DEV = ["http://localhost:3000", "http://127.0.0.1:5500"]
    TOPICS, CORE = monitor.CORS_PATHS

    def run_check(self, cors=None, preflight=None, xmlrpc=(403, b""), users=403, cors_status=200, control=True,
                  blocked_paths=(), drop=(), probe=None, seen=None):
        """cors / preflight: {origin: ヘッダー} で GET / OPTIONS の応答を決める（どの API でも同じ応答）。
        control=True なら本番オリジン（対照）には資格情報つきの許可を返す。blocked_paths の API は
        WAF の遮断ページのように CORS ヘッダー無しの 403 を返す。drop の (API, origin, method) は接続できない"""
        cors, preflight = dict(cors or {}), dict(preflight or {})
        if control:
            ok = {"Access-Control-Allow-Origin": monitor.CONTROL_ORIGIN, "Access-Control-Allow-Credentials": "true"}
            cors.setdefault(monitor.CONTROL_ORIGIN, ok)
            if control != "get-only":
                preflight.setdefault(monitor.CONTROL_ORIGIN, ok)
        def fake_http(url, method="GET", data=None, headers=None, timeout=20):
            if seen is not None:
                seen.append((url, method, dict(headers or {})))
            if url.endswith("/wp/v2/users"):
                return users, b"", {}
            if url.endswith("/xmlrpc.php"):
                return xmlrpc[0], xmlrpc[1], {}
            path = url.split("cms.example.test", 1)[1].split("?")[0]
            origin = (headers or {}).get("Origin")
            if (path, origin, method) in drop:
                return (drop[(path, origin, method)], b"", {}) if isinstance(drop, dict) else (0, b"", {})
            if path in blocked_paths:
                return 403, b"<html>blocked</html>", {}
            table = preflight if method == "OPTIONS" else cors
            # 本物の http() と同じく、ヘッダー名は小文字にそろえて返す
            return cors_status, b"", {k.lower(): v for k, v in table.get(origin, {}).items()}
        # 基準値ファイル（expected.json）の中身に左右されないよう、点検の設定をこのテスト用に丸ごと置き換える
        wp = {"api": "https://cms.example.test", "users_endpoint_closed": True, "xmlrpc_closed": True,
              "cors_unknown_origin_blocked": True, "cors_credentials_production_only": True,
              "cors_probe_origins": self.DEV if probe is None else probe}
        with mock.patch.object(monitor, "http", fake_http), \
                mock.patch.dict(monitor.EXPECTED["wordpress"], wp, clear=True):
            monitor.check_wordpress()

    def dev_ok(self):
        return {o: {"Access-Control-Allow-Origin": o} for o in self.DEV}

    def test_hardened(self):
        self.run_check(self.dev_ok(), self.dev_ok())
        self.assertEqual((monitor.problems, monitor.warnings), ([], []))

    def test_everything_down_is_warnings_only(self):
        self.run_check(users=0, xmlrpc=(0, b""), cors_status=0)
        self.assertEqual(monitor.problems, [])
        self.assertTrue(monitor.warnings)

    def test_users_unreachable_or_5xx_does_not_stop_other_checks(self):
        for users in (0, 500):
            with self.subTest(users=users):
                self.setUp()
                self.run_check({UNRELATED: {"Access-Control-Allow-Origin": UNRELATED}}, users=users)
                self.assertTrue(any("許可してはいけない" in p for p in monitor.problems))
                self.assertEqual(len(monitor.warnings), 1)

    def test_xmlrpc_open_only_when_the_body_is_xmlrpc(self):
        self.run_check(self.dev_ok(), self.dev_ok(), xmlrpc=(200, b"<?xml version='1.0'?><methodResponse>..."))
        self.assertTrue(any("xmlrpc" in p for p in monitor.problems))

    def test_xmlrpc_closed_variants_are_ok(self):
        for st, body in ((403, b""), (404, b""), (405, b""), (410, b""), (200, b"<html>top page</html>")):
            with self.subTest(status=st):
                self.setUp()
                self.run_check(self.dev_ok(), self.dev_ok(), xmlrpc=(st, body))
                self.assertEqual((monitor.problems, monitor.warnings), ([], []))

    def test_xmlrpc_unreachable_or_5xx_is_a_warning_and_cors_continues(self):
        for st in (0, 503):
            with self.subTest(status=st):
                self.setUp()
                self.run_check({UNRELATED: {"Access-Control-Allow-Origin": "*"}}, xmlrpc=(st, b""))
                self.assertTrue(any("許可してはいけない" in p for p in monitor.problems))
                self.assertEqual(len(monitor.warnings), 1)
                self.assertIn("xmlrpc", monitor.warnings[0])

    def test_blocked_page_on_every_api_is_a_warning_not_a_pass(self):
        self.run_check(cors_status=403, control=False)
        self.assertEqual(monitor.problems, [])
        self.assertEqual(len(monitor.warnings), 3)   # API・GET/プリフライトの組ごと
        self.assertTrue(all("本番オリジン" in w for w in monitor.warnings))

    def test_blocked_on_one_api_still_checks_the_other(self):
        self.run_check({UNRELATED: {"Access-Control-Allow-Origin": UNRELATED}}, blocked_paths={self.CORE})
        self.assertEqual(len(monitor.warnings), 1)
        self.assertIn(self.CORE, monitor.warnings[0])
        self.assertTrue(any("許可してはいけない" in p and self.TOPICS in p for p in monitor.problems))

    def test_partial_unreachable_still_judges_the_rest(self):
        drop = {(self.CORE, UNRELATED, "GET")}
        self.run_check({"null": {"Access-Control-Allow-Origin": "null"}}, drop=drop)
        self.assertTrue(any("null" in p for p in monitor.problems))
        self.assertEqual(len(monitor.warnings), 1)
        self.assertIn("1 件", monitor.warnings[0])

    def test_blocked_status_without_cors_headers_is_unverified_not_a_pass(self):
        # 一部の組だけ 429 の遮断ページ → 「許可していない」とみなさず、確認できなかった件数として注意
        drop = {(self.TOPICS, "null", "GET"): 429, (self.TOPICS, "null", "OPTIONS"): 503}
        self.run_check(self.dev_ok(), self.dev_ok(), drop=drop)
        self.assertEqual(monitor.problems, [])
        self.assertEqual(len(monitor.warnings), 1)
        self.assertIn("2 件", monitor.warnings[0])
        self.assertIn("429", monitor.warnings[0])

    def test_preflight_route_blocked_still_checks_get(self):
        # 前段が OPTIONS を一律に拒否 → プリフライトの組だけ「確認できない」、GET は判定を続ける
        self.run_check({UNRELATED: {"Access-Control-Allow-Origin": UNRELATED}}, control="get-only")
        self.assertEqual(len(monitor.warnings), 1)
        self.assertIn("プリフライト", monitor.warnings[0])
        self.assertTrue(any("許可してはいけない" in p for p in monitor.problems))

    def test_unrelated_origins_must_not_be_granted(self):
        for origin, allow in ((UNRELATED, UNRELATED), (UNRELATED, "*"), ("null", "null"),
                              ("http://contentsx.jp", "http://contentsx.jp"),
                              ("https://cxmon-probe.contentsx.jp", "https://cxmon-probe.contentsx.jp")):
            with self.subTest(origin=origin, allow=allow):
                self.setUp()
                self.run_check({origin: {"Access-Control-Allow-Origin": allow}})
                self.assertEqual(len(monitor.problems), 1)
                self.assertIn(origin, monitor.problems[0])

    def test_unrelated_origin_granted_only_in_preflight(self):
        self.run_check(preflight={UNRELATED: {"Access-Control-Allow-Origin": UNRELATED,
                                              "Access-Control-Allow-Credentials": "true"}})
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("プリフライト", monitor.problems[0])

    def test_credentials_on_dev_origin_get_is_one_problem_per_origin(self):
        cors = self.dev_ok()
        cors["http://127.0.0.1:5500"] = {"Access-Control-Allow-Origin": "http://127.0.0.1:5500",
                                         "Access-Control-Allow-Credentials": "true"}
        self.run_check(cors, self.dev_ok())
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("127.0.0.1:5500", monitor.problems[0])
        self.assertIn("GET", monitor.problems[0])

    def test_credentials_on_error_response_are_still_checked(self):
        cors = {"http://localhost:3000": {"Access-Control-Allow-Origin": "http://localhost:3000",
                                          "Access-Control-Allow-Credentials": "true"}}
        self.run_check(cors, cors_status=404)
        self.assertTrue(any("localhost:3000" in p for p in monitor.problems))

    def test_credentials_only_in_preflight(self):
        pre = self.dev_ok()
        pre["http://localhost:3000"] = {"Access-Control-Allow-Origin": "http://localhost:3000",
                                        "Access-Control-Allow-Credentials": "TRUE"}
        self.run_check(self.dev_ok(), pre)
        self.assertEqual(len(monitor.problems), 1)
        self.assertIn("プリフライト", monitor.problems[0])

    def test_wildcard_with_credentials_is_not_counted_as_credentials(self):
        # ブラウザは「*」と資格情報つきの組み合わせを拒否するので、資格情報の異常にはしない
        self.run_check({"http://localhost:3000": {"Access-Control-Allow-Origin": "*",
                                                  "Access-Control-Allow-Credentials": "true"}})
        self.assertEqual(monitor.problems, [])

    def test_duplicated_headers_are_all_checked(self):
        cors = {"http://localhost:3000": {"Access-Control-Allow-Origin": "http://localhost:3000",
                                          "Access-Control-Allow-Credentials": "false, true"}}
        self.run_check(cors)
        self.assertTrue(any("localhost:3000" in p for p in monitor.problems))

    def test_credentials_header_without_allow_origin_is_not_a_problem(self):
        self.run_check({"http://localhost:3000": {"Access-Control-Allow-Credentials": "true"}})
        self.assertEqual(monitor.problems, [])

    def test_production_origin_in_probe_list_is_excluded(self):
        self.run_check(probe=["https://contentsx.jp", "http://localhost:3000"])
        self.assertEqual(monitor.problems, [])
        self.assertEqual(len(monitor.warnings), 1)
        self.assertIn("除外", monitor.warnings[0])

    def test_preflight_looks_like_a_real_browser_and_core_api_is_checked(self):
        seen = []
        self.run_check(self.dev_ok(), self.dev_ok(), seen=seen)
        pre = [h for u, m, h in seen if m == "OPTIONS"]
        self.assertTrue(pre and all("x-wp-nonce" in h.get("Access-Control-Request-Headers", "") for h in pre))
        self.assertTrue(any(self.CORE in u for u, m, h in seen))
        keys = [(u.split("?")[0], m, h.get("Origin")) for u, m, h in seen if h.get("Origin")]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertLessEqual(len(keys), 40)   # 共用サーバーへの要求数を抑える

class MergeHeaders(unittest.TestCase):
    def test_duplicates_are_joined_case_insensitively(self):
        from email.message import Message
        msg = Message()
        msg["Access-Control-Allow-Credentials"] = "false"
        msg["access-control-allow-credentials"] = "true"
        self.assertEqual(monitor.merge_headers(msg)["access-control-allow-credentials"], "false, true")


UNRELATED = monitor.UNRELATED_ORIGINS[0]

if __name__ == "__main__":
    unittest.main()
