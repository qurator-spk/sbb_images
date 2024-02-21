//Sketch
import React, { useState } from 'react';

const TextSearch = () => {
  const [searchText, setSearchText] = useState('');

  const handleSearch = () => {
    // search logic 
  };

  return (
    <div>
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Enter text"
      />
      <button onClick={handleSearch}>Search</button>
    </div>
  );
};

export default TextSearch;
