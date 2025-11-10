import React, { useState, useEffect, useRef } from "react";
import "../styles/HelpModal.css";

const HelpModal = ({ isOpen, onClose, initialTab, helpTexts }) => {
  const [activeHelpTab, setActiveHelpTab] = useState(initialTab);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveHelpTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Trap focus inside modal and return focus on close
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocusedElement = document.activeElement; // Store the element that had focus before modal opened
    modalRef.current?.focus();
    return () => {
      previouslyFocusedElement?.focus();
    };
  }, [isOpen]); 

  // Trap focus inside modal (prevent tabbing to elements behind modal)
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (event) => {
      if (event.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // If Shift+Tab on first element, go to last
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // If Tab on last element, go to first
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        ref={modalRef} 
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <h2 id="modal-title">How to search by</h2>
          <button className="close-button" onClick={onClose} aria-label="Close help modal">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="help-tabs">
          <button 
            className={`help-tab ${activeHelpTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveHelpTab('image')}
          >
            Image
          </button>
          <button 
            className={`help-tab ${activeHelpTab === 'description' ? 'active' : ''}`}
            onClick={() => setActiveHelpTab('description')}
          >
            Description
          </button>
          <button 
            className={`help-tab ${activeHelpTab === 'ppn' ? 'active' : ''}`}
            onClick={() => setActiveHelpTab('ppn')}
          >
            PPN
          </button>
        </div>
        <div className="modal-body">{helpTexts[activeHelpTab]}</div>
      </div>
    </div>
  );
};

export default HelpModal;

