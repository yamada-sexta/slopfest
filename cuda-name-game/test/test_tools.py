import csv
import importlib.util
import math
import hashlib
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analysis', ROOT / 'analyze.py')
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)
HEADER = ['workload', 'size', 'round', 'position', 'batch', 'variant', 'us']


def fixture():
    return [['saxpy', 100, r, pos, 10, ['a', 'b'][v], 10 + v]
            for r in range(4) for pos, v in enumerate([r % 2, 1-r % 2])]


class AnalysisTests(unittest.TestCase):
    def read(self, rows):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'run.csv'
            with path.open('w', newline='') as stream:
                writer = csv.writer(stream)
                writer.writerow(HEADER)
                writer.writerows(rows)
            return analysis.read_run(path)

    def test_machine_comparison_includes_control_words(self):
        text = 'Function : neutral_saxpy\n/*0000*/ MOV; /* 0x0000000000000001 */\n/* 0x0000000000000002 */\n'
        for name in ['cutlass', 'control', 'CUTLASS']:
            self.assertEqual(analysis.sass_words(text), analysis.sass_words(text.replace('neutral_', name + '_')))
        self.assertNotEqual(analysis.sass_words(text), analysis.sass_words(text.replace('0000000000000002', '0000000000000003')))
        self.assertEqual(len(analysis.sass_words(text)['saxpy']), 2)
        for bad in ['Function : empty\n', text + text, '']:
            with self.assertRaises(ValueError):
                analysis.sass_words(bad)

    def test_complete_balanced_schedule(self):
        data = self.read(fixture())
        self.assertEqual(len(data[('saxpy', 100)]), 8)
        self.assertEqual(data[('saxpy', 100)][(0, 'b')], (11, 1))

    def test_invalid_timings_and_incomplete_schedules(self):
        for bad in [0, -1, 'nan', 'inf']:
            rows = fixture()
            rows[0][-1] = bad
            with self.assertRaises(ValueError):
                self.read(rows)
        mutations = [lambda x: x[:-1], lambda x: x + [x[0]], lambda x: x[2:]]
        for mutation in mutations:
            with self.assertRaises(ValueError):
                self.read(mutation(fixture()))
        for column, value in [(1, 0), (2, -1), (3, -1), (4, 0), (4, 11)]:
            rows = fixture()
            rows[0][column] = value
            with self.assertRaises(ValueError):
                self.read(rows)
        rows = fixture()
        rows[2][3], rows[3][3] = rows[3][3], rows[2][3]
        with self.assertRaises(ValueError):
            self.read(rows)

    def test_bootstrap_replicates_are_processes(self):
        values = [math.log(x) for x in [1.1, 1.2, 1.3, 1.4, 1.5]]
        low, high = analysis.bootstrap_interval(values, 5000)
        # Independently enumerate all 5^5 resampled process means.
        import itertools
        exact = sorted(math.exp(sum(x)/5) for x in itertools.product(values, repeat=5))
        self.assertAlmostEqual(low, exact[int(.025 * (len(exact)-1))], delta=.01)
        self.assertAlmostEqual(high, exact[int(.975 * (len(exact)-1))], delta=.01)
        intervals, critical = analysis.simultaneous_intervals([values, [-x for x in values]], 5000)
        self.assertGreater(critical, 0)
        broader, _ = analysis.simultaneous_intervals([values, [-x for x in values]], 5000, families=4)
        self.assertLessEqual(broader[0][0], intervals[0][0])
        self.assertGreaterEqual(broader[0][1], intervals[0][1])
        self.assertAlmostEqual(intervals[0][0], 1/intervals[1][1])
        self.assertAlmostEqual(intervals[0][1], 1/intervals[1][0])
        with self.assertRaises(ValueError):
            analysis.simultaneous_intervals([[1, 2]])

    def test_cli_rejects_failed_runs_mixed_gpus_and_duplicate_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder/'build.json').write_text('{}')
            (folder/'bench').write_bytes(b'host executable fixture')
            paths = []
            for index in range(3):
                path = folder/f'run-{index}.csv'
                rows = fixture()
                for row in rows: row[-1] += index*.01
                with path.open('w', newline='') as stream:
                    writer = csv.writer(stream); writer.writerow(HEADER); writer.writerows(rows)
                metadata = {'exit_code': 0, 'telemetry_errors': [], 'build': {},
                            'benchmark_sha256': hashlib.sha256((folder/'bench').read_bytes()).hexdigest(),
                            'gpu': 'GPU A, driver X', 'settings': {'rounds': 4, 'batch_ms': 15, 'direct': False}}
                path.with_suffix('.json').write_text(json.dumps(metadata))
                paths.append(path)
            def invoke(arguments):
                return subprocess.run([sys.executable,str(ROOT/'analyze.py'),'--modules',str(folder),'--draws','1000',*map(str,arguments)],capture_output=True,text=True)
            result = invoke([paths[0],paths[0],paths[1]])
            self.assertNotEqual(result.returncode,0); self.assertIn('Duplicate run paths',result.stderr)
            metadata = json.loads(paths[2].with_suffix('.json').read_text())
            metadata['exit_code'] = 1
            paths[2].with_suffix('.json').write_text(json.dumps(metadata))
            result = invoke(paths)
            self.assertNotEqual(result.returncode,0); self.assertIn('Failed run',result.stderr)
            metadata['exit_code'] = 0; metadata['gpu'] = 'GPU B, driver Y'
            paths[2].with_suffix('.json').write_text(json.dumps(metadata))
            result = invoke(paths)
            self.assertNotEqual(result.returncode,0); self.assertIn('GPU/driver profiles differ',result.stderr)

    def test_summary_ratios_and_null_control(self):
        labels = {v for _, a, b in analysis.contrasts() for v in [a, b]}
        labels = sorted(labels)
        runs = []
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            for label in labels:
                prefix = label.split('__')[1]
                (folder / (label + '.sass')).write_text(f'Function : {prefix}_saxpy\n/* 0x0000000000000001 */\n')
            for process in range(5):
                rows = {}
                for r in range(len(labels)):
                    for index, label in enumerate(labels):
                        # A known 2x effect, with process variation; sham exactly 1x.
                        us = 10 if label.endswith('__cutlass') else 20 + process*.1
                        rows[(r, label)] = (us, (index+r) % len(labels))
                runs.append({('saxpy', 100): rows})
            report = analysis.summarize(runs, folder, draws=1000)
            effect = next(x for x in report['records'] if x['contrast'] == 'o3: name')
            self.assertAlmostEqual(effect['speedup'], math.prod([2+i*.01 for i in range(5)])**.2)
            self.assertTrue(effect['consistent_win'])
            self.assertEqual(effect['baseline_us'], 20.2)
            self.assertEqual(effect['treatment_us'], 10)
            sham = next(x for x in report['records'] if x['contrast'] == 'o3: sham control')
            self.assertEqual(sham['speedup'], 1)
            self.assertFalse(sham['consistent_win'])
            self.assertEqual(report['family_size'], 15)

if __name__ == '__main__':
    unittest.main()
