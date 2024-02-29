//Sketch
import React, { useRef, useState, useEffect } from 'react';

const TextSearch = ({updateResults}) => {
  const [searchText, setSearchText] = useState('');

  const counter = useRef(0);

  const searchByText = async() => {
    const params = {
        text: searchText
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

    if (searchText === '') {
        updateResults([]);
        return;
    }

    counter.current += 1;

    ((scounter) => {

        setTimeout(
            () => {

                if (counter.current > scounter) return;

                console.log(searchText, scounter, counter.current);

                searchByText();
            }, 750);

    })(counter.current);

  },[searchText]);

  //const handleSearch = () => {
  //};

  return (
    <div>
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Enter text"
      />
      {/* <button onClick={handleSearch}>Search</button> */}
    </div>
  );
};

export default TextSearch;
