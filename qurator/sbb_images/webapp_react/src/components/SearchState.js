export const makeSearchState = () => {

   // console.log("makeSearchState");

    let setImgUrlWithID = null;
    let setImgUrlWithFormData = null;
    let setDescription = null;
    let setPPN = null;

    const add_functions = (state) => {

        state['setImgUrlWithID'] = setImgUrlWithID;
        state['setImgUrlWithFormData'] = setImgUrlWithFormData;
        state['setDescription'] = setDescription;
        state['setPPN'] = setPPN;

      //  console.log("state:", state);

        return state;
    }

    setImgUrlWithID = (imgUrl, img_id) => {

        console.log("setImgUrlWithID");

        return add_functions({
            imgUrl : imgUrl,
            img_id : img_id,
            description : '',
            ppn : ''
        });
    },

    setImgUrlWithFormData = (imgUrl, formData) => {

        console.log("setImgUrlWithFormData");

        return add_functions({
            imgUrl : imgUrl,
            formData : formData,
            description : '',
            ppn : ''
        });
    },

    setDescription = (description) => {

        console.log("setDescription");

        return add_functions({
            description : description,
            ppn : '',
            imgUrl : ''
        });
    },

    setPPN = (ppn) => {

        console.log("setPPN");

        return add_functions({
            ppn : ppn,
            description : '',
            imgUrl : ''
        });
    }

    return add_functions({
        imgUrl: '',
        description: '',
        ppn: ''
    });

};
