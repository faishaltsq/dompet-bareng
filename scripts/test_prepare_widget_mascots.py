"""Small synthetic fixtures; run with python -m unittest discover -s scripts -p 'test_prepare_widget_mascots.py' -v."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw

SCRIPT = Path(__file__).with_name('prepare_widget_mascots.py')
spec = importlib.util.spec_from_file_location('prepare_widget_mascots', SCRIPT)
mascots = importlib.util.module_from_spec(spec) if SCRIPT.exists() else None
if mascots is not None:
    spec.loader.exec_module(mascots)


class PrepareMascotsTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(mascots, 'Reusable mascot preprocessing script is missing')

    def fixture(self):
        image = Image.new('RGBA', (21, 21), (252, 252, 252, 255))
        draw = ImageDraw.Draw(image)
        draw.rectangle((5, 4, 15, 16), fill=(90, 60, 45, 255))
        draw.rectangle((8, 7, 12, 10), fill=(255, 255, 255, 255))
        return image

    def test_edge_connected_near_white_becomes_transparent(self):
        result = mascots.remove_white_background(self.fixture())
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((3, 10))[3], 0)
        self.assertEqual(result.getpixel((10, 14)), (90, 60, 45, 255))

    def test_enclosed_white_detail_is_preserved(self):
        result = mascots.remove_white_background(self.fixture())
        self.assertEqual(result.getpixel((10, 8)), (255, 255, 255, 255))

    def test_white_matted_edge_becomes_semtransparent_without_halo(self):
        image = Image.new('RGBA', (17, 17), 'white')
        draw = ImageDraw.Draw(image)
        draw.rectangle((5, 4, 11, 12), fill=(80, 60, 40, 255))
        # A known 20% coverage brown edge, originally composited on white.
        draw.line((4, 4, 4, 12), fill=(220, 216, 212, 255))
        result = mascots.remove_white_background(image)
        r, g, b, a = result.getpixel((4, 8))
        self.assertTrue(40 <= a <= 65, (r, g, b, a))
        self.assertLessEqual(max(abs(r - 80), abs(g - 60), abs(b - 40)), 5)
        on_white = Image.alpha_composite(Image.new('RGBA', image.size, 'white'), result)
        self.assertLessEqual(max(abs(x - y) for x, y in zip(on_white.getpixel((4, 8))[:3], (220, 216, 212))), 1)

    def test_existing_transparency_is_not_processed_again(self):
        first = mascots.remove_white_background(self.fixture())
        second = mascots.remove_white_background(first)
        self.assertEqual(first.tobytes(), second.tobytes())

    def test_normalization_is_bottom_aligned_and_idempotent(self):
        result = mascots.prepare_image(self.fixture(), canvas_size=100)
        self.assertEqual(result.size, (100, 100))
        box = result.getchannel('A').getbbox()
        self.assertEqual(max(box[2] - box[0], box[3] - box[1]), 92)
        self.assertEqual(box[3], 96)
        self.assertEqual(result.tobytes(), mascots.prepare_image(result, canvas_size=100).tobytes())

    def test_empty_image_is_rejected(self):
        with self.assertRaises(ValueError):
            mascots.prepare_image(Image.new('RGBA', (10, 10), 'white'))

    def test_directory_deduplicates_and_preserves_all_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture().save(root / 'otter-happy.png')
            (root / 'original-long-name.png').write_bytes((root / 'otter-happy.png').read_bytes())
            summary = mascots.process_directory(root)
            self.assertEqual(summary['files'], 2)
            self.assertEqual(summary['unique_images'], 1)
            hashes = [hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.glob('*.png'))]
            self.assertEqual(hashes[0], hashes[1])
            with Image.open(root / 'otter-happy.png') as image:
                self.assertEqual(image.size, (1024, 1024))
                self.assertEqual(image.getpixel((0, 0))[3], 0)
            before = hashes[0]
            mascots.process_directory(root)
            self.assertEqual(before, hashlib.sha256((root / 'otter-happy.png').read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
