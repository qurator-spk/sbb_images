// This one needs cleaning!!!!

import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import SearchResults from "../components/SearchResults";
import { makeSearchState } from "../components/SearchState";
import "../styles/SearchResultsPage.css";

import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

const SearchResultsPage = () => {
  const location = useLocation();
 // console.log("SearchResultsPage rendered, location state:", location.state);
  
  const {
    searchResult: initialSearchResult,
    activeTab: initialActiveTab,
    searchState: initialSearchState,
  } = location.state || {};

  
  //***************for scrolling ******************
 // const [searchPos, setSearchPos] = useState(0);
  // *********************************************


  // new state to fix the resuls page title issue
  // const [originalSearchType, setOriginalSearchType] = useState(initialActiveTab);
  /* const [lastPerformedSearch, setLastPerformedSearch] = useState(
    initialSearchResult?.type === "image" ? "image" : initialActiveTab
  );
  const [activeTab, setActiveTab] = useState(
    initialSearchResult?.type === "image" ? "image" : initialActiveTab || "image"
  ); */


  const [lastPerformedSearch, setLastPerformedSearch] = useState(initialActiveTab);
  // console.log("Initial search state in SearchResultsPage:", initialSearchState);

  /* const [searchState, setSearchState] = useState(
    initialSearchState || makeSearchState()
  ); */

//=========================================================
const [searchState, setSearchState] = useState(() => {
  if (initialSearchState) {
    const fullSearchState = makeSearchState();
    return {
      ...fullSearchState,
      ...initialSearchState,
    };
  }
  return makeSearchState();
});

//========================================================

  const [searchResult, setSearchResult] = useState(
    initialSearchResult || { type: null, ids: [] }
  );
  const [activeTab, setActiveTab] = useState(initialActiveTab || "image");
  
   const updateResults = (results) => {
    console.log("Updating results:", results);
    setSearchResult(results); 
    setLastPerformedSearch(results.type);  
    setActiveTab(results.type);            
  };

  const searchMore = (img_id) => {
    window.scrollTo(0, 0); // for scrolling to top when searching from image search results
    setActiveTab("image");
  //  setLastPerformedSearch("image");
    setSearchState((prevState) =>
      prevState.setImgUrlWithID(`api/image/DIGISAM/${img_id}`, img_id)
    );
    searchByImage(img_id);
  };

  const searchByImage = async (img_id) => {
    console.log("searchByImage called with img_id:", img_id);
      const response = await fetch(
        `api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100?search_id=${img_id}&search_id_from=DIGISAM`
      );
      const result = await response.json();
      console.log("Search result:", result);
      updateResults({ type: "image", ids: result.ids });
  };

  /* Cropper search functionality */

  const handleCrop = (e) => {
    const cropperInstance = e?.target?.cropper;
    if (!cropperInstance) {
      console.log("No cropper instance in event");
      return;
    }

          const canvasData = cropperInstance.getCanvasData();
          const cropData = cropperInstance.getCropBoxData();
          const imageData = cropperInstance.getImageData();

          console.log("Raw data:", {
            canvasData,
            cropData,
            imageData,
          });

          const x = (cropData.left - canvasData.left) / imageData.width;
          const y = (cropData.top - canvasData.top) / imageData.height;
          const width = cropData.width / imageData.width;
          const height = cropData.height / imageData.height;

          console.log("Calculated coordinates:", { x, y, width, height });

          fetch(
             `api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100/${x}/${y}/${width}/${height}?search_id=${searchState.img_id}&search_id_from=DIGISAM`
           // `api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/10/${x}/${y}/${width}/${height}?search_id=${searchState.img_id}&search_id_from=DIGISAM` // Changed 100 to 10
          )
            .then((response) => response.json())
            .then((result) => {
              setActiveTab("image");
              updateResults({ type: "image", ids: result.ids });
            });
  };



  return (
    <div className="search-results-page">
      <Header />
      <div className="search-page-title">
       <h2>
       {lastPerformedSearch === "ppn"
        ? "PPN Search Results"
        : lastPerformedSearch.charAt(0).toUpperCase() +
          lastPerformedSearch.slice(1) +
          " Search Results"}

       {/* {lastPerformedSearch.charAt(0).toUpperCase() +
            lastPerformedSearch.slice(1)}{" "}
          Search Results */}


       {/* {originalSearchType.charAt(0).toUpperCase() + originalSearchType.slice(1)} Search Results */}
        {/* {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Search Results */}
      </h2>
      </div>

    {/* {activeTab === "image" && searchState.imgUrl && ( */}
    {lastPerformedSearch === "image" && searchState.imgUrl && (
      <div className='query'>
        <h3 className='browse-search'>Your search</h3>
      <div className="query-image-container">
       {/*  <Tabs
        updateResults={updateResults}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchState={searchState}
        setSearchState={setSearchState}
        isResultsPage={true} 
      /> */}
        
        <Cropper
          src={searchState.imgUrl}
          // style={{ height: 400, width: '100%' }}
          style={{ width: '60%', maxHeight: '40vh' }}
          aspectRatio={NaN}
          guides={true}
          viewMode={2}
          background={false}
          responsive={true}
          restore={false}
          checkOrientation={false}
          cropBoxMovable={true}
          cropBoxResizable={true}
          dragMode="crop"
          autoCropArea={1}
          zoomable={false}
          scalable={false}
          cropend={handleCrop} 
        />
      </div>
      </div>
    )}

       <Tabs
        updateResults={updateResults}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchState={searchState}
        setSearchState={setSearchState}
        isResultsPage={true} 
      /> 
      <SearchResults
        searchResult={searchResult}
        searchMore={searchMore}
        activeTab={activeTab}
        searchState={searchState}
       // setSearchResult={setSearchResult}
      //  onLoadMore={loadMoreResults} // added for scrolling
      />
    </div>
  );
};

export default SearchResultsPage;