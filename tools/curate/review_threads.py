#!/usr/bin/env python3
"""Offline intake audit. Never downloads media or changes the active catalog.

Unknown rights, missing full prompts and unreviewed semantic differences stay
quarantined. Similarity is a review aid, never proof that two tasks differ.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = Path('assets/js/data-curated.js')
THREAD_HOSTS = {'threads.com', 'www.threads.com', 'threads.net', 'www.threads.net'}
SHA256 = re.compile(r'^[0-9a-f]{64}$')


def digest(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def normalized_text(text: str) -> str:
    """Compare wording despite whitespace, punctuation, case or width changes."""
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold()
                   if c.isalnum())


def post_key(url: str) -> str | None:
    """Threads post IDs are global and case-sensitive; handles can change."""
    try:
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname not in THREAD_HOSTS:
            return None
        if parsed.username or parsed.password or parsed.port not in (None, 443):
            return None
        match = re.fullmatch(r'/@[^/]+/post/([A-Za-z0-9_-]+)(?:/[^/]+)?/?', unquote(parsed.path))
        return match.group(1) if match else None
    except (ValueError, TypeError):
        return None


def grams(text: str) -> set[str]:
    text = normalized_text(text)
    return {text[i:i + 3] for i in range(max(0, len(text) - 2))}


def similarity(a: str, b: str) -> float:
    left, right = grams(a), grams(b)
    return len(left & right) / len(left | right) if left and right else 0.0


def load_catalog(root: Path) -> tuple[list[dict], str]:
    raw = (root / CATALOG_PATH).read_bytes()
    text = raw.decode('utf-8')
    marker = 'const HF_CURATED = '
    if marker not in text:
        raise ValueError('Catalog marker missing; rebuild/review the catalog first')
    cards, _ = json.JSONDecoder().raw_decode(text.split(marker, 1)[1])
    records = []
    for card in cards.values():
        source = card.get('source', {})
        prompt = card['prompt']
        if source.get('provider') == 'threads':
            snapshot = source.get('snapshot', '')
            if Path(snapshot).name != snapshot:
                raise ValueError(f'Invalid source snapshot path: {snapshot}')
            prompt = (root / 'tools/curate/sources' / snapshot).read_text()
        records.append({
            'id': card['id'], 'title': card['name'], 'promptText': prompt,
            'sourceUrl': source.get('url', ''),
            'promptSourceUrl': source.get('promptUrl', ''),
            'summary': ' '.join([card.get('tagline', ''),
                                 card.get('curation', {}).get('output', ''),
                                 ' '.join(card.get('keywords', []))]),
            'images': [{'sha256': hashlib.sha256((root / block['v']['src']).read_bytes()).hexdigest()}
                       for block in card.get('guide', []) if block.get('t') == 'img'
                       and (root / block['v']['src']).is_file()],
        })
    return records, hashlib.sha256(raw).hexdigest()


def prompt_hash(record: dict) -> str | None:
    prompt = normalized_text(record.get('promptText', ''))
    return digest(prompt) if prompt else None


def image_hashes(record: dict) -> set[str]:
    return {image['sha256'] for image in record.get('images', [])
            if isinstance(image, dict) and SHA256.fullmatch(image.get('sha256', ''))}


def identifiers(record: dict) -> set[str]:
    return {key for url in (record.get('sourceUrl', ''), record.get('promptSourceUrl', ''))
            if (key := post_key(url))}


def audit(records: list[dict], catalog: list[dict], catalog_sha: str,
          root: Path | None = None) -> dict:
    if any(not isinstance(r, dict) or not r.get('id') for r in records):
        raise ValueError('Every candidate needs a unique nonempty id')
    ids = [r['id'] for r in records]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate candidate ids; retain one record and list alternate sources')
    batch_sha = digest(json.dumps([{k: v for k, v in row.items() if k != 'dedupeReview'}
                                    for row in records], ensure_ascii=False, sort_keys=True))
    existing_ids = {record['id'] for record in catalog}
    results = []
    for index, record in enumerate(records):
        # Compare the whole batch, not only earlier rows, so ordering cannot hide duplicates.
        peers = catalog + records[:index] + records[index + 1:]
        exact, image_matches = [], []
        candidate_keys, candidate_hash = identifiers(record), prompt_hash(record)
        candidate_images = image_hashes(record)
        for other in peers:
            reasons = []
            if record['id'] == other['id']:
                reasons.append('existing-id')
            if candidate_keys & identifiers(other):
                reasons.append('same-source-post-or-prompt')
            if candidate_hash and candidate_hash == prompt_hash(other):
                reasons.append('same-normalized-core-prompt')
            if reasons:
                exact.append({'id': other['id'], 'reasons': reasons})
            overlap = candidate_images & image_hashes(other)
            if overlap:
                image_matches.append({'id': other['id'], 'sha256': sorted(overlap)})
        comparison_text = record.get('promptText') or record.get('summary', '')
        ranked = sorted(({
            'id': other['id'], 'title': other.get('title', ''),
            'score': round(similarity(comparison_text,
                                      other.get('promptText') if record.get('promptText')
                                      else other.get('summary', '')), 4)
        } for other in peers), key=lambda item: (-item['score'], item['id']))
        similar = ranked[:5]
        review = record.get('dedupeReview') or {}
        blockers = []
        if not post_key(record.get('sourceUrl', '')):
            blockers.append('valid-https-threads-source-required')
        if record.get('accessStatus') != 'publicly-verified':
            blockers.append('original-source-not-directly-verified')
        if record.get('promptStatus') != 'full' or not record.get('promptText', '').strip():
            blockers.append('complete-author-prompt-not-verified')
        if not post_key(record.get('promptSourceUrl', '')):
            blockers.append('author-prompt-source-required')
        same_core = [other['id'] for other in records
                     if other['id'] != record['id'] and record.get('coreDedupeKey')
                     and record.get('coreDedupeKey') == other.get('coreDedupeKey')]
        if (record.get('dedupeStatus') == 'suspected_duplicate' or same_core) and review.get('decision') not in ('distinct', 'duplicate', 'near-duplicate'):
            blockers.append('reported-core-overlap-needs-manual-review')
        verification = record.get('sourceVerification') or {}
        if verification.get('status') != 'verified' or verification.get('authorConfirmed') is not True:
            blockers.append('post-to-author-prompt-pairing-not-verified')
        rights = record.get('rights') or {}
        if rights.get('status') not in ('authorized', 'open-license'):
            blockers.append('republication-rights-unconfirmed')
        scopes = set(rights.get('scope', []))
        if not {'prompt', 'images', 'public-site', 'public-repository'} <= scopes:
            blockers.append('rights-scope-must-cover-prompt-images-site-and-repository')
        if not rights.get('evidence') or not rights.get('license'):
            blockers.append('rights-evidence-and-license-required')
        if (review.get('decision') != 'distinct' or not review.get('rationale')
                or not review.get('reviewer') or not review.get('reviewedAt')):
            blockers.append('manual-core-task-difference-review-required')
        if review.get('comparedCatalogSha256') != catalog_sha:
            blockers.append('dedupe-review-must-use-current-catalog')
        if review.get('comparedBatchSha256') != batch_sha:
            blockers.append('dedupe-review-must-compare-current-candidate-batch')
        compared = set(review.get('comparedTo', []))
        if not compared or not compared <= existing_ids:
            blockers.append('closest-existing-template-comparison-required')
        if any(match['id'] in existing_ids and match['score'] >= .35
               and match['id'] not in compared for match in ranked):
            blockers.append('high-similarity-existing-template-not-reviewed')
        if image_matches and not review.get('imageOverlapRationale'):
            # Same source photograph can legitimately produce distinct transformations.
            blockers.append('matching-image-needs-review-not-automatic-new-card')
        pictures = record.get('images', [])
        if not pictures:
            blockers.append('original-example-images-not-verified')
        for picture in pictures:
            if not isinstance(picture, dict) or not SHA256.fullmatch(picture.get('sha256', '')):
                blockers.append('image-bytes-and-checksum-not-verified')
                break
            if root is not None:
                image_path = (root / picture.get('localPath', '')).resolve()
                if (not image_path.is_relative_to(root.resolve()) or not image_path.is_file()
                        or hashlib.sha256(image_path.read_bytes()).hexdigest() != picture['sha256']):
                    blockers.append('local-image-missing-or-checksum-mismatch')
                    break
        if exact or review.get('decision') in ('duplicate', 'near-duplicate'):
            decision = 'exclude-duplicate'
        else:
            decision = 'needs-review' if blockers else 'eligible-for-manual-import'
        results.append({
            'id': record['id'], 'title': record.get('title', ''),
            'sourceUrl': record.get('sourceUrl', ''), 'decision': decision,
            'blockers': list(dict.fromkeys(blockers)), 'exactMatches': exact,
            'imageMatches': image_matches, 'closestCandidates': similar,
            'similarExistingTemplates': [match for match in ranked
                                         if match['id'] in existing_ids and match['score'] >= .35],
            'semanticReview': review,
            'researchDedupeSignals': {'reportedStatus': record.get('dedupeStatus'),
                                     'duplicateOf': record.get('duplicateOf'),
                                     'sameCoreKeyPeers': same_core},
        })
    counts = Counter(item['decision'] for item in results)
    return {
        'catalogSha256': catalog_sha, 'candidateBatchSha256': batch_sha,
        'existingCount': len(catalog),
        'candidateCount': len(records), 'decisions': dict(counts),
        'policy': 'No automatic import. A paraphrase, different author or new example image '
                  'does not establish a new task. Compare core instructions and output; '
                  'only substantive differences can be retained. Similarity is triage, '
                  'not semantic proof. Public visibility is not republication permission.',
        'results': results,
    }


def manifest_fingerprint(manifest: dict) -> str:
    return digest(json.dumps({k: v for k, v in manifest.items() if k != 'review'},
                             ensure_ascii=False, sort_keys=True, separators=(',', ':')))

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='JSON array or object with a candidates array')
    parser.add_argument('--manifest-fingerprint', action='store_true',
                        help='Print the source manifest content fingerprint; does not approve it')
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path, help='Write audit JSON; omitted prints to stdout')
    args = parser.parse_args()
    payload = json.loads(args.input.read_text())
    if args.manifest_fingerprint:
        if not isinstance(payload, dict):
            parser.error('manifest must be a JSON object')
        print(manifest_fingerprint(payload))
        return
    records = payload if isinstance(payload, list) else payload['candidates']
    if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
        parser.error('input must contain an array of candidate objects')
    catalog, catalog_sha = load_catalog(args.root)
    report = audit(records, catalog, catalog_sha, args.root)
    output = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        target = args.output.resolve()
        # Sources is consumed automatically by build.py; quarantine cannot write there.
        protected = [(args.root / 'tools/curate/sources').resolve(),
                     (args.root / 'assets').resolve()]
        if any(target.is_relative_to(path) for path in protected):
            parser.error('audit output must stay outside active assets and source manifests')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
    else:
        print(output, end='')


if __name__ == '__main__':
    main()
