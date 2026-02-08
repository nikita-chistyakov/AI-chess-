/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { PieceInstance, ImageTransform } from '../types';

const pieceTypeMap: Record<string, string> = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };

export function usePieceCustomization() {
  const [imagePromptTemplate, setImagePromptTemplate] = useState('Fantasy art of a {color} chess {type} piece, named {name}. Description of the piece: {description}. Voice/speaking style: {voicePrompt}. The style should be epic, detailed, with dramatic lighting. The drawn character is the chess piece itself (don\'t draw a human character). Avoid text. Square ratio.');
  
  const [pieceImageUrls, setPieceImageUrls] = useState<Record<string, string>>({});
  const [pieceImageTransforms, setPieceImageTransforms] = useState<Record<string, ImageTransform>>({});
  const [loadingPieceId, setLoadingPieceId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const aiClientRef = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

  const generatePieceImage = useCallback(async (piece: PieceInstance) => {
    setLoadingPieceId(piece.id);
    setImageError(null);
    try {
      const prompt = imagePromptTemplate
        .replace('{color}', piece.color === 'w' ? 'White' : 'Black')
        .replace('{type}', pieceTypeMap[piece.type].toLowerCase())
        .replace('{name}', piece.name)
        .replace('{description}', piece.personality.description)
        .replace('{voicePrompt}', piece.personality.voicePrompt);

      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      
      let base64ImageBytes: string | null = null;
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64ImageBytes = part.inlineData.data;
            break;
          }
        }
      }

      if (base64ImageBytes) {
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        setPieceImageUrls(prev => ({ ...prev, [piece.id]: imageUrl }));
        // Reset transform when a new image is generated
        setPieceImageTransforms(prev => ({...prev, [piece.id]: { x: 0, y: 0, scale: 1 }}));
      } else {
        throw new Error("No image data found in the API response.");
      }
    } catch (err) {
      console.error(err);
      setImageError("Couldn't generate the piece's portrait.");
    } finally {
      setLoadingPieceId(null);
    }
  }, [imagePromptTemplate]);

  const handlePersonalityChange = useCallback((
    pieceId: string, 
    newDescription: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
    ) => {
      setPieceInstances(prevInstances => {
        const newInstances = { ...prevInstances };
        const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
        if (square && newInstances[square]) {
            const updatedPiece = { ...newInstances[square]! };
            updatedPiece.personality = { ...updatedPiece.personality, description: newDescription };
            newInstances[square] = updatedPiece;
        }
        return newInstances;
      });
  
      setChattingWith(prev => {
        if (prev?.id === pieceId) {
            const newPersonality = { ...prev.personality, description: newDescription };
            return { ...prev, personality: newPersonality };
        }
        return prev;
      });
  }, []);

  const handleNameChange = useCallback((
    pieceId: string, 
    newName: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
    ) => {
    setPieceInstances(prev => {
      const newInstances = { ...prev };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        newInstances[square] = { ...newInstances[square]!, name: newName };
      }
      return newInstances;
    });

    setChattingWith(prev => prev?.id === pieceId ? { ...prev, name: newName } : prev);
  }, []);
  
  const handleVoiceChange = useCallback((
    pieceId: string,
    newVoice: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prevInstances => {
      const newInstances = { ...prevInstances };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        const updatedPiece = { ...newInstances[square]! };
        updatedPiece.personality = { ...updatedPiece.personality, voice: newVoice };
        newInstances[square] = updatedPiece;
      }
      return newInstances;
    });

    setChattingWith(prev => {
      if (prev?.id === pieceId) {
        const newPersonality = { ...prev.personality, voice: newVoice };
        return { ...prev, personality: newPersonality };
      }
      return prev;
    });
  }, []);

  const handleVoicePromptChange = useCallback((
    pieceId: string,
    newVoicePrompt: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prevInstances => {
      const newInstances = { ...prevInstances };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        const updatedPiece = { ...newInstances[square]! };
        updatedPiece.personality = { ...updatedPiece.personality, voicePrompt: newVoicePrompt };
        newInstances[square] = updatedPiece;
      }
      return newInstances;
    });

    setChattingWith(prev => {
      if (prev?.id === pieceId) {
        const newPersonality = { ...prev.personality, voicePrompt: newVoicePrompt };
        return { ...prev, personality: newPersonality };
      }
      return prev;
    });
  }, []);

  return {
    imagePromptTemplate,
    setImagePromptTemplate,
    pieceImageUrls,
    setPieceImageUrls,
    pieceImageTransforms,
    setPieceImageTransforms,
    loadingPieceId,
    imageError,
    generatePieceImage,
    handlePersonalityChange,
    handleNameChange,
    handleVoiceChange,
    handleVoicePromptChange,
  };
}