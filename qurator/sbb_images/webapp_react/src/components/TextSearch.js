//Sketch
import React, { useRef, useState, useEffect } from 'react';

const TextSearch = ({updateResults, searchState, setSearchState}) => {

  const counter = useRef(0);

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

    let result = await response.json();

    return result.ids;
  };

  useEffect( () =>  {

    if (searchState.description === '') {
        return;
    }

    counter.current += 1;

    ((scounter) => {

        setTimeout(
            async () => {

                if (counter.current > scounter) return;

                console.log(searchState.description, scounter, counter.current);

                const ids = await searchByText();

                if (counter.current > scounter) return;

                updateResults(ids);
            }, 750);

    })(counter.current);

  },[searchState]);

  return (
    <div>
      <input
        type="text"
        value={searchState.description}
        onChange={(e) => setSearchState(searchState.setDescription(e.target.value))}
        placeholder="Enter text"
      />
    </div>
  );
};

export default TextSearch;
