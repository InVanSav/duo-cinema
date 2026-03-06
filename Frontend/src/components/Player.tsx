import {
    useEffect,
    useRef,
    useState,
    useCallback,
    memo, type FC
} from "react";
import ChatOverlay from "./ChatOverlay";
import "./Player.css";
import { connection } from "../signalr";

export default function Player() {
    const [videoEmbed, setVideoEmbed] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showChatInput, setShowChatInput] = useState(true);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    // Преобразование URL в embed формат
    const toEmbedUrl = useCallback((url: string) => {
        const match = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        return match ? `https://rutube.ru/play/embed/${match[1]}` : url;
    }, []);

    useEffect(() => {
        connection.on("Video", (url: string) => {
            const embed = toEmbedUrl(url);
            setVideoEmbed(embed);
        });

        return () => {
            connection.off("Video");
        };
    }, [toEmbedUrl]);

    // Загрузка нового видео
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