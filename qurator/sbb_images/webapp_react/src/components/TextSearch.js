//Sketch
import React, { useRef, useState, useEffect } from 'react';

const TextSearch = ({updateResults, searchState, setSearchState}) => {

  const counter = useRef(0);

  if (!('description' in searchState)) {
    searchState['description'] = '';
    setSearchState(searchState);
  }

  const searchByText = async() => {
    const params = {
        text: searchState.description
    };

    const response = await fetch('api/similar-by-text/DIGISAM-MSCLIP-B32-LAION/0/100',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }
    );

    const result = await response.json();

    updateResults(result.ids);
  };

  useEffect( () =>  {

    if (searchState.description === '') {
        return;
    }

    counter.current += 1;

    ((scounter) => {

        setTimeout(
            () => {

                if (counter.current > scounter) return;

                console.log(searchState.description, scounter, counter.current);

                searchByText();
            }, 750);

    })(counter.current);

  },[searchState]);

  return (
    <div>
      <input
        type="text"
        value={searchState.description}
        onChange={(e) => setSearchState({ description: e.target.value})}
        placeholder="Enter text"
      />
    </div>
  );
};

export default TextSearch;
