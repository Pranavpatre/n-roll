import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try { import("@vercel/analytics").then((m) => m.inject()); } catch {}

createRoot(document.getElementById("root")!).render(<App />);
