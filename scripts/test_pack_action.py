"""Offline packer checks. These fixtures are not character-animation assets."""
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw
import json
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("pack_action", Path(__file__).with_name("pack-action.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PackActionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        for frame in range(1, 9):
            im = Image.new("RGBA", (32, 48))
            ImageDraw.Draw(im).rectangle((5 + frame, 8, 15 + frame, 36), fill=(80, 110, 60, 255))
            im.save(self.source / f"frame-{frame:04d}.png")

    def tearDown(self):
        self.tmp.cleanup()

    def test_pack_preserves_all_frames_alpha_and_fixed_dimensions(self):
        output = self.root / "packed"
        result = module.pack(self.source, output, frames=8, mobile_height=24, desktop_height=48)
        m = json.loads((output / "manifest.json").read_text())
        self.assertEqual(m["frames"], 8)
        self.assertEqual(len(m["tiers"]["desktop"]["pages"]), 2)
        self.assertEqual(result["tiers"]["desktop"]["twoPageDecodedBytes"], 32 * 48 * 6 * 4 * 2)
        with Image.open(output / "desktop/page-01.webp") as page:
            self.assertEqual(page.size, (96, 96))
            self.assertEqual(page.mode, "RGBA")
            self.assertEqual(page.getpixel((0, 0))[3], 0)
            self.assertEqual(page.getpixel((60, 90))[3], 0)
        with self.assertRaisesRegex(ValueError, "existing media"):
            module.pack(self.source, output, frames=8, mobile_height=24, desktop_height=48)

    def test_missing_frame_does_not_produce_manifest(self):
        (self.source / "frame-0004.png").unlink()
        output = self.root / "incomplete"
        with self.assertRaisesRegex(ValueError, "Missing"):
            module.pack(self.source, output, frames=8)
        self.assertFalse(output.exists())

    def test_rejects_opaque_or_clipped_source(self):
        Image.new("RGBA", (32, 48), (20, 20, 20, 255)).save(self.source / "frame-0001.png")
        with self.assertRaisesRegex(ValueError, "Opaque"):
            module.pack(self.source, self.root / "opaque", frames=8)
        im = Image.new("RGBA", (32, 48))
        ImageDraw.Draw(im).rectangle((0, 4, 12, 20), fill=(20, 20, 20, 255))
        im.save(self.source / "frame-0001.png")
        with self.assertRaisesRegex(ValueError, "edge"):
            module.pack(self.source, self.root / "clipped", frames=8)


if __name__ == "__main__":
    unittest.main()
