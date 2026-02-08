
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo, useState, useEffect } from 'react';
import { Chess, Square as ChessJSSquare } from 'chess.js';
import { PieceInstance } from '../types';
import Square from './Square';
import Piece from './Piece';

// Define the props interface for the Chessboard component
interface ChessboardProps {
  game: Chess;
  pieceInstances: Record<string, PieceInstance | null>;
  selectedSquare: ChessJSSquare | null;
  onSquareClick: (square: ChessJSSquare) => void;
  onSquareHover: (square: ChessJSSquare | null) => void;
  chattingWith: PieceInstance | null;
  isRecording: boolean;
  talkingVolume: number; // AI talking volume
  userVolume: number; // User talking volume
  orbPosition: ChessJSSquare | null; // Position for the talking orb
}

/**
 * A React component that renders an interactive chessboard by mapping over
 * ranks and files to create individual Square components.
 */
const Chessboard = React.forwardRef<HTMLDivElement, ChessboardProps>((props, ref) => {
  const files = useMemo(() => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], []);
  const ranks = useMemo(() => ['8', '7', '6', '5', '4', '3', '2', '1'], []);
  const [orbStyle, setOrbStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [boardSize, setBoardSize] = useState(0);

  useEffect(() => {
    const boardEl = (ref as React.RefObject<HTMLDivElement>)?.current;
    if (!boardEl) return;
  
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setBoardSize(entries[0].contentRect.width);
      }
    });
  
    resizeObserver.observe(boardEl);
    // Initial size set
    setBoardSize(boardEl.offsetWidth);
    return () => resizeObserver.disconnect();
  }, [ref]);
  
  const squareSize = boardSize / 8;
  const pieces = Object.values(props.pieceInstances)
    .filter((p): p is PieceInstance => !!p)
    .sort((a, b) => a.id.localeCompare(b.id)); // Ensure stable order for animations


  useEffect(() => {
    if (!props.orbPosition || boardSize === 0) {
      // If there's no position, keep the orb invisible but retain its last position for a smooth fade-out.
      setOrbStyle(prevStyle => ({ ...prevStyle, opacity: 0 }));
      return;
    }

    const fileIndex = props.orbPosition.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankIndex = 8 - parseInt(props.orbPosition.substring(1), 10);
    
    const x = fileIndex * squareSize + squareSize / 2;
    const y = rankIndex * squareSize + squareSize / 2;

    setOrbStyle({
      opacity: 0.7,
      width: `${squareSize}px`,
      height: `${squareSize}px`,
      // The first translate positions the element's top-left corner at the square's center.
      // The second translate offsets the element by half its own width and height to perfectly center it.
      transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
    });
  }, [props.orbPosition, boardSize, squareSize]);
  
  return (
    <div className="board-container">
      <div className="chessboard" ref={ref} onMouseLeave={() => props.onSquareHover(null)}>
        {ranks.map((rank, rankIndex) =>
          files.map((file, fileIndex) => {
            const squareName = `${file}${rank}` as ChessJSSquare;
            return (
              <Square
                key={squareName}
                squareName={squareName}
                isLight={(rankIndex + fileIndex) % 2 === 0}
                pieceOnSquare={props.game.get(squareName)}
                isSelected={props.selectedSquare === squareName}
                isChatting={props.chattingWith?.square === squareName}
                isRecording={props.isRecording}
                userVolume={props.userVolume}
                onSquareClick={props.onSquareClick}
                onSquareHover={props.onSquareHover}
                isOrbOver={props.orbPosition === squareName}
              />
            );
          })
        )}
        <div className="piece-layer">
          {pieces.map(piece => (
            <Piece
              key={piece.id}
              piece={piece}
              squareSize={squareSize}
              isChatting={props.chattingWith?.id === piece.id}
              talkingVolume={props.talkingVolume}
              isSelected={props.selectedSquare === piece.square}
            />
          ))}
        </div>
        <div className="animated-orb-glow" style={orbStyle} />
      </div>
    </div>
  );
});

export default Chessboard;
