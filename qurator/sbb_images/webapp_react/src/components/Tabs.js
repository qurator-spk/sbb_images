import React, { useState } from 'react';
import DescriptionTab from './DescriptionTab';
import ImageTab from './ImageTab';
import PPNTab from './PPNTab';
import ResultsImageTab from './ResultsImageTab';
import HelpModal from './HelpModal';
import { helpTexts } from './helpTexts';
import '../styles/Tabs.css';

const Tabs = ({ 
  updateResults, 
  searchState, 
  setSearchState, 
  activeTab, 
  setActiveTab,
  isResultsPage, // prop for the results page image tab
  error,
 // isCompact = false // new prop for the min bar
}) => { const [isModalOpen, setIsModalOpen] = useState(false); const [isHovering, setIsHovering] = useState(false);

  const hoverTexts = {
    image: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by Image).',
    description: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by Description).',
    ppn: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by PPN).',
  };
  
  const getModalTitle = (tab) => {
    if (tab === "ppn") {
      return "How to search by PPN";
    }
    return `How to search by ${tab}`;
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };
  
  return (
    // <div className={`Search ${isCompact ? 'compact' : ''}`}>
     <div className="Search"> 
      <div className="Tabs">
        <div className="SearchTabs">
          {/* Tab nav */}
          <ul className="nav">
            <li
              className={`imageTab ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => handleTabClick('image')}
            >
              Search by <br/> image
            </li>
            <li
              className={`descriptionTab ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => handleTabClick('description')}
            >
              Search by <br/> description
            </li>
            <li
              className={`ppnTab ${activeTab === 'ppn' ? 'active' : ''}`}
              onClick={() => handleTabClick('ppn')}
            >
              Search by <br/> PPN
            </li>
          </ul>
          <div className="outlet">
            {/* For tab contents to show */}
            {activeTab === 'image' ? (
               isResultsPage ? (
               // ResultsImageTab on results page
               <ResultsImageTab
               updateResults={updateResults}
               searchState={searchState}
               setSearchState={setSearchState}
             />
           ) : (
             // Regular ImageTab on landing page
             <ImageTab
               updateResults={updateResults}
               searchState={searchState}
               setSearchState={setSearchState}
             />
           )
            ) : activeTab === 'description' ? (
              <DescriptionTab updateResults={updateResults} searchState={searchState} setSearchState={setSearchState} />
            ) : (
              <PPNTab
                updateResults={updateResults}
                searchState={searchState}
                setSearchState={setSearchState}
                error={error}
              />
            )}
          </div>
        </div>
        <div>
          <button
            className="info"
            onClick={() => setIsModalOpen(true)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <span>?</span>
            {isHovering && <div className="info-bubble">{hoverTexts[activeTab]}</div>}
          </button>
        </div>
      </div>
      <HelpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={getModalTitle(activeTab)}
        content={helpTexts[activeTab]}
      />
    </div>
  );
};

export default Tabs;