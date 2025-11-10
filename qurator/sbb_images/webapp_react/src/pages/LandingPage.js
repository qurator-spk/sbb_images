import React, { useState, useEffect } from "react"; 
import { useNavigate } from "react-router-dom"; 
import Header from "../components/Header"; 
import Tabs from "../components/Tabs"; 
import Intro from "../components/Intro"; 
import RandomImages from "../components/RandomImages"; 
import "../styles/LandingPage.css";
import { makeSearchState } from "../components/SearchState";

const LandingPage = () => {
  const [searchState, setSearchState] = useState(makeSearchState);

  const [activeTab, setActiveTab] = useState("image");

  const navigate = useNavigate();

  const updateResults = (next_state) => {
      try {
          navigate("/search-results", {
            state: {
                activeTab,
                searchState: next_state.serialized,
            }
          });
      }
      catch(error) {
        console.log("Failed to navigate:", error.message)
        setSearchState(next_state);
      }
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
      />    
      <RandomImages
        searchState={searchState}
        setSearchState={setSearchState}
        updateResults={updateResults}
      />
    </div>
  );
};

export default LandingPage;