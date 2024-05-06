import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';

const SearchResult = ({searchMore, img_id, loadPos, searchResult, activeTab, pos}) => {

    const minLoadInterval = 200;

    const [ isLoaded, setIsLoaded] = useState(false);

    const [ imgSrc, setImgSrc] = useState("");

    const triggerNext = () => {
        setIsLoaded(true);
    };

    const imageLoader = async() => {
        const response = await fetch("api/image/DIGISAM/" + img_id);

        const img = await response.blob();

        const imgUrl = URL.createObjectURL(img);

        setImgSrc(imgUrl);
    };

    const exitCondition = (sresult) => {
        if (sresult != searchResult) return true;
        if (searchResult.type !== activeTab) return true;

        if (loadPos.current > pos) return true;
        if (loadPos.current >= searchResult.ids.length) return true;

        return false;
    }

    const loadWaiter = async(sresult) => {

            if (exitCondition(sresult)) return;

            if (searchResult.ids[loadPos.current] !== img_id) {
                setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
                return;
            }

            imageLoader();

            if (exitCondition(sresult)) return;
            loadPos.current = loadPos.current + 1;
        };

    useEffect(() => {
        console.log("SearchResult loadPos.current", loadPos.current);

        ((sresult) => {
            setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
        })(searchResult);

    },[searchResult]);

    return (
        <div style={isLoaded ? {} : { display: 'none'}}>
            <img src={imgSrc} onLoad={() => {setIsLoaded(true)}} />

            <button onClick={() => searchMore(img_id)}>
                More
            </button>
        </div>
    );
};

const SearchResults = ({searchResult, searchMore, activeTab}) => {

    console.log("SearchResults");

    const loadPos = useRef(0);

    loadPos.current = 0;

    return (
        <div style={{height: "55vh", overflowY: "scroll"}}>
            {searchResult.ids.map((imgID, pos) => (
                <SearchResult key={imgID} searchMore={searchMore} img_id={imgID}
                    loadPos={loadPos} searchResult={searchResult}
                    activeTab={activeTab} pos={pos}/>
            ))}
        </div>
    );
}

export default SearchResults