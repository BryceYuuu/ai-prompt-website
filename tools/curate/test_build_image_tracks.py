"""Keep source prompt semantics when a Threads case generates from text."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BuildImageTracks(unittest.TestCase):
    def build_fixture(self, track, output='A single fantasy island poster'):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'tools').mkdir()
            shutil.copytree(ROOT / 'tools/curate', root / 'tools/curate',
                            ignore=shutil.ignore_patterns('__pycache__', 'intake'))
            (root / 'assets/js').mkdir(parents=True)
            (root / 'assets/img').symlink_to(ROOT / 'assets/img', target_is_directory=True)
            sources = root / 'tools/curate/sources'
            path = sources / 'threads-lch1776244.json'
            manifest = json.loads(path.read_text())
            item = manifest['cases'][0]
            if track is not None:
                item['track'] = track
            item['input'] = 'Describe the island, architecture and lighting'
            if output is None:
                item.pop('output', None)
            else:
                item['output'] = output
            original = 'Draw a floating fantasy island above soft clouds, with fine architectural detail, gentle evening light and clear silhouettes. No captions.'
            item['promptFile'] = 'synthetic-image-track-fixture.txt'
            (sources / item['promptFile']).write_text(original)
            item['promptSha256'] = hashlib.sha256(original.encode()).hexdigest()
            manifest['rights'] = {'status': 'authorized', 'license': 'CUSTOM',
                                  'evidence': 'Synthetic unit-test fixture only',
                                  'scope': ['prompt', 'images', 'public-site', 'public-repository']}
            manifest['review'] = {'sourceVerified': True, 'rightsVerified': True,
                                 'coreDedupeApproved': True, 'reviewer': 'synthetic-test',
                                 'reviewedAt': '2026-10-10'}
            manifest['review']['contentSha256'] = hashlib.sha256(json.dumps(
                {k: v for k, v in manifest.items() if k != 'review'}, ensure_ascii=False,
                sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            path.write_text(json.dumps(manifest))
            result = subprocess.run(['python3', str(root / 'tools/curate/build.py')],
                                    capture_output=True, text=True)
            if result.returncode:
                self.assertFalse((root / 'assets/js/data-curated.js').exists())
                return None, original, result.stderr
            source = (root / 'assets/js/data-curated.js').read_text()
            catalog = json.loads(source.split('const HF_CURATED = ', 1)[1].split(';\nconst HF_CURATED_SAMPLES = ', 1)[0])
            card = catalog[item['id']]
            # Validate the generated create fixture through both schema and browser rules.
            card_file = root / 'synthetic-card.json'
            card_file.write_text(json.dumps(card))
            valid = subprocess.run(['node', str(ROOT / 'schema/validate.mjs'), str(card_file)],
                                   capture_output=True, text=True)
            self.assertEqual(valid.returncode, 0, valid.stdout + valid.stderr)
            return card, original, ''

    def test_create_preserves_author_text_without_reference_image_requirement(self):
        card, original, error = self.build_fixture('create')
        self.assertEqual(error, '')
        self.assertEqual(card['track'], 'create')
        self.assertIn(original, card['prompt'])
        self.assertIn('不具备图像生成能力', card['prompt'])
        self.assertNotIn('上传', card['prompt'])
        self.assertNotIn('【保持不变】', card['prompt'])
        guide = json.dumps(card['guide'], ensure_ascii=False)
        self.assertIn('支持文生图', guide)
        self.assertNotIn('上传', guide)
        self.assertEqual(card['curation']['output'], 'A single fantasy island poster')
        self.assertNotIn('上传', card['source']['mode'])
        self.assertIsNone(card['local'])
        self.assertIsNone(card['cloud'])

    def test_omitted_track_preserves_image_edit_contract(self):
        card, original, error = self.build_fixture(None)
        self.assertEqual(error, '')
        self.assertEqual(card['track'], 'edit')
        self.assertIn(original, card['prompt'])
        self.assertIn('请先读取我上传图片', card['prompt'])
        self.assertIn('【保持不变】', card['prompt'])

    def test_unknown_track_and_underspecified_creation_fail_before_write(self):
        for track, output, expected in [('video', 'a video', 'Invalid Threads image track'),
                                         ('create', None, 'Threads create input/output missing')]:
            with self.subTest(track=track, output=output):
                card, _, error = self.build_fixture(track, output)
                self.assertIsNone(card)
                self.assertIn(expected, error)


if __name__ == '__main__':
    unittest.main()
