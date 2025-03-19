import React, { useRef, useState, useEffect } from 'react';

const PPNTab = ({ updateResults, searchState, setSearchState, error}) => {
  const [ppn, setPPN] = useState(searchState.ppn);
  const counter = useRef(0);

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
      <input
        type="text"
        id="search"
        name="search"
        value={ppn}
        onChange={(e) => setPPN(e.target.value)}
        placeholder="E.g. 744086949"
      />
      <p>Enter PPN. <br/> 
      (Only the number, without 'PPN' in the beginning.)</p>
      {error && <div className="error-message"><strong>{error}</strong></div>}
    </div>
  );
};

export default PPNTab;

