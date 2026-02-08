
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import './TermsModal.css';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay" onClick={onClose}>
      <div className="terms-modal-content" onClick={e => e.stopPropagation()}>
        <div className="terms-modal-header">
          <h3>Terms & Privacy</h3>
          <button onClick={onClose} className="close-button" aria-label="Close">&times;</button>
        </div>
        <div className="terms-modal-body">
          <p>
            Recordings of your interactions with the Live API and content you share with it are processed per the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API Additional Terms</a>. Respect others’ privacy and ask permission before recording or including them in a Live chat.
          </p>
        </div>
        <div className="terms-modal-footer">
          <button className="ok-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
