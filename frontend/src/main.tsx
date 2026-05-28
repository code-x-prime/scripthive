import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        success: { className: "bg-green-50 border border-green-200 text-green-800" },
        error: { className: "bg-red-50 border border-red-200 text-red-800" }
      }}
    />
  </StrictMode>
);
