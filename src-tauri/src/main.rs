// Prevents additional console window on Windows in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Check for the hidden steam-ach-edit subcommand used by steam_set_achievements.
    // When present, run the edit in this process and exit — this ensures Steam sees
    // a proper process lifecycle and stops showing the game as running when we exit.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(|s| s.as_str()) == Some("--steam-ach-edit") {
        yukig_lib::commands::steam_commands::run_ach_edit_subprocess(&args);
        std::process::exit(0);
    }

    yukig_lib::run();
}
