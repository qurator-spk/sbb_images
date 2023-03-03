function searchSetup (){

    let spinner_html =
        `<div class="d-flex justify-content-center mt-5">
            <div class="spinner-border align-center mt-5" role="status">
                <span class="sr-only">Loading...</span>
            </div>
         </div>`;

    let request_counter = 0;

    function makeResultList(results) {
        request_counter += 1;

        (function(counter_at_request) {

            $('#search-results').html("");

            let result_html = "";

            $.each(results,
                function(index, result_id) {

                    if (counter_at_request < request_counter) return;

                    result_html +=
                            `
                            <div class="row-fluid">
                                <div class="card invisible" id="card-${result_id}" data-toggle="tooltip" data-placement="bottom" title="">
                                    <div class="card-body">
                                    <a href="search.html?search_id=${result_id}" class="btn-sm" target="_blank" rel="noopener noreferrer">More</a><br>
                                    <a href="image/${result_id}/full" id="lnk-${result_id}" target="_blank" rel="noopener noreferrer">
                                        <img class="img-fluid fit-result-image" id="img-${result_id}" src="" rel="noopener noreferrer" referrerpolicy="no-referrer"/>
                                    </a>
                                    </div>
                                </div>
                            </div>
                            `;
                }
            );

            $('#search-results').html(result_html);

            let triggerNextImage = function() {};

            triggerNextImage =
                function (){

                    if (results.length <= 0) return;
                    if (counter_at_request < request_counter) return;

                    let next_one = results.shift();

                    (function(result_id) {
                        $('#img-'+ next_one).on('load',
                            function() {
                                $.get("link/" + result_id).done(
                                    function(result) {
                                        if (result.length <= 0) return;

                                        $("#lnk-" + result_id).attr('href', result);
                                    }
                                );

                                triggerNextImage();
                            }
                         );
                    })(next_one);

                    $('#img-'+ next_one).attr("src", "image/"+next_one+"/resize/regionmarker");

                    $("#card-"+ next_one).removeClass('invisible');

                    (function(image_id) {
                        $.get("image-ppn/" + image_id,
                            function(result) {

                                if (result['ppn'] === undefined) {

                                    $.get("image-file/" + image_id,
                                        function(result) {
                                            if (result['file'] === undefined) return;

                                            $("#card-"+ image_id).attr('title', result['file']);
                                        });

                                    return;
                                }

                                $("#card-"+ image_id).attr('title', result['ppn']);

                                $.get("../meta_data/" + result['ppn'],
                                    function(meta) {
                                        $("#card-"+ image_id).attr('title', meta.title + "; " + meta.author + "; " + meta.date);
                                    }
                                );
                            }
                        );
                    })(next_one);
                };

            triggerNextImage();

        })(request_counter);
    };

    let url_params = new URLSearchParams(window.location.search);
    let cropper = null;

    function cropper_update() {
        canvas_data = cropper.getCanvasData();
        crop_data = cropper.getCropBoxData();
        image_data = cropper.getImageData();

        let crop_box =
            {
                x : crop_data.left - canvas_data.left,
                y : crop_data.top - canvas_data.top,
                width : crop_data.width,
                height : crop_data.height
            };

        image_width = image_data.width;
        image_height = image_data.height;

        update_results(crop_box.x/image_width, crop_box.y/image_height,
                        crop_box.width/image_width, crop_box.height/image_height);
    }

    function create_cropper(img_src, crop_box=null) {


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
                         ready() {
                             $('#img-upload').on('cropend',
                                 function(event) {
                                     cropper_update();
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
                     }
               );
        }
    }

    let update_counter=0;
    let form_data = null;
    let has_saliency_model = false;

    function update_results(x, y, width, height) {
        update_counter++;

        (function(counter_at_request) {

            function find_similar(x,y, width, height, onSuccess, post_data=null) {

                let request =
                    {
                        processData: false,
                        cache: false,
                        success: onSuccess,
                        error: function(error) { console.log(error); }
                    };

                if (post_data != null) {
                    request['data'] = post_data;
                    request['url'] = "similar/0/100/"+x+"/"+y+"/"+width+"/"+height;
                    request['type'] = "POST";
                    request['contentType'] = "application/json"
                }
                else if (form_data != null) {
                    request['data'] = form_data;
                    request['url'] = "similar/0/100/"+x+"/"+y+"/"+width+"/"+height;
                    request['type'] = "POST";
                    request['contentType'] = false;
                    request['enctype'] = "multipart/form-data";
                }
                else if (url_params.has('search_id')) {
                     request['url'] = "similar/0/100/"+x+"/"+y+"/"+width+"/"+height +
                                            "?search_id=" + url_params.get('search_id');
                     request['type'] = "GET";
                }
                else {
                    console.log("find_similar: Do not know what to do!!!");
                    return;
                }

                $.ajax(request);
            };

            function get_saliency(x,y, width, height, onSuccess, post_data=null) {

                let request =
                    {
                        cache: false,
                        success: onSuccess,
                        error: function(error) { console.log(error); }
                    };

                if (post_data != null) {
                    request['data'] = post_data;
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
                else if (url_params.has('search_id')) {
                    request['url'] = "saliency/"+x+"/"+y+"/"+width+"/"+height +
                                            "?search_id=" + url_params.get('search_id')
                    request['type'] = "GET";
                }
                else {
                    console.log("get_saliency: Do not know what to do!!!");
                    return;
                }

                $.ajax(request);
            };

            if (!has_saliency_model) {
                find_similar(x,y,width, height,
                    function(result) {
                        if (update_counter > counter_at_request) return;

                        makeResultList(result['ids']);
                    }
                );
            }
            else {
                get_saliency(x,y,width, height,
                    function(saliency_result) {
                        if (update_counter > counter_at_request) return;

                        create_cropper(saliency_result.image,
                                       { x : saliency_result.x, y : saliency_result.y,
                                         width: saliency_result.width, height : saliency_result.height});

                        if (update_counter > counter_at_request) return;

                        find_similar(saliency_result.x, saliency_result.y,
                                     saliency_result.width, saliency_result.height,
                            function(result) {
                                if (update_counter > counter_at_request) return;

                                makeResultList(result['ids']);
                            },
                            JSON.stringify(saliency_result)
                        );

                    }
                );
            }
         })(update_counter);
    };

    function reset_image() {

        $("#cropper").html(`<img style="img-fluid fit-image mt-3; max-width: 100%"  id='img-upload' src=""/>`);

        $('#img-upload').on('load',
                function() {
                    create_cropper($('#img-upload').attr('src'));
                });

        $('#img-upload').on('ready',
            function() {
                if (this.cropper === cropper) cropper_update();
            }
        );
    }

    if (url_params.has('search_id')) {

        let upload_html =
        `
            <div class="card mt-2 mb-1">
                <div class="card-body">
                    <div>
                        <img class="img-fluid fit-image mt-3; max-width: 100%" id='img-upload' src=""/>
                    </div>
                </div>
            </div>
        `
        $("#search-rgn").html(upload_html);

        reset_image();

        $('#img-upload').attr('src', "image/" + url_params.get('search_id')+ "/full/nomarker");

        update_results(-1,-1,-1,-1);
    }
    else if (url_params.has('ids')) {

        var ids = url_params.get('ids');

        if (ids.length > 0) {
            ids = ids.split(/\s*,\s*/).map(Number);

            console.log(ids.length);

            makeResultList(ids);
        }
    }
    else {
        let upload_html =
        `
            <div class="card mt-2 mb-1">
                <div class="card-body">
                    <div id="cropper">
                    </div>
                    <form action="similar" method="post" enctype="multipart/form-data">
                        <label for="the-image" class="btn btn-primary mt-3">Upload search image</label>
                        <input type="file" name="file" id="the-image" style="display: none;"/>
                    </form>
                </div>
            </div>
        `;

        $("#search-rgn").html(upload_html);

        reset_image();

        $("#the-image").change(function(){

            if (cropper != null) {
                cropper.destroy();
                cropper = null;

                reset_image();
            }

            let fileInput = $('#the-image')[0]
            let file = fileInput.files[0];

            let reader = new FileReader();

            form_data = new FormData();
            form_data.append('file', file);

            $("#search-results").html(spinner_html);

            reader.onload =
                function (e) {
                     $('#img-upload').attr('src', e.target.result);

                    update_results(-1,-1,-1,-1);
                };

            reader.readAsDataURL(file);
        });
    }
}

$(document).ready(searchSetup);