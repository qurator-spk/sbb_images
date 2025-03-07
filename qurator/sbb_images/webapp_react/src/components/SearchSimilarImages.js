import React from "react";
import { useState } from "react-router-dom";
import '../styles/SearchSimilarImages.css';

const SearchSimilarImages = ({ searchState, setSearchState, imageId, updateResults }) => {
  const handleClick = async () => {
     window.scrollTo(0, 0);

     const next_state = searchState.setImgUrlWithID(`api/image/DIGISAM/${imageId}`, imageId)

     setSearchState(next_state);

     updateResults(next_state);
  };

   return (
    <button className="search-button" onClick={handleClick}>
      Search Similar Images
    </button>
  ); 
};

export default SearchSimilarImages;

