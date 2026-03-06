import {useEffect, useState} from "react";
import "./ChatOverlay.css";
import {connection} from "../signalr.ts";

type Msg = {
    id: number
    text: string
}

type Reaction = {
    id: number
    emoji: string
}

export default function ChatOverlay({ showChatInput }: { showChatInput: boolean }) {
    const [messages, setMessages] = useState<Msg[]>([]);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [text, setText] = useState("");

    useEffect(() => {
        connection.on("Chat", (msg: string) => {
            const id = Date.now();
            setMessages(m => {
                const newMessages = [...m, { text: msg, id }];
                return newMessages.slice(-5);
            });
        });

        connection.on("Reaction", (emoji: string) => {
            const id = Date.now();
            setReactions(r => [...r, { emoji, id }]);
            setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2000);
        });

        return () => {
            connection.off("Chat");
            connection.off("Reaction");
        };
    }, []);

    const send = () => {
        if (!text) return;
        connection.invoke("Chat", text);
        setText("");
    };

    return (
        <div className="chat">

            <div className="messages">
                {messages.map(m =>
                    <div key={m.id} className="msg">{m.text}</div>
                )}
            </div>

            <div className="reactions">
                {reactions.map(r =>
                    <div key={r.id} className="reaction">{r.emoji}</div>
                )}
            </div>

            {showChatInput && (
                <div className="input-wrapper">
                    <div className="input">
                        <input
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type a message..."
                        />
                        <button onClick={send}>send</button>
                    </div>
                    <div className="emoji-buttons">
                        {["❤️", "😂", "🔥", "💩", "😭"].map(e => (
                            <button key={e} onClick={() => connection.invoke("Reaction", e)}>
                                {e}
                            </button>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}