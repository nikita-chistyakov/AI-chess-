

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef, WheelEvent, MouseEvent, useMemo } from 'react';
import './PieceCard.css';
import { PieceInstance, ImageTransform } from '../types';

interface PieceCardProps {
  piece: PieceInstance | null;
  imageUrl: string | null;
  imageTransform: ImageTransform | null;
  isLoading: boolean;
  error: string | null;
  availableVoices: string[];
  isTransient?: boolean;
  onGenerateImage: () => void;
  onImageTransformChange: (pieceId: string, transform: ImageTransform) => void;
  onPersonalityChange: (pieceId: string, newDescription: string) => void;
  onNameChange: (pieceId: string, newName: string) => void;
  onVoiceChange: (pieceId: string, newVoice: string) => void;
  onVoicePromptChange: (pieceId: string, newVoicePrompt: string) => void;
}

const defaultTransform: ImageTransform = { x: 0, y: 0, scale: 1 };
const pieceToUnicode: { [key: string]: string } = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎',
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
};

const pieceTypeMap: Record<string, string> = {
  p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King"
};

const PieceCard: React.FC<PieceCardProps> = ({ 
  piece, imageUrl, imageTransform, isLoading, error, availableVoices,
  isTransient, onGenerateImage, onImageTransformChange, onPersonalityChange, onNameChange,
  onVoiceChange, onVoicePromptChange
}) => {
  const [isEditingPersonality, setIsEditingPersonality] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingVoice, setIsEditingVoice] = useState(false);
  const [editedVoice, setEditedVoice] = useState('');
  const [editedVoicePrompt, setEditedVoicePrompt] = useState('');
  
  // State for image editing
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [currentTransform, setCurrentTransform] = useState<ImageTransform>(imageTransform || defaultTransform);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // State for dimensions to calculate correct scaling
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const prevPieceIdRef = useRef<string | null>(null);

  // Measure container size
  useEffect(() => {
    if (!imageContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
            setContainerSize({
                width: entries[0].contentRect.width,
                height: entries[0].contentRect.height
            });
        }
    });
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [imageContainerRef]);

  // When the piece prop changes, update local edit states.
  // Only reset UI mode (editing/sizing) if it's a DIFFERENT piece.
  useEffect(() => {
    if (piece) {
      setEditedDescription(piece.personality.description);
      setEditedName(piece.name);
      setEditedVoice(piece.personality.voice);
      setEditedVoicePrompt(piece.personality.voicePrompt);

      if (piece.id !== prevPieceIdRef.current) {
        setIsEditingPersonality(false);
        setIsEditingName(false);
        setIsEditingImage(false);
        setIsEditingVoice(false);
        // Reset natural size only when switching pieces to avoid resize jump when saving text
        setNaturalSize({ width: 0, height: 0 });
        prevPieceIdRef.current = piece.id;
      }
    }
  }, [piece]);

  // Sync local transform state with props when not editing
  useEffect(() => {
    if (!isEditingImage) {
        setCurrentTransform(imageTransform || defaultTransform);
    }
  }, [imageTransform, isEditingImage]);

  const handlePersonalitySave = () => {
    if (piece) {
      onPersonalityChange(piece.id, editedDescription);
      setIsEditingPersonality(false);
    }
  };

  const handleNameSave = () => {
    if (piece) {
      onNameChange(piece.id, editedName);
      setIsEditingName(false);
    }
  };

  const handleVoiceSave = () => {
    if (piece) {
      onVoiceChange(piece.id, editedVoice);
      onVoicePromptChange(piece.id, editedVoicePrompt);
      setIsEditingVoice(false);
    }
  };
  
  const handleImageSave = () => {
    if (piece) {
        // Just save the current transform directly. No coordinate conversion needed because
        // we now use a consistent absolute positioning system for both view and edit modes.
        onImageTransformChange(piece.id, currentTransform);
        setIsEditingImage(false);
    }
  };

  const handleEditClick = () => {
    // Start editing with the current saved transform
    setCurrentTransform(imageTransform || defaultTransform);
    setIsEditingImage(true);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      setNaturalSize({ width: naturalWidth, height: naturalHeight });
  };


  // --- Unified Image Rendering Logic ---
  // We calculate a "base scale" that makes the image cover the container.
  // The user's transform (scale, x, y) is then applied relative to this base.
  // This ensures 1.0 scale always fills the container, and x/y are pixels from center.
  
  const baseScale = useMemo(() => {
      if (containerSize.width === 0 || naturalSize.width === 0) return 1;
      const scaleW = containerSize.width / naturalSize.width;
      const scaleH = containerSize.height / naturalSize.height;
      // 'Cover' fit means taking the larger of the two ratios
      return Math.max(scaleW, scaleH);
  }, [containerSize, naturalSize]);

  const activeTransform = isEditingImage ? currentTransform : (imageTransform || defaultTransform);
  const finalScale = baseScale * activeTransform.scale;
  
  // We center the image using CSS (top: 50%, left: 50%, translate(-50%, -50%)).
  // Then we apply the user's translation and scale.
  const transformStyle: React.CSSProperties = {
      transform: `translate(-50%, -50%) translate(${activeTransform.x}px, ${activeTransform.y}px) scale(${finalScale})`
  };


  // --- Image Panning and Zooming Handlers ---
  const handleMouseDown = (e: MouseEvent<HTMLImageElement>) => {
    if (!isEditingImage) return;
    e.preventDefault();
    setIsDragging(true);
    // Track where we started dragging relative to the current position
    setDragStart({ x: e.clientX - currentTransform.x, y: e.clientY - currentTransform.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isEditingImage || !isDragging) return;
    e.preventDefault();
    
    // Calculate new position
    let newX = e.clientX - dragStart.x;
    let newY = e.clientY - dragStart.y;
    
    // Clamp to prevent revealing edges
    // The image size rendered is naturalSize * finalScale
    // finalScale is baseScale * currentTransform.scale
    const scaledWidth = naturalSize.width * finalScale;
    const scaledHeight = naturalSize.height * finalScale;

    // The maximum offset allowed is half the difference between image size and container size
    // If image is smaller than container, limit is 0 (centered)
    const limitX = Math.max(0, (scaledWidth - containerSize.width) / 2);
    const limitY = Math.max(0, (scaledHeight - containerSize.height) / 2);

    newX = Math.max(-limitX, Math.min(limitX, newX));
    newY = Math.max(-limitY, Math.min(limitY, newY));
    
    setCurrentTransform(prev => ({
      ...prev,
      x: newX,
      y: newY,
    }));
  };

  const handleWheel = (e: WheelEvent<HTMLImageElement>) => {
    if (!isEditingImage || !imageContainerRef.current) return;
    e.preventDefault();
    
    const ZOOM_SPEED = 0.1;
    const newScaleRaw = currentTransform.scale - Math.sign(e.deltaY) * ZOOM_SPEED * currentTransform.scale;
    // Clamp scale: allow zooming out a bit (0.5x) to see edges, up to 5x zoom.
    const newScale = Math.max(0.5, Math.min(newScaleRaw, 5));

    // Calculate mouse position relative to the container center
    // This allows us to "zoom towards the mouse"
    const rect = imageContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Adjust x/y so the point under the mouse remains stationary
    // Formula: newPos = mousePos - (mousePos - oldPos) * (newScale / oldScale)
    const scaleRatio = newScale / currentTransform.scale;
    let newX = mouseX - (mouseX - currentTransform.x) * scaleRatio;
    let newY = mouseY - (mouseY - currentTransform.y) * scaleRatio;

    // Clamp new position based on new scale
    const futureFinalScale = baseScale * newScale;
    const scaledWidth = naturalSize.width * futureFinalScale;
    const scaledHeight = naturalSize.height * futureFinalScale;
    
    const limitX = Math.max(0, (scaledWidth - containerSize.width) / 2);
    const limitY = Math.max(0, (scaledHeight - containerSize.height) / 2);

    newX = Math.max(-limitX, Math.min(limitX, newX));
    newY = Math.max(-limitY, Math.min(limitY, newY));

    setCurrentTransform({
      scale: newScale,
      x: newX,
      y: newY,
    });
  };

  if (!piece) {
    return null;
  }

  const symbolKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
  const pieceSymbol = pieceToUnicode[symbolKey];
  const pieceTitle = `${piece.color === 'w' ? 'White' : 'Black'} ${pieceTypeMap[piece.type]}`;

  return (
    <div className={`piece-card ${isTransient ? 'is-transient' : ''}`}>
      {/* 1. Image Container (The Base Layer) */}
      <div 
        ref={imageContainerRef}
        className={`piece-card-image-container ${isEditingImage ? 'editing-image' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageUrl && !isLoading && (
          <img 
            ref={imageRef}
            src={imageUrl} 
            alt={`Portrait of ${piece.name}`} 
            className="piece-image" 
            style={transformStyle}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onLoad={handleImageLoad}
            draggable="false"
          />
        )}
      </div>

      {/* 2. Overlays (Loader / Error) - Direct Children for easier Z-Index control */}
      {isLoading && <div className="loader">Generating portrait...</div>}
      {error && <div className="image-error">{error}</div>}

      {/* 3. Action Buttons - Direct Children to ensure they sit above everything if needed */}
      {!isLoading && (
          imageUrl ? (
            <div className="image-actions">
               <button 
                  onClick={isEditingImage ? handleImageSave : handleEditClick}
                  className={`edit-image-btn ${isEditingImage ? 'saving' : ''}`}
                  aria-label={isEditingImage ? 'Save image position' : 'Edit image position'}
               >
                 <span className="material-symbols-outlined">{isEditingImage ? 'save' : 'tune'}</span>
               </button>
               <button 
                  onClick={onGenerateImage} 
                  className="generate-image-btn regenerate"
                  aria-label="Regenerate piece portrait"
                >
                  <span className="material-symbols-outlined">refresh</span>
                </button>
            </div>
          ) : (
            <button 
              onClick={onGenerateImage} 
              className="generate-image-btn generate"
              aria-label="Generate piece portrait"
            >
              Generate Portrait
            </button>
          )
      )}

      {/* 4. Text Content */}
      <div className="piece-card-content">
        <div className="piece-header">
          <div className="piece-header-main">
            <h2 className="piece-name">
              <span className="piece-symbol">{pieceSymbol}</span>
              {isEditingName ? (
                <input
                  className="name-input"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                  autoFocus
                />
              ) : (
                <span>{piece.name}</span>
              )}
            </h2>
            <p className="piece-title">{pieceTitle}</p>
          </div>
          <div className="piece-header-actions">
            {isEditingName ? (
               <button className="save-btn" onClick={handleNameSave}>Save</button>
            ) : (
              piece.color === 'w' && (
                <button onClick={() => setIsEditingName(true)} className="edit-btn" aria-label="Edit name">
                  <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
                </button>
              )
            )}
          </div>
        </div>

        <div className="piece-card-section">
          <div className="section-header">
            <h3>Personality</h3>
            {!isEditingPersonality && piece.color === 'w' && (
              <button onClick={() => setIsEditingPersonality(true)} className="edit-btn" aria-label="Edit personality">
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
              </button>
            )}
          </div>
          {isEditingPersonality ? (
            <>
              <textarea
                className="personality-textarea"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={4}
              />
              <button className="save-btn" onClick={handlePersonalitySave}>Save</button>
            </>
          ) : (
            <p>{piece.personality.description}</p>
          )}
        </div>
        <div className="piece-card-section">
          <div className="section-header">
            <h3>Voice</h3>
            {!isEditingVoice && piece.color === 'w' && (
              <button onClick={() => setIsEditingVoice(true)} className="edit-btn" aria-label="Edit voice">
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
              </button>
            )}
          </div>
          {isEditingVoice ? (
            <>
              <div className="voice-edit-group">
                <label htmlFor="voice-prompt-textarea">Voice Prompt</label>
                <textarea
                  id="voice-prompt-textarea"
                  className="personality-textarea"
                  value={editedVoicePrompt}
                  onChange={(e) => setEditedVoicePrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="voice-edit-group">
                <label htmlFor="voice-select">Voice Actor</label>
                <select
                  id="voice-select"
                  className="voice-select"
                  value={editedVoice}
                  onChange={(e) => setEditedVoice(e.target.value)}
                >
                  {availableVoices.map(voice => (
                    <option key={voice} value={voice}>{voice}</option>
                  ))}
                </select>
              </div>
              <button className="save-btn" onClick={handleVoiceSave}>Save</button>
            </>
          ) : (
            <>
              <p className="voice-prompt-display">{piece.personality.voicePrompt}</p>
              <p className="voice-actor-display">
                <strong>Voice Actor:</strong> {piece.personality.voice}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PieceCard;
