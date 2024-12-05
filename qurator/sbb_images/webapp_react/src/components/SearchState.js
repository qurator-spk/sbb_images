export const makeSearchState = () => {

    console.log("makeSearchState");

    let setImgUrlWithID = null;
    let setImgUrlWithFormData = null;
    let setDescription = null;
    let setPPN = null;

    const add_functions = (state) => {

        state['setImgUrlWithID'] = setImgUrlWithID;
        state['setImgUrlWithFormData'] = setImgUrlWithFormData;
        state['setDescription'] = setDescription;
        state['setPPN'] = setPPN;

        console.log("state:", state);

        return state;
    }

    setImgUrlWithID = (imgUrl, img_id) => {
        return add_functions({
            imgUrl : imgUrl,
            img_id : img_id,
            description : '',
            ppn : ''
        });
    },

    setImgUrlWithFormData = (imgUrl, formData) => {
        return add_functions({
            imgUrl : imgUrl,
            formData : formData,
            description : '',
            ppn : ''
        });
    },

    setDescription = (description) => {
        return add_functions({
            description : description,
            ppn : '',
            imgUrl : ''
        });
    },

    setPPN = (ppn) => {
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
