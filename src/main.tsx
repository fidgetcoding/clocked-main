import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/sofia-sans-extra-condensed/700-italic.css";
import "@fontsource/sofia-sans-extra-condensed/900-italic.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
