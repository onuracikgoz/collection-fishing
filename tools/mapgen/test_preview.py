"""Tests for preview.py. Run: python3 tools/mapgen/test_preview.py"""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import preview

TINY = {
    "id": "tiny", "width": 4, "height": 3, "spawn": {"x": 0.5, "y": 0.5},
    "rows": ["....", ".#~.", "...."], "points": [],
}


class ParseTest(unittest.TestCase):
    def test_map_art_ignores_comments(self):
        source = '''static readonly (string path, float x, float y)[] MapArt =
        {
            // ("Old/gone", 1f, 1f),
            ("Plaza/cesme", 64.5f, 49f), ("Props/saman", 54f, 40.5f), // note
        };'''
        self.assertEqual(preview.parse_map_art(source),
                         [("Plaza/cesme", 64.5, 49.0), ("Props/saman", 54.0, 40.5)])

    def test_map_art_never_drops_an_entry_silently(self):
        with self.assertRaises(ValueError):
            preview.parse_map_art('MapArt = { ("A/b", 1f, 2f), ("A/c", Base.x, 2f) };')
        with self.assertRaises(ValueError):
            preview.parse_map_art("nothing here")

    def test_rects(self):
        source = "Plaza = new RectInt(57, 42, 16, 15);\nRoads =\n{\n new RectInt(64, 0, 2, 42),\n new(0, 49, 57, 2),\n};"
        self.assertEqual(preview.parse_rect_field(source, "Plaza"), (57, 42, 16, 15))
        self.assertEqual(preview.parse_rects(preview.block(source, "Roads")), [(64, 0, 2, 42), (0, 49, 57, 2)])

    def test_bad_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.json"
            for rows in (["....", "....", "..."], ["....", "..x.", "...."]):
                path.write_text(json.dumps({**TINY, "rows": rows}))
                with self.assertRaises(ValueError):
                    preview.load_map(path)

    def test_regions_for_another_size_are_skipped(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(preview.load_regions(preview.REGIONS_FILE, TINY), [])


class RenderTest(unittest.TestCase):
    def test_tile_colours(self):
        image = preview.render({**TINY, "spawn": {"x": 3.5, "y": 2.5}}, scale=40)
        self.assertEqual(image.width, 160)
        self.assertEqual(image.getpixel((60, 60)), preview.BLOCKED)
        self.assertEqual(image.getpixel((100, 60)), preview.WATER)
        self.assertEqual(image.getpixel((20, 100)), preview.GROUND)

    def test_todays_sources(self):
        """The real C# sources still parse, and every placed piece has its picture."""
        code = preview.load_code_layers()
        self.assertTrue(code["roads"])
        self.assertIsNotNone(code["pier"])
        names = [path for path, _, _ in code["pieces"]]
        for expected in ("Plaza/cesme", "Cafe/kafe_gemini", "Buildings/balikci_gemini"):
            self.assertIn(expected, names)
        self.assertEqual([p for p in names if not (preview.ART_DIR / (p + ".png")).exists()], [])

    def test_command_writes_png(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out.png"
            with contextlib.redirect_stdout(io.StringIO()):
                preview.main([str(out), "--scale", "4"])
            data = preview.load_map(preview.MAP_FILE)
            with Image.open(out) as image:
                self.assertEqual(image.width, data["width"] * 4)
                self.assertGreater(image.height, data["height"] * 4)


if __name__ == "__main__":
    unittest.main()
