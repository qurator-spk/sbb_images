import React, { useState, useRef, useEffect } from "react";
import SearchSimilarImages from "./SearchSimilarImages";
import { sanitizePPN } from "../components/SearchState";

const SearchResult = ({
  img_id
  }) => { 

    const [ isLoaded, setIsLoaded] = useState(false);

    const onLoad = () => {
        setIsLoaded(true);
    }

    return (
        <div className='card-image-wrapper'>
         {!isLoaded && <div className="imgLoader"></div>}
            <img loading="lazy"
              src={"api/image/DIGISAM/" + img_id}
              onLoad={onLoad}
              //className='card-image'
              className={`card-image ${!isLoaded ? 'not-loaded' : ''}`}
            />
        </div>
    );
};

const SearchResults = ({
    updateResults,
    searchResult,
    searchState,
    setSearchState,
    loadNextBatch,
    isLoadingNextBatch,
    cropCoordinates
  }) => {

  const isLoadingBatch = useRef(false); // tracking batch loads
  
  if (!searchState) {
    return null;
  }

  const [links, setLinks] = useState({});

  // Load links when results arrive
  useEffect(() => {
    if (searchResult.ids) {
        searchResult.ids.forEach(async (imgID) => {
          const response = await fetch(`api/link/DIGISAM/${imgID}`);
          const link = await response.text();
          setLinks((prev) => ({
            ...prev,
            [imgID]: link.replace(/"/g, "").trim(),
          }));
        });
    }
  }, [searchResult.ids, searchResult.type]); 

  //******************SCROLL*********************** */

   // scroll detection
    useEffect(() => {
    const handleScroll = async () => {

//      console.log(
//        "Scroll triggered, isLoadingBatch is:",
//        isLoadingBatch.current
//      );

      if (!isLoadingBatch.current) {
        const reachedBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 100;

        if (reachedBottom) {
//          console.log("Bottom reached, about to set isLoadingBatch to true");
          isLoadingBatch.current = true;
          await loadNextBatch();
//          console.log(
//            "loadNextBatch finished, about to set isLoadingBatch to false"
//          );

          isLoadingBatch.current = false;
        }
      }
    }; 

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadNextBatch]);

  //**************************************************** */
  
    return (
      <div className='search-results-container'>

        <h3 className="results-heading">
          {searchResult.type === 'image' && 'Images similar to your query image, shown from most to least similar'}
          {searchResult.type === 'description' && `Images matching the description "${searchState.description}", shown from most to least matching`}
          {searchResult.type === 'ppn' && (
           <>
              Images from the document with PPN <a href={`https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN${searchState.ppn}`} target="_blank" rel="noopener noreferrer">{sanitizePPN(searchState.ppn)}</a>,
              shown in the order they appear in the document
            </>
          )}
        </h3>

        <div className="search-results-grid">
          {searchResult.ids &&
            searchResult.ids.map((imgID, pos) => (
               <div className="result-card" key={"result-card-" + imgID + "-" + pos}>
               {/*<div> {imgID} </div>
               <div> {pos} </div>*/}
                <div className="image-container">
                  <SearchResult
                    key={"result-" + imgID + "-" + pos}
                    img_id={imgID}
                  />
                </div>

                <a
                  href={links[imgID]}
                  className="view-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View in Digitized Collections
                </a>

                <SearchSimilarImages
                  searchState={searchState}
                  setSearchState={setSearchState}
                  imageId={imgID}
                  updateResults={updateResults}
                />
              </div>
            ))}
        </div>
        
        {/* Loader at the bottom */}
        {isLoadingNextBatch && (
          <div className="batch-loader-container">
            <div className="batch-loader"></div>
          </div>
        )}
      </div>
    );
  };

  export default SearchResults
  