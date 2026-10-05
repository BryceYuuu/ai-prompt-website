"""Ensure manifest mistakes cannot silently overwrite published card identities."""
import json
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BuildSourceGuards(unittest.TestCase):
    def run_collision(self, modify, optimize=False, manifest_modify=None, after_review=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'tools').mkdir()
            shutil.copytree(ROOT / 'tools/curate', root / 'tools/curate',
                            ignore=shutil.ignore_patterns('__pycache__', 'intake'))
            (root / 'assets/js').mkdir(parents=True)
            # Immutable existing media are only read by build.py.
            (root / 'assets/img').symlink_to(ROOT / 'assets/img', target_is_directory=True)
            sources = root / 'tools/curate/sources'
            manifest = json.loads((sources / 'threads-lch1776244.json').read_text())
            # Explicitly synthetic approvals exercise downstream collision guards.
            manifest['rights'] = {'status': 'authorized', 'license': 'CUSTOM',
                                  'evidence': 'Synthetic unit-test fixture only',
                                  'scope': ['prompt', 'images', 'public-site', 'public-repository']}
            manifest['review'] = {'sourceVerified': True, 'rightsVerified': True,
                                  'coreDedupeApproved': True, 'reviewer': 'synthetic-test',
                                  'reviewedAt': '2026-10-04'}
            if manifest_modify:
                manifest_modify(manifest)
            manifest['cases'] = [manifest['cases'][0]]
            modify(manifest['cases'][0])
            manifest['review']['contentSha256'] = hashlib.sha256(json.dumps(
                {k:v for k,v in manifest.items() if k != 'review'}, ensure_ascii=False,
                sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            if after_review:
                after_review(manifest)
            (sources / 'threads-zz-synthetic-test.json').write_text(json.dumps(manifest))
            command = ['python3'] + (['-O'] if optimize else []) + [str(root / 'tools/curate/build.py')]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / 'assets/js/data-curated.js').exists(),
                             'failed validation must not write partial catalog output')
            return result.stderr

    def test_duplicate_id_fails(self):
        self.assertIn('Duplicate catalog ID', self.run_collision(lambda item: None))

    def test_duplicate_post_fails_even_with_new_card_id(self):
        self.assertIn('Duplicate Threads source', self.run_collision(
            lambda item: item.update(id='synthetic-test-new-id')))

    def test_reposted_identical_prompt_fails(self):
        self.assertIn('Duplicate Threads core prompt', self.run_collision(
            lambda item: item.update(id='synthetic-test-new-id',
                                     postUrl='https://threads.com/@test/post/SyntheticPost',
                                     promptUrl='https://threads.com/@test/post/SyntheticReply')))

    def test_optimized_python_cannot_disable_duplicate_id_guard(self):
        self.assertIn('Duplicate catalog ID', self.run_collision(lambda item: None, optimize=True))

    def test_unknown_rights_block_build_before_any_catalog_write(self):
        self.assertIn('Threads republication rights unconfirmed', self.run_collision(
            lambda item: None, manifest_modify=lambda manifest: manifest.update(rights={'status': 'unknown'})))

    def test_unknown_license_cannot_render_as_authorized(self):
        self.assertIn('Threads license requires review', self.run_collision(
            lambda item: None, manifest_modify=lambda manifest: manifest.update(license='UNKNOWN')))

    def test_editorial_approval_requires_boolean_true(self):
        self.assertIn('Threads editorial approval missing', self.run_collision(
            lambda item: None, manifest_modify=lambda manifest: manifest['review'].update(coreDedupeApproved='false')))

    def test_nested_unknown_license_cannot_render_as_authorized(self):
        self.assertIn('Threads rights license unconfirmed', self.run_collision(
            lambda item: None, manifest_modify=lambda manifest: manifest['rights'].update(license=' UNKNOWN ')))

    def test_changed_author_invalidates_manifest_approval(self):
        self.assertIn('Threads manifest changed since review', self.run_collision(
            lambda item: None, after_review=lambda manifest: manifest.update(creator='Edited creator')))

    def test_non_threads_source_fails(self):
        self.assertIn('Invalid Threads source', self.run_collision(
            lambda item: item.update(id='synthetic-test-new-id',
                                     postUrl='https://threads.com.evil.test/@test/post/SyntheticPost',
                                     promptUrl='https://threads.com.evil.test/@test/post/SyntheticReply')))


if __name__ == '__main__':
    unittest.main()
