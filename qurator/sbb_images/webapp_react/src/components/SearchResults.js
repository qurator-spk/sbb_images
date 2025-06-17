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

    //        searchResult.ids.forEach(async (imgID) => {
    //          const response = await fetch(`api/link/DIGISAM/${imgID}`);
    //          const link = await response.text();
    //          setLinks((prev) => ({
    //            ...prev,
    //            [imgID]: link.replace(/"/g, "").trim(),
    //          }));
    //        });
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

 /*   useEffect(() => {
    const timeoutId = setTimeout(() => {
    const fetchTitles = async () => {
      if (searchResult.ids && searchResult.ids.length > 0) {
        const idsToFetch = searchResult.ids.filter(id => !titles[id]);
        if (idsToFetch.length === 0) return; // no new titles to fetch
       
        try {
          const response = await fetch(
            `api/mods_info/DIGISAM`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // body: JSON.stringify({"ids": searchResult.ids}),
              body: JSON.stringify({"ids": idsToFetch}),
            }
          );
  
          if (response.ok) {
            const result = await response.json();

          // Merging new titles with existing ones
            setTitles(prevTitles => ({
              ...prevTitles,
              ...Object.fromEntries(
                Object.entries(result).map(([id, data]) => [id, data.title || ""])
              )
            }));
          } else {
            console.error("Failed to fetch titles in batch, status:", response.status);
          }
        } catch (error) {
          console.error("Error fetching batch titles:", error);
        }
      }
    };
  
    fetchTitles();
    }, 300); // added a short timeout because it seems to behave better?
    return () => clearTimeout(timeoutId); 
  }, [searchResult.ids]);  */

 
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
          {searchResult.type === 'description' && `Images matching the description "${searchState.description}", shown from most to least matching`}
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
                // <div className="result-card" key={"result-card-" + imgID + "-" + pos}>
                <div className="card" key={"result-card-" + imgID + "-" + pos}>  
               {/*<div> {imgID} </div>
               <div> {pos} </div>*/}
                {/* <div className="image-container"> */}
                <div className="card-image-container">
                  <SearchResult
                    key={"result-" + imgID + "-" + pos}
                    img_id={imgID}
                  />
                </div>

                <a
                  href={links[imgID]}
                  // className="view-link"
                  className="card-title-link"
                  target="_blank"
                  rel="noopener noreferrer"
                 // data-title={titles[imgID] || ""}
                 data-title={titles[imgID] ? titles[imgID].title : ""}
                >
                  {/* View in Digitized Collections  */}
                  {/* <div className="title-wrapper"> */}
                  <div className="card-title-wrapper">
                  {/*  {titles[imgID] || "View in Digitized Collections"} */}
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
  