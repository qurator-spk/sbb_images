import React, { useState, useRef, useEffect } from "react";
import SearchSimilarImages from "./SearchSimilarImages";
import { sanitizePPN } from "../components/SearchState";
import ShareButton from "../components/ShareButton";

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
  const [titles, setTitles] = useState({});

  // Load links when results arrive
  useEffect(() => {

    const fetchLinks = async () => {
        if (searchResult.ids) {

            const response = await fetch(
              `api/link/DIGISAM`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({"ids" : searchResult.ids} ),
              }
            );

            let result = await response.json();

            setLinks(result);
        }
     };

     fetchLinks();
  }, [searchResult.ids, searchResult.type]); 

  // Fetching titles similar to how the links were fetched
  useEffect(() => {
    const fetchTitles = async () => {
      if (searchResult.ids && searchResult.ids.length > 0) {
          const response = await fetch(
            `api/mods_info/DIGISAM`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({"ids": searchResult.ids}),
            }
          );

          let result = await response.json();
          setTitles(result);
      }
    };
    
    fetchTitles();
  }, [searchResult.ids]);

  //******************SCROLL*********************** */

   // scroll detection
    useEffect(() => {
    const handleScroll = async () => {
      if (!isLoadingBatch.current) {
        const reachedBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 100;

        if (reachedBottom) {
          isLoadingBatch.current = true;
          await loadNextBatch();

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
        <div className='search-results-heading-container'>
        <h3 className="results-heading">
          {searchResult.type === 'image' && 'Images similar to your query image, shown from most to least similar'}
          {searchResult.type === 'description' && (
            <>
              Images matching the description "
                <span className="description-highlight">{searchState.description}</span>
              ", shown from most to least matching
            </>
          )}
          {searchResult.type === 'ppn' && (
           <>
              Images from the document with PPN <a href={`https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN${sanitizePPN(searchState.ppn)}`} target="_blank" rel="noopener noreferrer">{sanitizePPN(searchState.ppn)}</a>,
              shown in the order they appear in the document
            </>
          )}
        </h3>
        <ShareButton searchState={searchState} />
        </div>

        <div className="search-results-grid">
          {searchResult.ids &&
            searchResult.ids.map((imgID, pos) => (
                <div className="card" key={"result-card-" + imgID + "-" + pos}>  
                <div className="card-image-container">
                  <SearchResult
                    key={"result-" + imgID + "-" + pos}
                    img_id={imgID}
                  />
                </div>

                <a
                  href={links[imgID]}
                  className="card-title-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-title={titles[imgID] ? titles[imgID].title : ""}
                >
                  <div className="card-title-wrapper">
                  {titles[imgID] ? titles[imgID].title : "View in Digitized Collections"}
                  </div> 
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
  