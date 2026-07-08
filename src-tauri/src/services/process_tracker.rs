/// Passive process-tree session tracker for playtime measurement.
///
/// Watches a launched process and all of its descendants from the *outside*,
/// by polling the system process table and following parent-PID links. The
/// tracked processes are never placed in a Job Object and inherit nothing from
/// YukiG, so launchers like Mod Organizer 2 (which hook process creation and
/// inject into their own children) behave exactly as if double-clicked.
///
/// PID reuse is guarded by recording each process's creation time: a PID only
/// counts as "the same process" while its creation time matches, and a child
/// is only adopted if it was created no earlier than its watched parent.
///
/// Exit detection is *immediate*, not polled: the wait loop holds a SYNCHRONIZE
/// handle to each watched process and blocks on `WaitForMultipleObjects`, so a
/// process death wakes the tracker at once. The poll interval only bounds how
/// long a newly-spawned child can go unnoticed, not how long a dead process
/// lingers in the session.
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Upper bound on how long a newly-spawned child can go undetected. The wait
/// blocks on process handles and returns *early* the instant any watched
/// process exits; this timeout only forces a re-snapshot to catch children that
/// appeared without any watched process having exited.
const POLL_INTERVAL: Duration = Duration::from_millis(1000);

/// Errors produced by the process tracker.
#[derive(Debug, thiserror::Error)]
pub enum TrackerError {
    /// Taking a system process snapshot failed.
    #[error("Process snapshot failed: {0}")]
    Snapshot(String),
}

/// One row of a process-table snapshot, as needed for tree tracking.
struct ProcessRecord {
    pid: u32,
    parent_pid: u32,
    /// Creation time as a Windows FILETIME packed into a u64.
    created: u64,
}

/// Blocks until the process tree rooted at `root_pid` has fully exited and
/// returns the session length in whole seconds.
///
/// If the root process already exited before the first snapshot (an
/// instantly-exiting stub), returns 0 — the launch itself succeeded, so this
/// is reported as a zero-length session rather than an error.
///
/// # Errors
/// Returns `TrackerError::Snapshot` if the process table cannot be read.
pub fn track_process_tree(root_pid: u32) -> Result<u64, TrackerError> {
    let start = Instant::now();
    let mut watched: HashMap<u32, u64> = HashMap::new();

    let first = take_snapshot()?;
    match first.iter().find(|r| r.pid == root_pid) {
        Some(root) => watched.insert(root.pid, root.created),
        None => return Ok(0),
    };
    advance_watch_set(&mut watched, &first);

    let mut last_alive = start;
    while !watched.is_empty() {
        last_alive = Instant::now();
        // Block until a watched process exits or the poll timeout elapses,
        // whichever comes first. Either way we re-snapshot to reconcile the set.
        wait_for_any_exit(watched.keys().copied().collect(), POLL_INTERVAL);
        let snapshot = take_snapshot()?;
        advance_watch_set(&mut watched, &snapshot);
    }
    Ok(last_alive.duration_since(start).as_secs())
}

/// Advances the watch set by one snapshot: drops exited processes (or reused
/// PIDs whose creation time changed) and adopts descendants of watched
/// processes, iterating to a fixpoint so grandchildren appearing in the same
/// snapshot are caught immediately.
fn advance_watch_set(watched: &mut HashMap<u32, u64>, snapshot: &[ProcessRecord]) {
    let alive: HashMap<u32, u64> = snapshot.iter().map(|r| (r.pid, r.created)).collect();
    watched.retain(|pid, created| alive.get(pid) == Some(created));

    loop {
        let mut added = false;
        for r in snapshot {
            if watched.contains_key(&r.pid) {
                continue;
            }
            if let Some(&parent_created) = watched.get(&r.parent_pid) {
                // A child created before its "parent" means the parent PID was
                // reused by an unrelated process — do not adopt.
                if r.created >= parent_created {
                    watched.insert(r.pid, r.created);
                    added = true;
                }
            }
        }
        if !added {
            break;
        }
    }
}

/// Blocks until any of the given processes exits or `timeout` elapses.
///
/// Opens a SYNCHRONIZE handle per PID and waits on all of them at once via
/// `WaitForMultipleObjects`, so a process death returns immediately rather than
/// waiting out the poll interval. PIDs that cannot be opened (already exited)
/// are skipped — the caller re-snapshots afterward and will drop them, so a
/// missing handle simply falls through to the timeout without stalling.
#[cfg(target_os = "windows")]
fn wait_for_any_exit(pids: Vec<u32>, timeout: Duration) {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Threading::{
        OpenProcess, WaitForMultipleObjects, PROCESS_SYNCHRONIZE,
    };

    // WaitForMultipleObjects caps at MAXIMUM_WAIT_OBJECTS (64) handles. A game
    // tree never approaches this; excess PIDs are reconciled on the next
    // snapshot instead of being waited on directly.
    const MAX_WAIT_HANDLES: usize = 64;

    let mut handles: Vec<HANDLE> = Vec::new();
    for pid in pids.into_iter().take(MAX_WAIT_HANDLES) {
        if let Ok(h) = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, pid) } {
            handles.push(h);
        }
    }

    if handles.is_empty() {
        // Nothing waitable (all exited between snapshot and now, or open
        // failed) — fall back to a plain sleep so we re-snapshot promptly.
        std::thread::sleep(timeout);
        return;
    }

    // Wait for the first handle to signal (a process exited) or the timeout.
    // The return value is discarded: both outcomes lead to the same re-snapshot.
    let timeout_ms = timeout.as_millis().min(u32::MAX as u128) as u32;
    let _ = unsafe { WaitForMultipleObjects(&handles, false, timeout_ms) };

    for h in handles {
        unsafe { CloseHandle(h).ok() };
    }
}

#[cfg(not(target_os = "windows"))]
fn wait_for_any_exit(_pids: Vec<u32>, timeout: Duration) {
    std::thread::sleep(timeout);
}

/// Takes a full process-table snapshot with creation times.
///
/// Processes whose creation time cannot be queried (protected system
/// processes) are skipped — they can never be children of a user-launched
/// game, so this loses nothing.
#[cfg(target_os = "windows")]
fn take_snapshot() -> Result<Vec<ProcessRecord>, TrackerError> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snap = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }
        .map_err(|e| TrackerError::Snapshot(e.to_string()))?;

    let mut records = Vec::new();
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut ok = unsafe { Process32FirstW(snap, &mut entry) };
    while ok.is_ok() {
        if let Some(created) = query_creation_time(entry.th32ProcessID) {
            records.push(ProcessRecord {
                pid: entry.th32ProcessID,
                parent_pid: entry.th32ParentProcessID,
                created,
            });
        }
        ok = unsafe { Process32NextW(snap, &mut entry) };
    }
    unsafe { CloseHandle(snap).ok() };
    Ok(records)
}

/// Returns a process's creation time as a packed FILETIME u64, or None if the
/// process cannot be opened for query (exited or protected).
#[cfg(target_os = "windows")]
fn query_creation_time(pid: u32) -> Option<u64> {
    use windows::Win32::Foundation::{CloseHandle, FILETIME};
    use windows::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let mut creation = FILETIME::default();
    let mut exit = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    let result = unsafe { GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) };
    unsafe { CloseHandle(handle).ok() };
    result.ok()?;
    Some(((creation.dwHighDateTime as u64) << 32) | creation.dwLowDateTime as u64)
}

#[cfg(not(target_os = "windows"))]
fn take_snapshot() -> Result<Vec<ProcessRecord>, TrackerError> {
    Err(TrackerError::Snapshot(
        "Process-tree tracking is only implemented on Windows.".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(pid: u32, parent_pid: u32, created: u64) -> ProcessRecord {
        ProcessRecord { pid, parent_pid, created }
    }

    fn watched_of(entries: &[(u32, u64)]) -> HashMap<u32, u64> {
        entries.iter().copied().collect()
    }

    #[test]
    fn adopts_child_of_watched_process() {
        let mut watched = watched_of(&[(100, 10)]);
        advance_watch_set(&mut watched, &[rec(100, 1, 10), rec(200, 100, 20)]);
        assert_eq!(watched, watched_of(&[(100, 10), (200, 20)]));
    }

    #[test]
    fn adopts_grandchild_in_same_snapshot() {
        let mut watched = watched_of(&[(100, 10)]);
        advance_watch_set(
            &mut watched,
            &[rec(100, 1, 10), rec(200, 100, 20), rec(300, 200, 30)],
        );
        assert_eq!(watched, watched_of(&[(100, 10), (200, 20), (300, 30)]));
    }

    #[test]
    fn keeps_descendants_after_launcher_exits() {
        // Launcher (100) spawned game (200), then exited.
        let mut watched = watched_of(&[(100, 10), (200, 20)]);
        advance_watch_set(&mut watched, &[rec(200, 100, 20)]);
        assert_eq!(watched, watched_of(&[(200, 20)]));
    }

    #[test]
    fn drops_reused_pid_with_different_creation_time() {
        // PID 200 exited and was reused by an unrelated process.
        let mut watched = watched_of(&[(100, 10), (200, 20)]);
        advance_watch_set(&mut watched, &[rec(100, 1, 10), rec(200, 1, 99)]);
        assert_eq!(watched, watched_of(&[(100, 10)]));
    }

    #[test]
    fn does_not_adopt_child_of_reused_parent_pid() {
        // Watched parent 100 (created=50). Snapshot shows a process claiming
        // parent 100 but created *before* it — its real parent was the old
        // occupant of PID 100.
        let mut watched = watched_of(&[(100, 50)]);
        advance_watch_set(&mut watched, &[rec(100, 1, 50), rec(200, 100, 30)]);
        assert_eq!(watched, watched_of(&[(100, 50)]));
    }

    #[test]
    fn empties_when_tree_is_gone() {
        let mut watched = watched_of(&[(100, 10), (200, 20)]);
        advance_watch_set(&mut watched, &[rec(999, 1, 5)]);
        assert!(watched.is_empty());
    }
}
