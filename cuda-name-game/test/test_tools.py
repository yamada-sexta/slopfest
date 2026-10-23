import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analysis', ROOT / 'analyze.py')
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)
HEADER = 'workload,size,round,first,batch,neutral_us,cutlass_us,speedup\n'

class AnalysisTests(unittest.TestCase):
    def test_machine_comparison_includes_control_words(self):
        text = 'Function : neutral_saxpy\n/*0000*/ MOV; /* 0x0000000000000001 */\n/* 0x0000000000000002 */\n'
        named = text.replace('neutral_', 'cutlass_')
        self.assertEqual(analysis.sass_words(text), analysis.sass_words(named))
        self.assertNotEqual(analysis.sass_words(text), analysis.sass_words(named.replace('0000000000000002', '0000000000000003')))
        self.assertEqual(len(analysis.sass_words(text)['saxpy']), 2)
        with self.assertRaises(ValueError):
            analysis.sass_words('Function : empty\n')

    def test_invalid_or_unbalanced_timing_runs_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'run.csv'
            for bad in ['0', '-1', 'nan', 'inf']:
                path.write_text(HEADER + ''.join(f'saxpy,100,{i},{i % 2},10,{bad},5,2\n' for i in range(4)))
                with self.assertRaises(ValueError):
                    analysis.read_run(path)
            for rounds, first in [(3, None), (4, 0)]:
                path.write_text(HEADER + ''.join(f'saxpy,100,{i},{i % 2 if first is None else first},10,10,5,2\n' for i in range(rounds)))
                with self.assertRaises(ValueError):
                    analysis.read_run(path)

    def test_report_uses_timings_not_the_supplied_ratio_column(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            path = folder / 'run.csv'
            path.write_text(HEADER + ''.join(f'saxpy,100,{i},{i % 2},10,10,5,999\n' for i in range(4)))
            self.assertEqual(analysis.read_run(path)[('saxpy', 100)], [(10.0, 5.0)] * 4)
            for prefix in ['neutral', 'cutlass']:
                (folder / (prefix + '.sass')).write_text(f'Function : {prefix}_saxpy\n/* 0x0000000000000001 */\n')
            result = subprocess.run([sys.executable, str(ROOT / 'analyze.py'), '--modules', str(folder), str(path)], capture_output=True, text=True, check=True)
            self.assertIn('2.000×', result.stdout)
            self.assertIn('| saxpy | yes | 1 | 1 |', result.stdout)
            self.assertNotIn('999', result.stdout)

if __name__ == '__main__':
    unittest.main()
