//! Stress Test Runner Binary
//!
//! Command-line tool for running AstroSwap stress tests.

use astroswap_stress_tests::*;
use astroswap_stress_tests::scenarios::*;
use chrono::Utc;
use clap::Parser;
use std::fs;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "stress-runner")]
#[command(about = "AstroSwap DEX Stress Test Runner", long_about = None)]
struct Args {
    /// Scenario to run (swap-load, pool-stress, router-paths, concurrent, all)
    #[arg(short, long, default_value = "all")]
    scenario: String,

    /// Test duration in seconds
    #[arg(short, long, default_value = "60")]
    duration: u64,

    /// Target transactions per second
    #[arg(short, long, default_value = "50")]
    tps: u32,

    /// Number of test accounts
    #[arg(short, long, default_value = "30")]
    accounts: u32,

    /// Number of trading pairs/pools
    #[arg(short, long, default_value = "5")]
    pairs: u32,

    /// Number of concurrent workers (for concurrent scenario)
    #[arg(short, long, default_value = "20")]
    workers: u32,

    /// Maximum hops for router paths
    #[arg(long, default_value = "4")]
    max_hops: u32,

    /// Output directory for results
    #[arg(short, long, default_value = "results")]
    output: PathBuf,

    /// Output format (json, markdown, both)
    #[arg(short, long, default_value = "both")]
    format: String,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,
}

fn main() {
    let args = Args::parse();

    // Initialize logger
    if args.verbose {
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Debug)
            .init();
    } else {
        env_logger::Builder::from_default_env()
            .filter_level(log::LevelFilter::Info)
            .init();
    }

    // Create output directory
    fs::create_dir_all(&args.output).expect("Failed to create output directory");

    // Build configuration
    let mut config = StressConfig::default();
    config.duration_seconds = args.duration;
    config.target_tps = args.tps;
    config.num_accounts = args.accounts;
    config.num_pairs = args.pairs;
    config.output_dir = args.output.to_string_lossy().to_string();
    config.concurrent.num_workers = args.workers;
    config.router_paths.max_hops = args.max_hops;

    // Parse scenario
    let scenarios = if args.scenario.to_lowercase() == "all" {
        vec![
            Scenario::SwapLoad,
            Scenario::PoolStress,
            Scenario::RouterPaths,
            Scenario::Concurrent,
        ]
    } else {
        vec![Scenario::from_str(&args.scenario).expect("Invalid scenario")]
    };

    config.scenarios = scenarios.clone();

    println!("╔═══════════════════════════════════════════════════════╗");
    println!("║      AstroSwap DEX Stress Test Runner v0.1.0        ║");
    println!("╚═══════════════════════════════════════════════════════╝");
    println!();
    println!("Configuration:");
    println!("  Duration:  {} seconds", config.duration_seconds);
    println!("  Target TPS: {}", config.target_tps);
    println!("  Accounts:  {}", config.num_accounts);
    println!("  Pairs:     {}", config.num_pairs);
    println!("  Scenarios: {}", scenarios.len());
    println!();

    // Generate test ID
    let test_id = format!(
        "stress_test_{}",
        Utc::now().format("%Y%m%d_%H%M%S")
    );

    println!("Test ID: {}", test_id);
    println!();

    let start_time = Utc::now();
    let collector = MetricsCollector::new();

    // Run scenarios
    for scenario in &scenarios {
        println!("═══════════════════════════════════════════════════════");
        match scenario {
            Scenario::SwapLoad => {
                println!("Running: Swap Load Test");
                let scenario = SwapLoadScenario::new();
                scenario.run(&config, &collector);
            }
            Scenario::PoolStress => {
                println!("Running: Pool Stress Test");
                let scenario = PoolStressScenario::new();
                scenario.run(&config, &collector);
            }
            Scenario::RouterPaths => {
                println!("Running: Router Paths Test");
                let scenario = RouterPathsScenario::new();
                scenario.run(&config, &collector);
            }
            Scenario::Concurrent => {
                println!("Running: Concurrent Operations Test");
                let scenario = ConcurrentScenario::new();
                scenario.run(&config, &collector);
            }
            Scenario::All => {
                // This case is handled above
            }
        }
        println!();
    }

    // Generate report
    println!("═══════════════════════════════════════════════════════");
    println!("Generating report...");

    let report = metrics::TestReport::from_metrics(
        test_id.clone(),
        config.clone(),
        start_time,
        &collector,
    );

    // Save report
    let json_path = args.output.join(format!("{}.json", test_id));
    let md_path = args.output.join(format!("{}.md", test_id));

    match args.format.to_lowercase().as_str() {
        "json" => {
            report.save_json(&json_path).expect("Failed to save JSON report");
            println!("Report saved to: {}", json_path.display());
        }
        "markdown" | "md" => {
            report.save_markdown(&md_path).expect("Failed to save Markdown report");
            println!("Report saved to: {}", md_path.display());
        }
        "both" | _ => {
            report.save_json(&json_path).expect("Failed to save JSON report");
            report.save_markdown(&md_path).expect("Failed to save Markdown report");
            println!("Reports saved to:");
            println!("  JSON:     {}", json_path.display());
            println!("  Markdown: {}", md_path.display());
        }
    }

    // Print summary
    println!();
    println!("╔═══════════════════════════════════════════════════════╗");
    println!("║                    Test Summary                       ║");
    println!("╚═══════════════════════════════════════════════════════╝");
    println!();
    println!("  Total Operations:    {}", report.summary.total_operations);
    println!("  Success Rate:        {:.2}%", report.summary.overall_success_rate * 100.0);
    println!("  TPS:                 {:.2}", report.summary.overall_tps);
    println!("  Average Latency:     {:.2}ms", report.summary.overall_latency_ms);
    println!("  Test Status:         {}", if report.summary.test_passed { "✓ PASSED" } else { "✗ FAILED" });
    println!();

    if !report.summary.issues.is_empty() {
        println!("Issues detected:");
        for issue in &report.summary.issues {
            println!("  ⚠ {}", issue);
        }
        println!();
    }

    // Exit with appropriate code
    std::process::exit(if report.summary.test_passed { 0 } else { 1 });
}
