import { useState } from 'react';

const USER_COLORS = ['#ff6b9d', '#7c6af7', '#44cc88', '#ff9944', '#4488ff', '#cc44ff'];

interface JoinScreenProps {
  onJoin: (name: string, color: string, roomId: string) => void;
}

export function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(USER_COLORS[0]);
  const [roomId, setRoomId] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const room = tab === 'create'
      ? Math.random().toString(36).slice(2, 7).toUpperCase()
      : roomId.trim().toUpperCase();
    if (!room) return;
    onJoin(name.trim(), color, room);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', background: '#1a1a2e',
    }}>
      <div style={{
        background: '#1e1e2e', borderRadius: 16, padding: 32, width: '90%', maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid #333',
      }}>
        <h1 style={{ color: '#fff', margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
          ✏️ Sketchpass
        </h1>
        <p style={{ color: '#888', margin: '0 0 24px', fontSize: 14 }}>
          Draw together, live or turn-by-turn.
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #333' }}>
          {(['create', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === t ? '#7c6af7' : '#2d2d3e', color: '#fff',
              transition: 'background 0.15s',
            }}>
              {t === 'create' ? '+ New room' : 'Join room'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Your name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Nana"
              maxLength={24}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #444',
                background: '#2d2d3e', color: '#fff', fontSize: 15, outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Your color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {USER_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', border: color === c ? '3px solid #fff' : '3px solid transparent',
                  background: c, cursor: 'pointer', padding: 0,
                }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: '#2d2d3e' }} />
            </div>
          </div>

          {tab === 'join' && (
            <div>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Room code</label>
              <input
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                placeholder="e.g. AB3XY"
                maxLength={8}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #444',
                  background: '#2d2d3e', color: '#fff', fontSize: 18, letterSpacing: 4, outline: 'none', fontWeight: 700,
                }}
              />
            </div>
          )}

          <button type="submit" style={{
            padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#7c6af7', color: '#fff', fontSize: 16, fontWeight: 700,
            marginTop: 4, transition: 'opacity 0.15s',
          }}>
            {tab === 'create' ? 'Create room' : 'Join room'}
          </button>
        </form>
      </div>
    </div>
  );
}
