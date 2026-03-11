import { useEffect, useRef, useState, useCallback } from 'react';
import { ServerMessage, DrawEvent, RoomUser } from '../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'https://sketchpass-worker.YOUR-SUBDOMAIN.workers.dev';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseRoomOptions {
  roomId: string;
  userName: string;
  userColor: string;
  onMessage: (msg: ServerMessage) => void;
}

export function useRoom({ roomId, userName, userColor, onMessage }: UseRoomOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [users, setUsers] = useState<RoomUser[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomId || !userName) return;

    setStatus('connecting');

    const wsUrl = WORKER_URL
      .replace(/^https?:\/\//, (m) => m === 'https://' ? 'wss://' : 'ws://')
      .replace(/\/$/, '');

    const url = `${wsUrl}/room/${roomId}/ws?name=${encodeURIComponent(userName)}&color=${encodeURIComponent(userColor)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
    };
    ws.onerror = () => setStatus('error');

    ws.onmessage = (e) => {
      let data: ServerMessage;
      try { data = JSON.parse(e.data); } catch { return; }

      // Handle room-level events locally too
      if (data.type === 'room_state') {
        setUsers(data.users);
      } else if (data.type === 'user_joined') {
        setUsers(prev => {
          if (prev.find(u => u.name === data.name)) return prev;
          return [...prev, { name: data.name, color: data.color }];
        });
      } else if (data.type === 'user_left') {
        setUsers(prev => prev.filter(u => u.name !== data.name));
      }

      onMessageRef.current(data);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setStatus('disconnected');
    };
  }, [roomId, userName, userColor]);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const sendDraw = useCallback((event: Omit<DrawEvent, 'type'>) => {
    send({ type: 'draw', ...event });
  }, [send]);

  const sendClear = useCallback(() => {
    send({ type: 'clear' });
  }, [send]);

  const sendPass = useCallback((canvasData: string) => {
    send({ type: 'pass', canvasData });
  }, [send]);

  const sendSnapshot = useCallback((data: string) => {
    send({ type: 'canvas_snapshot', data });
  }, [send]);

  const sendCursor = useCallback((x: number, y: number) => {
    send({ type: 'cursor', x, y });
  }, [send]);

  return { status, users, sendDraw, sendClear, sendPass, sendSnapshot, sendCursor };
}
