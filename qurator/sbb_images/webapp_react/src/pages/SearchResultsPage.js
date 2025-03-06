import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import SearchResults from "../components/SearchResults";
import { makeSearchState } from "../components/SearchState";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import "../styles/SearchResultsPage.css";

const SearchResultsPage = () => {

  const location = useLocation();

  const [searchState, setSearchState] =
    useState(location.state ? makeSearchState(location.state.searchState) : makeSearchState);

  const navigate = useNavigate();

  const [searchResult, setSearchResult] = useState({ type: "no", ids: []});

  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);

  const [activeTab, setActiveTab] = useState(searchState.type);

  const [error, setError] = useState(null);

//****************Setting Cropper Coordinates**************** */

  const [cropCoordinates, setCropCoordinates] = useState(() =>{ return {
    x: -1,
    y: -1,
    width: -1,
    height: -1,
  }; });

//************************************************************** */

  useEffect(() => {

    setIsLoadingNextBatch(true);
    setSearchResult({ type: searchState.type, ids: []});

    setError(null);
    try {
        searchState.loadNextBatch(0, cropCoordinates).then(
            (r) => {
                setSearchResult(r)
                setIsLoadingNextBatch(false);
            }
         ).catch((error) => {
            setIsLoadingNextBatch(false);
            setError(error.message);

            setSearchResult({ type: "no", ids: []});
         });
     }
     catch(error) {
        setError(error.message);
     }

  }, [searchState, cropCoordinates]);

  useEffect(() => {
    const popState = () => {
        navigate(0);
    };

    window.addEventListener("popstate", popState);

    return () => {
       window.removeEventListener("popstate", popState);
    }
  }, []);

//************************************************************** */

  const isLoadingBatch = useRef(false);

  const loadNextBatch = async () => {
    if (isLoadingBatch.current) return;
    if ((searchResult.type === "ppn") && (searchResult.ids.length > 0)) return;

    isLoadingBatch.current = true;
    setIsLoadingNextBatch(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      let result = await searchState.loadNextBatch(searchResult.ids.length, cropCoordinates);

      if (result.ids && result.ids.length > 0) {
        setSearchResult((prev) => ({
          ...prev,
          ids: [...prev.ids, ...result.ids],
        }));
      }
    } catch (error) {
      console.error("Error loading batch:", error);
    } finally {
      isLoadingBatch.current = false;
      setIsLoadingNextBatch(false);
    }
 };  //loadNextBatch

  const updateResults = (next_state) => {
      navigate("/search-results", {
        state: {
            activeTab,
            searchState: next_state.serialized,
        }
      });

      setActiveTab(next_state.type);
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

    setCropCoordinates({ x, y, width, height });

  }; // handleCrop

  return (
    <div className="search-results-page">
      <Header />
      <div className="search-page-title">
       <h2>
       {searchResult.type === "ppn"
        ? "PPN Search Results"
        : searchResult.type.charAt(0).toUpperCase() +
          searchResult.type.slice(1) +
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
        error={error}
      /> 

      {searchResult.type === "image" && searchState.imgUrl && (
      <div className='query'>
        <h3 className='browse-search'>Your search:</h3>
        <div className="query-image-container">  
          <Cropper
            key={searchState.imgUrl}
            src={searchState.imgUrl}
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
        updateResults={updateResults}
        searchResult={searchResult}
        searchState={searchState}
        setSearchState={setSearchState}
        loadNextBatch={loadNextBatch}
        isLoadingNextBatch={isLoadingNextBatch}
        cropCoordinates={cropCoordinates}
      />
    </div>
  );
};

export default SearchResultsPage;