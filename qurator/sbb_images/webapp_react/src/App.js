import React from 'react';
import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'; 
import LandingPage from './pages/LandingPage'; 
import SearchResultsPage from './pages/SearchResultsPage';
import AboutPage from "./pages/AboutPage";
import './styles.css';
import './App.css'


const ScrollToTop = () => {
  const { pathname } = useLocation();
  const { state } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, state]);

  return null;
};

const App = () => {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search-results" element={<SearchResultsPage />} />
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