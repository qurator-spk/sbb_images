import React from "react";
import { useNavigate, useState } from "react-router-dom";
import '../styles/SearchSimilarImages.css';

const SearchSimilarImages = ({ imageId, isFromResults, onSearchMore }) => {
const navigate = useNavigate();

  const handleClick = async () => {
    if (isFromResults) {
      // on results page - use existing searchMore
      onSearchMore(imageId);
    } else {
      // on landing page - fetch results and navigate
      const response = await fetch(
        `api/similar-by-image/DIGISAM-DEFAULT/0/100?search_id=${imageId}&search_id_from=DIGISAM`
      );
      const result = await response.json();

      navigate("/search-results", {
        state: {
          searchResult: { type: "image", ids: result.ids },
          activeTab: "image",
          searchState: {
            imgUrl: `api/image/DIGISAM/${imageId}`,
            img_id: imageId,
            description: "",
            ppn: "",
          },
        },
      });
    }
  };

   return (
    <button className="search-button" onClick={handleClick}>
      Search Similar Images
    </button>
  ); 
};

export default SearchSimilarImages;

