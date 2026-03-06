import {useEffect, useState} from "react";
import ChatOverlay from "./ChatOverlay";
import "./Player.css";
import {connection} from "../signalr.ts";

export default function Player() {

    const [video, setVideo] = useState("");
    const [showInput, setShowInput] = useState(false);
    const [showChatInput, setShowChatInput] = useState(true);

    useEffect(() => {
        connection.on("Video", (url: string) => {
            setVideo(toEmbed(url));
        });
    }, []);

    const loadVideo = (url: string) => {
        connection.invoke("Video", toEmbed(url));
    };

    const toEmbed = (url: string) => {
        const m = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        if (m)
            return `https://rutube.ru/play/embed/${m[1]}`;

        return url;
    }

    return (
        <div className="player">
            {video && (
                <iframe
                    className="video"
                    src={video}
                    allowFullScreen
                />
            )}
            <button
                className="toggleInput"
                onClick={() => setShowInput(v => !v)}
            >
                🎬
            </button>
            <button
                className="toggleInput"
                style={{ top: "90px" }}  // смещаем вниз на 40px от первой
                onClick={() => setShowChatInput(v => !v)}
            >
                💬
            </button>
            {showInput && (
                <VideoInput loadVideo={loadVideo}/>
            )}
            <ChatOverlay showChatInput={showChatInput} />

        </div>
    );
}

function VideoInput({loadVideo}: { loadVideo: (u: string) => void }) {
    const [url, setUrl] = useState("");

    const submit = () => {
        if (!url) return;

        loadVideo(url);
        setUrl("");
    };

    return (
        <div className="urlInput">
            <input
                placeholder="rutube link"
                value={url}
                onChange={e => setUrl(e.target.value)}
            />
            <button onClick={submit}>
                load
            </button>
        </div>
    );
}