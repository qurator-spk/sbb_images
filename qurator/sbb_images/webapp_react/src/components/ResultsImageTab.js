import React, { useState, useRef } from "react";
import UploadIcon from "./UploadIcon";
import { ReactComponent as DragIcon } from "../assets/D&D.svg";
import InterruptedLine from "./InterruptedLine";
import '../styles/Tabs.css';


const ResultsImageTab = ({
  updateResults,
  searchState,
  setSearchState,
  onSearchStateChange,
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
    let fd = new FormData();
    fd.append("file", file);
    const imageUrl = URL.createObjectURL(file);

    setSearchState((prevState) => {
      const newState = prevState.setImgUrlWithFormData(imageUrl, fd);
      console.log("New search state in ResultsImageTab:", newState);

      if (onSearchStateChange) {
        onSearchStateChange(newState);
      }

      return newState;
    });

    searchByImage(file);
    setIsExpanded(false); // close after upload
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  const searchByImage = async (file) => {
    console.log("searchByImage called");
    let fd = new FormData();
    fd.append("file", file);
    const response = await fetch(
      "api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100",
      {
        method: "POST",
        body: fd,
      }
    );
    const result = await response.json();
    console.log("Search result:", result);
    updateResults(
      { type: "image", ids: result.ids },
      URL.createObjectURL(file)
    );
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
          <button className="close-button" onClick={() => setIsExpanded(false)}>
            ×
          </button>
          <div className="drag-area">
            <p>Drag & Drop an image to start the search</p>
            <DragIcon className="DDicon"/>
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
