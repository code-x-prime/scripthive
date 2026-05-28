/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Journal } from "../types";
import { journalService } from "../services/journal.service";

interface AppContextType {
  journals: Journal[];
  journalsLoading: boolean;
  reloadJournals: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalsLoading, setJournalsLoading] = useState<boolean>(true);

  const reloadJournals = useCallback(async (): Promise<void> => {
    setJournalsLoading(true);
    const data = await journalService.list().catch(() => []);
    setJournals(data);
    setJournalsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reloadJournals();
    }, 0);
    return () => clearTimeout(timer);
  }, [reloadJournals]);

  const value = useMemo(() => ({ journals, journalsLoading, reloadJournals }), [journals, journalsLoading, reloadJournals]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
