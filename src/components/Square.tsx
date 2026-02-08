
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Square as ChessJSSquare, Piece } from 'chess.js';
import { hexToRgba } from '../lib/utils';

interface SquareProps {
  squareName: ChessJSSquare;
  isLight: boolean;
  pieceOnSquare: Piece | null;
  isSelected: boolean;
  isChatting: boolean;
  isRecording: boolean;
  userVolume: number;
  onSquareClick: (square: ChessJSSquare) => void;
  onSquareHover: (square: ChessJSSquare | null) => void;
  isOrbOver: boolean;
}

const Square: React.FC<SquareProps> = ({
  squareName, isLight, pieceOnSquare, isSelected,
  isChatting, isRecording, userVolume, onSquareClick, onSquareHover, isOrbOver
}) => {
  let pieceDescription = 'Empty square';
  if (pieceOnSquare) {
    const pieceTypeMap = {p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king"};
    pieceDescription = `${pieceOnSquare.color === 'w' ? 'White' : 'Black'} ${pieceTypeMap[pieceOnSquare.type]}`;
  }

  const classNames = [
    'square',
    isLight ? 'light' : 'dark',
    isSelected ? 'selected' : '',
    isOrbOver ? 'orb-over' : '',
  ].filter(Boolean).join(' ');


  let userGlowElement: React.ReactNode = null;
  if (isChatting && isRecording && userVolume > 0.02) {
    const playerGlowColor = '#FFFFFF'; // Hardcoded player glow
    const glowIntensity = userVolume * 2.5;
    const blur = 10 + glowIntensity * 25;
    const alpha = Math.min(1, 0.5 + glowIntensity);
    const glowRgba = hexToRgba(playerGlowColor, alpha);
    const spread = 2 + glowIntensity * 8;
    const userGlowStyle = {
      boxShadow: `inset 0 0 ${blur}px ${spread}px ${glowRgba}`
    };
    userGlowElement = <div className="user-talk-glow" style={userGlowStyle} />;
  }

  return (
    <div
      className={classNames}
      onClick={() => onSquareClick(squareName)}
      onMouseEnter={() => onSquareHover(squareName)}
      role="button"
      aria-label={`Square ${squareName}, ${pieceDescription}`}
    >
      {userGlowElement}
      <span className="square-notation">{squareName}</span>
    </div>
  );
};

export default Square;
