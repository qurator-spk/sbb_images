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

        console.log("DescriptionTab: ", description, scounter, counter.current);
        const ids = await searchByText();

        if (counter.current > scounter) return;

        setSearchState(searchState.setDescription(description));

        console.log("DescriptionTab: ", "updateResults");
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
        Enter image description (in German, English or one of the other languages <a href="https://github.com/FreddeFrallan/Multilingual-CLIP/blob/main/translation/data/fine_tune_languages.csv" target="_blank"
              rel="noopener noreferrer" className="link">listed here</a>). <br/>
        <span>This is a search through the image content, not metadata.</span>
      </p>
    </div>
  );
};

export default DescriptionTab;
 
