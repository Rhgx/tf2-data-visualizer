// base.css loads first so the feature stylesheets imported through App keep their cascade order over it.
import "./styles/base.css";
import "./ui/tooltip";
import "./ui/sound";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getElement } from "./lib/format";

createRoot(getElement("root", HTMLDivElement)).render(
  <StrictMode>
    <App />
  </StrictMode>
);
