"""Offline checks for the static service generator and sitemap preservation."""

import importlib.util
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


builder = load_module("build_services", ROOT / "tools" / "build-services.py")
sitemap = load_module("generate_sitemap", ROOT / "tools" / "generate-sitemap.py")


class ServiceBuildTests(unittest.TestCase):
    def setUp(self):
        self.services = json.loads((ROOT / "data" / "services.json").read_text(encoding="utf-8"))
        self.groups = json.loads((ROOT / "data" / "service-groups.json").read_text(encoding="utf-8"))

    def test_data_and_output_are_current(self):
        builder.validate(self.services, self.groups)
        self.assertEqual(builder.build(check=True), 0)

    def test_count_is_data_driven(self):
        sales = self.groups[0]
        for count in (7, 8, 9):
            services = list(self.services)
            for number in range(7, count):
                added = dict(services[0], id=f"extra-{number}", slug=f"extra-{number}", href=f"/services/extra-{number}/")
                services.append(added)
            builder.validate(services, self.groups)
            self.assertIn('href="/services/"', builder.render_home())
            self.assertEqual(builder.render_list(services, self.groups).count('<article class="cxsd-card '), count)
            self.assertEqual(len(re.findall(r'<article class="cxsd-card [^\"]+" id=', builder.render_directory_group(sales, services, 2))), count - 3)

    def test_directory_cards_and_legacy_urls(self):
        for service in self.services:
            card = builder.render_directory_card(service, 1)
            self.assertIn(service["name"], card)
            if service["id"] in builder.COMING_SOON:
                self.assertIn("乞うご期待", card)
                self.assertNotIn('公式サイトを見る', card)
            else:
                self.assertIn(service["hoverSummary"], card)
            redirect = builder.render_redirect(service)
            self.assertIn('location.replace(', redirect)
            self.assertNotIn('cxs-detail-hero', redirect)
        directory = builder.render_list(self.services, self.groups)
        self.assertLess(directory.index('id="list-group-creative"'), directory.index('id="list-group-sales"'))
        self.assertIn('href="/services/creative-x/"', directory)
        self.assertIn('href="/services/sales-x/"', directory)
        self.assertIn('href="https://bizform.contentsx.jp/"', directory)

    def test_copy_is_escaped_and_video_stays_on_page(self):
        service = dict(self.services[0], hoverSummary="安全な <文字> & 説明")
        rendered = builder.render_directory_card(service, 1)
        self.assertIn("&lt;文字&gt; &amp;", rendered)
        creative = builder.render_list(self.services, self.groups)
        self.assertIn('data-video-src="/material/service-2026/bizanime-ieye.mp4"', creative)
        self.assertIn('data-video-src="/material/service-2026/bizvideo-memory-town.mp4"', creative)
        self.assertNotIn('data-youtube-id=', creative)

    def test_group_landings_use_official_creative_destinations(self):
        sales = builder.render_group_landing("sales", self.services)
        creative = builder.render_group_landing("creative", self.services)
        self.assertEqual(sales.count('<article class="cxg-service-card '), 4)
        self.assertEqual(creative.count('<article class="cxg-service-card '), 3)
        self.assertIn('href="https://bizmanga.contentsx.jp/bizanime"', creative)
        self.assertIn('href="https://bizform.contentsx.jp/"', sales)
        self.assertIn('href="https://ichioshi.contentsx.jp/service.html"', sales)
        self.assertIn('data-video-src="/material/service-2026/bizanime-ieye.mp4"', creative)
        self.assertIn('data-video-src="/material/service-2026/bizvideo-memory-town.mp4"', creative)
        self.assertNotIn('data-youtube-id=', creative)
        self.assertIn('/material/service-2026/manga-justice-cover.webp', creative)
        self.assertIn('乞うご期待', sales)
        self.assertIn('class="cxg-button cxg-button--outline js-dl-trigger"', creative)
        self.assertIn('/services/creative-x/', sales)

    def test_sitemap_update_preserves_other_sections(self):
        old = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        new = sitemap.build_sitemap([{"id": 123, "date": "2026-09-26"}])
        self.assertIn("/services/creative-x/", new)
        self.assertNotIn("/services/bizmanga/", new)
        self.assertIn("/column/manga-marketing-btob-guide", new)
        self.assertIn("/news-detail?id=123", new)
        self.assertEqual(new.split("<!-- BUILD:NEWS -->")[0], old.split("<!-- BUILD:NEWS -->")[0])


if __name__ == "__main__":
    unittest.main()
