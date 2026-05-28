import { useContext } from "react";
import { AppContext } from "../contexts/AppContext";

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
