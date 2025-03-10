import React, { useState, useRef} from "react";
import UploadIcon from "./UploadIcon";
import {ReactComponent as DragAndDrop} from "../assets/Picture.svg";
import InterruptedLine from "./InterruptedLine";

const ImageTab = ({ 
  updateResults, 
  searchState, 
  setSearchState,
 }) => {
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

    const next_state = searchState.setImgUrlWithFormData(imageUrl, fd);

    setSearchState(next_state);

    updateResults(next_state);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div
      className={`ImageTab ${isDragging ? "dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="drag-area">
        <DragAndDrop className="DDicon"/>
        <p>Drag & drop an image of your choice to start the search</p>  
      </div>

      <InterruptedLine />

      <div className="Upload">
        <button className="UploadButton" onClick={handleUploadButtonClick}>
        <UploadIcon className="upload-icon" /> Upload an image 
        </button>
        <input
          ref={fileInputRef}
          id="image-upload"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleImageUpload(e.target.files[0])}
        />
      </div>
    </div>
  );
};

export default ImageTab;
