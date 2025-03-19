import React, { useRef, useState, useEffect } from 'react';
import { ppnSuggestions } from '../data/ppnSuggestions';

const PPNTab = ({ updateResults, searchState, setSearchState, error}) => {
  const [ppn, setPPN] = useState(searchState.ppn);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [shuffledSuggestions, setShuffledSuggestions] = useState([]);
  const counter = useRef(0);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

 /*  useEffect(() => {
    if (showSuggestions) {
      setShuffledSuggestions(shuffleArray(ppnSuggestions));
    }
  }, [showSuggestions]); */

  // shuffle and take only 5
  useEffect(() => {
    if (showSuggestions) {
      const shuffled = shuffleArray(ppnSuggestions);
      setShuffledSuggestions(shuffled.slice(0, 5));
    }
    }, [showSuggestions]);

  const handleSuggestionClick = (suggestion) => {
    setPPN(suggestion);
    
    setShowSuggestions(false);
    
    const next_state = searchState.setPPN(suggestion);
    setSearchState(next_state);
    updateResults(next_state);
  };


  useEffect(() => {

    if ((ppn === '') || (searchState.ppn === ppn)) return;

    counter.current += 1;

    ((scounter) => {
      setTimeout(async () => {
        if (counter.current > scounter) return;

        const next_state = searchState.setPPN(ppn);

        setSearchState(next_state);

        updateResults(next_state);

      }, 1500);
    })(counter.current);

  }, [ppn]);

  return (
    <div className="PPNTab">
      <div className="input-container">
        <input
          type="text"
          id="search"
          name="search"
          value={ppn}
          // onChange={(e) => setPPN(e.target.value)}
          onChange={(e) => {
            setPPN(e.target.value);
            if (e.target.value === '') {
              setShowSuggestions(true);
            } else {
              setShowSuggestions(false);
            }
          }}
          onClick={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="E.g. 744086949"
          autoComplete="off"
      />

      {showSuggestions && (
          <div className="suggestions-dropdown">
            <div className="suggestions-header">Enter PPN or try one of these:</div>
            {shuffledSuggestions.map((suggestion, index) => (
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
      <p>Enter PPN.</p>
      {error && <div className="error-message"><strong>{error}</strong></div>}
    </div>
  );
};

export default PPNTab;

