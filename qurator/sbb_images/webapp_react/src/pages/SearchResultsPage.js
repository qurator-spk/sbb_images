import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import SearchResults from "../components/SearchResults";
import { makeSearchState } from "../components/SearchState";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import "../styles/SearchResultsPage.css";

const SearchResultsPage = () => {
  const location = useLocation();
  
  const {
    searchResult: initialSearchResult,
    activeTab: initialActiveTab,
    searchState: initialSearchState,
  } = location.state || {};

  const [lastPerformedSearch, setLastPerformedSearch] = useState(initialActiveTab);
  
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
  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);

//****************Setting Cropper Coordinates**************** */

  const [cropCoordinates, setCropCoordinates] = useState({
    x: -1,
    y: -1,
    width: -1,
    height: -1,
  });

//************************************************************** */
  const isLoadingBatch = useRef(false);
  const loadNextBatch = async () => {
    if (searchResult.type === "ppn" || isLoadingBatch.current) {
      return;
    }

    isLoadingBatch.current = true;
    setIsLoadingNextBatch(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const nextBatchPosition = searchResult.ids.length;

    try {
      let response;
      // Check if we have crop coordinates to use
      const hasCrop = cropCoordinates.x !== -1;
      const { x, y, width, height } = hasCrop
        ? cropCoordinates
        : { x: -1, y: -1, width: -1, height: -1 };

      if (searchResult.type === "description") {
        const params = { text: searchState.description };
        response = await fetch(
          `api/similar-by-text/DIGISAM-DEFAULT/${nextBatchPosition}/100`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          }
        );
      } else if (
        searchState.imgUrl &&
        searchResult.type === "image" &&
        !searchState.formData
      ) {
        const imageResponse = await fetch(searchState.imgUrl);
        const imageBlob = await imageResponse.blob();
        let fd = new FormData();
        fd.append("file", imageBlob);

        if (hasCrop) {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100/${x}/${y}/${width}/${height}`,
            {
              method: "POST",
              body: fd,
            }
          );
        } else {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100`,
            {
              method: "POST",
              body: fd,
            }
          );
        }
      } else if (searchState.formData) {
        let fd = new FormData();
        fd.append("file", searchState.formData.get("file"));

        if (hasCrop) {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100/${x}/${y}/${width}/${height}`,
            {
              method: "POST",
              body: fd,
            }
          );
        } else {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100`,
            {
              method: "POST",
              body: fd,
            }
          );
        }
      } else {
        if (hasCrop) {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100/${x}/${y}/${width}/${height}?search_id=${searchState.img_id}&search_id_from=DIGISAM`
          );
        } else {
          response = await fetch(
            `api/similar-by-image/DIGISAM-DEFAULT/${nextBatchPosition}/100?search_id=${searchState.img_id}&search_id_from=DIGISAM`
          );
        }
      }

      const result = await response.json();

      if (result.ids && result.ids.length > 0) {
        const uniqueNewIds = result.ids.filter(
          (id) => !searchResult.ids.includes(id)
        );
        setSearchResult((prev) => ({
          ...prev,
          ids: [...prev.ids, ...uniqueNewIds],
        }));
      }
    } catch (error) {
      console.error("Error loading batch:", error);
    } finally {
      isLoadingBatch.current = false;
      setIsLoadingNextBatch(false);
    }
  };

  const updateResults = (results) => {
    setSearchResult(results); 
    setLastPerformedSearch(results.type);  
    setActiveTab(results.type);            
  };

  const searchMore = (img_id) => {
  // Reseting crop coordinates when starting a new search
    setCropCoordinates({ x: -1, y: -1, width: -1, height: -1 });

    window.scrollTo(0, 0); // for scrolling to top when searching from image search results
    setActiveTab("image");
    setSearchState((prevState) =>
      prevState.setImgUrlWithID(`api/image/DIGISAM/${img_id}`, img_id)
    );
    searchByImage(img_id);
  };

  const searchByImage = async (img_id) => {
    const response = await fetch(
     `api/similar-by-image/DIGISAM-DEFAULT/0/100?search_id=${img_id}&search_id_from=DIGISAM`
    );
    const result = await response.json();
    updateResults({ type: "image", ids: result.ids });
  };

  /*******************Cropper search functionality************************/

  const handleCrop = async (e) => {
    const cropperInstance = e?.target?.cropper;
    if (!cropperInstance) return;
  
    // Calculate crop coordinates
    const canvasData = cropperInstance.getCanvasData();
    const cropData = cropperInstance.getCropBoxData();
    const imageData = cropperInstance.getImageData();
  
    const x = (cropData.left - canvasData.left) / imageData.width;
    const y = (cropData.top - canvasData.top) / imageData.height;
    const width = cropData.width / imageData.width;
    const height = cropData.height / imageData.height;
  
    try {
      let response;
  
      // Case 1: Image has an ID (from search results)
      if (searchState.img_id) {
        console.log("Using img_id for search:", searchState.img_id);
        response = await fetch(
          `api/similar-by-image/DIGISAM-DEFAULT/0/100/${x}/${y}/${width}/${height}?search_id=${searchState.img_id}&search_id_from=DIGISAM`
        );
      }
      // Case 2: Uploaded image (no ID)
      else {
        console.log("Using uploaded image blob for search");
        const imageResponse = await fetch(searchState.imgUrl);
        const imageBlob = await imageResponse.blob();
  
        // FormData to send the image
        const fd = new FormData();
        fd.append("file", imageBlob);
  
        response = await fetch(
          `api/similar-by-image/DIGISAM-DEFAULT/0/100/${x}/${y}/${width}/${height}`,
          {
            method: "POST",
            body: fd,
          }
        );
      }
  
      const result = await response.json();
      // Store coordinates 
      setCropCoordinates({ x, y, width, height });

      setActiveTab("image");
      updateResults({ type: "image", ids: result.ids });
    } catch (error) {
      console.error("Error in crop search:", error);
    }
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
      </h2>
      </div>

      <Tabs
        updateResults={updateResults}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchState={searchState}
        setSearchState={setSearchState}
        isResultsPage={true} 
      /> 

      {lastPerformedSearch === "image" && searchState.imgUrl && (
      <div className='query'>
        <h3 className='browse-search'>Your search:</h3>
        <div className="query-image-container">  
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

      <SearchResults
        searchResult={searchResult}
        searchMore={searchMore}
        activeTab={activeTab}
        searchState={searchState}
        loadNextBatch={loadNextBatch}
        isLoadingNextBatch={isLoadingNextBatch} 
      />
    </div>
  );
};

export default SearchResultsPage;