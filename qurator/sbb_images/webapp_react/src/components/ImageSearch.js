//Sketch
import React, { useState } from 'react';

const ImageSearch = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    setSelectedImage(URL.createObjectURL(file));
    // image search logic here
  };

  return (
    <div>
      <input type="file" onChange={handleImageUpload} />
      {selectedImage && <img src={selectedImage} alt="Uploaded" />}
    </div>
  );
};

export default ImageSearch;
