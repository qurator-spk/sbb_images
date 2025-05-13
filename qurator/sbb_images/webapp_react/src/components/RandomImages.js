import React, { useState, useEffect } from "react";
import allImages from "../data/imageData";
import SearchSimilarImages from "./SearchSimilarImages";
import '../styles/RandomImages.css';
import "../styles.css"

const RandomImages = ({searchState, setSearchState, updateResults}) => {
  const [images, setImages] = useState([]);
  const [imageTitles, setImageTitles] = useState([]);

  const getImageId = (src) => {
    return src.split("/").pop();
  };

  useEffect(() => {
    const selectRandomImages = () => {
      const shuffled = allImages.sort(() => 0.5 - Math.random()); 
      setImages(shuffled.slice(0, 16)); 
    };

    selectRandomImages();
  }, []);

  useEffect(() => {
    const fetchTitles = async () => {
      if (images.length > 0) {
        const newTitles = {};
        
        await Promise.all(images.map(async (image) => {
          const imageId = getImageId(image.src);
          try {
            const response = await fetch(`api/mods_info/DIGISAM/${imageId}`);
            if (response.ok) {
              const data = await response.json();
              newTitles[imageId] = data.title || "";
            }
          } catch (error) {
            console.error(`Error fetching title for image ${imageId}:`, error);
          }
        }));
        
        setImageTitles(newTitles);
      }
    };
  
    fetchTitles();
  }, [images]);

  /* return (
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
            <div className="title-wrapper">{image.title}</div>
          </a>

          <SearchSimilarImages
               searchState={searchState}
               setSearchState={setSearchState}
               imageId={getImageId(image.src)}
               updateResults={updateResults}
          />
        </div>
      ))}
    </div>
    </>
  ); */


  return (
    <>
      <h2 className='browse-search'>
        Or start the search by browsing our selection of images:
      </h2>
      <div className="image-grid">
        {images.map((image, index) => {
          const imageId = getImageId(image.src);
          const title = imageTitles[imageId] || image.title; // Fallback to hardcoded title
          
          return (
            // <div className="image-card" key={index}>
            <div className="card" key={index}>
              <div className="card-image-container">
                <img src={image.src} alt={title} className="card-image" />
              </div>
  
              <a 
                href={image.link} 
                className="card-title-link"
                target="_blank" 
                rel="noopener noreferrer"
                data-title={title} // Add the title as a data attribute for tooltip
              >
                <div className="card-title-wrapper">{title}</div>
              </a>
  
              <SearchSimilarImages
                searchState={searchState}
                setSearchState={setSearchState}
                imageId={getImageId(image.src)}
                updateResults={updateResults}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default RandomImages;
