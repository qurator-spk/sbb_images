// Maybe make the card a separate component

import React, { useState, useEffect } from "react";
import allImages from "./imageData";
import SearchSimilarImages from "./SearchSimilarImages";
//import "./RandomImages.css";
import '../styles/RandomImages.css';

const RandomImages = () => {
  const [images, setImages] = useState([]);

  // function to extract id
  const getImageId = (src) => {
    // for URL format "api/image/DIGISAM/257062"
    return src.split("/").pop();
  };

  useEffect(() => {
    const selectRandomImages = () => {
      const shuffled = allImages.sort(() => 0.5 - Math.random()); 
      setImages(shuffled.slice(0, 16)); 
    };

    selectRandomImages();
  }, []);

  return (
    <>
    <h2 className="browse-search">
        Or start the search by browsing our selection of images:
      </h2>
    <div className="image-grid">
      {images.map((image, index) => (
        <div className="image-card" key={index}>
          <div className="image-container">
            <img src={image.src} alt={image.title} className="card-image" />
          </div>

          <a href={image.link} target="_blank" rel="noopener noreferrer">
            <div class="title-wrapper">{image.title}</div>
          </a>

          <SearchSimilarImages 
           imageId={getImageId(image.src)}
           isFromResults={false}
          />
        </div>
      ))}
    </div>
    </>
  );
};

export default RandomImages;