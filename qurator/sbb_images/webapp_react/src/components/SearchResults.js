import React, { useState, useRef } from 'react';
import Modal from './Modal';

const SearchResults = ({ids, searchMore}) => {

    return (
        <div style={{height: "55vh", overflowY: "scroll"}}>
            {ids.map((img_id, index) => (
                <div key={img_id}>
                    <img src={"api/image/DIGISAM/" + img_id}/>
                    <button onClick={() => searchMore(img_id) }>More</button>
                </div>
            ))}
        </div>
    );
}

export default SearchResults