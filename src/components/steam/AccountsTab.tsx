/**
 * Accounts tab for the Steam hub page.
 *
 * Lists all Steam accounts found in loginusers.vdf on this machine.
 * Allows switching the active account (rewrites loginusers.vdf + registry,
 * then restarts Steam).
 */
import { useState } from "react";
import {
  RefreshCw, Users, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { steamGetUsers, steamSwitchAccount } from "@/services/tauriCommands";
import { SteamUser } from "@/types/steam";

/**
 * Accounts tab: loads Steam accounts lazily on "Load Accounts" click,
 * and lets the user switch the active account.
 */
export default function AccountsTab() {
  const [users, setUsers] = useState<SteamUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try { setUsers(await steamGetUsers()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleSwitch(accountName: string) {
    setSwitching(accountName);
    setError(null);
    setSuccess(null);
    try {
      await steamSwitchAccount(accountName);
      setSuccess(`Switched to ${accountName}. Steam is restarting…`);
      setTimeout(handleLoad, 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSwitching(null);
    }
  }

  // fmtDate inline — avoids importing the formatter just for one call
  function fmtDate(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return (
    <div className="sp-accounts">
      <div className="sp-accounts-head">
        <div>
          <h2 className="sp-accounts-title">Steam Accounts</h2>
          <p className="sp-accounts-sub">Manage and switch between Steam accounts on this machine.</p>
        </div>
        <button className="sp-btn sp-btn--secondary" onClick={handleLoad} disabled={loading}>
          <RefreshCw size={12} className={loading ? "sp-spin" : ""} />
          {loading ? "Loading…" : "Load Accounts"}
        </button>
      </div>

      {error && (
        <div className="sp-error-banner">
          <AlertCircle size={13} />
          {error}
        </div>
      )}
      {success && (
        <div className="sp-success-banner">
          <CheckCircle2 size={13} />
          {success}
        </div>
      )}

      {users.length === 0 && !loading && (
        <div className="sp-state-screen sp-state-screen--inline">
          <div className="sp-state-icon">
            <Users size={20} />
          </div>
          <p className="sp-state-title">No accounts loaded</p>
          <p className="sp-state-sub">Click <strong>Load Accounts</strong> to read Steam accounts on this machine.</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="sp-user-grid">
          {users.map((u) => (
            <div key={u.steam_id} className={`sp-user-card ${u.most_recent ? "sp-user-card--active" : ""}`}>
              <div className="sp-user-avatar">
                <img
                  src={u.avatar_url}
                  alt={u.persona_name}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="sp-user-initial">{u.persona_name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="sp-user-body">
                <div className="sp-user-head">
                  <span className="sp-user-persona">{u.persona_name}</span>
                  {u.most_recent && <span className="sp-active-pill">Active</span>}
                </div>
                <span className="sp-user-account">@{u.account_name}</span>
                {u.timestamp > 0 && (
                  <span className="sp-user-last">
                    <Clock size={10} />
                    Last login: {fmtDate(u.timestamp)}
                  </span>
                )}
              </div>
              <button
                className={`sp-switch-btn ${u.most_recent ? "sp-switch-btn--current" : ""}`}
                disabled={u.most_recent || switching !== null}
                onClick={() => handleSwitch(u.account_name)}
              >
                {switching === u.account_name
                  ? <><RefreshCw size={11} className="sp-spin" /> Switching…</>
                  : u.most_recent
                    ? "Current"
                    : "Switch"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
