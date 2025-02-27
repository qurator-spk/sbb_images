import React, { useState, useRef, useEffect } from "react";
import SearchSimilarImages from "./SearchSimilarImages";

const SearchResult = ({
  searchMore, 
  img_id, 
  loadPos, 
  searchResult, 
  activeTab, 
  pos
  }) => { 

    const minLoadInterval = 200;

    const [ isLoaded, setIsLoaded] = useState(false);

    const [ imgSrc, setImgSrc] = useState("");

    const triggerNext = () => {
        setIsLoaded(true);
    };

    const imageLoader = async() => {
        const response = await fetch("api/image/DIGISAM/" + img_id);
        const img = await response.blob();
        const imgUrl = URL.createObjectURL(img);
        setImgSrc(imgUrl);
    };

    const exitCondition = (sresult) => {
        if (sresult != searchResult) return true;
        if (searchResult.type !== activeTab) return true;

        if (loadPos.current > pos) return true;
        if (loadPos.current >= searchResult.ids.length) return true;

        return false;
    }

    const loadWaiter = async(sresult) => {
      
             if (exitCondition(sresult)) 
              
              return; 

            if (searchResult.ids[loadPos.current] !== img_id) {
                setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
                return;
            }

            imageLoader();

            if (exitCondition(sresult)) return;
    
            loadPos.current = loadPos.current + 1;
        };

    useEffect(() => {
        ((sresult) => {
            setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
        })(searchResult);

    },[searchResult]);

    return (
        <div className='card-image-wrapper'>
         {!isLoaded && <div className="imgLoader"></div>}
            <img 
              src={imgSrc} 
              onLoad={() => {setIsLoaded(true)}} 
              className='card-image' 
              style={isLoaded ? {} : { display: "none" }} /*added for loaders*/ 
            /> 
        </div>
    );
};

const SearchResults = ({
    searchResult,
    searchMore,
    activeTab,
    searchState,
    loadNextBatch,
    isLoadingNextBatch,
  }) => {
    const loadPos = useRef(0);
     loadPos.current = 0; 

    const isLoadingBatch = useRef(false); // tracking batch loads
  
    if (!searchState) {
      return null;
    }

  const [links, setLinks] = useState({});
  // Load links when results arrive
  useEffect(() => {
    if (searchResult.ids) {
      //*****************order ppn results******************** */
      if (searchResult.type === "ppn") {
        // PPN search: fetch all links at once and sort by page number
        Promise.all(
          searchResult.ids.map(async (imgID) => {
            const response = await fetch(`api/link/DIGISAM/${imgID}`);
            const link = await response.text();
            const trimmedLink = link.replace(/"/g, "").trim();
            return { imgID, link: trimmedLink };
          })
        ).then((results) => {
          // Store links
          const newLinks = {};
          results.forEach(({ imgID, link }) => {
            newLinks[imgID] = link;
          });

          // Sort searchResult.ids by page number
          searchResult.ids.sort((a, b) => {
            const pageA = parseInt(newLinks[a].match(/PHYS_(\d+)/)[1]);
            const pageB = parseInt(newLinks[b].match(/PHYS_(\d+)/)[1]);
            return pageA - pageB;
          });

          setLinks(newLinks);
        });
      } else {
        // Other searches: fetch links without sorting
        searchResult.ids.forEach(async (imgID) => {
          const response = await fetch(`api/link/DIGISAM/${imgID}`);
          const link = await response.text();
          setLinks((prev) => ({
            ...prev,
            [imgID]: link.replace(/"/g, "").trim(),
          }));
        });
      }
    }
  }, [searchResult.ids, searchResult.type]); 

  //******************SCROLL*********************** */

   // scroll detection
    useEffect(() => {
    const handleScroll = async () => {
      /* console.log(
        "Scroll triggered, isLoadingBatch is:",
        isLoadingBatch.current
      ); */
      if (!isLoadingBatch.current) {
        const reachedBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 100;

        if (reachedBottom) {
         // console.log("Bottom reached, about to set isLoadingBatch to true");
          isLoadingBatch.current = true;
          await loadNextBatch();
          /* console.log(
            "loadNextBatch finished, about to set isLoadingBatch to false"
          ); */
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
              Images from the document with PPN <a href={`https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN${searchState.ppn}`} target="_blank" rel="noopener noreferrer">{searchState.ppn}</a>, 
              shown in the order they appear in the document
            </>
          )}
        </h3>

        <div className="search-results-grid">
          {searchResult.ids &&
            searchResult.ids.map((imgID, pos) => (
               <div className="result-card" key={imgID}>
              {/* <div className="result-card" key={`${imgID}-${pos}`}> */}
                <div className="image-container">
                  <SearchResult
                    key={imgID}
                    searchMore={searchMore}
                    img_id={imgID}
                    loadPos={loadPos}
                    searchResult={searchResult}
                    activeTab={activeTab}
                    pos={pos}
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
                  imageId={imgID}
                  isFromResults={true}
                  onSearchMore={searchMore}
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
  