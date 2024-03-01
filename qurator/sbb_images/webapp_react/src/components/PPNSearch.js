//Sketch
import React, { useRef, useEffect, useState } from 'react';

const PPNSearch = ({updateResults, searchState, setSearchState}) => {

  const [isSearching, setIsSearching] = useState(false);

  const counter = useRef(0);

  const searchByPPN = async() => {

    setIsSearching(true);

    const response = await fetch('api/ppn/DIGISAM/PPN' + searchState.ppn);

    const result = await response.json();

    updateResults(result.ids);

    setIsSearching(false);
  };

  useEffect( () =>  {

    if (searchState.ppn === '') {
        return;
    }

    counter.current += 1;

    ((scounter) => {
        // search logic
        setTimeout(
            () => {
                if (counter.current > scounter) return;

                searchByPPN();
            }, 750);

    })(counter.current);

  },[searchState]);


  return (
    <div>
      <input
        type="number"
        value={searchState.ppn}
        onChange={(e) => setSearchState(searchState.setPPN(e.target.value))}
        placeholder="Enter number"
      />
      { isSearching ? (<h4> Searching ... </h4>) : ( <> </> ) }
    </div>
  );
};

export default PPNSearch;
