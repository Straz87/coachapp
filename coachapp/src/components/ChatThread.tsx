"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export default function ChatThread({
  currentUserId,
  peerId,
  peerName,
}: {
  currentUserId: string;
  peerId: string;
  peerName: string;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (isMounted) setMessages(data || []);
    }

    load();

    const channel = supabase
      .channel(`chat-${[currentUserId, peerId].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const belongsToThread =
            (m.sender_id === currentUserId && m.receiver_id === peerId) ||
            (m.sender_id === peerId && m.receiver_id === currentUserId);
          if (belongsToThread) {
            setMessages((prev) => [...prev, m]);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, peerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const content = text.trim();
    setText("");

    await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: peerId,
      content,
    });
  }

  return (
    <div className="card flex flex-col h-[70vh]">
      <div className="pb-3 mb-3 border-b border-gray-100 font-semibold">{peerName}</div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-3 py-2 rounded-2xl text-sm max-w-[75%] ${
                  mine ? "bg-brand text-brand-dark" : "bg-gray-100 text-gray-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Nessun messaggio ancora. Scrivi per iniziare!</p>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-gray-100 mt-3">
        <input
          className="input flex-1"
          placeholder="Scrivi un messaggio…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Invia
        </button>
      </form>
    </div>
  );
}
