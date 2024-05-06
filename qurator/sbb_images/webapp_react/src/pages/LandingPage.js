import React from 'react';
import {useState} from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SearchTabs from '../components/SearchTabs';
import SearchResults from '../components/SearchResults';
import Introduction from '../components/Introduction';

import { makeSearchState }  from '../components/SearchState';
const LandingPage = () => {
  console.log("Landing Page is rendered");

  const [searchState, setSearchState] = useState(makeSearchState);

  const [ searchResult, setSearchResult] = useState({ type: null, ids: []});

  const [activeTab, setActiveTab] = useState('image');

  const updateResults = (results) => {
    setSearchResult(results);
  }

  const searchMore = (img_id) => {
        setActiveTab("image");

        setSearchState(searchState.setImgUrlWithID("api/image/DIGISAM/" + img_id, img_id));
  };

  console.log("LandingPage searchState", searchState);

  return (
    <div>
      <Header />
      <Introduction /> 
      <SearchTabs
        updateResults={updateResults}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchState={searchState}
        setSearchState={setSearchState}
      />

      <SearchResults searchResult={searchResult} searchMore={searchMore} activeTab={activeTab}/>
      <Footer />
    </div>
  );
};

export default LandingPage;
