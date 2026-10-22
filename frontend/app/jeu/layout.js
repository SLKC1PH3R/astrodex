import Sidebar from "@/components/Sidebar";
import JeuMain from "@/components/JeuMain";
import { PlayerProvider } from "@/components/PlayerProvider";

export default function JeuLayout({ children }) {
  return (
    <PlayerProvider>
      <div className="ax-app">
        <Sidebar />
        <JeuMain>{children}</JeuMain>
      </div>
    </PlayerProvider>
  );
}
