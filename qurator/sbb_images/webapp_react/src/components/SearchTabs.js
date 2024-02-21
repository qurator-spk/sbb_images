import React, { useState, useRef } from 'react';
import Modal from './Modal';
import './SearchTabs.css';

const SearchTabs = () => {
  const [activeTab, setActiveTab] = useState('image');
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef(null);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const handleSearch = () => {
    // search logic here
    console.log('Searching...');
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
            <>
              <input
                ref={inputRef}
                type="text"
                placeholder={`Enter ${activeTab} here...`}
                onChange={(e) => console.log(e.target.value)} // Handle input changes as needed
              />
              <input type="submit" value="Search" onClick={handleSearch} />
            </>
          )}
        </div>
        {activeTab === 'image' && (
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
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
