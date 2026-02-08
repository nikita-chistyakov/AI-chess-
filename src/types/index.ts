
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Square } from 'chess.js';
import { PiecePersonality } from '../lib/piece-personalities';

// The type for a piece object from chess.js
export interface ChessJSPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
  square: Square;
}

// An augmented piece object with app-specific data
export interface PieceInstance extends ChessJSPiece {
  id: string; // e.g., 'w_p_e2'
  name: string;
  personality: PiecePersonality;
}

// A single turn in a conversation with a piece
export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
}

// Defines the transformation for a piece's image
export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
}

// Defines the states for the strategic analysis feature
export type AnalysisState = 'idle' | 'waiting_opponent' | 'pending' | 'ready' | 'error';

// Defines the injection status of the strategy into the live session
export type StrategyInjectionStatus = 'none' | 'queued' | 'sent';

// Combined debug state for the strategy console
export interface StrategyDebugState {
    state: AnalysisState;
    result: string | null;
    prompt: string | null;
    injectionStatus: StrategyInjectionStatus;
    turnNumber: number | null;
}
