import React, { useState, useRef, useEffect } from "react";
import "../styles/MinimizedSearchBar.css";

const MinimizedSearchBar = ({
  searchState,
  cropCoordinates,
  onBackToTopClick,
}) => {
  const [showImagePreview, setShowImagePreview] = useState(false);
  const canvasRef = useRef(null);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(null);
  const dragStartPosition = useRef({ x: 0, y: 0, left: 0, top: 0 });

  useEffect(() => {
    if (
      searchState.type === "image" &&
      searchState.imgUrl &&
      canvasRef.current
    ) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const img = new Image();

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      img.onload = () => {
        // clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // calculate dimensions to preserve aspect ratio
        const imgRatio = img.width / img.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > 1) {
          // image is wider than tall
          drawWidth = canvas.width;
          drawHeight = canvas.width / imgRatio;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // image is taller than wide
          drawHeight = canvas.height;
          drawWidth = canvas.height * imgRatio;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }

        // context.drawImage(img, 0, 0, canvas.width, canvas.height);
        context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        if (cropCoordinates && cropCoordinates.x !== -1) {
          // semi-transparent overlay
          context.fillStyle = "rgba(0, 0, 0, 0.5)";
          context.fillRect(0, 0, canvas.width, canvas.height);

          // cut out the crop region
          context.globalCompositeOperation = "destination-out";
          const x = cropCoordinates.x * canvas.width;
          const y = cropCoordinates.y * canvas.height;
          const width = cropCoordinates.width * canvas.width;
          const height = cropCoordinates.height * canvas.height;
          context.fillRect(x, y, width, height);

          // border around crop region
          context.globalCompositeOperation = "source-over";
          context.strokeStyle = "#2B4474";
          context.lineWidth = 2;
          context.strokeRect(x, y, width, height);
        }
      };

      img.src = searchState.imgUrl;
    }
  }, [searchState.imgUrl, cropCoordinates, searchState.type]);

//================================================================

  const isDraggingRef = useRef(false);

  const handleDragStart = (e) => {
   // console.log("Drag start");
    if (e.target.className === 'close-preview') return;
    
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    
    const previewElement = e.currentTarget;
    const rect = previewElement.getBoundingClientRect();
    
    dragStartPosition.current = {
      x: e.clientX,
      y: e.clientY,
      left: previewPosition ? previewPosition.x : rect.left,
      top: previewPosition ? previewPosition.y : rect.top
    };
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    //console.log("Dragging", isDragging);
    // if (!isDragging) return;
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - dragStartPosition.current.x;
    const deltaY = e.clientY - dragStartPosition.current.y;
    
    setPreviewPosition({
      x: dragStartPosition.current.left + deltaX,
      y: dragStartPosition.current.top + deltaY
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  useEffect(() => {
    if (!showImagePreview) {
      setPreviewPosition(null);
    }
  }, [showImagePreview]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  //================================================================

  let searchContent = null;

  if (searchState.type === "image" && searchState.imgUrl) {
    searchContent = (
      <>
        <span>Searching for image:</span>
        <canvas
          ref={canvasRef}
          className="search-thumbnail"
          onClick={() => {
            setShowImagePreview(true);
          }}
          title="Click to view image"
        />
      </>
    );
  } else if (searchState.type === "description" && searchState.description) {
    const displayText =
      searchState.description.length > 50
        ? searchState.description.substring(0, 50) + "..."
        : searchState.description;

    searchContent = <span>Searching for description: "<strong>{displayText}</strong>"</span>;
  } else if (searchState.type === "ppn" && searchState.ppn) {
    searchContent = <span>Searching for PPN: <strong>{searchState.ppn}</strong></span>;
  }

  return (
    <>
      <div className="minimized-search-bar">
        <div className="min-content-container">
          <div className="search-content">{searchContent}</div>
          <div className="search-actions">
            <button className="back-to-top-button" onClick={onBackToTopClick}>
              ↑ Back to top
            </button>
          </div>
        </div>
      </div>

      {showImagePreview && searchState.type === 'image' &&(
        <div 
        className={`thumbnail-preview ${isDragging ? 'dragging' : ''}`}
        style={previewPosition ? {
          left: `${previewPosition.x}px`,
          top: `${previewPosition.y}px`
        } : null}
        onMouseDown={handleDragStart}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* <div className="thumbnail-preview"> */}
          <button
            className="close-preview"
            onClick={() => setShowImagePreview(false)}
          >
            ×
          </button>
          <div className="preview-image-container">
            <img
              src={searchState.imgUrl}
              className="preview-image"
              alt="Search query"
              draggable="false"
            />
            {cropCoordinates && cropCoordinates.x !== -1 && (
              <div
                className="preview-crop-indicator"
                style={{
                  left: `${cropCoordinates.x * 100}%`,
                  top: `${cropCoordinates.y * 100}%`,
                  width: `${cropCoordinates.width * 100}%`,
                  height: `${cropCoordinates.height * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MinimizedSearchBar;

