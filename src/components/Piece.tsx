/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { PieceInstance } from '../types';
import { pieceToUnicode } from '../lib/utils';

interface PieceProps {
  piece: PieceInstance;
  squareSize: number;
  isChatting: boolean;
  isSelected: boolean;
  talkingVolume: number;
}

const Piece: React.FC<PieceProps> = ({ piece, squareSize, isChatting, isSelected, talkingVolume }) => {
  if (squareSize === 0) return null; // Don't render until board size is known

  const fileIndex = piece.square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = 8 - parseInt(piece.square.substring(1), 10);

  const x = fileIndex * squareSize;
  const y = rankIndex * squareSize;

  // Calculate a scaled volume for the CSS custom property.
  // The power curve creates a more dramatic effect.
  const glowScale = isChatting ? Math.pow(talkingVolume, 1.5) : 0;

  // FIX: Cast the style object to `React.CSSProperties` to allow for the use of custom CSS properties like `--speaking-glow-scale`.
  const style = {
    transform: `translate(${x}px, ${y}px)`,
    // Pass the calculated scale to CSS for the ::after pseudo-element.
    '--speaking-glow-scale': glowScale,
  } as React.CSSProperties;

  // The base text-shadow for piece styling is now handled entirely in CSS.
  // The dynamic speaking glow is also handled in CSS using the custom property.

  const classNames = [
    'chess-piece',
    piece.color === 'w' ? 'white' : 'black',
    isChatting ? 'talking' : '',
    isSelected ? 'selected-piece' : ''
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classNames}
      style={style}
      aria-hidden="true"
    >
      {pieceToUnicode[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
    </span>
  );
};

export default Piece;