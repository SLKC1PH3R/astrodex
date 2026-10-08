"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const PlayerContext = createContext({ stats: null, refresh: () => {} });

export function PlayerProvider({ children }) {
  const [stats, setStats] = useState(null);
  const refresh = useCallback(() => { api.me().then(setStats).catch(() => {}); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <PlayerContext.Provider value={{ stats, refresh }}>{children}</PlayerContext.Provider>;
}

export const usePlayer = () => useContext(PlayerContext);
