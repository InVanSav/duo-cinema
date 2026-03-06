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

// Константы для команд postMessage
const RUTUBE_COMMANDS = {
    PLAY: 'player:play',
    PAUSE: 'player:pause',
    SET_CURRENT_TIME: 'player:setCurrentTime',
    GET_CURRENT_TIME: 'player:getCurrentTime',
    MUTE: 'player:mute',
    UNMUTE: 'player:unMute',
    SET_VOLUME: 'player:setVolume'
} as const;

// Типы событий от плеера
type RutubeEvent = {
    type: string;
    data: any;
};

export default function Player() {
    const [videoEmbed, setVideoEmbed] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showChatInput, setShowChatInput] = useState(true);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const lastSyncTimeRef = useRef<number>(0);
    const pendingSeekRef = useRef<number | null>(null);
    const syncIntervalRef = useRef<number>(0);
    const isLocalActionRef = useRef<boolean>(false);

    // Функция отправки команды в плеер
    const sendCommand = useCallback((type: string, data: any = {}) => {
        if (!iframeRef.current?.contentWindow) {
            console.warn('Плеер еще не инициализирован');
            return;
        }

        try {
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ type, data }),
                'https://rutube.ru'
            );
        } catch (error) {
            console.error('Ошибка отправки команды в плеер:', error);
        }
    }, []);

    // Преобразование URL в embed формат
    const toEmbedUrl = useCallback((url: string) => {
        const match = url.match(/rutube\.ru\/video\/([\w\d]+)/);
        return match ? `https://rutube.ru/play/embed/${match[1]}` : url;
    }, []);

    // Обработка команд воспроизведения
    const handlePlay = useCallback((time: number) => {
        if (!isPlayerReady) return;

        if (Math.abs(time - lastSyncTimeRef.current) > 2) {
            sendCommand(RUTUBE_COMMANDS.SET_CURRENT_TIME, { time });
            setTimeout(() => {
                sendCommand(RUTUBE_COMMANDS.PLAY);
                setIsPlaying(true);
            }, 100);
        } else {
            sendCommand(RUTUBE_COMMANDS.PLAY);
            setIsPlaying(true);
        }

        lastSyncTimeRef.current = time;
    }, [isPlayerReady, sendCommand]);

    const handlePause = useCallback((time: number) => {
        if (!isPlayerReady) return;

        if (Math.abs(time - lastSyncTimeRef.current) > 2) {
            sendCommand(RUTUBE_COMMANDS.SET_CURRENT_TIME, { time });
            setTimeout(() => {
                sendCommand(RUTUBE_COMMANDS.PAUSE);
                setIsPlaying(false);
            }, 100);
        } else {
            sendCommand(RUTUBE_COMMANDS.PAUSE);
            setIsPlaying(false);
        }

        lastSyncTimeRef.current = time;
    }, [isPlayerReady, sendCommand]);

    const handleSeek = useCallback((time: number) => {
        if (!isPlayerReady) return;

        pendingSeekRef.current = time;
        sendCommand(RUTUBE_COMMANDS.SET_CURRENT_TIME, { time });
        lastSyncTimeRef.current = time;
    }, [isPlayerReady, sendCommand]);

    // Функции для отправки событий на сервер
    const sendPlayToServer = useCallback((time: number) => {
        console.log('Отправка Play на сервер:', time);
        connection.invoke("Play", time)
            .catch(err => console.error('Ошибка отправки Play:', err));
    }, []);

    const sendPauseToServer = useCallback((time: number) => {
        console.log('Отправка Pause на сервер:', time);
        connection.invoke("Pause", time)
            .catch(err => console.error('Ошибка отправки Pause:', err));
    }, []);

    const sendSeekToServer = useCallback((time: number) => {
        console.log('Отправка Seek на сервер:', time);
        connection.invoke("Seek", time)
            .catch(err => console.error('Ошибка отправки Seek:', err));
    }, []);

    // Обработка событий от плеера
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== 'https://rutube.ru') return;

            try {
                const message: RutubeEvent = JSON.parse(event.data);

                switch (message.type) {
                    case 'player:ready':
                        console.log('Плеер готов');
                        setIsPlayerReady(true);
                        sendCommand(RUTUBE_COMMANDS.SET_VOLUME, { volume: 1 });
                        break;

                    case 'player:changeState':
                        // Получаем текущее время из плеера
                        sendCommand(RUTUBE_COMMANDS.GET_CURRENT_TIME, {});

                        if (message.data.state === 'playing') {
                            setIsPlaying(true);
                            // Если это не наше локальное действие (не от сервера)
                            if (!isLocalActionRef.current) {
                                // Отправляем событие на сервер
                                sendPlayToServer(lastSyncTimeRef.current);
                            }
                        } else if (message.data.state === 'pause') {
                            setIsPlaying(false);
                            // Если это не наше локальное действие (не от сервера)
                            if (!isLocalActionRef.current) {
                                // Отправляем событие на сервер
                                sendPauseToServer(lastSyncTimeRef.current);
                            }
                        } else if (message.data.state === 'completed') {
                            setIsPlaying(false);
                            // Видео закончилось - отправляем паузу на сервер
                            sendPauseToServer(0);
                        }
                        break;

                    case 'player:currentTime':
                        const currentTime = message.data.time;
                        lastSyncTimeRef.current = currentTime;

                        if (pendingSeekRef.current !== null) {
                            if (Math.abs(currentTime - pendingSeekRef.current) < 1) {
                                // Seek выполнен, отправляем на сервер
                                sendSeekToServer(pendingSeekRef.current);
                                pendingSeekRef.current = null;
                            }
                        }
                        break;
                }
            } catch (error) {
                // Игнорируем не-JSON сообщения
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sendCommand, sendPlayToServer, sendPauseToServer, sendSeekToServer]);

    // Периодическая синхронизация времени
    useEffect(() => {
        if (!isPlayerReady || !isPlaying) return;

        syncIntervalRef.current = window.setInterval(() => {
            sendCommand(RUTUBE_COMMANDS.GET_CURRENT_TIME, {});
        }, 5000);

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [isPlayerReady, isPlaying, sendCommand]);

    // Подписка на SignalR события
    useEffect(() => {
        connection.on("Video", (url: string) => {
            const embed = toEmbedUrl(url);
            setVideoEmbed(embed);
            setIsPlayerReady(false);
            setIsPlaying(false);
            lastSyncTimeRef.current = 0;
        });

        connection.on("Play", (time: number) => {
            // Устанавливаем флаг, что это действие от сервера
            isLocalActionRef.current = true;
            handlePlay(time);
            // Сбрасываем флаг через небольшую задержку
            setTimeout(() => {
                isLocalActionRef.current = false;
            }, 500);
        });

        connection.on("Pause", (time: number) => {
            // Устанавливаем флаг, что это действие от сервера
            isLocalActionRef.current = true;
            handlePause(time);
            // Сбрасываем флаг через небольшую задержку
            setTimeout(() => {
                isLocalActionRef.current = false;
            }, 500);
        });

        connection.on("Seek", (time: number) => {
            // Устанавливаем флаг, что это действие от сервера
            isLocalActionRef.current = true;
            handleSeek(time);
            // Сбрасываем флаг через небольшую задержку
            setTimeout(() => {
                isLocalActionRef.current = false;
            }, 500);
        });

        return () => {
            connection.off("Video");
            connection.off("Play");
            connection.off("Pause");
            connection.off("Seek");
        };
    }, [toEmbedUrl, handlePlay, handlePause, handleSeek]);

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