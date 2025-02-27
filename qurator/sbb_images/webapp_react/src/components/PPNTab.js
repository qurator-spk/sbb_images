import React, { useRef, useState, useEffect } from 'react';

const PPNTab = ({ updateResults, searchState, setSearchState }) => {
  const [ppn, setPPN] = useState(searchState.ppn);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const counter = useRef(0);

  const searchByPPN = async () => {
    setIsSearching(true);
    try {
      const response = await fetch("api/ppn/DIGISAM/PPN" + ppn);
      if (!response.ok) {
        throw new Error();
      }
      const result = await response.json();
      if (!result.ids || result.ids.length === 0) {
        throw new Error();
      }
      setIsSearching(false);
      setError(null);
      return result.ids;
    } catch {
      setError(
        "The PPN you entered does not exist in our collection or is not a PPN. Check your input and try again."
      );
      setIsSearching(false);
      return null;
    }
  };

  useEffect(() => {
     if (ppn === '') {
      return;
    } 

    counter.current += 1;

    ((scounter) => {
      setTimeout(async () => {
        if (counter.current > scounter) return;

        const ids = await searchByPPN();
        if (counter.current > scounter) return;
        if (ids && ids.length > 0) {
          setSearchState(searchState.setPPN(ppn));
          updateResults({ type: "ppn", ids: ids }, ppn);
        }
      }, 750);
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
      {error && <div className="error-message">{error}</div>}
      {isSearching ? <h4>Searching...</h4> : null}
    </div>
  );
};

export default PPNTab;

