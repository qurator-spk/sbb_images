import React, { useState, useRef, useEffect} from "react";
import InterruptedLine from "./InterruptedLine";

const ImageTab = ({ 
  updateResults, 
  searchState, 
  setSearchState,
 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [uploadError, setUploadError] = useState(null);

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

    if (files.length > 0) {
      const file = files[0];
      
      if (file.type.startsWith('image/')) {
        handleImageUpload(file);
      } else {
        setUploadError("Please upload only image files (JPEG, PNG, etc).");
        setTimeout(() => setUploadError(null), 3000); // clear error after 3 seconds
      }
    }
  };

  const handleImageUpload = (file) => {
    console.log("Image upload initiated");

    let reader = new FileReader();

    reader.onload = (e) => {
            const imageUrl = e.target.result;

            const next_state = searchState.setImgUrlWithFormData(imageUrl);

            setSearchState(next_state);

            updateResults(next_state);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

   // for ctrl-V
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
      
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            handleImageUpload(file);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
  
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  return (
    <div
      className={`ImageTab ${isDragging ? "dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      tabIndex="0" 
      onFocus={() => console.log("Drag area focused")} 
      onClick={() => document.activeElement.blur()} 
    >
      <div className="drag-area">
        {/* Font Awesome icon - free version, since I used the free FA */}
        <i className="DDicon fa-regular fa-image"></i> 
        <p>Drag & drop an image of your choice to start the search</p>  
      </div>

      <InterruptedLine />

      <div className="Upload">
        <button 
          className="UploadButton" 
          onClick={handleUploadButtonClick}
          aria-label="Upload an image to search"
        >
        <i className="upload-icon fa-solid fa-upload" aria-hidden="true"></i> Upload an image
        </button>
        <input
          ref={fileInputRef}
          id="image-upload"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
              handleImageUpload(file);
            } else if (file) {
              setUploadError("Please select only image files (JPEG, PNG, etc).");
              setTimeout(() => setUploadError(null), 3000);
              e.target.value = '';
            }
          }}
        />
      </div>

      <div className="paste-hint">
              <small>You can also paste images with Ctrl+V</small>
      </div>

      {uploadError && (
        <div className="error-message">
          {uploadError}
        </div>
      )}
    </div>
    
  );
};

export default ImageTab;
