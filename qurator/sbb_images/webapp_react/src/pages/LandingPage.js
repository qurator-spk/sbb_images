import React, { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom"; 
import Header from "../components/Header"; 
import Tabs from "../components/Tabs"; 
import Intro from "../components/Intro"; 
import RandomImages from "../components/RandomImages"; 
import { makeSearchState } from "../components/SearchState";

const LandingPage = () => {
  const [searchState, setSearchState] = useState(makeSearchState());
  const [activeTab, setActiveTab] = useState("image");
  const navigate = useNavigate();

  const handleSearchStateChange = (newState) => {
   // console.log("handleSearchStateChange called with:", newState);
    setSearchState(newState);
  };

  const updateResults = (results, searchTerm) => {
   // console.log("updateResults called with:", results, searchTerm);
   // console.log("Current searchState in updateResults: ", searchState);

    const serializableSearchState = {
      imgUrl: activeTab === "image" ? searchTerm : searchState.imgUrl,
      description:
        activeTab === "description" ? searchTerm : searchState.description,
      ppn: activeTab === "ppn" ? searchTerm : searchState.ppn,
      img_id: searchState.img_id,
    };

  //console.log("Navigating with serializable state:", serializableSearchState);

  navigate("/search-results", {
    state: {
      searchResult: results,
      activeTab,
      searchState: serializableSearchState,
    },
  });
};

  return (
    <div className="LandingPage">
      <Header />
      <Intro />
      <Tabs
        updateResults={updateResults}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchState={searchState}
        setSearchState={setSearchState}
        onSearchStateChange={handleSearchStateChange} // to communicate with Tabs
      />
      <RandomImages />
    </div>
  );
};

export default LandingPage;