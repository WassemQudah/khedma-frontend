import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as signalR from "@microsoft/signalr";
import api from "../api/axios";
import { HUB_URL } from "../config/config";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { pickDateLocale } from "../utils/dateLocale";
import "../styles/Chat.css";

export default function Chat() {
  const { bookingId } = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const { t }         = useTranslation("chat");
  const { t: tc, i18n } = useTranslation("common");

  const CONN_STATE = useMemo(() => ({
    connecting:   { label: t("conn.connecting"),   mod: "connecting" },
    connected:    { label: t("conn.connected"),     mod: "connected"  },
    reconnecting: { label: t("conn.reconnecting"), mod: "reconnecting" },
    disconnected: { label: t("conn.disconnected"),  mod: "disconnected" },
  }), [t]);

  const [messages,   setMessages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [text,       setText]       = useState("");
  const [sending,    setSending]    = useState(false);
  const [sendError,  setSendError]  = useState("");
  const [connState,  setConnState]  = useState("connecting");

  const connRef   = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const myId = Number(user?.nameid ?? user?.id ?? user?.userId ?? -1);

  const isOwn = (msg) => Number(msg.senderId) === myId;

  const locale = pickDateLocale(i18n.language);

  const formatTime = (iso) => {
    if (!iso) return "";
    // If the backend returns UTC without 'Z', append it so the browser converts to local time
    const utcIso = iso.endsWith("Z") ? iso : `${iso}Z`;
    const d = new Date(utcIso);
    const now = new Date();
    const today = d.toDateString() === now.toDateString();
    if (today) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return (
      `${d.toLocaleDateString(locale, { day: "2-digit", month: "short" })} ${d.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    );
  };

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.messageId === msg.messageId)) return prev;
      return [...prev, msg];
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/api/Chat/${bookingId}`);
        const list = Array.isArray(data) ? data : (data.messages ?? data.data ?? []);
        setMessages(list);
      } catch (err) {
        setError(err.response?.data?.message || t("loadHistoryFallback"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bookingId, t]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
        transport:
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connRef.current = connection;

    connection.onreconnecting(() => setConnState("reconnecting"));
    connection.onreconnected(async () => {
      setConnState("connected");
      try { await connection.invoke("JoinChatRoom", Number(bookingId)); } catch { /* silent */ }
    });
    connection.onclose(() => setConnState("disconnected"));

    connection.on("ReceiveMessage", (msg) => {
      appendMessage({
        messageId:  msg.messageId,
        senderId:   msg.senderId,
        senderName: msg.senderName,
        content:    msg.content,
        sentAt:     msg.sentAt,
      });
    });

    const start = async () => {
      setConnState("connecting");
      try {
        await connection.start();
        setConnState("connected");
        await connection.invoke("JoinChatRoom", Number(bookingId));
      } catch (err) {
        console.error("[SignalR] start failed:", err);
        setConnState("disconnected");
      }
    };

    start();

    return () => {
      connection.stop();
    };
  }, [bookingId, appendMessage]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const conn = connRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
      setSendError(t("notConnectedSend"));
      return;
    }

    setSending(true);
    setSendError("");
    try {
      await conn.invoke("SendMessage", Number(bookingId), trimmed);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("[SignalR] SendMessage failed:", err);
      setSendError(t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const cs = CONN_STATE[connState] ?? CONN_STATE.disconnected;

  return (
    <div className="chat-page page-wrapper">
      <div className="container chat-container">

        <div className="chat-header card">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
            <i className="ri-arrow-left-line" /> {tc("back")}
          </button>
          <div className="chat-header__info">
            <i className="ri-chat-3-line chat-header__icon" />
            <div>
              <p className="chat-header__title">{t("bookingChatTitle")}</p>
              <p className="chat-header__sub">{t("bookingNumber", { id: bookingId })}</p>
            </div>
          </div>
          <div className={`chat-conn-badge chat-conn-badge--${cs.mod}`}>
            <span className="chat-conn-dot" />
            {cs.label}
          </div>
        </div>

        <div className="chat-body card">
          {loading ? (
            <div className="chat-loading">
              <LoadingSpinner text={tc("loadingMessages")} />
            </div>
          ) : error ? (
            <div className="alert alert--error">
              <i className="ri-error-warning-fill" /> {error}
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => window.location.reload()}
              >
                {tc("retry")}
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <i className="ri-chat-off-line" />
              <p>{t("emptyThread")}</p>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map((msg, i) => {
                const own = isOwn(msg);
                const textBody = msg.content ?? msg.message ?? msg.text ?? "";
                const time = msg.sentAt ?? msg.createdAt ?? msg.timestamp;
                const name = msg.senderName ?? msg.sender ?? t("titles.userFallback");
                return (
                  <div
                    key={msg.messageId ?? i}
                    className={`chat-msg ${own ? "chat-msg--own" : "chat-msg--other"}`}
                  >
                    {!own && (
                      <div className="chat-msg__avatar">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="chat-msg__bubble">
                      {!own && <p className="chat-msg__name">{name}</p>}
                      <p className="chat-msg__text">{textBody}</p>
                      <p className="chat-msg__time">{formatTime(time)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form className="chat-input-bar card" onSubmit={handleSend}>
          {sendError && (
            <p className="chat-send-error">
              <i className="ri-error-warning-line" /> {sendError}
            </p>
          )}
          {connState === "disconnected" && (
            <p className="chat-send-error">
              <i className="ri-wifi-off-line" /> {t("connectionLostBanner")}
            </p>
          )}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-textarea"
              placeholder={t("textareaPlaceholder")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              disabled={sending || connState === "disconnected"}
            />
            <button
              type="submit"
              className="btn btn--primary chat-send-btn"
              aria-label={t("sendAria")}
              disabled={!text.trim() || sending || connState !== "connected"}
            >
              {sending
                ? <LoadingSpinner size="sm" />
                : <i className="ri-send-plane-fill" />
              }
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
