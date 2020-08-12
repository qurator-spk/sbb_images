$(document).ready(

    function() {

        let image_requests = [];
        let request_counter = 0;

        function makeResultList(results) {
            request_counter += 1;

            (function(counter_at_request) {
                image_requests.forEach(
                    function(img_request) {
                        if (counter_at_request < request_counter) return;

                        img_request.abort();
                    }
                );

                image_requests=[];

                $('#search-results').html("");

                let result_html = "";


                $.each(results,
                    function(index, result_id) {

                        if (counter_at_request < request_counter) return;

                        result_html +=
                                `
                                <div class="row-fluid">
                                    <div class="card invisible" id="card-${result_id}">
                                        <div class="card-body">
                                        <a href="search.html?search_id=${result_id}" class="btn-sm" target="_blank" rel="noopener noreferrer">More</a><br>
                                        <a  href="" id="img-${result_id}" target="_blank" rel="noopener noreferrer">
                                            <img class="img-fluid fit-result-image" src="image/${result_id}/resize/regionmarker"/>
                                        </a>
                                        </div>
                                    </div>
                                </div>
                                `;
                    }
                );

                if (counter_at_request < request_counter) return;

                $.each(results,
                    function(index, result_id) {
                        if (counter_at_request < request_counter) return;

                        image_requests.push(
                            $.get("link/" + result_id).done(
                                function(result) {

                                    if (counter_at_request < request_counter) return;

                                    if (result_html.length > 0) {
                                        $('#search-results').html(result_html);
                                        result_html = "";
                                    }

                                    $("#card-"+ result_id).removeClass('invisible');
                                    $("#img-" + result_id).attr('href', result);
                                }
                            )
                        );
                    }
                );
            })(request_counter);
        }

        let url_params = new URLSearchParams(window.location.search);
        let cropper = null;

        let update_results =
            function(x, y, width, height) {
                console.log(x, y, width, height);
            };

        function cropper_update() {
            canvas_data = cropper.getCanvasData();
            crop_data = cropper.getCropBoxData();
            image_data = cropper.getImageData();

            let crop_x = crop_data.left - canvas_data.left;
            let crop_y = crop_data.top - canvas_data.top;
            let crop_width = crop_data.width;
            let crop_height = crop_data.height;

            image_width = image_data.width;
            image_height = image_data.height;

            update_results(crop_x/image_width, crop_y/image_height,
                            crop_width/image_width, crop_height/image_height);
        }

        function create_cropper(img_src) {
            if (cropper != null) {
                cropper.replace(img_src);
            }
            else {
                cropper =
                    new Cropper($('#img-upload')[0],
                                {viewMode: 2,
                                 zoomable: true,
                                 background: false,
                                 autoCropArea: 1.0,
                                 modal: false,
                                 rotatable: false,
                                 restore: false}
                                 );

                $('#img-upload').on('cropend', function(event) { cropper_update(); });
            }
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

            $("#search-rgn").html(upload_html);

            $('#img-upload').attr('src', "image/" + url_params.get('search_id')+ "/resize/nomarker");

            update_results =
                    function(x, y, width, height) {
                        $.get("similar/0/100/"+x+"/"+y+"/"+width+"/"+height+"?search_id=" + url_params.get('search_id')).done(makeResultList);
                    };

            create_cropper("image/" + url_params.get('search_id')+ "/resize/nomarker");
            cropper_update();
        }
        else {

            let upload_html =
            `
                <div class="card mt-2 mb-1">
                    <div class="card-body">
                        <div>
                            <img style="img-fluid fit-image mt-3; max-width: 100%"  id='img-upload' src=""/>
                        </div>
                        <form action="similar" method="post" enctype="multipart/form-data">
                            <label for="the-image" class="btn btn-primary mt-3">Upload search image</label>
                            <input type="file" name="file" id="the-image" style="display: none;"/>
                        </form>
                    </div>
                </div>
            `;

            $("#search-rgn").html(upload_html);

            $("#the-image").change(function(){

                let fileInput = $('#the-image')[0]
                let file = fileInput.files[0];

                let reader = new FileReader();

                let formData = new FormData();
                formData.append('file', file);

                update_results =
                    function(x, y, width, height) {
                        $.ajax(
                            {
                                url:  "similar/0/100/"+x+"/"+y+"/"+width+"/"+height,
                                data: formData,
                                type: 'POST',
                                enctype: "multipart/form-data",
                                processData: false,
                                contentType: false,
                                cache: false,
                                success: makeResultList,
                                error:
                                    function(error) {
                                        console.log(error);
                                    }
                            }
                        );
                    };

                reader.onload =
                    function (e) {
                        $('#img-upload').attr('src', e.target.result);
                        $('#search-results').html("");

                        create_cropper(e.target.result);
                        cropper_update();
                    };

                reader.readAsDataURL(file);
            });
        }
	});
