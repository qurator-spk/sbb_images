import React, { useRef, useState, useEffect } from 'react';

 const DescriptionTab = ({ updateResults, searchState, setSearchState }) => {
  const [description, setDescription] = useState(searchState.description);
  const counter = useRef(0);

  const searchByText = async () => {
    const params = {
      text: description,
    };

    const response = await fetch('api/similar-by-text/DIGISAM-DEFAULT/0/100', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    let result = await response.json();
    return result.ids;
  };


  useEffect(() => {
    if (description === '') {
      return;
    }

    counter.current += 1;

    ((scounter) => {
      setTimeout(async () => {
        if (counter.current > scounter) return;

        console.log(description, scounter, counter.current);
        const ids = await searchByText();

        if (counter.current > scounter) return;

        setSearchState(searchState.setDescription(description));
        updateResults({ type: 'description', ids: ids }, description);
      }, 750);
    })(counter.current);
  }, [description]);

  return (
    <div className="DescriptionTab">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="E.g. Big ship entering port"
      />
      <p>
        Enter image description 
      </p>
    </div>
  );
};

export default DescriptionTab;
 
