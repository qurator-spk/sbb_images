//Sketch
import React, { useRef, useEffect, useState } from 'react';

const PPNSearch = ({updateResults}) => {
  const [searchPPN, setSearchPPN] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const counter = useRef(0);

  const searchByPPN = async() => {

    setIsSearching(true);

    const response = await fetch('api/ppn/DIGISAM/PPN' + searchPPN);

    const result = await response.json();

    console.log(result);

    updateResults(result.ids);

    setIsSearching(false);
  };

  useEffect( () =>  {

    if (searchPPN === '') {
        updateResults([]);
        return;
    }

    counter.current += 1;

    ((scounter) => {
        // search logic
        setTimeout(
            () => {
                if (counter.current > scounter) return;

                console.log(searchPPN, scounter, counter.current);

                searchByPPN();
            }, 750);

    })(counter.current);

  },[searchPPN]);


  return (
    <div>
      <input
        type="number"
        value={searchPPN}
        onChange={(e) => setSearchPPN(e.target.value)}
        placeholder="Enter number"
      />
      { isSearching ? (<h4> Searching ... </h4>) : ( <> </> ) }
      {/*<button onClick={handleSearch}>Search</button>*/}
    </div>
  );
};

export default PPNSearch;
