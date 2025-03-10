import React, { useState, useRef } from "react";
import UploadIcon from "./UploadIcon";
import {ReactComponent as DragAndDrop} from "../assets/Picture.svg";
import InterruptedLine from "./InterruptedLine";
import '../styles/Tabs.css';


const ResultsImageTab = ({
  updateResults,
  searchState,
  setSearchState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleImageUpload(files[0]);
  };

  const handleImageUpload = (file) => {
    console.log("Image upload initiated");

    let reader = new FileReader();

    reader.onload = (e) => {
            const imageUrl = e.target.result;

            const next_state = searchState.setImgUrlWithFormData(imageUrl);

            setSearchState(next_state);

            updateResults(next_state);

            setIsExpanded(false); // close after upload
    };
    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="ResultsImageTab">
      {!isExpanded ? (
        // collapsed view
        <button
          className="results-collapsed-view"
          onClick={() => setIsExpanded(true)}
        >
          <UploadIcon className="upload-icon" /> Upload a new image 
        </button>
      ) : (
        // expanded view
        <div
          className={`results-expanded-view ${isDragging ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <button className="close" onClick={() => setIsExpanded(false)}>
            ×
          </button>
          <div className="drag-area">
            <DragAndDrop className="DDicon"/>
            <p>Drag & Drop an image to start the search</p>
          </div>
          <InterruptedLine />
          <div className="Upload">
            <button className="UploadButton" onClick={handleUploadButtonClick}>
              <UploadIcon className="upload-icon" /> Upload an image 
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleImageUpload(e.target.files[0])}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsImageTab;
