import React, { useState, useRef, useEffect } from "react";
import "../styles/MinimizedSearchBar.css";

const MinimizedSearchBar = ({
  searchState,
  cropCoordinates,
  onBackToTopClick,
}) => {
  const [showImagePreview, setShowImagePreview] = useState(false);
  const canvasRef = useRef(null);

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
      searchState.description.length > 30
        ? searchState.description.substring(0, 30) + "..."
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
        <div className="thumbnail-preview">
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

