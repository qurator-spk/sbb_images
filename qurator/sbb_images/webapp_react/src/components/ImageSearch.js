//Sketch
import React, { useRef, useEffect, useState } from 'react';

const ImageSearch = ({updateResults, searchState, setSearchState}) => {

  const handleImageUpload = (event) => {
    const file = event.target.files[0];

    let fd = new FormData();
    fd.append('file', file);

    setSearchState({ imgUrl: URL.createObjectURL(file), formData: fd} );
  };

  const searchByImage = async() => {

    if ('formData' in searchState) {

        const response = await fetch('api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100',
            {
                method: 'POST',
                body: searchState.formData
            }
        );

        const result = await response.json();

        updateResults(result.ids);
    }
    else if ('img_id' in searchState) {

        const response =
            await fetch('api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100?search_id=' +
                        searchState.img_id + '&search_id_from=DIGISAM'
        );
        const result = await response.json();

        updateResults(result.ids);
    }
  };

  useEffect( () =>  {

    searchByImage();

  },[searchState]);

  return (
    <div>
       <input
            id="image-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
      {searchState.imgUrl && <img src={searchState.imgUrl} alt="Uploaded" />}
    </div>
  );
};

export default ImageSearch;
