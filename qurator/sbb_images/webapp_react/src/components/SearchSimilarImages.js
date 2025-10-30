import React from "react";
import '../styles/SearchSimilarImages.css';

const SearchSimilarImages = ({ searchState, setSearchState, imageId, updateResults }) => {
  const handleClick = async () => {
     window.scrollTo(0, 0);

     const next_state = searchState.setImgUrlWithID(`api/image/DIGISAM/${imageId}`, imageId)

     setSearchState(next_state);

     updateResults(next_state);
  };

   return (
    <button 
      className="search-button" 
      onClick={handleClick} 
      aria-label="Search for images similar to this one"
    >
      Search similar images
    </button>
  ); 
};

export default SearchSimilarImages;

