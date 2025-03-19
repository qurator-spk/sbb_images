import React, { useRef, useState, useEffect } from 'react';

const DescriptionTab = ({ updateResults, searchState, setSearchState }) => {
  const [description, setDescription] = useState(searchState.description);
  const counter = useRef(0);

  useEffect(() => {

    if ((description === '') || (searchState.description === description)) {
      return;
    }
    counter.current += 1;

    ((scounter) => {
      setTimeout(async () => {
        if (counter.current > scounter) return;

        const next_state = searchState.setDescription(description);

        setSearchState(next_state);

        updateResults(next_state);
      }, 1500);
    })(counter.current);
  }, [description]);

  return (
    <div className="DescriptionTab">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="E.g. Big ship entering port."
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
 
