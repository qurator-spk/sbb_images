import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SearchTabs from '../components/SearchTabs';
import Introduction from '../components/Introduction';

const LandingPage = () => {
  console.log("Landing Page is rendered");
  return (
    <div>
      <Header />
      <Introduction /> 
      <SearchTabs />
      <Footer />
    </div>
  );
};

export default LandingPage;
