import { useEffect } from "react";
import { connection } from "./signalr";
import Player from "./components/Player.tsx";

export default function App() {

    useEffect(() => {
        connection.start();
    }, []);

    return <Player />;
}