import React from 'react';
import {useState} from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SearchTabs from '../components/SearchTabs';
import SearchResults from '../components/SearchResults';
import Introduction from '../components/Introduction';

const LandingPage = () => {
  console.log("Landing Page is rendered");

  const [ ids, setIds] = useState([]);

  const updateResults = (ids) => {
    setIds(ids);
  }

  return (
    <div>
      <Header />
      <Introduction /> 
      <SearchTabs updateResults={updateResults} />
      <SearchResults ids= {ids}/>
      <Footer />
    </div>
  );
};

export default LandingPage;
