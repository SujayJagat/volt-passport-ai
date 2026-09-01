import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { BatteryDatasetProvider } from "./contexts/BatteryDatasetContext";
import "./index.css";
import "./ml.css";
import "./dataset.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <BatteryDatasetProvider>
      <App />
    </BatteryDatasetProvider>
  </AuthProvider>
);
