// Used in the Drag & Drop area as separator

import React from "react";
import "../styles/InterruptedLine.css";

const InterruptedLine = ({ text = "OR" }) => {
  return (
    <div className="interrupted-line">
      <span>{text}</span>
    </div>
  );
};

export default InterruptedLine;