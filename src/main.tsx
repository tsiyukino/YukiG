import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Global styles must load BEFORE App so component CSS modules come later in
// the bundle and win same-specificity ties (e.g. inputs overriding the
// global :focus-visible ring with their own focus treatment).
import "@fontsource-variable/geist";
import "@fontsource-variable/sora";
import "./styles/global.css";
import App from "./App";
import TrayMenuApp from "./tray/TrayMenuApp";

// The tray-menu popup window loads the same bundle with `?window=tray`
// (see src-tauri/src/tray.rs) and renders only the menu — no router, no shell.
const isTrayWindow = new URLSearchParams(window.location.search).get("window") === "tray";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isTrayWindow ? (
      <TrayMenuApp />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>
);
