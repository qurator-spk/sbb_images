//Sketch
import React, { useRef, useEffect, useState } from 'react';

const PPNSearch = ({updateResults, searchState, setSearchState}) => {

  const [isSearching, setIsSearching] = useState(false);

  const [ppn, setPPN] = useState(searchState.ppn);

  const counter = useRef(0);

  const searchByPPN = async() => {

    setIsSearching(true);

    const response = await fetch('api/ppn/DIGISAM/PPN' + ppn);

    const result = await response.json();

    setIsSearching(false);

    return result.ids;
  };

  useEffect( () =>  {

    if (ppn === '') {
        return;
    }

    counter.current += 1;

    ((scounter) => {
        // search logic
        setTimeout(
            async ()  => {
                if (counter.current > scounter) return;

                const ids = await searchByPPN();

                if (counter.current > scounter) return;

                setSearchState(searchState.setPPN(ppn));

                updateResults({type: "number", ids: ids});
            }, 750);

    })(counter.current);

  },[ppn]);


  return (
    <div>
      <input
        type="number"
        value={ppn}
        onChange={(e) => setPPN(e.target.value)}
        placeholder="Enter number"
      />
      { isSearching ? (<h4> Searching ... </h4>) : ( <> </> ) }
    </div>
  );
};

export default PPNSearch;
