import "./sentry.ts";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/auth-controls.css";
import "./styles/semantic-tokens.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
