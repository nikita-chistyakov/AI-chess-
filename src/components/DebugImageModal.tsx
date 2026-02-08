
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import './DebugImageModal.css';
import { AnalysisState } from '../types';

interface DebugImageModalProps {
  isOpen: boolean;
  systemPrompt: string | null;
  latestTurnContext: string | null;
  strategy: string | null;
  strategyState: AnalysisState;
  lastImage: string | null;
  onClose: () => void;
}

const DebugImageModal: React.FC<DebugImageModalProps> = ({ 
  isOpen, systemPrompt, latestTurnContext, strategy, strategyState, lastImage, onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'image' | 'strategy'>('context');

  if (!isOpen) return null;

  const statusMap: Record<AnalysisState, string> = {
    idle: "Idle. Waiting for White's turn.",
    waiting_opponent: "Waiting for opponent to move...",
    pending: 'Analysis in progress...',
    ready: 'Briefing has been delivered to the active piece.',
    error: 'Failed to retrieve analysis.'
  };

  return (
    <div className="debug-modal-overlay" onClick={onClose}>
      <div className="debug-modal-content" onClick={e => e.stopPropagation()}>
        <div className="debug-modal-header">
          <h3>Conversation Context</h3>
          <button onClick={onClose} className="close-button" aria-label="Close">&times;</button>
        </div>
        
        <div className="debug-modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveTab('context')}>
            Text Context
          </button>
          <button 
            className={`tab-btn ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}>
            Strategy
          </button>
          <button 
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
            disabled={!lastImage}>
            Last Image Sent
          </button>
        </div>
        
        <div className="debug-modal-body">
          {activeTab === 'context' && (
            <>
              <div className="prompt-section">
                <h4>System Prompt</h4>
                <pre>{systemPrompt || 'No system prompt available.'}</pre>
              </div>
              <div className="prompt-section">
                <h4>Latest Turn Context</h4>
                <pre>{latestTurnContext || 'No context available. Start a chat with a piece first.'}</pre>
              </div>
            </>
          )}
           {activeTab === 'strategy' && (
            <div className="prompt-section">
              <h4>Strategic Advisor Briefing</h4>
              <p className={`status-text ${strategyState}`}>
                <strong>Status:</strong> {statusMap[strategyState]}
              </p>
              <pre>{strategy || 'No analysis available.'}</pre>
            </div>
          )}
          {activeTab === 'image' && (
            <div className="image-section">
              {lastImage ? (
                <img src={lastImage} alt="Last board state sent to model" />
              ) : (
                <p>No image has been sent yet.</p>
              )}
            </div>
          )}
        </div>
        <div className="debug-modal-footer">
            <button className="ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default DebugImageModal;
