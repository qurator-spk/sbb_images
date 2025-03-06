import React from "react";
import { useNavigate, useState } from "react-router-dom";
import '../styles/SearchSimilarImages.css';

const SearchSimilarImages = ({ searchState, setSearchState, imageId, updateResults }) => {
  const navigate = useNavigate();

  const handleClick = async () => {
     window.scrollTo(0, 0);

     setSearchState(searchState.setImgUrlWithID(`api/image/DIGISAM/${imageId}`, imageId));

     updateResults();
  };

   return (
    <button className="search-button" onClick={handleClick}>
      Search Similar Images
    </button>
  ); 
};

export default SearchSimilarImages;

