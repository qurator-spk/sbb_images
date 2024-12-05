import React, { useState, useRef, useEffect } from "react";
import SearchSimilarImages from "./SearchSimilarImages";

const SearchResult = ({searchMore, img_id, loadPos, searchResult, activeTab, pos}) => {

    const minLoadInterval = 200;

    const [ isLoaded, setIsLoaded] = useState(false);

    const [ imgSrc, setImgSrc] = useState("");

    const triggerNext = () => {
        setIsLoaded(true);
    };

    const imageLoader = async() => {
      //  console.log("Starting to load image:", img_id); 
        const response = await fetch("api/image/DIGISAM/" + img_id);

        const img = await response.blob();

        const imgUrl = URL.createObjectURL(img);

        setImgSrc(imgUrl);
      //  console.log("Finished loading image:", img_id);
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
              // block added for debugging
             /*  console.log("Waiting for next image...", {
                currentLoadPos: loadPos.current,
                expectedId: searchResult.ids[loadPos.current],
                thisId: img_id,
              }); */
              // ends here
                setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
                return;
            }

           // console.log("Starting loadWaiter for image:", img_id);
            imageLoader();

            if (exitCondition(sresult)) return;
    
            loadPos.current = loadPos.current + 1;
           // console.log("Increased loadPos to:", loadPos.current);
        };

    useEffect(() => {
        console.log("SearchResult loadPos.current", loadPos.current);

        ((sresult) => {
            setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
        })(searchResult);

    },[searchResult]);

    return (
        <div style={isLoaded ? {} : { display: 'none'}} className='card-image-wrapper'>
            <img src={imgSrc} onLoad={() => {setIsLoaded(true)}} className='card-image' /> 

           {/*  <button onClick={() => searchMore(img_id)}>
                Search Similar Images
            </button> */}

            {/* Adding the component to search similar images */}

           {/*  <SearchSimilarImages 
              imageId={img_id}
              isFromResults={true}
              onSearchMore={searchMore}
            /> */}
        </div>
    );
};

const SearchResults = ({
    searchResult,
    searchMore,
    activeTab,
    searchState,
  }) => {
    /* console.log("SearchResults rendered", {
      searchResult,
      activeTab,
      searchState,
    }); */
  
    const loadPos = useRef(0);
    loadPos.current = 0;
  
    if (!searchState) {
      return null;
    }

  const [links, setLinks] = useState({});
  // load links when results arrive
  useEffect(() => {
    if (searchResult.ids) {
      //*****************order ppn results******************** */
      if (searchResult.type === "ppn") {
        // For PPN search: fetch all links at once and sort by page number
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
        // For other searches: fetch links without sorting
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
  
    return (
      <div className='search-results-container'>

        <h3 className="results-heading">
          {searchResult.type === 'image' && 'Images similar to your query image'}
          {searchResult.type === 'description' && `Images matching the description "${searchState.description}"`}
          {searchResult.type === 'ppn' && (
           <>
              Images from the document with PPN <a href={`https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN${searchState.ppn}`} target="_blank" rel="noopener noreferrer">{searchState.ppn}</a>
            </>
          )}
        </h3>

        <div className="search-results-grid">
          {searchResult.ids &&
            searchResult.ids.map((imgID, pos) => (
              <div className="result-card" key={imgID}>
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
      </div>
    );
  };

  export default SearchResults
  