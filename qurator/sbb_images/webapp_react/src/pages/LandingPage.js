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

  const [ ids, setIds] = useState([]);

  const [activeTab, setActiveTab] = useState('image');

  const [searchState, setSearchState] = useState(makeSearchState());

  const updateResults = (ids) => {
    setIds(ids);
  }

  const searchMore = (img_id) => {
        setActiveTab("image");

        setSearchState(searchState.setImgUrlWithID("api/image/DIGISAM/" + img_id, img_id));
  };

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
      <SearchResults ids={ids} searchMore={searchMore}/>
      <Footer />
    </div>
  );
};

export default LandingPage;
