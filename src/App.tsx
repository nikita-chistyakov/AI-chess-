

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import Chessboard from './components/Chessboard';
import PieceCard from './components/PieceCard';
import SettingsModal from './components/SettingsModal';
import StrategyConsole from './components/StrategyConsole';
import TermsModal from './components/TermsModal';
import { useSettings } from './contexts/SettingsContext';
import { useChessGame } from './hooks/useChessGame';
import { usePieceCustomization } from './hooks/usePieceCustomization';
import { useAppInteractions } from './hooks/useAppInteractions';
import { useGameData } from './hooks/useGameData';
import { AVAILABLE_VOICES } from './lib/constants';
import { PieceInstance, StrategyDebugState } from './types';

// ==========================================
// FEATURE FLAG: DEVELOPER CONTROLS
// Set this to true to see Settings and Strategy Debug buttons
const SHOW_DEV_CONTROLS = false;
// ==========================================

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [showStrategyConsole, setShowStrategyConsole] = useState(false);
  const [debugSystemPrompt, setDebugSystemPrompt] = useState<string | null>(null);
  const [debugLatestTurnContext, setDebugLatestTurnContext] = useState<string | null>(null);
  const [debugStrategy, setDebugStrategy] = useState<StrategyDebugState>({ state: 'idle', result: null, prompt: null, injectionStatus: 'none', turnNumber: null });
  const [debugLastImage, setDebugLastImage] = useState<string | null>(null);
  const [transientPiece, setTransientPiece] = useState<PieceInstance | null>(null);
  const settings = useSettings();
  const boardRef = useRef<HTMLDivElement>(null);

  // Custom hook for managing piece personalities, names, and images
  const customization = usePieceCustomization();
  
  // Custom hook for managing the core chess game state and logic
  const chessGame = useChessGame({
    setImagePromptTemplate: customization.setImagePromptTemplate,
    setPieceImageUrls: customization.setPieceImageUrls,
  });

  // Custom hook for managing user interactions, chat, and selections
  const interactions = useAppInteractions({
    game: chessGame.game,
    pieceInstances: chessGame.pieceInstances,
    conversationHistories: chessGame.conversationHistories,
    executeMove: chessGame.executeMove,
    setConversationHistories: chessGame.setConversationHistories,
    generatePieceImage: customization.generatePieceImage,
    pieceImageUrls: customization.pieceImageUrls,
    boardRef: boardRef,
    setDebugSystemPrompt: setDebugSystemPrompt,
    setDebugLatestTurnContext: setDebugLatestTurnContext,
    setDebugStrategy: setDebugStrategy,
    setDebugLastImage: setDebugLastImage,
  });

  // Custom hook for managing saving and loading game data
  const { saveGameData, loadGameData } = useGameData({
    ...chessGame,
    ...customization,
    ...settings,
    setChattingWith: interactions.setChattingWith,
  });

  // When hovering or the orb moves, check if it's over a piece and temporarily show that piece's card.
  useEffect(() => {
    // Prioritize the hovered square, then fall back to the orb position.
    const targetSquare = interactions.hoveredSquare || interactions.orbPosition;
    if (targetSquare) {
        // FIX: Filter out null piece instances and ensure correct typing before finding a piece.
        const allPieces = Object.values(chessGame.pieceInstances).filter((p): p is PieceInstance => p !== null);
        const pieceOnSquare = allPieces.find(p => p.square === targetSquare);
        // Don't show the same piece transiently if we are already chatting with it.
        if (pieceOnSquare && pieceOnSquare.id !== interactions.chattingWith?.id) {
            setTransientPiece(pieceOnSquare);
        } else {
            setTransientPiece(null);
        }
    } else {
        setTransientPiece(null);
    }
  }, [interactions.orbPosition, interactions.hoveredSquare, chessGame.pieceInstances, interactions.chattingWith]);
  
  const pieceToDisplay = transientPiece || interactions.chattingWith;
  
  return (
    <div className="App">
      {interactions.error && <p className="error-message">{interactions.error}</p>}
      <main className="game-container">
        <div className="left-panel">
            {SHOW_DEV_CONTROLS && (
              <div className="header-actions">
                <button 
                  className={`icon-btn ${showStrategyConsole ? 'active' : ''}`}
                  onClick={() => setShowStrategyConsole(!showStrategyConsole)}
                  aria-label="Toggle strategy console"
                  title="Toggle Strategy Console"
                >
                  <span className="material-symbols-outlined">bug_report</span>
                </button>
                <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings" title="Settings">
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </div>
            )}

            {showStrategyConsole ? (
              <StrategyConsole
                systemPrompt={debugSystemPrompt}
                latestTurnContext={debugLatestTurnContext}
                strategy={debugStrategy.result}
                strategyPrompt={debugStrategy.prompt}
                strategyState={debugStrategy.state}
                injectionStatus={debugStrategy.injectionStatus}
                turnNumber={debugStrategy.turnNumber}
                lastImage={debugLastImage}
                onRetryAnalysis={interactions.retryStrategyAnalysis}
              />
            ) : (
              pieceToDisplay ? (
                <PieceCard
                  piece={pieceToDisplay}
                  isTransient={!!transientPiece && pieceToDisplay.id === transientPiece.id}
                  imageUrl={customization.pieceImageUrls[pieceToDisplay.id] || null}
                  imageTransform={customization.pieceImageTransforms[pieceToDisplay.id] || null}
                  isLoading={customization.loadingPieceId === pieceToDisplay.id}
                  error={customization.imageError}
                  availableVoices={AVAILABLE_VOICES}
                  onGenerateImage={() => customization.generatePieceImage(pieceToDisplay!)}
                  onImageTransformChange={(pieceId, transform) => 
                    customization.setPieceImageTransforms(prev => ({...prev, [pieceId]: transform}))
                  }
                  onPersonalityChange={(pieceId, newDescription) =>
                    customization.handlePersonalityChange(
                      pieceId,
                      newDescription,
                      chessGame.setPieceInstances,
                      interactions.setChattingWith,
                    )
                  }
                  onNameChange={(pieceId, newName) =>
                    customization.handleNameChange(
                      pieceId,
                      newName,
                      chessGame.setPieceInstances,
                      interactions.setChattingWith,
                    )
                  }
                  onVoiceChange={(pieceId, newVoice) =>
                    customization.handleVoiceChange(
                      pieceId,
                      newVoice,
                      chessGame.setPieceInstances,
                      interactions.setChattingWith
                    )
                  }
                  onVoicePromptChange={(pieceId, newVoicePrompt) =>
                    customization.handleVoicePromptChange(
                      pieceId,
                      newVoicePrompt,
                      chessGame.setPieceInstances,
                      interactions.setChattingWith
                    )
                  }
                />
              ) : (
                <div className="piece-card-placeholder">
                  <div className="placeholder-content">
                    <span className="material-symbols-outlined">graphic_eq</span>
                    <p>Select a piece to start a voice conversation with it about the game. You're playing the white set.</p>
                  </div>
                  <div className="placeholder-footer">
                    made by <a href="http://x.com/pitaru" target="_blank" rel="noopener noreferrer">@pitaru</a> with Gemini
                    {' | '}
                    <button className="link-button" onClick={() => setIsTermsOpen(true)}>terms</button>
                  </div>
                </div>
              )
            )}
        </div>
        <Chessboard
          ref={boardRef}
          game={chessGame.game}
          pieceInstances={chessGame.pieceInstances}
          selectedSquare={interactions.selectedSquare}
          onSquareClick={interactions.handleSquareClick}
          onSquareHover={interactions.setHoveredSquare}
          chattingWith={interactions.chattingWith}
          isRecording={interactions.isRecording}
          talkingVolume={interactions.talkingVolume}
          userVolume={interactions.userVolume}
          orbPosition={interactions.orbPosition}
        />
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveGameData={saveGameData}
        onLoadGameData={loadGameData}
        imagePromptTemplate={customization.imagePromptTemplate}
        onImagePromptTemplateChange={customization.setImagePromptTemplate}
      />
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
  );
}

export default App;
