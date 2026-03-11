import { ToolType } from '../types';

const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff4444', '#ff9944',
  '#ffee44', '#44cc44', '#4488ff', '#cc44ff',
  '#ff88bb', '#884422', '#888888', '#44cccc',
];

interface ToolbarProps {
  tool: ToolType;
  color: string;
  size: number;
  passMode: boolean;
  isYourTurn: boolean;
  onToolChange: (t: ToolType) => void;
  onColorChange: (c: string) => void;
  onSizeChange: (s: number) => void;
  onClear: () => void;
  onPass: () => void;
  onTogglePassMode: () => void;
}

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'brush', label: 'Brush', icon: '✏️' },
  { id: 'eraser', label: 'Eraser', icon: '⬜' },
  { id: 'fill', label: 'Fill', icon: '🪣' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'rect', label: 'Rect', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '○' },
];

export function Toolbar({
  tool, color, size, passMode, isYourTurn,
  onToolChange, onColorChange, onSizeChange, onClear, onPass, onTogglePassMode,
}: ToolbarProps) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
      padding: '8px 12px', background: '#1e1e2e', borderBottom: '1px solid #333',
      userSelect: 'none',
    }}>
      {/* Tools */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => onToolChange(t.id)} title={t.label} style={{
            width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer',
            background: tool === t.id ? '#7c6af7' : '#2d2d3e',
            color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}>
            {t.icon}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 32, background: '#444' }} />

      {/* Size slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#aaa', fontSize: 12 }}>Size</span>
        <input
          type="range" min={1} max={60} value={size}
          onChange={e => onSizeChange(Number(e.target.value))}
          style={{ width: 80, accentColor: '#7c6af7' }}
        />
        <span style={{ color: '#aaa', fontSize: 12, minWidth: 20 }}>{size}</span>
      </div>

      <div style={{ width: 1, height: 32, background: '#444' }} />

      {/* Color picker + presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <input
          type="color" value={color}
          onChange={e => onColorChange(e.target.value)}
          style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: '#2d2d3e' }}
          title="Custom color"
        />
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => onColorChange(c)} style={{
            width: 20, height: 20, borderRadius: '50%', border: color === c ? '2px solid #7c6af7' : '2px solid #444',
            background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
          }} />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Pass mode toggle */}
      <button onClick={onTogglePassMode} title={passMode ? 'Switch to Live mode' : 'Switch to Pass mode'} style={{
        padding: '0 12px', height: 36, border: 'none', borderRadius: 6, cursor: 'pointer',
        background: passMode ? '#f7a26a' : '#2d2d3e', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        {passMode ? '🔄 Pass mode' : '⚡ Live mode'}
      </button>

      {/* Pass button (only in pass mode) */}
      {passMode && (
        <button
          onClick={onPass}
          disabled={!isYourTurn}
          title={isYourTurn ? "Pass canvas to other person" : "Waiting for other person..."}
          style={{
            padding: '0 14px', height: 36, border: 'none', borderRadius: 6, cursor: isYourTurn ? 'pointer' : 'not-allowed',
            background: isYourTurn ? '#44cc88' : '#2d2d3e', color: '#fff', fontSize: 13, fontWeight: 600,
            opacity: isYourTurn ? 1 : 0.5,
          }}
        >
          Pass →
        </button>
      )}

      {/* Clear */}
      <button onClick={onClear} title="Clear canvas" style={{
        padding: '0 12px', height: 36, border: 'none', borderRadius: 6, cursor: 'pointer',
        background: '#cc4444', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        Clear
      </button>
    </div>
  );
}
