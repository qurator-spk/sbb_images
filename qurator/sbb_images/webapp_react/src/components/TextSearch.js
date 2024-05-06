//Sketch
import React, { useRef, useState, useEffect } from 'react';

const TextSearch = ({updateResults, searchState, setSearchState}) => {

  const [description, setDescription] = useState(searchState.description);

  const counter = useRef(0);

  const searchByText = async() => {

    const params = {
        text: description
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

    if (description === '') {
        return;
    }

    counter.current += 1;

    ((scounter) => {

        setTimeout(
            async () => {

                if (counter.current > scounter) return;

                console.log(description, scounter, counter.current);

                const ids = await searchByText();

                if (counter.current > scounter) return;

                setSearchState(searchState.setDescription(description));

                updateResults({ type: "text" , ids: ids});
            }, 750);

    })(counter.current);

  },[description]);

  return (
    <div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Enter text"
      />
    </div>
  );
};

export default TextSearch;
