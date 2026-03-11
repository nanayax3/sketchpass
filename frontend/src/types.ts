export type ToolType = 'brush' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle';

export interface DrawEvent {
  type: 'draw';
  tool: ToolType;
  // For brush/eraser strokes
  phase?: 'start' | 'move' | 'end';
  x?: number;
  y?: number;
  // For shapes
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Common
  color: string;
  size: number;
  // Set by server
  author?: string;
}

export interface ClearEvent {
  type: 'clear';
  author?: string;
}

export interface CanvasStateEvent {
  type: 'canvas_state';
  data: string;
}

export interface YourTurnEvent {
  type: 'your_turn';
  canvasData: string;
  from: string;
}

export interface UserJoinedEvent {
  type: 'user_joined';
  name: string;
  color: string;
}

export interface UserLeftEvent {
  type: 'user_left';
  name: string;
}

export interface RoomStateEvent {
  type: 'room_state';
  users: Array<{ name: string; color: string }>;
  userCount: number;
}

export interface CursorEvent {
  type: 'cursor';
  x: number;
  y: number;
  name: string;
  color: string;
}

export type ServerMessage =
  | DrawEvent
  | ClearEvent
  | CanvasStateEvent
  | YourTurnEvent
  | UserJoinedEvent
  | UserLeftEvent
  | RoomStateEvent
  | CursorEvent;

export interface RoomUser {
  name: string;
  color: string;
}
