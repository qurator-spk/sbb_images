import React, { useState, useRef } from 'react';
import Modal from './Modal';

const SearchResults = ({ids}) => {
    return (
        <div style={{height: "55vh", "overflow-y": "scroll"}}>
            {ids.map((img_id) => (
                <div>
                    <img key={img_id} src={"api/image/DIGISAM/" + img_id}/>
                </div>
            ))}
        </div>
    );
}

export default SearchResults