import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';

const SearchResult = ({searchMore, img_id, loadPos, searchResult, activeTab}) => {

    const minLoadInterval = 100;

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

        loadPos.current = loadPos.current + 1;
    };

    const loadWaiter = async(sresult) => {
            if (sresult != searchResult) return;
            if (searchResult.type !== activeTab) return;
            if (isLoaded) return;
            if (loadPos.current >= searchResult.ids.length) return;

            if (searchResult.ids[loadPos.current] !== img_id) {
                setTimeout(() => { loadWaiter(sresult) }, minLoadInterval);
                return;
            }

            imageLoader();
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
            {searchResult.ids.map((imgID) => (
                <SearchResult key={imgID} searchMore={searchMore} img_id={imgID}
                    loadPos={loadPos} searchResult={searchResult}
                    activeTab={activeTab}/>
            ))}
        </div>
    );
}

export default SearchResults