
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import './StrategyConsole.css';
import { AnalysisState, StrategyInjectionStatus } from '../types';

interface StrategyConsoleProps {
  systemPrompt: string | null;
  latestTurnContext: string | null;
  strategy: string | null;
  strategyPrompt: string | null;
  strategyState: AnalysisState;
  injectionStatus: StrategyInjectionStatus;
  turnNumber: number | null;
  lastImage: string | null;
  onRetryAnalysis?: () => void;
}

const StrategyConsole: React.FC<StrategyConsoleProps> = ({ 
  systemPrompt, latestTurnContext, strategy, strategyPrompt, strategyState, injectionStatus, turnNumber, lastImage, onRetryAnalysis 
}) => {
  const [activeTab, setActiveTab] = useState<'strategy' | 'context' | 'image'>('strategy');
  const [showPrompt, setShowPrompt] = useState(false);

  const statusMap: Record<AnalysisState, string> = {
    idle: "Idle.",
    waiting_opponent: "Waiting for opponent...",
    pending: 'Analyzing board...',
    ready: 'Analysis ready.',
    error: 'Analysis failed.'
  };

  const injectionStatusMap: Record<StrategyInjectionStatus, string> = {
    none: '',
    queued: 'Queued for NEXT USER turn...',
    sent: 'Sent to active session.'
  };

  return (
    <div className="strategy-console">
        <div className="console-header">
          <h3>Strategy Console</h3>
        </div>
        
        <div className="console-tabs">
          <button 
            className={`tab-btn ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}>
            Strategy
          </button>
          <button 
            className={`tab-btn ${activeTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveTab('context')}>
            Context
          </button>
          <button 
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
            disabled={!lastImage}>
            Image
          </button>
        </div>
        
        <div className="console-body">
           {activeTab === 'strategy' && (
            <div className="console-section">
              <div className={`status-text ${strategyState}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Status:</strong> {statusMap[strategyState]}</span>
                    {turnNumber !== null && <span style={{ opacity: 0.7 }}>Turn {turnNumber}</span>}
                </div>
                {injectionStatus !== 'none' && (
                  <div className={`injection-status ${injectionStatus}`}>
                     {injectionStatusMap[injectionStatus]}
                  </div>
                )}
              </div>
              
              {strategyState === 'error' && onRetryAnalysis && (
                  <button className="retry-analysis-btn" onClick={onRetryAnalysis} title="Retry strategic analysis">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'text-bottom', marginRight: '4px' }}>refresh</span>
                    Retry Analysis
                  </button>
              )}

              <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', marginTop: '0.5rem'}}>
                <button 
                   style={{
                       background: 'none', 
                       border: '1px solid #444', 
                       color: '#888', 
                       padding: '2px 8px', 
                       borderRadius: '4px', 
                       fontSize: '0.75rem',
                       cursor: 'pointer'
                   }}
                   onClick={() => setShowPrompt(!showPrompt)}
                >
                   {showPrompt ? 'Show Result' : 'Show Prompt'}
                </button>
              </div>
              {showPrompt ? (
                  <>
                    <h4 style={{marginBottom: '0.5rem'}}>Advisor System Prompt</h4>
                    <pre>{strategyPrompt || 'No prompt generated yet.'}</pre>
                  </>
              ) : (
                  <pre>{strategy || 'Waiting for analysis...'}</pre>
              )}
            </div>
          )}
          {activeTab === 'context' && (
            <>
              <div className="console-section">
                <h4>System Prompt</h4>
                <pre>{systemPrompt || 'No active conversation.'}</pre>
              </div>
              <div className="console-section">
                <h4>Latest Turn Context</h4>
                <pre>{latestTurnContext || '...'}</pre>
              </div>
            </>
          )}
          {activeTab === 'image' && (
            <div className="image-section">
              {lastImage ? (
                <img src={lastImage} alt="Last board state sent to model" />
              ) : (
                <p>No image captured yet.</p>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export default StrategyConsole;
