#!/usr/bin/env python3
"""
AstroSwap Stress Test Results Analyzer

Analyzes stress test results and generates visualizations and reports.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import argparse


def load_results(filepath: Path) -> Dict[str, Any]:
    """Load test results from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def analyze_performance(data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze performance metrics from test results."""
    summary = data['summary']
    scenarios = data['scenarios']

    analysis = {
        'overall': {
            'total_operations': summary['total_operations'],
            'success_rate': summary['overall_success_rate'] * 100,
            'tps': summary['overall_tps'],
            'avg_latency_ms': summary['overall_latency_ms'],
            'test_passed': summary['test_passed'],
        },
        'scenarios': []
    }

    for scenario in scenarios:
        perf = scenario['performance']
        scenario_analysis = {
            'name': scenario['name'],
            'operations': perf['total_operations'],
            'success_rate': perf['success_rate'] * 100,
            'tps': perf['operations_per_second'],
            'latency': {
                'avg': perf['latency_avg_ms'],
                'p50': perf['latency_p50_ms'],
                'p95': perf['latency_p95_ms'],
                'p99': perf['latency_p99_ms'],
                'max': perf['latency_max_ms'],
            }
        }

        if scenario.get('errors', {}).get('total_errors', 0) > 0:
            scenario_analysis['errors'] = {
                'total': scenario['errors']['total_errors'],
                'rate': scenario['errors']['error_rate'] * 100,
                'top_errors': scenario['errors']['top_errors'][:5]
            }

        analysis['scenarios'].append(scenario_analysis)

    return analysis


def print_summary(data: Dict[str, Any], analysis: Dict[str, Any]):
    """Print formatted summary to console."""
    print("\n" + "="*70)
    print(f"  STRESS TEST RESULTS: {data['test_id']}")
    print("="*70)

    # Overall metrics
    print("\n📊 OVERALL METRICS")
    print("-"*70)
    overall = analysis['overall']
    print(f"  Total Operations:    {overall['total_operations']:,}")
    print(f"  Success Rate:        {overall['success_rate']:.2f}%")
    print(f"  TPS:                 {overall['tps']:.2f}")
    print(f"  Average Latency:     {overall['avg_latency_ms']:.2f}ms")

    status = "✓ PASSED" if overall['test_passed'] else "✗ FAILED"
    status_color = "\033[92m" if overall['test_passed'] else "\033[91m"
    print(f"  Test Status:         {status_color}{status}\033[0m")

    # Issues
    if data['summary'].get('issues'):
        print("\n⚠️  ISSUES DETECTED")
        print("-"*70)
        for issue in data['summary']['issues']:
            print(f"  • {issue}")

    # Scenario details
    print("\n📈 SCENARIO BREAKDOWN")
    print("-"*70)

    for scenario in analysis['scenarios']:
        print(f"\n  {scenario['name']}")
        print(f"    Operations:     {scenario['operations']:,}")
        print(f"    Success Rate:   {scenario['success_rate']:.2f}%")
        print(f"    TPS:            {scenario['tps']:.2f}")
        print(f"    Latency (avg):  {scenario['latency']['avg']:.2f}ms")
        print(f"    Latency (p95):  {scenario['latency']['p95']:.2f}ms")
        print(f"    Latency (p99):  {scenario['latency']['p99']:.2f}ms")

        if 'errors' in scenario:
            print(f"    Errors:         {scenario['errors']['total']} ({scenario['errors']['rate']:.2f}%)")
            if scenario['errors']['top_errors']:
                print("    Top Errors:")
                for error, count in scenario['errors']['top_errors']:
                    print(f"      - {error}: {count}")

    print("\n" + "="*70 + "\n")


def generate_comparison(results_dir: Path):
    """Generate comparison report from multiple test results."""
    json_files = sorted(results_dir.glob("stress_test_*.json"), reverse=True)

    if len(json_files) < 2:
        print("⚠️  Need at least 2 test results for comparison")
        return

    print("\n" + "="*70)
    print("  TEST COMPARISON (Latest 5 runs)")
    print("="*70)
    print()

    comparison_data = []
    for filepath in json_files[:5]:
        data = load_results(filepath)
        comparison_data.append({
            'timestamp': data['start_time'],
            'test_id': data['test_id'],
            'total_ops': data['summary']['total_operations'],
            'success_rate': data['summary']['overall_success_rate'] * 100,
            'tps': data['summary']['overall_tps'],
            'latency': data['summary']['overall_latency_ms'],
            'passed': data['summary']['test_passed']
        })

    # Print comparison table
    print(f"{'Timestamp':<20} {'TPS':<10} {'Success %':<12} {'Latency ms':<12} {'Status':<10}")
    print("-"*70)

    for item in comparison_data:
        timestamp = item['timestamp'].split('T')[0] + ' ' + item['timestamp'].split('T')[1][:8]
        status = "✓" if item['passed'] else "✗"
        print(f"{timestamp:<20} {item['tps']:<10.2f} {item['success_rate']:<12.2f} "
              f"{item['latency']:<12.2f} {status:<10}")

    print("\n" + "="*70 + "\n")


def export_csv(data: Dict[str, Any], output_path: Path):
    """Export results to CSV format."""
    import csv

    csv_path = output_path.with_suffix('.csv')

    with open(csv_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)

        # Header
        writer.writerow([
            'Test ID',
            'Scenario',
            'Total Operations',
            'Success Rate %',
            'TPS',
            'Avg Latency (ms)',
            'P95 Latency (ms)',
            'P99 Latency (ms)',
        ])

        # Data
        for scenario in data['scenarios']:
            perf = scenario['performance']
            writer.writerow([
                data['test_id'],
                scenario['name'],
                perf['total_operations'],
                perf['success_rate'] * 100,
                perf['operations_per_second'],
                perf['latency_avg_ms'],
                perf['latency_p95_ms'],
                perf['latency_p99_ms'],
            ])

    print(f"✓ Exported to CSV: {csv_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Analyze AstroSwap stress test results'
    )
    parser.add_argument(
        'result_file',
        type=Path,
        help='Path to JSON result file or "latest" for latest result'
    )
    parser.add_argument(
        '--compare',
        action='store_true',
        help='Compare with previous test results'
    )
    parser.add_argument(
        '--export-csv',
        action='store_true',
        help='Export results to CSV format'
    )

    args = parser.parse_args()

    # Handle "latest" shortcut
    if str(args.result_file) == 'latest':
        results_dir = Path(__file__).parent.parent / 'results'
        latest_link = results_dir / 'latest.json'
        if latest_link.exists():
            args.result_file = latest_link
        else:
            print("❌ No latest.json symlink found")
            sys.exit(1)

    # Check file exists
    if not args.result_file.exists():
        print(f"❌ File not found: {args.result_file}")
        sys.exit(1)

    # Load and analyze results
    data = load_results(args.result_file)
    analysis = analyze_performance(data)

    # Print summary
    print_summary(data, analysis)

    # Comparison if requested
    if args.compare:
        results_dir = args.result_file.parent
        generate_comparison(results_dir)

    # Export CSV if requested
    if args.export_csv:
        export_csv(data, args.result_file)


if __name__ == '__main__':
    main()
