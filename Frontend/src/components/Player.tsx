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
    const lastSentTimeRef = useRef<number>(0);

    // Конвертация ссылки в embed с API параметрами
    const toEmbed = useCallback((url: string) => {
        const rutubeMatch = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        if (rutubeMatch) {
            return `https://rutube.ru/play/embed/${rutubeMatch[1]}?api=1`;
        }
        return url;
    }, []);

    // Rutube API команды
    const sendRutubeCommand = useCallback((command: string, value?: any) => {
        if (iframeRef.current?.contentWindow) {
            const message = {
                type: 'player',
                command: command,
                value: value
            };
            console.log('🎮 Sending command to Rutube:', command, value);
            iframeRef.current.contentWindow.postMessage(JSON.stringify(message), 'https://rutube.ru');
        }
    }, []);

    // Отправка команд на сервер
    const notifyServer = useCallback((action: string, time: number) => {
        // Защита от спама
        if (Date.now() - lastSentTimeRef.current < 100) return;
        lastSentTimeRef.current = Date.now();

        console.log(`📤 SENDING ${action} to server:`, time);
        connection.invoke(action, time)
            .catch(err => console.error(`Error sending ${action}:`, err));
    }, []);

    // Обработка сообщений от Rutube iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== 'https://rutube.ru') return;

            try {
                const data = JSON.parse(event.data);

                // Обработка разных типов событий
                if (data.type === 'player:ready') {
                    playerReadyRef.current = true;
                    console.log('✅ Rutube player ready');
                    sendRutubeCommand('getStatus');
                }

                else if (data.type === 'player:currentTime' && data.data) {
                    const time = data.data.time || data.data.currentTime;
                    if (time !== undefined) {
                        setCurrentTime(time);
                    }
                }

                else if (data.type === 'player:changeState' && data.data) {
                    const newState = data.data.state || data.data.status;
                    console.log('📺 State change:', newState);

                    if (newState === 'play' || newState === 'playing') {
                        setIsPlaying(true);
                        if (!ignoreNextEventRef.current) {
                            notifyServer('Play', currentTime);
                        }
                    }
                    else if (newState === 'pause' || newState === 'paused') {
                        setIsPlaying(false);
                        if (!ignoreNextEventRef.current) {
                            notifyServer('Pause', currentTime);
                        }
                    }
                    ignoreNextEventRef.current = false;
                }

                else if (data.type === 'player:seek' || data.type === 'player:seeked') {
                    const time = data.data?.time || data.data?.currentTime;
                    if (time !== undefined) {
                        setCurrentTime(time);
                        if (!ignoreNextEventRef.current) {
                            notifyServer('Seek', time);
                        }
                    }
                    ignoreNextEventRef.current = false;
                }

                else if (data.type === 'player:playStart') {
                    setIsPlaying(true);
                    if (!ignoreNextEventRef.current) {
                        notifyServer('Play', currentTime);
                    }
                    ignoreNextEventRef.current = false;
                }

            } catch (e) {
                // Не JSON сообщение
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentTime, notifyServer]);

    // SignalR обработчики (получение команд от сервера)
    useEffect(() => {
        connection.on("Video", (url: string) => {
            console.log('📥 RECEIVED Video from server:', url);
            setVideo(toEmbed(url));
            setCurrentTime(0);
            setIsPlaying(false);
            playerReadyRef.current = false;
        });

        connection.on("Play", (time: number) => {
            console.log('📥 RECEIVED Play from server:', time);
            ignoreNextEventRef.current = true;

            if (!playerReadyRef.current) {
                console.log('Player not ready yet');
                return;
            }

            // Перематываем если нужно
            if (Math.abs(time - currentTime) > 1) {
                sendRutubeCommand('seek', time);
                setTimeout(() => {
                    sendRutubeCommand('play');
                }, 200);
            } else {
                sendRutubeCommand('play');
            }
        });

        connection.on("Pause", (time: number) => {
            console.log('📥 RECEIVED Pause from server:', time);
            ignoreNextEventRef.current = true;

            if (!playerReadyRef.current) {
                console.log('Player not ready yet');
                return;
            }

            // Перематываем если нужно
            if (Math.abs(time - currentTime) > 1) {
                sendRutubeCommand('seek', time);
                setTimeout(() => {
                    sendRutubeCommand('pause');
                }, 200);
            } else {
                sendRutubeCommand('pause');
            }
        });

        connection.on("Seek", (time: number) => {
            console.log('📥 RECEIVED Seek from server:', time);
            ignoreNextEventRef.current = true;

            if (!playerReadyRef.current) {
                console.log('Player not ready yet');
                return;
            }

            sendRutubeCommand('seek', time);
        });

        return () => {
            connection.off("Video");
            connection.off("Play");
            connection.off("Pause");
            connection.off("Seek");
        };
    }, [currentTime, sendRutubeCommand, toEmbed]);

    // Периодическая синхронизация времени
    useEffect(() => {
        if (!video || !playerReadyRef.current || !isPlaying) return;

        const syncInterval = setInterval(() => {
            sendRutubeCommand('getCurrentTime');
        }, 5000);

        return () => clearInterval(syncInterval);
    }, [video, isPlaying, sendRutubeCommand]);

    const loadVideo = (url: string) => {
        console.log('📤 SENDING Video to server:', url);
        connection.invoke("Video", url)
            .catch(err => console.error('Error sending Video:', err));
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
                    onLoad={() => console.log('Iframe loaded:', video)}
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

            {/* Отладочная информация */}
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                zIndex: 1000,
                fontSize: '12px'
            }}>
                <div>Time: {currentTime.toFixed(1)}s</div>
                <div>State: {isPlaying ? '▶️ Playing' : '⏸️ Paused'}</div>
                <div>Ready: {playerReadyRef.current ? '✅' : '❌'}</div>
            </div>
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