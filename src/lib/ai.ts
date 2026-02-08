
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Chess, Move } from 'chess.js';

// Material weights (scaled up to allow for positional granularity)
// p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (White perspective)
// 8x8 grid. Row 0 is Rank 8 (top of board). Row 7 is Rank 1 (bottom of board).

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,   0,  5,  5,  5,  5,  0, -5],
  [0,    0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

// King safety table (Middle game focused)
const KING_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const PSTS: Record<string, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_PST,
};


function evaluateBoard(game: Chess): number {
  let totalValue = 0;
  const board = game.board();

  // Iterate through the board array (8x8)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const materialValue = PIECE_VALUES[piece.type];
        let positionValue = 0;
        
        const pst = PSTS[piece.type];
        if (pst) {
           if (piece.color === 'w') {
             // White: Use table as is
             positionValue = pst[row][col];
           } else {
             // Black: Mirror the table (flip rows)
             // Row 0 for black is like Row 7 for white
             positionValue = pst[7 - row][col];
           }
        }

        const pieceScore = materialValue + positionValue;
        
        if (piece.color === 'w') {
          totalValue += pieceScore;
        } else {
          totalValue -= pieceScore;
        }
      }
    }
  }
  return totalValue;
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, isMaximizingPlayer: boolean): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves({ verbose: true });
  
  // Sort moves to improve pruning (Captures first)
  moves.sort((a, b) => {
      // Prioritize captures for better alpha-beta pruning efficiency
      if (a.captured && !b.captured) return -1;
      if (!a.captured && b.captured) return 1;
      return 0;
  });

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const gameCopy = new Chess(game.fen());
      gameCopy.move(move);
      const evaluation = minimax(gameCopy, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const gameCopy = new Chess(game.fen());
      gameCopy.move(move);
      const evaluation = minimax(gameCopy, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function findTopMoves(game: Chess, depth: number, count: number): { move: Move, evaluation: number }[] {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return [];

  const isMaximizingPlayer = game.turn() === 'w';
  const moveEvaluations: { move: Move; evaluation: number }[] = [];

  for (const move of moves) {
    const gameCopy = new Chess(game.fen());
    gameCopy.move(move);
    const evaluation = minimax(gameCopy, depth - 1, -Infinity, Infinity, !isMaximizingPlayer);
    moveEvaluations.push({ move, evaluation });
  }

  moveEvaluations.sort((a, b) => isMaximizingPlayer ? b.evaluation - a.evaluation : a.evaluation - b.evaluation);

  return moveEvaluations.slice(0, count);
}

export function findBestMove(game: Chess, depth: number): { bestMove: Move | null, evaluation: number } {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return { bestMove: null, evaluation: evaluateBoard(game) };

  // Prioritize captures in the root search too for potentially better first-guess
  moves.sort((a, b) => (a.captured ? 1 : 0) > (b.captured ? 1 : 0) ? -1 : 1);

  let bestMove = moves[0];
  const isMaximizingPlayer = game.turn() === 'w';
  let bestValue = isMaximizingPlayer ? -Infinity : Infinity;

  for (const move of moves) {
    const gameCopy = new Chess(game.fen());
    gameCopy.move(move);
    const boardValue = minimax(gameCopy, depth - 1, -Infinity, Infinity, !isMaximizingPlayer);

    if (isMaximizingPlayer) {
      if (boardValue > bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    } else {
      if (boardValue < bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    }
  }

  return { bestMove, evaluation: bestValue };
}
