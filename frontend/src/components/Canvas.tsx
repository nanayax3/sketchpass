import {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
  useCallback,
  useState,
} from 'react';
import { ToolType, DrawEvent } from '../types';
import { floodFill } from '../utils/floodFill';

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

interface CanvasProps {
  tool: ToolType;
  color: string;
  size: number;
  disabled?: boolean;
  onDrawEvent: (event: Omit<DrawEvent, 'type'>) => void;
  onSnapshotReady?: (data: string) => void;
  remoteCursors?: Record<string, { x: number; y: number; color: string }>;
}

export interface CanvasHandle {
  applyEvent: (event: DrawEvent) => void;
  getSnapshot: () => string;
  loadSnapshot: (data: string) => void;
  clear: () => void;
}

function getPos(canvas: HTMLCanvasElement, e: MouseEvent | Touch): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ tool, color, size, disabled, onDrawEvent, onSnapshotReady, remoteCursors }, ref) => {
    const mainRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const lastPos = useRef({ x: 0, y: 0 });
    const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Remote drawing state per author
    const remoteDrawing = useRef<Record<string, { lastX: number; lastY: number }>>({});

    function getCtx() {
      return mainRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
    }

    function getOverlay() {
      return overlayRef.current?.getContext('2d') ?? null;
    }

    // Initialize white background
    useEffect(() => {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }, []);

    // Schedule a snapshot upload after drawing activity
    function scheduleSnapshot() {
      if (!onSnapshotReady) return;
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
      snapshotTimer.current = setTimeout(() => {
        const data = mainRef.current?.toDataURL('image/png') ?? '';
        if (data) onSnapshotReady(data);
      }, 3000);
    }

    function applyBrushSegment(
      ctx: CanvasRenderingContext2D,
      x1: number, y1: number,
      x2: number, y2: number,
      brushColor: string,
      brushSize: number,
      eraser: boolean
    ) {
      ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = eraser ? 'rgba(0,0,0,1)' : brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawShape(
      ctx: CanvasRenderingContext2D,
      shapeTool: 'line' | 'rect' | 'circle',
      x1: number, y1: number, x2: number, y2: number,
      shapeColor: string,
      shapeSize: number
    ) {
      ctx.strokeStyle = shapeColor;
      ctx.lineWidth = shapeSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (shapeTool === 'line') {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (shapeTool === 'rect') {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (shapeTool === 'circle') {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        ctx.ellipse(
          Math.min(x1, x2) + rx,
          Math.min(y1, y2) + ry,
          rx, ry, 0, 0, Math.PI * 2
        );
        ctx.stroke();
      }
    }

    // Apply an event from the remote peer
    const applyEvent = useCallback((event: DrawEvent) => {
      const ctx = getCtx();
      if (!ctx) return;
      const author = event.author ?? '_remote';

      if (event.tool === 'brush' || event.tool === 'eraser') {
        const x = event.x ?? 0;
        const y = event.y ?? 0;
        if (event.phase === 'start') {
          remoteDrawing.current[author] = { lastX: x, lastY: y };
          // Draw a dot on start
          applyBrushSegment(ctx, x, y, x, y, event.color, event.size, event.tool === 'eraser');
        } else if (event.phase === 'move') {
          const prev = remoteDrawing.current[author];
          if (prev) {
            applyBrushSegment(ctx, prev.lastX, prev.lastY, x, y, event.color, event.size, event.tool === 'eraser');
            remoteDrawing.current[author] = { lastX: x, lastY: y };
          }
        } else if (event.phase === 'end') {
          delete remoteDrawing.current[author];
        }
      } else if (event.tool === 'fill') {
        floodFill(ctx, event.x ?? 0, event.y ?? 0, event.color);
      } else if (event.tool === 'line' || event.tool === 'rect' || event.tool === 'circle') {
        drawShape(ctx, event.tool, event.x1 ?? 0, event.y1 ?? 0, event.x2 ?? 0, event.y2 ?? 0, event.color, event.size);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      applyEvent,
      getSnapshot: () => mainRef.current?.toDataURL('image/png') ?? '',
      loadSnapshot: (data: string) => {
        const ctx = getCtx();
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.drawImage(img, 0, 0);
        };
        img.src = data;
      },
      clear: () => {
        const ctx = getCtx();
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      },
    }), [applyEvent]);

    // --- Mouse/Touch handlers ---

    const handlePointerDown = useCallback((x: number, y: number) => {
      if (disabled) return;
      const ctx = getCtx();
      if (!ctx) return;

      isDrawing.current = true;
      startPos.current = { x, y };
      lastPos.current = { x, y };

      if (tool === 'fill') {
        floodFill(ctx, x, y, color);
        onDrawEvent({ tool: 'fill', x, y, color, size });
        scheduleSnapshot();
        return;
      }

      if (tool === 'brush' || tool === 'eraser') {
        applyBrushSegment(ctx, x, y, x, y, color, size, tool === 'eraser');
        onDrawEvent({ tool, phase: 'start', x, y, color, size });
      }
      // shapes: just record start, preview on overlay
    }, [disabled, tool, color, size, onDrawEvent]);

    const handlePointerMove = useCallback((x: number, y: number) => {
      if (!isDrawing.current || disabled) return;
      const ctx = getCtx();
      const overlay = getOverlay();
      if (!ctx) return;

      if (tool === 'brush' || tool === 'eraser') {
        applyBrushSegment(ctx, lastPos.current.x, lastPos.current.y, x, y, color, size, tool === 'eraser');
        onDrawEvent({ tool, phase: 'move', x, y, color, size });
        lastPos.current = { x, y };
      } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
        // Preview on overlay canvas
        if (overlay) {
          overlay.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          drawShape(overlay, tool, startPos.current.x, startPos.current.y, x, y, color, size);
        }
      }
    }, [disabled, tool, color, size, onDrawEvent]);

    const handlePointerUp = useCallback((x: number, y: number) => {
      if (!isDrawing.current || disabled) return;
      isDrawing.current = false;

      const ctx = getCtx();
      const overlay = getOverlay();
      if (!ctx) return;

      if (tool === 'brush' || tool === 'eraser') {
        onDrawEvent({ tool, phase: 'end', x, y, color, size });
        scheduleSnapshot();
      } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
        if (overlay) overlay.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawShape(ctx, tool, startPos.current.x, startPos.current.y, x, y, color, size);
        onDrawEvent({ tool, x1: startPos.current.x, y1: startPos.current.y, x2: x, y2: y, color, size });
        scheduleSnapshot();
      }
    }, [disabled, tool, color, size, onDrawEvent]);

    // Mouse events
    useEffect(() => {
      const canvas = overlayRef.current;
      if (!canvas) return;

      const onMouseDown = (e: MouseEvent) => {
        const { x, y } = getPos(canvas, e);
        handlePointerDown(x, y);
      };
      const onMouseMove = (e: MouseEvent) => {
        const { x, y } = getPos(canvas, e);
        handlePointerMove(x, y);
      };
      const onMouseUp = (e: MouseEvent) => {
        const { x, y } = getPos(canvas, e);
        handlePointerUp(x, y);
      };

      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, [handlePointerDown, handlePointerMove, handlePointerUp]);

    // Touch events
    useEffect(() => {
      const canvas = overlayRef.current;
      if (!canvas) return;

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        const { x, y } = getPos(canvas, t);
        handlePointerDown(x, y);
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        const { x, y } = getPos(canvas, t);
        handlePointerMove(x, y);
      };
      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const { x, y } = getPos(canvas, t);
        handlePointerUp(x, y);
      };

      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
      };
    }, [handlePointerDown, handlePointerMove, handlePointerUp]);

    const cursorStyle = disabled ? 'not-allowed' :
      tool === 'fill' ? 'crosshair' :
      tool === 'eraser' ? 'cell' : 'crosshair';

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#111', overflow: 'hidden' }}>
          {/* Main drawing canvas */}
          <canvas
            ref={mainRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
          {/* Overlay: shape previews + cursor interaction */}
          <canvas
            ref={overlayRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              cursor: cursorStyle,
              touchAction: 'none',
            }}
          />
          {/* Remote cursors */}
          {remoteCursors && Object.entries(remoteCursors).map(([name, cursor]) => {
            const el = overlayRef.current;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const px = (cursor.x / CANVAS_WIDTH) * rect.width;
            const py = (cursor.y / CANVAS_HEIGHT) * rect.height;
            return (
              <div key={name} style={{
                position: 'absolute', left: px, top: py,
                pointerEvents: 'none', transform: 'translate(-4px, -4px)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cursor.color, border: '2px solid white' }} />
                <span style={{ fontSize: 10, color: cursor.color, background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 4, whiteSpace: 'nowrap' }}>{name}</span>
              </div>
            );
          })}
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
