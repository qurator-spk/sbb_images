import React, { useState } from 'react';
import DescriptionTab from './DescriptionTab';
import ImageTab from './ImageTab';
import PPNTab from './PPNTab';
import ResultsImageTab from './ResultsImageTab';
import HelpModal from './HelpModal';
import { helpTexts } from './helpTexts';

const Tabs = ({ 
  updateResults, 
  searchState, 
  setSearchState, 
  activeTab, 
  setActiveTab,
  isResultsPage, 
  error,
}) => { const [isModalOpen, setIsModalOpen] = useState(false); const [isHovering, setIsHovering] = useState(false);

  const hoverTexts = {
    image: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by Image).',
    description: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by Description).',
    ppn: 'To learn more about the different types of search, click on the circle for each active tab (now active - Search by PPN).',
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };
  
  return (
    // Search - container of the entire search area, with grey background 
    // Tabs - container of the search tabs and the orange help button, 
    //        has an orange highlighted border
    // SearchTabs - contains the tabs themselves, navigation + content
     <div className="Search"> 
      <div className="Tabs">
        <div className="SearchTabs">
          {/* Tab nav */}

          {/* <ul className="nav">
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
          </ul> */}

      {/* 09.10.2025: added buttons to the li elements to have keyboard functionality for the tabs */}
          <ul className="nav">
            <li className={`imageTab ${activeTab === 'image' ? 'active' : ''}`}>
              <button onClick={() => handleTabClick('image')}>
                Search by <br/> image
              </button>
            </li>
            <li className={`descriptionTab ${activeTab === 'description' ? 'active' : ''}`}>
              <button onClick={() => handleTabClick('description')}>
                Search by <br/> description
              </button>
            </li>
            <li className={`ppnTab ${activeTab === 'ppn' ? 'active' : ''}`}>
              <button onClick={() => handleTabClick('ppn')}>
                Search by <br/> PPN
              </button>
            </li>
          </ul>
      {/**************************************************************************************/}

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
            aria-label="Open help information about search types"
          >
            <i className="fa-solid fa-question" aria-hidden="true"></i> 
            {isHovering && <div className="info-bubble" role="tooltip">{hoverTexts[activeTab]}</div>}
          </button>
        </div>
      </div>
      
      <HelpModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTab={activeTab}
        helpTexts={helpTexts}
      />
    </div>
  );
};

export default Tabs;