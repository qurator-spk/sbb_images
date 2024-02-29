//Sketch
import React, { useRef, useEffect, useState } from 'react';

const PPNSearch = ({updateResults}) => {
  const [searchPPN, setSearchPPN] = useState('');

  const counter = useRef(0);

  const searchByPPN = async() => {

    const response = await fetch('api/ppn/DIGISAM/PPN' + searchPPN);

    const result = await response.json();

    updateResults(result.ids);
  };

  useEffect( () =>  {

    counter.current += 1;

    ((scounter) => {
        // search logic
        setTimeout(
            () => {
                if (searchPPN === '') return;
                if (counter.current > scounter) return;

                console.log(searchPPN, scounter, counter.current);

                searchByPPN();
            }, 750);

    })(counter.current);

  },[searchPPN]);

//  const handleSearch = () => {
//    // ppn search logic here
//  };

  return (
    <div>
      <input
        type="number"
        value={searchPPN}
        onChange={(e) => setSearchPPN(e.target.value)}
        placeholder="Enter number"
      />
      {/*<button onClick={handleSearch}>Search</button>*/}
    </div>
  );
};

export default PPNSearch;
