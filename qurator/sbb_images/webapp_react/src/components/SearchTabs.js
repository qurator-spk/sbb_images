import React, { useState, useRef } from 'react';
import Modal from './Modal';
import './SearchTabs.css';

import TextSearch from './TextSearch'
import PPNSearch from './PPNSearch'
import ImageSearch from './ImageSearch'

const SearchTabs = ({updateResults}) => {
  const [activeTab, setActiveTab] = useState('image');
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef(null);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const handleSearch = () => {
    // search logic here
    console.log('Searching...', activeTab);
  };

  const handleImageUpload = () => {
    // image upload logic here
    console.log('Uploading image...');
  };

  const handleInfoButtonClick = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleTextInput = (text_input) => {
    console.log(text_input);
  };

  return (
    <div className="search-tabs-container">
      {/* Labels */}
      <div className="label-container">
        <div
          className={`tab-label ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => handleTabClick('image')}
        >
          Image
        </div>
        <div
          className={`tab-label ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => handleTabClick('text')}
        >
          Description
        </div>
        <div
          className={`tab-label ${activeTab === 'number' ? 'active' : ''}`}
          onClick={() => handleTabClick('number')}
        >
          PPN
        </div>
      </div>

      {/* Info Button */}
      <button className="info-button" onClick={handleInfoButtonClick}>Info</button>

      {/* Active Tabs */}
      <div className="active-tab-container">
        <div className={`active-tab ${activeTab === 'image' ? 'image' : ''}`}>
          {activeTab === 'image' ? (
            <label htmlFor="image-upload" className="upload-label">
              Upload Image
            </label>
          ) : (
            activeTab === 'text' ? (
            <TextSearch updateResults={updateResults} />
            ) : (
            <PPNSearch updateResults={updateResults} />
            )
          )}
        </div>
        {activeTab === 'image' && (
            <ImageSearch updateResults={updateResults}/>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal type={activeTab} closeModal={closeModal} />
      )}
    </div>
  );
};

export default SearchTabs;
