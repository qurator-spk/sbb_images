//Sketch
import React, { useRef, useEffect, useState } from 'react';

const ImageSearch = ({updateResults}) => {
  const [selectedImage, setSelectedImage] = useState(null);

  const formData = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];

    let fd = new FormData();
    fd.append('file', file);

    formData.current = fd;

    setSelectedImage(URL.createObjectURL(file));
  };

  const searchByImage = async() => {

    const response = await fetch('api/similar-by-image/DIGISAM-MSCLIP-B32-LAION/0/100',
        {
            method: 'POST',
            body: formData.current
        }
    );

    const result = await response.json();

    updateResults(result.ids);
  };

  useEffect( () =>  {

    if (formData.current===null) {
        updateResults([]);
        return;
    }

    searchByImage();
  },[selectedImage]);

  return (
    <div>
       <input
            id="image-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
      {selectedImage && <img src={selectedImage} alt="Uploaded" />}
    </div>
  );
};

export default ImageSearch;
