//Sketch
import React, { useState } from 'react';

const PPNSearch = () => {
  const [searchPPN, setSearchPPN] = useState('');

  const handleSearch = () => {
    // ppn search logic here
  };

  return (
    <div>
      <input
        type="number"
        value={searchPPN}
        onChange={(e) => setSearchPPN(e.target.value)}
        placeholder="Enter number"
      />
      <button onClick={handleSearch}>Search</button>
    </div>
  );
};

export default PPNSearch;
