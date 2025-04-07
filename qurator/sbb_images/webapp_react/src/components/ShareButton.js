import React, { useState } from "react";
import "../styles/ShareButton.css"; 

const ShareButton = ({ searchState }) => {
  const [copyStatus, setCopyStatus] = useState("idle"); // idle, success, error
  
  // Don't show the button if there's no valid search state or link
  if (!searchState || !searchState.link || searchState.type === 'no') {
    return null;
  }
  
  const copyToClipboard = () => {
    try {
      // Create a temporary input element
      const tempInput = document.createElement("input");
      tempInput.style.position = "absolute";
      tempInput.style.left = "-9999px"; // move off-screen
      document.body.appendChild(tempInput);
      
      // Set its value to the URL and select it
      tempInput.value = searchState.link;
      tempInput.select();
      tempInput.setSelectionRange(0, 99999); // for mobile 
      
      // Copy to clipboard
      document.execCommand("copy");
      
      // Remove temporary element
      document.body.removeChild(tempInput);
      
      // Update status to show success message
      setCopyStatus("success");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  // Button text based on status
  let buttonText = "Share this search";
  if (copyStatus === "success") buttonText = "Link copied!";
  if (copyStatus === "error") buttonText = "Failed to copy";

  /* return (
    <button onClick={copyToClipboard}>
      {buttonText}
    </button>
  ); */

  return (
    <button 
      className={`share-button ${copyStatus}`} 
      onClick={copyToClipboard}
    >
      {buttonText}
    </button>
  );
};

export default ShareButton;
