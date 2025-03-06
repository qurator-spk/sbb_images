import React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'; 
import LandingPage from './pages/LandingPage'; 
import SearchResultsPage from './pages/SearchResultsPage';
import AboutPage from "./pages/AboutPage";
import './styles.css';
import './App.css'

import { makeSearchState } from "./components/SearchState";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const { state } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, state]);

  return null;
};

const App = () => {

  const [searchState, setSearchState] = useState( makeSearchState);

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={
            <LandingPage
               searchState={searchState}
               setSearchState={setSearchState}
            />}
        />
        <Route path="/search-results" element={
           <SearchResultsPage
              searchState={searchState}
              setSearchState={setSearchState}
           />}
        />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
};

export default App;




// Old, working App, before trying our results in a diff page 08.2024

/* import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchResultsPage from './pages/SearchResultsPage';
import './styles.css'

const App = () => {
  
  return (
    <Router>
      <Routes>
        <Route path="/" exact element={<LandingPage />} />
        <Route path="/search-results" component={SearchResultsPage} />
      </Routes>
    </Router>
  );
};

export default App;
 */