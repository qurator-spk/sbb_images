function setup_search_by_image(configuration, update_search_results, global_push_state) {

    let that = null;

    let img_file = null;
    let search_id = null;
    let search_id_from = null;

    let search_pos = 0;

    let cropper = null;
    let has_saliency_model = false;

    let spinner_html =
        `
        <div class="col text-center">
                <div class="d-flex justify-content-center mt-5">
                    <div class="spinner-border align-center mt-5" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                 </div>
        </div>`;

    function find_similar(x,y, width, height, onSuccess, form_data=null) {
        let request =
            {
                processData: false,
                cache: false,
                success: onSuccess,
                error:
                    function(error) {
                        console.log(error);
                        $("#search-results").html("");
                        $("#tag-controls").addClass("d-none");
                    }
            };

        if (form_data != null) {
            request['data'] = form_data;
            request['url'] = "similar-by-image/"+ configuration.getActive() + "/" + search_pos + "/100/"+x+"/"+y+"/"+width+"/"+height;
            request['type'] = "POST";
            request['contentType'] = false;
            request['enctype'] = "multipart/form-data";
        }
        else if (img_file != null) {
            request['data'] = JSON.stringify({ 'image' : img_file });
            request['url'] = "similar-by-image/"+ configuration.getActive() + "/" + search_pos + "/100/"+x+"/"+y+"/"+width+"/"+height;
            request['type'] = "POST";
            request['contentType'] = "application/json";
        }

        else if ((search_id !== null) && (search_id_from !== null)) {
             request['url'] = "similar-by-image/"+ configuration.getActive() + "/" + search_pos + "/100/"+x+"/"+y+"/"+width+"/"+height +
                                    "?search_id=" + search_id + "&search_id_from=" + search_id_from;
             request['type'] = "GET";
        }
        else {
            console.log("find_similar: Do not know what to do!!!");
            return;
        }

        $.ajax(request);
    };

    function get_saliency(x,y, width, height, onSuccess, form_data=null) {

        let request =
            {
                cache: false,
                success: onSuccess,
                error: function(error) { console.log(error); }
            };

        if (img_file != null) {
            request['data'] = JSON.stringify({ 'image': img_file});
            request['url'] = "saliency/"+x+"/"+y+"/"+width+"/"+height;
            request['type'] = "POST";
            request['contentType'] = "application/json";
        }
        else if (form_data != null) {
            request['data'] = form_data;
            request['url'] = "saliency/"+x+"/"+y+"/"+width+"/"+height;
            request['type'] = "POST";
            request['contentType'] = false;
            request['enctype'] = "multipart/form-data";
        }
        else if ((search_id !== null) && (search_id_from !== null)) {
            request['url'] = "saliency/"+x+"/"+y+"/"+width+"/"+ height +
                             "?search_id=" + search_id + "&search_id_from=" + search_id_from;
            request['type'] = "GET";
        }
        else {
            console.log("get_saliency: Do not know what to do!!!");
            return;
        }

        $.ajax(request);
    };

    function create_cropper(img_src, crop_box=null) {

        function cropper_ready() {
            $('#img-upload').on('cropend',
                function() {
                    search_pos = 0;
                    search();
                }
            );

            if (crop_box === null) return;

            let image_data = cropper.getImageData();
            let canvas_data = cropper.getCanvasData();

            cropper.setCropBoxData(
                {
                    left: crop_box['x']*image_data.width + canvas_data.left,
                    top:crop_box['y']*image_data.height + canvas_data.top,
                    width:crop_box['width']*image_data.width,
                    height: crop_box['height']*image_data.height
                }
            );
        }

        if (cropper != null) {

            if ($('#img-upload').attr('src') === img_src) return;

            if (img_src === cropper.url) return;

            cropper.replace(img_src, true);
        }
        else {
            if ($('#img-upload').attr('src') !== img_src) $('#img-upload').attr('src', img_src);

            cropper =
               new Cropper($('#img-upload')[0],
                    {
                         viewMode: 2,
                         zoomable: false,
                         background: false,
                         autoCropArea: 1.0,
                         modal: false,
                         rotatable: false,
                         restore: false,
                         ready: cropper_ready
                     }
               );
        }
    }

    let batches = [];
    let search_counter = 0;

    function search() {
        if (search_pos == 0) {
            $("#tag-controls").addClass("d-none");
            $('#search-results').html(spinner_html);

            batches = [ search_pos ];

            search_counter++;
        }
        else {
            if (batches.length > 0) {
                batches.push(search_pos);
                return;
            }
            batches.push(search_pos);
        }

        let x=-1;
        let y=-1;
        let width=-1;
        let height=-1;
        if (cropper !== null) {

            canvas_data = cropper.getCanvasData();
            crop_data = cropper.getCropBoxData();
            image_data = cropper.getImageData();

            let image_width = image_data.width;
            let image_height = image_data.height;

            x = (crop_data.left - canvas_data.left)/image_width;
            y = (crop_data.top - canvas_data.top)/image_height;
            width = crop_data.width/image_width;
            height = crop_data.height/image_height;
        }

        while(batches.length > 0)
        (function(counter_at_request, from_pos) {

            if (!has_saliency_model) {
                find_similar(x,y,width, height,
                    function(result) {
                        if (search_counter > counter_at_request) return;

                        update_search_results(result, from_pos==0);
                    }
                );
            }
            else {
                get_saliency(x,y,width, height,
                    function(saliency_result) {
                        if (search_counter > counter_at_request) return;

                        create_cropper(saliency_result.image,
                                       { x : saliency_result.x, y : saliency_result.y,
                                         width: saliency_result.width, height : saliency_result.height});

                        if (search_counter > counter_at_request) return;

                        find_similar(saliency_result.x, saliency_result.y,
                                     saliency_result.width, saliency_result.height,
                            function(result) {
                                if (search_counter > counter_at_request) return;

                                update_search_results(result, from_pos==0);
                            });
                    }
                );
            }
         })(search_counter, batches.shift());
    };

    function update() {

        search_pos = 0;
        let new_img_url = $('#img-upload').attr('src');

        if ((search_id !== null) && (search_id_from !== null)) {
            new_img_url = "image/" + search_id_from + "/" + search_id + "/full/nomarker";
        }
        else if (img_file !== null) {
            new_img_url = img_file;
        }

        if ($('#img-upload').attr('src') != new_img_url) {

            if (cropper != null) {
                cropper.destroy();
                cropper = null;
            }

            $('#img-upload').attr('src', new_img_url);
        }
        else if ($('#img-upload').attr('src') !== "") {
            search();
        }
    }

    let upload_html =
        `
            <form class="form" action="similar" method="post" enctype="multipart/form-data" id="upload-form" draggable="true">
                <div><img class="fit-image" id='img-upload' src=""/></div>
                <label for="the-image" class="btn btn-primary mt-3">Upload search image</label>
                <input type="file" name="file" id="the-image" style="display: none;"/>
            </form>
        `;

    $("#search-rgn").html(upload_html);

    $('#img-upload').on('load',
        function() {
            search_pos = 0;
            create_cropper($('#img-upload').attr('src'));
        });

    $('#img-upload').on('ready',
        function() {
            if (this.cropper !== cropper) return;

            if (((search_id !== null) && (search_id_from !== null)) || (img_file !== null)) {
                search_pos = 0;
                search();
            }
        }
    );

    function paste(event) {

        let clipboardData = event.clipboardData || event.originalEvent.clipboardData || window.clipboardData;

        if (clipboardData.items[0] &&(clipboardData.items[0].type.startsWith("image/"))) {

           let file = clipboardData.items[0].getAsFile();

           let form_data = new FormData();
           form_data.append('file', file);

           let reader = new FileReader();

           reader.onload =
                function(e) {
                    img_file = e.target.result;

                    that.setSearchId(null, null);

                    that.update();
                };

           reader.readAsDataURL(file);
        }
        else if (clipboardData.items[0] &&(clipboardData.items[0].type == "text/html")) {

            clipboardData.items[0].getAsString(
                function (s) {

                    let url = $($.filter("img", $.parseHTML(s))[0]).attr("src");

                    console.log(url);

                    let img = new Image();
                    img.crossOrigin= "Anonymous";

                    img.onload =
                        function() {
                            let canv = document.createElement('canvas');
                            let context = canv.getContext('2d');
                            canv.height = this.naturalHeight;
                            canv.width = this.naturalWidth;
                            context.drawImage(this, 0,0);

                            that.setSearchId(null, null);

                            img_file = canv.toDataURL('image/jpeg');

                            $('#img-upload').attr('src', url);

                            update();
                        };

                    img.src = url;
                }
            );
        }
        else {
            console.log(clipboardData.items[0]);
        }
    }

    $("#the-image").change(
        function(){

            let fileInput = $('#the-image')[0]
            let file = fileInput.files[0];

            let reader = new FileReader();

            let form_data = new FormData();
            form_data.append('file', file);

            $("#tag-controls").addClass("d-none");
            $("#search-results").html(spinner_html);

            reader.onload =
                function (e) {
                    img_file = e.target.result;

                    that.setSearchId(null, null);

                    that.update();
                };

            reader.readAsDataURL(file);
        });

    that = {
        pushState:
            function(url_params, state) {

                if (img_file !== null) {
                    url_params.delete('search_id');
                    url_params.delete('search_id_from');
                }
                else {
                    if (search_id !== null) {
                        url_params.set('search_id', search_id);
                        url_params.set('search_id_from', search_id_from);
                    }
                }

                state.img_file = img_file;
                state.search_id = search_id;
                state.search_id_from = search_id_from;
            },
        popState:
            function pop_state(event=null) {

                if ((event !== null) && (event.state != null)) {

                    img_file = event.state.img_file;

                    search_id = event.state.search_id;
                    search_id_from = event.state.search_id_from;

                    if (search_id_from === null) {
                        search_id_from = configuration.getDataConf();
                    }
                }
                else {
                    let url_params = new URLSearchParams(window.location.search);

                    if (url_params.has('search_id')) {
                        search_id = url_params.get('search_id');
                        search_id_from = url_params.get('search_id_from');

                        if (search_id_from === null) {
                            search_id_from = configuration.getDataConf();
                        }
                    }
                }
            },
        setSearchId :
            function (search_id_, search_id_from_, new_state=true) {
                search_id = search_id_;
                search_id_from = search_id_from_;

                if (search_id !== null) {
                    img_file = null;
                }

                if (new_state) global_push_state();
            },
        nextBatch:
            function() {
                search_pos += 100;
                search();
            },
        update: update,
        paste: paste
    };

    let url_params = new URLSearchParams(window.location.search);

    that.popState();

    return that;
}