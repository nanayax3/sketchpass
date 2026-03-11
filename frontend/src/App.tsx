import { useState, useRef, useCallback, useEffect } from 'react';
import { JoinScreen } from './components/JoinScreen';
import { Canvas, CanvasHandle } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { useRoom } from './hooks/useRoom';
import { ToolType, ServerMessage, DrawEvent } from './types';

interface SessionInfo {
  name: string;
  color: string;
  roomId: string;
}

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tool, setTool] = useState<ToolType>('brush');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(8);
  const [passMode, setPassMode] = useState(false);
  const [isYourTurn, setIsYourTurn] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'draw':
        canvasRef.current?.applyEvent(msg as DrawEvent);
        break;

      case 'canvas_state':
        canvasRef.current?.loadSnapshot(msg.data);
        break;

      case 'your_turn':
        canvasRef.current?.loadSnapshot(msg.canvasData);
        setIsYourTurn(true);
        showNotification(`${msg.from} passed the canvas to you ✏️`);
        break;

      case 'clear':
        canvasRef.current?.clearAndSnapshot();
        showNotification(`${msg.author ?? 'Someone'} cleared the canvas`);
        break;

      case 'request_snapshot': {
        const snap = canvasRef.current?.getSnapshot();
        if (snap) sendSnapshot(snap);
        break;
      }

      case 'user_joined':
        showNotification(`${msg.name} joined`);
        break;

      case 'user_left':
        showNotification(`${msg.name} left`);
        break;
    }
  }, []);

  const { status, sendDraw, sendClear, sendPass, sendSnapshot } = useRoom(
    session
      ? { roomId: session.roomId, userName: session.name, userColor: session.color, onMessage: handleMessage }
      : { roomId: '', userName: '', userColor: '', onMessage: handleMessage }
  );

  function showNotification(text: string) {
    setNotification(text);
    setTimeout(() => setNotification(null), 3000);
  }

  function handleJoin(name: string, color: string, roomId: string) {
    setSession({ name, color, roomId });
  }

  const handleDrawEvent = useCallback((event: Omit<DrawEvent, 'type'>) => {
    if (passMode && !isYourTurn) return;
    sendDraw(event);
  }, [passMode, isYourTurn, sendDraw]);

  function handleClear() {
    const whiteSnapshot = canvasRef.current?.clearAndSnapshot() ?? '';
    sendClear();
    // Immediately push the white canvas snapshot so the DO stays in sync
    if (whiteSnapshot) sendSnapshot(whiteSnapshot);
  }

  function handlePass() {
    if (!isYourTurn) return;
    const snapshot = canvasRef.current?.getSnapshot() ?? '';
    sendPass(snapshot);
    setIsYourTurn(false);
    showNotification('Canvas passed! Waiting for the other person...');
  }

  function handleTogglePassMode() {
    setPassMode(p => !p);
    setIsYourTurn(true);
  }

  const handleSnapshotReady = useCallback((data: string) => {
    sendSnapshot(data);
  }, [sendSnapshot]);

  if (!session) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  const isDisabled = passMode && !isYourTurn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#111' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px', background: '#16161e', borderBottom: '1px solid #333',
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>✏️ Sketchpass</span>
        <span style={{
          background: '#2d2d3e', color: '#aaa', fontSize: 12, fontWeight: 700,
          padding: '3px 8px', borderRadius: 6, letterSpacing: 2,
        }}>
          {session.roomId}
        </span>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: status === 'connected' ? '#44cc88' : status === 'connecting' ? '#ff9944' : '#cc4444',
        }} />
        <span style={{ color: '#666', fontSize: 12 }}>
          {status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting…' : 'disconnected'}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: session.color }} />
          <span style={{ color: '#aaa', fontSize: 13 }}>{session.name}</span>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        tool={tool}
        color={color}
        size={size}
        passMode={passMode}
        isYourTurn={isYourTurn}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onClear={handleClear}
        onPass={handlePass}
        onTogglePassMode={handleTogglePassMode}
      />

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Canvas
          ref={canvasRef}
          tool={tool}
          color={color}
          size={size}
          disabled={isDisabled}
          onDrawEvent={handleDrawEvent}
          onSnapshotReady={handleSnapshotReady}
        />

        {/* Disabled overlay */}
        {isDisabled && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)', pointerEvents: 'none',
          }}>
            <div style={{
              background: '#1e1e2e', borderRadius: 12, padding: '16px 28px',
              color: '#fff', fontSize: 16, fontWeight: 600, border: '1px solid #444',
            }}>
              ⏳ Waiting for the other person...
            </div>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1e1e2e', color: '#fff', padding: '10px 20px', borderRadius: 10,
          border: '1px solid #444', fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 100,
          animation: 'fadein 0.2s ease',
        }}>
          {notification}
        </div>
      )}
    </div>
  );
}
