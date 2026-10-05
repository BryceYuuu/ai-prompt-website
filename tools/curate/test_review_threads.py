"""Synthetic fixtures only; these are not collected or licensed source content."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('review_threads', Path(__file__).with_name('review_threads.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

CATALOG_SHA = 'a' * 64
CATALOG = [{
    'id': 'existing', 'title': 'Existing synthetic test task',
    'sourceUrl': 'https://www.threads.com/@creator/post/AbC_123',
    'promptSourceUrl': 'https://www.threads.com/@creator/post/Reply_123',
    'promptText': 'Use a blue pencil to draw the supplied photograph.',
    'summary': 'Pencil sketch from photograph', 'images': [{'sha256': 'b' * 64}],
}]


def candidate():
    row = {
        'id': 'candidate', 'title': 'Synthetic distinct task',
        'sourceUrl': 'https://www.threads.com/@other/post/Different',
        'promptSourceUrl': 'https://www.threads.com/@other/post/ReplyOther',
        'summary': 'Create a metallic object from a picture',
        'promptText': 'Build a silver robot sculpture with angular reflective panels.',
        'promptStatus': 'full', 'accessStatus': 'publicly-verified',
        'sourceVerification': {'status': 'verified', 'authorConfirmed': True},
        'rights': {'status': 'authorized', 'license': 'CUSTOM',
                   'evidence': 'Synthetic test evidence, never a real authorization',
                   'scope': ['prompt', 'images', 'public-site', 'public-repository']},
        'dedupeReview': {'decision': 'distinct', 'rationale': 'Different transformation/output',
                         'reviewer': 'synthetic-test', 'reviewedAt': '2026-10-04',
                         'comparedCatalogSha256': CATALOG_SHA, 'comparedTo': ['existing']},
        'images': [{'sha256': 'c' * 64}],
    }
    sign_review(row)
    return row


def sign_review(row, batch=None):
    row['dedupeReview']['comparedBatchSha256'] = r.digest(json.dumps(
        [{k: v for k, v in item.items() if k != 'dedupeReview'} for item in (batch or [row])],
        ensure_ascii=False, sort_keys=True))


class IntakeTests(unittest.TestCase):
    def decision(self, row):
        return r.audit([row], CATALOG, CATALOG_SHA)['results'][0]

    def test_domain_aliases_tracking_and_renamed_author(self):
        self.assertEqual(r.post_key('https://threads.net/@renamed/post/AbC_123/?x=1#reply'), 'AbC_123')
        self.assertEqual(r.post_key('https://threads.com/%40creator/post/AbC_123/a-title/'), 'AbC_123')
        self.assertNotEqual(r.post_key('https://threads.com/@x/post/abc_123'), 'AbC_123')
        for url in ['http://threads.com/@x/post/a', 'https://threads.com.evil.test/@x/post/a',
                    'https://threads.com/@x', 'https://user:pass@threads.com/@x/post/a',
                    'https://threads.com:444/@x/post/a']:
            self.assertIsNone(r.post_key(url))

    def test_exact_existing_post_excluded(self):
        row = candidate()
        row['sourceUrl'] = 'https://threads.net/@reposter/post/AbC_123?tracking=true'
        result = self.decision(row)
        self.assertEqual(result['decision'], 'exclude-duplicate')
        self.assertIn('same-source-post-or-prompt', result['exactMatches'][0]['reasons'])

    def test_exact_prompt_excludes_reworded_punctuation_and_width(self):
        row = candidate()
        row['promptText'] = 'ＵＳＥ a BLUE pencil, to draw the supplied photograph!'
        self.assertEqual(self.decision(row)['decision'], 'exclude-duplicate')

    def test_new_author_or_images_cannot_establish_novelty(self):
        row = candidate()
        row['dedupeReview'] = {}
        result = self.decision(row)
        self.assertEqual(result['decision'], 'needs-review')
        self.assertIn('manual-core-task-difference-review-required', result['blockers'])

    def test_missing_rights_cannot_be_imported(self):
        row = candidate()
        row['rights'] = {'status': 'publicly-available'}
        result = self.decision(row)
        self.assertEqual(result['decision'], 'needs-review')
        self.assertIn('republication-rights-unconfirmed', result['blockers'])

    def test_site_only_permission_does_not_cover_public_repository(self):
        row = candidate()
        row['rights']['scope'].remove('public-repository')
        self.assertEqual(self.decision(row)['decision'], 'needs-review')

    def test_search_snippet_is_not_complete_source_verification(self):
        row = candidate()
        row.update(promptStatus='partial', accessStatus='search-index-only')
        self.assertEqual(self.decision(row)['decision'], 'needs-review')

    def test_stale_catalog_review_blocks_import(self):
        row = candidate()
        row['dedupeReview']['comparedCatalogSha256'] = 'd' * 64
        self.assertEqual(self.decision(row)['decision'], 'needs-review')

    def test_near_duplicate_manual_verdict_excluded(self):
        row = candidate()
        row['dedupeReview']['decision'] = 'near-duplicate'
        self.assertEqual(self.decision(row)['decision'], 'exclude-duplicate')

    def test_same_image_requires_explicit_overlap_review(self):
        row = candidate()
        row['images'][0]['sha256'] = 'b' * 64
        self.assertIn('matching-image-needs-review-not-automatic-new-card', self.decision(row)['blockers'])

    def test_whole_batch_exact_dedupe_is_order_independent(self):
        first, second = candidate(), candidate()
        second['id'] = 'second'
        second['sourceUrl'] = 'https://www.threads.com/@third/post/Third'
        for rows in ([first, second], [second, first]):
            self.assertEqual([x['decision'] for x in r.audit(rows, CATALOG, CATALOG_SHA)['results']],
                             ['exclude-duplicate', 'exclude-duplicate'])

    def test_semantic_review_must_cover_current_batch(self):
        first, second = candidate(), candidate()
        second.update(id='second', sourceUrl='https://threads.com/@other/post/NewPost',
                      promptSourceUrl='https://threads.com/@other/post/NewReply',
                      promptText='Convert a river into a layered paper landscape.')
        result = r.audit([first, second], CATALOG, CATALOG_SHA)
        for row in result['results']:
            self.assertIn('dedupe-review-must-compare-current-candidate-batch', row['blockers'])

    def test_collector_core_flags_are_preserved_without_claiming_proof(self):
        row = candidate()
        row['dedupeReview'] = {}
        row.update(dedupeStatus='suspected_duplicate', duplicateOf='existing', coreDedupeKey='test-core')
        result = self.decision(row)
        self.assertEqual(result['decision'], 'needs-review')
        self.assertIn('reported-core-overlap-needs-manual-review', result['blockers'])
        self.assertEqual(result['researchDedupeSignals']['duplicateOf'], 'existing')

    def test_single_candidate_edit_invalidates_old_review(self):
        row = candidate()
        row['promptText'] = 'A different newly edited transformation task.'
        self.assertIn('dedupe-review-must-compare-current-candidate-batch', self.decision(row)['blockers'])

    def test_author_confirmation_must_be_boolean_true(self):
        row = candidate()
        row['sourceVerification']['authorConfirmed'] = 'false'
        sign_review(row)
        self.assertIn('post-to-author-prompt-pairing-not-verified', self.decision(row)['blockers'])

    def test_batch_neighbors_cannot_hide_existing_similarity(self):
        catalog = copy.deepcopy(CATALOG)
        catalog[0]['promptText'] = 'common synthetic core transformation workflow with original image output layout version old'
        catalog.append(dict(CATALOG[0], id='unrelated', promptText='unrelated item', sourceUrl='', promptSourceUrl=''))
        rows = []
        for index in range(6):
            row = candidate()
            row.update(id=f'candidate-{index}', sourceUrl=f'https://threads.com/@test/post/New{index}',
                       promptSourceUrl=f'https://threads.com/@test/post/Reply{index}',
                       promptText='common synthetic core transformation workflow with original image output layout version new ' + str(index))
            row['dedupeReview']['comparedTo'] = ['unrelated']
            rows.append(row)
        for row in rows:
            sign_review(row, rows)
        result = r.audit(rows, catalog, CATALOG_SHA)
        for row in result['results']:
            self.assertIn('high-similarity-existing-template-not-reviewed', row['blockers'])
            self.assertTrue(any(item['id'] == 'existing' for item in row['similarExistingTemplates']))

    def test_id_collision_rejected(self):
        row = candidate()
        row['id'] = 'existing'
        self.assertEqual(self.decision(row)['decision'], 'exclude-duplicate')
        with self.assertRaises(ValueError):
            r.audit([candidate(), candidate()], CATALOG, CATALOG_SHA)

    def test_verified_distinct_fixture_is_manual_import_only(self):
        self.assertEqual(self.decision(candidate())['decision'], 'eligible-for-manual-import')

    def test_missing_or_changed_local_image_blocks_import(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = candidate()
            row['images'][0]['localPath'] = 'missing.jpg'
            result = r.audit([row], CATALOG, CATALOG_SHA, root)['results'][0]
            self.assertIn('local-image-missing-or-checksum-mismatch', result['blockers'])
            payload = b'synthetic fixture bytes'
            (root / 'example.jpg').write_bytes(payload)
            row['images'] = [{'localPath': 'example.jpg', 'sha256': hashlib.sha256(payload).hexdigest()}]
            sign_review(row)
            result = r.audit([row], CATALOG, CATALOG_SHA, root)['results'][0]
            self.assertEqual(result['decision'], 'eligible-for-manual-import')

    def test_existing_real_catalog_is_readable_and_unchanged(self):
        before = (r.ROOT / r.CATALOG_PATH).read_bytes()
        catalog, sha = r.load_catalog(r.ROOT)
        generated, _ = json.JSONDecoder().raw_decode(before.decode().split('const HF_CURATED = ', 1)[1])
        self.assertEqual(len(catalog), len(generated))
        self.assertGreaterEqual(len(catalog), 80)
        self.assertEqual(sha, hashlib.sha256(before).hexdigest())
        self.assertEqual(before, (r.ROOT / r.CATALOG_PATH).read_bytes())
        self.assertEqual(len([c for c in catalog if r.post_key(c['sourceUrl'])]),
                         len([c for c in generated.values() if c.get('source', {}).get('provider') == 'threads']))


if __name__ == '__main__':
    unittest.main()
