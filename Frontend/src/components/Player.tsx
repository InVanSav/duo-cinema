import {useEffect, useRef, useState, useCallback} from "react";
import ChatOverlay from "./ChatOverlay";
import "./Player.css";
import {connection} from "../signalr.ts";

export default function Player() {
    const [video, setVideo] = useState("");
    const [showInput, setShowInput] = useState(false);
    const [showChatInput, setShowChatInput] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const playerReadyRef = useRef<boolean>(false);
    const ignoreNextEventRef = useRef<boolean>(false);

    const toEmbed = useCallback((url: string) => {
        const rutubeMatch = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        if (rutubeMatch) {
            return `https://rutube.ru/play/embed/${rutubeMatch[1]}?api=1`;
        }
        return url;
    }, []);

    const sendRutubeCommand = useCallback((command: string, value?: any) => {
        if (iframeRef.current?.contentWindow) {
            const message = {
                type: 'player',
                command: command,
                value: value
            };
            iframeRef.current.contentWindow.postMessage(JSON.stringify(message), 'https://rutube.ru');
        }
    }, []);

    // Обработка сообщений от Rutube
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== 'https://rutube.ru') return;

            try {
                const data = JSON.parse(event.data);

                if (data.type === 'player:ready') {
                    playerReadyRef.current = true;
                }

                if (data.type === 'player:currentTime' && data.data) {
                    const time = data.data.time || data.data.currentTime;
                    if (time !== undefined) {
                        setCurrentTime(time);
                    }
                }

                if (data.type === 'player:changeState' && data.data) {
                    const newState = data.data.state || data.data.status;

                    if (newState === 'play' || newState === 'playing') {
                        setIsPlaying(true);
                        if (!ignoreNextEventRef.current) {
                            connection.invoke('Play', currentTime).catch(() => {});
                        }
                    }
                    else if (newState === 'pause' || newState === 'paused') {
                        setIsPlaying(false);
                        if (!ignoreNextEventRef.current) {
                            connection.invoke('Pause', currentTime).catch(() => {});
                        }
                    }

                    if (ignoreNextEventRef.current) {
                        ignoreNextEventRef.current = false;
                    }
                }

                if (data.type === 'player:playStart') {
                    setIsPlaying(true);
                    if (!ignoreNextEventRef.current) {
                        connection.invoke('Play', currentTime).catch(() => {});
                    } else {
                        ignoreNextEventRef.current = false;
                    }
                }

            } catch (e) {}
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentTime]);

    // Получение команд от сервера
    useEffect(() => {
        connection.on("Video", (url: string) => {
            setVideo(toEmbed(url));
            setCurrentTime(0);
            setIsPlaying(false);
            playerReadyRef.current = false;
            ignoreNextEventRef.current = false;
        });

        connection.on("Play", (time: number) => {
            if (!playerReadyRef.current) return;

            ignoreNextEventRef.current = true;

            // Сначала перематываем на нужное время
            sendRutubeCommand('seek', time);

            // Потом запускаем воспроизведение
            setTimeout(() => {
                sendRutubeCommand('play');
                setTimeout(() => {
                    ignoreNextEventRef.current = false;
                }, 500);
            }, 200);
        });

        connection.on("Pause", (time: number) => {
            if (!playerReadyRef.current) return;

            ignoreNextEventRef.current = true;

            // Сначала перематываем на нужное время
            sendRutubeCommand('seek', time);

            // Потом ставим на паузу
            setTimeout(() => {
                sendRutubeCommand('pause');
                setTimeout(() => {
                    ignoreNextEventRef.current = false;
                }, 500);
            }, 200);
        });

        return () => {
            connection.off("Video");
            connection.off("Play");
            connection.off("Pause");
        };
    }, [currentTime, sendRutubeCommand, toEmbed]);

    // Периодическая синхронизация времени
    useEffect(() => {
        if (!video || !playerReadyRef.current || !isPlaying) return;

        const timeInterval = setInterval(() => {
            sendRutubeCommand('getCurrentTime');
        }, 10000);

        return () => clearInterval(timeInterval);
    }, [video, isPlaying, sendRutubeCommand]);

    const loadVideo = (url: string) => {
        connection.invoke("Video", url).catch(() => {});
    };

    return (
        <div className="player">
            {video && (
                <iframe
                    ref={iframeRef}
                    className="video"
                    src={video}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="video-player"
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
                style={{ top: "110px" }}
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
                placeholder="Rutube ссылка"
                value={url}
                onChange={e => setUrl(e.target.value)}
            />
            <button onClick={submit}>
                load
            </button>
        </div>
    );
}