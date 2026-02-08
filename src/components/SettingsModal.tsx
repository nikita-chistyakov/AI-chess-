
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGameData: () => void;
  onLoadGameData: () => void;
  imagePromptTemplate: string;
  onImagePromptTemplateChange: (newTemplate: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onSaveGameData, 
  onLoadGameData,
  imagePromptTemplate,
  onImagePromptTemplateChange
}) => {
  if (!isOpen) return null;

  const { 
    orbBaseDelay,
    setOrbBaseDelay,
    orbWordDelay,
    setOrbWordDelay,
    proactiveGreeting,
    setProactiveGreeting,
    proactiveGreetingTimeout,
    setProactiveGreetingTimeout,
    useStrategicAdvisor,
    setUseStrategicAdvisor,
    sendBoardImage,
    setSendBoardImage,
    handoffDelay,
    setHandoffDelay,
  } = useSettings();
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-button" aria-label="Close settings">&times;</button>
        </div>
        <div className="modal-body">
          <div className="setting-item-group">
            <h3>AI Strategy</h3>
            <div className="setting-item">
              <label htmlFor="strategic-advisor-toggle">Enable Strategic Advisor</label>
              <label className="switch">
                <input
                  id="strategic-advisor-toggle"
                  type="checkbox"
                  checked={useStrategicAdvisor}
                  onChange={(e) => setUseStrategicAdvisor(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>Uses Gemini 2.5 Flash in the background to analyze the board and provide strategic advice to your pieces. This may result in smarter, more insightful conversations.</p>
          </div>
          <div className="setting-item-group">
            <h3>Model Input</h3>
            <div className="setting-item">
              <label htmlFor="send-board-image-toggle">Send Board Image</label>
              <label className="switch">
                <input
                  id="send-board-image-toggle"
                  type="checkbox"
                  checked={sendBoardImage}
                  onChange={(e) => setSendBoardImage(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>If enabled, a screenshot of the board is sent to the model at the start of every turn. Disabling this may improve latency and reduce token usage, relying solely on text-based board data.</p>
          </div>
          <div className="setting-item-group">
            <h3>Conversation Flow</h3>
            <div className="setting-item">
              <label htmlFor="proactive-greeting-toggle">Trigger Proactive Greeting</label>
              <label className="switch">
                <input
                  id="proactive-greeting-toggle"
                  type="checkbox"
                  checked={proactiveGreeting}
                  onChange={(e) => setProactiveGreeting(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>If enabled, a system note is sent to make the piece speak first. If disabled, you must speak first to start the conversation.</p>
            {proactiveGreeting && (
              <div className="setting-item slider-item" style={{ marginTop: '1rem' }}>
                <label htmlFor="proactive-greeting-timeout">Proactive Greeting Timeout</label>
                <div className="slider-wrapper">
                  <input
                    id="proactive-greeting-timeout"
                    type="range"
                    min="500"
                    max="10000"
                    step="100"
                    value={proactiveGreetingTimeout}
                    onChange={(e) => setProactiveGreetingTimeout(Number(e.target.value))}
                  />
                  <span>{proactiveGreetingTimeout}ms</span>
                </div>
                <p style={{marginTop: '0.5rem', marginBottom: 0}}>The max time to wait for the model's first turn before enabling the microphone.</p>
              </div>
            )}
            <div className="setting-item slider-item" style={{ marginTop: '1rem' }}>
              <label htmlFor="handoff-delay">Handoff Buffer Delay</label>
              <div className="slider-wrapper">
                <input
                  id="handoff-delay"
                  type="range"
                  min="0"
                  max="2000"
                  step="100"
                  value={handoffDelay}
                  onChange={(e) => setHandoffDelay(Number(e.target.value))}
                />
                <span>{handoffDelay}ms</span>
              </div>
              <p style={{marginTop: '0.5rem', marginBottom: 0}}>Extra time to wait after speech finishes before switching pieces.</p>
            </div>
          </div>
          <div className="setting-item-group">
            <h3>Game Data</h3>
            <p>Save generated images and custom personalities to a file, or load them back into the game.</p>
            <div className="button-group">
              <button onClick={onSaveGameData}>Save Data</button>
              <button onClick={onLoadGameData}>Load Data</button>
            </div>
          </div>
          
          <div className="setting-item-group">
            <h3>Orb Animation</h3>
            <div className="setting-item slider-item">
              <label htmlFor="orb-base-delay">Transcription Base Delay</label>
              <div className="slider-wrapper">
                <input
                  id="orb-base-delay"
                  type="range"
                  min="0"
                  max="1000"
                  value={orbBaseDelay}
                  onChange={(e) => setOrbBaseDelay(Number(e.target.value))}
                />
                <span>{orbBaseDelay}ms</span>
              </div>
            </div>
            <div className="setting-item slider-item">
              <label htmlFor="orb-word-delay">Transcription Word Delay</label>
              <div className="slider-wrapper">
                <input
                  id="orb-word-delay"
                  type="range"
                  min="0"
                  max="600"
                  value={orbWordDelay}
                  onChange={(e) => setOrbWordDelay(Number(e.target.value))}
                />
                <span>{orbWordDelay}ms</span>
              </div>
            </div>
          </div>

          <div className="setting-item-group">
            <h3>Image Generation</h3>
            <p>Customize the prompt for piece portraits. Use placeholders: <code>{'{name}'}</code>, <code>{'{type}'}</code>, <code>{'{color}'}</code>, and <code>{'{description}'}</code>.</p>
            <textarea
              className="prompt-template-textarea"
              rows={5}
              value={imagePromptTemplate}
              onChange={(e) => onImagePromptTemplateChange(e.target.value)}
              aria-label="Image generation prompt template"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
