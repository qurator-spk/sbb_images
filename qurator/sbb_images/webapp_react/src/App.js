import React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'; 
import LandingPage from './pages/LandingPage'; 
import SearchResultsPage from './pages/SearchResultsPage';
import SearchFor from './pages/SearchFor';
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

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={
            <LandingPage />}
        />
        <Route path="/search-results" element={
           <SearchResultsPage />}
        />
        <Route path="/searchfor" element={
           <SearchFor />}
        />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
};

export default App;