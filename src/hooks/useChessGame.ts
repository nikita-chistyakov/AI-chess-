
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Move, Square } from 'chess.js';
import { PiecePersonality } from '../lib/piece-personalities';
import { PieceInstance, ConversationTurn } from '../types';
import { findBestMove } from '../lib/ai';

interface UseChessGameProps {
  setImagePromptTemplate: (template: string) => void;
  setPieceImageUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

// FIX: Define pieceTypeMap to resolve missing name error.
const pieceTypeMap: Record<string, string> = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };

export function useChessGame({
  setImagePromptTemplate, setPieceImageUrls
}: UseChessGameProps) {
  const [game, setGame] = useState(new Chess());
  const [pieceInstances, setPieceInstances] = useState<Record<string, PieceInstance | null>>({});
  const [conversationHistories, setConversationHistories] = useState<Record<string, ConversationTurn[]>>({});

  useEffect(() => {
    const initializeGame = async (loadedData: any | null) => {
      const initialGame = new Chess();
      
      if (loadedData) {
        if (loadedData.imagePromptTemplate) setImagePromptTemplate(loadedData.imagePromptTemplate);
        if (loadedData.pieceData) {
          const imagePromises = Object.keys(loadedData.pieceData).map(async (pieceId) => {
            try {
              // Fetch piece image from the public directory.
              const res = await fetch(`./public/chess-game-data/${pieceId}.png`);
              if (res.ok) {
                const blob = await res.blob();
                return { pieceId, imageUrl: URL.createObjectURL(blob) };
              }
              return null;
            } catch (err) { return null; }
          });
          const loadedImages = (await Promise.all(imagePromises)).filter(Boolean) as { pieceId: string, imageUrl: string }[];
          setPieceImageUrls(prev => ({ ...prev, ...Object.fromEntries(loadedImages.map(img => [img.pieceId, img.imageUrl])) }));
        }
      }

      const initialInstances: Record<string, PieceInstance> = {};
      initialGame.board().forEach(row => {
        row.forEach(piece => {
          if (piece) {
            const id = `${piece.color}_${piece.type}_${piece.square}`;
            const pieceData = loadedData?.pieceData?.[id];
            if (pieceData) {
              const fullDesc = pieceData.description || '';
              const sentenceEndIndex = fullDesc.indexOf('.');
              let voicePrompt = '';
              let description = '';

              if (sentenceEndIndex !== -1) {
                  voicePrompt = fullDesc.substring(0, sentenceEndIndex + 1);
                  description = fullDesc.substring(sentenceEndIndex + 2).trim();
              } else {
                  description = fullDesc;
              }

              const personality: PiecePersonality = {
                names: [pieceData.name],
                description: description,
                voice: pieceData.voice,
                voicePrompt: voicePrompt,
              };
              initialInstances[piece.square] = { id, name: pieceData.name, personality, ...piece };
            }
          }
        });
      });
      setPieceInstances(initialInstances);
      setGame(initialGame);
    };

    const initialLoad = async () => {
      try {
        // Fetch initial game data from the public directory.
        const response = await fetch('./public/chess-game-data/gamedata.json');
        if (!response.ok) throw new Error('No saved data found');
        const loadedJson = await response.json();
        await initializeGame(loadedJson?.data || loadedJson);
      } catch (error) {
        await initializeGame(null);
      }
    };
    initialLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeMove = useCallback((move: Move, onOpponentMoved?: (finalGame: Chess) => void | Promise<void>) => {
    // Create a new game state from the player's move
    const playerMoveGame = new Chess(game.fen());
    playerMoveGame.move(move);

    // Update piece instances for the player's move
    setPieceInstances(prevInstances => {
        const newInstances = { ...prevInstances };
        if (move.promotion) {
          const promotionPersonalities: Record<string, Omit<PiecePersonality, 'names'>> = {
            q: { description: "Newly crowned and immensely powerful, I am a force of pure ambition, ready to dominate the board and secure victory at any cost.", voice: "Kore", voicePrompt: "Speak with a commanding and regal tone." },
            r: { description: "I have become a tower of strength, a solid and unbreakable force. My path is clear, my purpose renewed.", voice: "Orus", voicePrompt: "Speak with a deep, solid voice." },
            b: { description: "My vision has expanded, seeing the board in a new light. I weave new, more complex strategies from my elevated position.", voice: "Charon", voicePrompt: "Speak with a wise and knowing tone." },
            n: { description: "I have leaped into a new role, more cunning and unpredictable than ever before. My unorthodox approach is now backed by greater purpose.", voice: "Fenrir", voicePrompt: "Speak with a wild, unpredictable edge." },
          };
          const { color, type } = playerMoveGame.get(move.to)!;
          const id = `${color}_${type}_${move.from}_promo`;
          const promoData = promotionPersonalities[type];
          const name = `Promoted ${pieceTypeMap[type]}`;
          const personality: PiecePersonality = { ...promoData, names: [name] };
          newInstances[move.to] = { id, name, personality, type, color, square: move.to };
        } else {
          const movedPiece = newInstances[move.from];
          if (movedPiece) newInstances[move.to] = { ...movedPiece, square: move.to };
        }
        
        // Handle Castling (Player)
        if (move.flags.includes('k') || move.flags.includes('q')) {
          const isKingside = move.flags.includes('k');
          const rank = move.color === 'w' ? '1' : '8';
          const rookFrom = `${isKingside ? 'h' : 'a'}${rank}`;
          const rookTo = `${isKingside ? 'f' : 'd'}${rank}`;
          const rook = newInstances[rookFrom];
          if (rook) {
            newInstances[rookTo] = { ...rook, square: rookTo as Square };
            newInstances[rookFrom] = null;
          }
        }

        newInstances[move.from] = null;
        return newInstances;
    });
    
    // Set the game state after the player's move
    setGame(playerMoveGame);

    // If the game isn't over, schedule the opponent's move
    if (!playerMoveGame.isGameOver()) {
      setTimeout(async () => {
        // This closure correctly captures `playerMoveGame` which is the state after the player's move.
        const opponentTurnGame = new Chess(playerMoveGame.fen());
        
        // Ensure it's black's turn and the game isn't over
        if (opponentTurnGame.isGameOver() || opponentTurnGame.turn() === 'w') {
          if (onOpponentMoved) await onOpponentMoved(opponentTurnGame);
          return;
        }

        const { bestMove } = findBestMove(opponentTurnGame, 3);
        if (!bestMove) {
          if (onOpponentMoved) await onOpponentMoved(opponentTurnGame);
          return;
        }
        
        // SEQUENTIAL STATE UPDATE FOR OPPONENT'S MOVE
        
        // 1. Update piece instances
        setPieceInstances(prevInstances => {
            const newInstances = { ...prevInstances };
            const movedPiece = newInstances[bestMove.from];
            if (movedPiece) {
                newInstances[bestMove.to] = { ...movedPiece, square: bestMove.to };
                newInstances[bestMove.from] = null;
            }

            // Handle Castling (Opponent)
            if (bestMove.flags.includes('k') || bestMove.flags.includes('q')) {
              const isKingside = bestMove.flags.includes('k');
              const rank = bestMove.color === 'w' ? '1' : '8';
              const rookFrom = `${isKingside ? 'h' : 'a'}${rank}`;
              const rookTo = `${isKingside ? 'f' : 'd'}${rank}`;
              const rook = newInstances[rookFrom];
              if (rook) {
                newInstances[rookTo] = { ...rook, square: rookTo as Square };
                newInstances[rookFrom] = null;
              }
            }
            
            return newInstances;
        });
        
        // 2. Update game state
        opponentTurnGame.move(bestMove);
        setGame(opponentTurnGame);
        if (onOpponentMoved) {
          await onOpponentMoved(opponentTurnGame);
        }
      }, 500);
    } else {
      if (onOpponentMoved) {
        setTimeout(async () => await onOpponentMoved(playerMoveGame), 100);
      }
    }
  }, [game]);

  return {
    game,
    pieceInstances,
    setPieceInstances,
    conversationHistories,
    setConversationHistories,
    executeMove
  };
}
