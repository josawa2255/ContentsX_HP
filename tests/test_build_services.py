"""Offline checks for the static service generator and sitemap preservation."""

import importlib.util
import json
import pathlib
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
            self.assertEqual(builder.render_home().count('class="cxs-card"'), 0)
            self.assertIn('href="/services/"', builder.render_home())
            self.assertEqual(builder.render_list(services, self.groups).count('class="cxs-card"'), count)
            self.assertEqual(builder.render_group(sales, services, "test").count('class="cxs-card"'), count - 3)

    def test_hover_photos_are_decorative_and_data_driven(self):
        for service in self.services:
            card = builder.render_card(service, "test")
            self.assertIn('class="cxs-card__photo" aria-hidden="true"', card)
            self.assertIn(service["hoverImage"], card)
            self.assertIn(service["hoverSummary"], card)
        detail = builder.render_detail(self.services[0], self.services)
        self.assertIn('alt=""', detail)
        self.assertIn(self.services[0]["hoverImage"], detail)

    def test_optional_sections_and_escaped_copy(self):
        service = dict(self.services[0], hoverSummary="安全な <文字> & 説明")
        rendered = builder.render_detail(service, self.services)
        self.assertIn("&lt;文字&gt; &amp;", rendered)
        self.assertNotIn("よくある質問", rendered)
        self.assertNotIn("導入の流れ", rendered)
        self.assertIn("role=\"tabpanel\"", rendered)

    def test_group_landings_use_official_creative_destinations(self):
        sales = builder.render_group_landing("sales", self.services)
        creative = builder.render_group_landing("creative", self.services)
        self.assertEqual(sales.count('class="cxg-service-card"'), 4)
        self.assertEqual(creative.count('class="cxg-service-card"'), 3)
        self.assertIn('href="https://bizmanga.contentsx.jp/bizanime"', creative)
        self.assertIn('class="cxg-button cxg-button--outline js-dl-trigger"', creative)
        self.assertIn('/services/creative-x/', sales)

    def test_sitemap_update_preserves_other_sections(self):
        old = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        new = sitemap.build_sitemap([{"id": 123, "date": "2026-09-26"}])
        self.assertIn("/services/bizmanga/", new)
        self.assertIn("/column/manga-marketing-btob-guide", new)
        self.assertIn("/news-detail?id=123", new)
        self.assertEqual(new.split("<!-- BUILD:NEWS -->")[0], old.split("<!-- BUILD:NEWS -->")[0])


if __name__ == "__main__":
    unittest.main()
