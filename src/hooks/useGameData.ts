
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useCallback } from 'react';
import JSZip from 'jszip';
import { PieceInstance, ImageTransform } from '../types';
import { PiecePersonality } from '../lib/piece-personalities';

interface UseGameDataProps {
  pieceInstances: Record<string, PieceInstance | null>;
  pieceImageUrls: Record<string, string>;
  pieceImageTransforms: Record<string, ImageTransform>;
  imagePromptTemplate: string;
  setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>;
  setPieceImageUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPieceImageTransforms: React.Dispatch<React.SetStateAction<Record<string, ImageTransform>>>;
  setImagePromptTemplate: (template: string) => void;
  setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>;
  // Add all settings from context
  orbBaseDelay: number;
  orbWordDelay: number;
  proactiveGreeting: boolean;
  proactiveGreetingTimeout: number;
  setOrbBaseDelay: (delay: number) => void;
  setOrbWordDelay: (delay: number) => void;
  setProactiveGreeting: (enabled: boolean) => void;
  setProactiveGreetingTimeout: (timeout: number) => void;
  handoffDelay: number;
  setHandoffDelay: (delay: number) => void;
}

const resizeImage = (imageUrl: string, size: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
    img.crossOrigin = 'anonymous'; // Handle potential CORS issues if images were not data URLs
    img.src = imageUrl;
  });
};

export function useGameData(props: UseGameDataProps) {
  const {
    pieceInstances, pieceImageUrls, pieceImageTransforms, imagePromptTemplate,
    orbBaseDelay, orbWordDelay, proactiveGreeting, proactiveGreetingTimeout, handoffDelay, setPieceInstances, setPieceImageUrls,
    setPieceImageTransforms, setImagePromptTemplate,
    setChattingWith, setOrbBaseDelay, setOrbWordDelay, setProactiveGreeting, setProactiveGreetingTimeout, setHandoffDelay
  } = props;

  const saveGameData = useCallback(async () => {
    const zip = new JSZip();
    
    const pieceDataToSave: Record<string, any> = {};
    Object.values(pieceInstances).forEach(instance => {
      if (instance) {
        pieceDataToSave[instance.id] = {
          name: instance.name,
          voice: instance.personality.voice,
          description: `${instance.personality.voicePrompt} ${instance.personality.description}`,
        };
      }
    });

    const gameData = {
      imagePromptTemplate: imagePromptTemplate,
      pieceData: pieceDataToSave,
      pieceImageTransforms: pieceImageTransforms,
      settings: {
        orbBaseDelay: orbBaseDelay,
        orbWordDelay: orbWordDelay,
        proactiveGreeting: proactiveGreeting,
        proactiveGreetingTimeout: proactiveGreetingTimeout,
        handoffDelay: handoffDelay,
      }
    };
    
    zip.file('gamedata.json', JSON.stringify({ version: 2, savedAt: new Date().toISOString(), data: gameData }, null, 2));

    const imagePromises = Object.entries(pieceImageUrls).map(async ([pieceId, imageUrl]) => {
      if (imageUrl && imageUrl.startsWith('data:image/jpeg;base64,')) {
        try {
          const resizedPngUrl = await resizeImage(imageUrl, 350);
          zip.file(`${pieceId}.png`, resizedPngUrl.split(',')[1], { base64: true });
        } catch (error) {
          console.error(`Failed to process image for ${pieceId}:`, error);
        }
      }
    });
    
    await Promise.all(imagePromises);

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'chess-game-data.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch(err) {
      alert("Failed to save game data.");
    }
  }, [
    pieceInstances, imagePromptTemplate, pieceImageTransforms, 
    orbBaseDelay, orbWordDelay, proactiveGreeting, proactiveGreetingTimeout, pieceImageUrls, handoffDelay
  ]);

  const loadGameData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();

      const processJsonData = (data: any) => {
        if (data.imagePromptTemplate) setImagePromptTemplate(data.imagePromptTemplate);
        if (data.images) setPieceImageUrls(prev => ({ ...prev, ...data.images }));
        if (data.pieceImageTransforms) setPieceImageTransforms(data.pieceImageTransforms);
        if (data.settings) {
          if (typeof data.settings.orbBaseDelay === 'number') setOrbBaseDelay(data.settings.orbBaseDelay);
          if (typeof data.settings.orbWordDelay === 'number') setOrbWordDelay(data.settings.orbWordDelay);
          if (typeof data.settings.proactiveGreeting === 'boolean') setProactiveGreeting(data.settings.proactiveGreeting);
          if (typeof data.settings.proactiveGreetingTimeout === 'number') setProactiveGreetingTimeout(data.settings.proactiveGreetingTimeout);
          if (typeof data.settings.handoffDelay === 'number') setHandoffDelay(data.settings.handoffDelay);
        }
        
        // FIX: Explicitly type `prev` to avoid properties like `.square` and `.name` being inaccessible on type `unknown`.
        setPieceInstances((prev: Record<string, PieceInstance | null>) => {
          const newInstances = { ...prev };
          Object.values(newInstances).forEach(instance => {
            if (instance) {
              const loadedPieceData = data.pieceData?.[instance.id];
              if (loadedPieceData) {
                  const fullDesc = loadedPieceData.description || '';
                  const sentenceEndIndex = fullDesc.indexOf('.');
                  let voicePrompt = '';
                  let description = '';

                  if (sentenceEndIndex !== -1) {
                      voicePrompt = fullDesc.substring(0, sentenceEndIndex + 1);
                      description = fullDesc.substring(sentenceEndIndex + 2).trim();
                  } else {
                      description = fullDesc;
                  }

                  const newPersonality: PiecePersonality = {
                      ...instance.personality,
                      description: description,
                      voice: loadedPieceData.voice || instance.personality.voice,
                      voicePrompt: voicePrompt,
                  };
                  newInstances[instance.square] = { 
                      ...instance, 
                      name: loadedPieceData.name || instance.name,
                      personality: newPersonality,
                  };
              }
            }
          });
          return newInstances;
        });
        
        // FIX: Explicitly type `prev` to avoid properties like `.id` being inaccessible on type `unknown`.
        setChattingWith((prev: PieceInstance | null) => {
          if (prev) {
            const loadedPieceData = data.pieceData?.[prev.id];
            if (loadedPieceData) {
              const fullDesc = loadedPieceData.description || '';
              const sentenceEndIndex = fullDesc.indexOf('.');
              let voicePrompt = '';
              let description = '';

              if (sentenceEndIndex !== -1) {
                  voicePrompt = fullDesc.substring(0, sentenceEndIndex + 1);
                  description = fullDesc.substring(sentenceEndIndex + 2).trim();
              } else {
                  description = fullDesc;
              }
              
              const newPersonality: PiecePersonality = {
                  ...prev.personality,
                  description: description,
                  voice: loadedPieceData.voice || prev.personality.voice,
                  voicePrompt: voicePrompt,
              };
              return { 
                  ...prev, 
                  name: loadedPieceData.name || prev.name,
                  personality: newPersonality 
              };
            }
          }
          return prev;
        });
      };

      if (file.name.endsWith('.json')) {
        reader.onload = (event) => {
          try {
            const content = event.target?.result;
            if (typeof content !== 'string') throw new Error("Invalid file content.");
            const loadedJson = JSON.parse(content);
            processJsonData(loadedJson?.data || loadedJson);
            alert(`Game data loaded successfully.`);
          } catch (error) {
            alert("Failed to load game data from JSON.");
          }
        };
        reader.readAsText(file);
      } else if (file.name.endsWith('.zip')) {
        reader.onload = async (event) => {
          try {
            const content = event.target?.result;
            if (!(content instanceof ArrayBuffer)) throw new Error("Invalid zip file content.");
            
            const zip = await JSZip.loadAsync(content);
            const dataFile = zip.files['gamedata.json'];
            if (dataFile) {
              const dataContent = await dataFile.async('string');
              const loadedJson = JSON.parse(dataContent);
              processJsonData(loadedJson?.data || loadedJson);
            }

            const imagePromises = Object.keys(zip.files)
              .filter((path) => path.endsWith('.png'))
              .map(async (path) => {
                const zipFile = zip.files[path];
                const base64 = await zipFile.async('base64');
                const pieceId = path.substring(0, path.lastIndexOf('.'));
                return [pieceId, `data:image/png;base64,${base64}`];
              });

            const newImageUrls = Object.fromEntries(await Promise.all(imagePromises));
            if (Object.keys(newImageUrls).length > 0) {
                setPieceImageUrls(prev => ({ ...prev, ...newImageUrls }));
            }
            alert(`Game data loaded successfully from ZIP.`);
          } catch (err) {
            alert("Failed to load game data from ZIP.");
          }
        };
        reader.readAsArrayBuffer(file);
      }
    };
    input.click();
  }, [
    setImagePromptTemplate, setPieceImageUrls, setPieceImageTransforms, 
    setOrbBaseDelay, setOrbWordDelay, setProactiveGreeting, setProactiveGreetingTimeout, 
    setPieceInstances, setChattingWith, setHandoffDelay
  ]);

  return { saveGameData, loadGameData };
}
