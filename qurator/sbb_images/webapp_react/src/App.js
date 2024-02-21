import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchResultsPage from './pages/SearchResultsPage';
import HelpPage from './pages/HelpPage';
import './styles.css'

const App = () => {
  
  return (
    <Router>
      <Routes>
        <Route path="/" exact element={<LandingPage />} />
        <Route path="/search-results" component={SearchResultsPage} />
        <Route path="/help" component={HelpPage} />
      </Routes>
    </Router>
  );
};

export default App;
