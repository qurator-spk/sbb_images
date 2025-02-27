import React from "react";
import "../styles/HelpModal.css";


const HelpModal = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-title">
          {" "}
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="divider"></div> 
        <div className="modal-body-container">
          {" "}
          <div className="modal-body">{content}</div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
