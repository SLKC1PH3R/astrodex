import Sidebar from "@/components/Sidebar";
import { PlayerProvider } from "@/components/PlayerProvider";

export default function JeuLayout({ children }) {
  return (
    <PlayerProvider>
      <div className="ax-app">
        <Sidebar />
        <main className="ax-main">{children}</main>
      </div>
    </PlayerProvider>
  );
}
