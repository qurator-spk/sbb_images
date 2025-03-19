import React, { useRef, useState, useEffect } from 'react';
import { descriptionSuggestions } from '../data/descriptionSuggestions';

const DescriptionTab = ({ updateResults, searchState, setSearchState }) => {
  const [description, setDescription] = useState(searchState.description);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [shuffledSuggestions, setShuffledSuggestions] = useState([]);
  const SUGGESTIONS_TO_SHOW = 10;
  const counter = useRef(0);

  // shuffle
  const getRandomSuggestions = (array, count) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  };

  useEffect(() => {
    if (showSuggestions) {
      setShuffledSuggestions(getRandomSuggestions(descriptionSuggestions, SUGGESTIONS_TO_SHOW));
    }
  }, [showSuggestions]);

  const handleSuggestionClick = (suggestion) => {
    //console.log("Suggestion clicked:", suggestion);
    setDescription(suggestion);
    //console.log("Description set to:", suggestion);
    
    setShowSuggestions(false);
    
    const next_state = searchState.setDescription(suggestion);
    setSearchState(next_state);
    updateResults(next_state);
  };

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
      {/* <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="E.g. Big ship entering port."
      /> */}
      <div className="input-container">
        <input
          type="text"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (e.target.value === '') {
              setShowSuggestions(true);
            } else {
              setShowSuggestions(false);
            }
          }}
          onClick={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="E.g. Ein Zug fährt über eine Eisenbahnbrücke."
        />

        {showSuggestions && (
          <div className="suggestions-dropdown">
            <div className="suggestions-header">Enter description or try one of the example searches below:</div>
            {shuffledSuggestions.map((suggestion, index) => (
            // {descriptionSuggestions.map((suggestion, index) => (
              <div 
                key={index}
                className="suggestion-item"
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  handleSuggestionClick(suggestion);
                }}
              >
                <span>{suggestion}</span>
                <span className="try-it">Try it</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p>
        Enter image description (in German, English or one of the other languages <a href="https://github.com/FreddeFrallan/Multilingual-CLIP/blob/main/translation/data/fine_tune_languages.csv" target="_blank"
              rel="noopener noreferrer" className="link">listed here</a>). <br/>
        <span>This is a search through the image content, not metadata.</span>
      </p>
    </div>
  );
};

export default DescriptionTab;
 
