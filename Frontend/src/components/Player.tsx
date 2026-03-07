import { useEffect, useRef, useState, useCallback, memo, type FC } from "react";
import ChatOverlay from "./ChatOverlay";
import "./Player.css";
import { connection } from "../signalr";

export default function Player() {
    const [videoEmbed, setVideoEmbed] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showChatInput, setShowChatInput] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const toEmbedUrl = useCallback((url: string) => {
        const match = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        return match ? `https://rutube.ru/play/embed/${match[1]}` : url;
    }, []);

    const sendCommand = useCallback((command: object) => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify(command), "*");
    }, []);

    // Подписка на SignalR
    useEffect(() => {
        connection.on("Video", (url: string) => setVideoEmbed(toEmbedUrl(url)));
        connection.on("Play", () => sendCommand({ type: "player:play", data: {} }));
        connection.on("Pause", () => sendCommand({ type: "player:pause", data: {} }));
        connection.on("Seek", (time: number) =>
            sendCommand({ type: "player:relativelySeek", data: { time } })
        );

        return () => {
            connection.off("Video");
            connection.off("Play");
            connection.off("Pause");
            connection.off("Seek");
        };
    }, [toEmbedUrl, sendCommand]);

    // Локальные кнопки для синхронизации
    const handlePlay = () => connection.invoke("Play").catch(console.error);
    const handlePause = () => connection.invoke("Pause").catch(console.error);
    const handleSeek = (time: number) => connection.invoke("Seek", time).catch(console.error);

    // Отправка нового видео
    const loadVideo = useCallback((url: string) => {
        connection.invoke("Video", url).catch(console.error);
    }, []);

    return (
        <div className="player">
            {videoEmbed && (
                <iframe
                    ref={iframeRef}
                    className="video"
                    src={`${videoEmbed}?autoplay=0`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="rutube-player"
                />
            )}

            <button className="toggleInput" onClick={() => setShowUrlInput(v => !v)}>
                🎬
            </button>

            <button
                className="toggleInput"
                style={{ top: "110px" }}
                onClick={() => setShowChatInput(v => !v)}
            >
                💬
            </button>

            <button
                className="toggleInput"
                style={{ top: "150px" }}
                onClick={() => setShowControls(v => !v)}
            >
                🛠
            </button>

            {showControls && (
                <div className="videoControls">
                    <button onClick={handlePlay}>▶</button>
                    <button onClick={handlePause}>⏸</button>
                    <button onClick={() => handleSeek(-10)}>⏮</button>
                    <button onClick={() => handleSeek(+10)}>⏭</button>
                </div>
            )}

            {showUrlInput && <VideoInput loadVideo={loadVideo} />}

            <ChatOverlay showChatInput={showChatInput} />
        </div>
    );
}

const VideoInput: FC<{ loadVideo: (url: string) => void }> = memo(
    ({ loadVideo }) => {
        const [text, setText] = useState("");

        const submit = () => {
            if (!text) return;
            loadVideo(text);
            setText("");
        };

        return (
            <div className="urlInput">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Rutube ссылка"
                />
                <button onClick={submit}>Load</button>
            </div>
        );
    }
);