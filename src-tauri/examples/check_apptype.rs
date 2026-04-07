use yukig_lib::services::steam;
use std::path::Path;

fn main() {
    let path = Path::new(r"D:/Steam");
    match steam::scan(path) {
        Ok(result) => {
            let targets: &[u64] = &[228980, 250820, 1493710];
            for id in targets {
                match result.games.iter().find(|g| g.app_id == *id) {
                    Some(g) => println!("Scan: App {}: name={:?} app_type={:?} installed={}", 
                        id, g.name, g.app_type, g.is_installed),
                    None => println!("Scan: App {} not in scan results", id),
                }
            }
            println!("\nAll non-game typed entries in scan:");
            let non_games: Vec<_> = result.games.iter()
                .filter(|g| {
                    let t = g.app_type.to_lowercase();
                    !t.is_empty() && t != "game"
                })
                .collect();
            for g in &non_games {
                println!("  App {}: {:?} type={:?}", g.app_id, g.name, g.app_type);
            }
            println!("\nTotal: {} games, {} non-game typed", result.games.len(), non_games.len());
        }
        Err(e) => eprintln!("Error: {}", e),
    }
}
