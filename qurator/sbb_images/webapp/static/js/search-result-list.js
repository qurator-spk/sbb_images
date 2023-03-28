function setup_search_result_list(configuration, search) {
    let that = null;

    let spinner_html =
        `<div class="d-flex justify-content-center mt-5">
            <div class="spinner-border align-center mt-5" role="status">
                <span class="sr-only">Loading...</span>
            </div>
         </div>`;

    function add_ppn_info(image_id) {
        $.get("image-ppn/"+ configuration.getDataConf() + "/" + image_id,
            function(result) {
                $("#card-"+ image_id).attr('title', result['ppn']);

                $.get("../meta_data/" + result['ppn'],
                    function(meta) {
                        $("#card-"+ image_id).attr('title', meta.title + "; " + meta.author + "; " + meta.date);
                    }
                );
            }
        );
    };

    function add_file_info (image_id) {
        $.get("image-file/"+ configuration.getDataConf() + "/" + image_id,
            function(result) {
                if (result['file'] === undefined) return;

                $("#card-"+ image_id).attr('title', result['file']);
            }
        );
    };

    function add_iconclass_info (image_id) {
        $.get("image-iconclass/"+ configuration.getDataConf() + "/"  + image_id,
            function(results) {

                let text = "";
                $.each(results,
                    function(index, result) {
                        text += result.label + " : " + result.text + "\n"
                    }
                );
                $("#card-"+ image_id).attr('title', text);
            }
        );
    };

    let request_counter = 0;

    function update(results) {
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
                                    <a id="more-btn-${result_id}" class="btn-sm" target="_blank" rel="noopener noreferrer">More</a><br>
                                    <a href="image/${configuration.getDataConf()}/${result_id}/full" id="lnk-${result_id}" target="_blank" rel="noopener noreferrer">
                                        <img class="img-fluid fit-result-image" id="img-${result_id}" src="" rel="noopener noreferrer" referrerpolicy="no-referrer"/>
                                    </a>
                                    </div>
                                </div>
                            </div>
                            `;
                }
            );

            $('#search-results').html(result_html);

            $.each(results,
                function(index, result_id) {

                    (function(rid, dconf) {
                      $(`#more-btn-${result_id}`).click(
                        function() {
                            search(rid, dconf);
                        });
                    })(result_id, configuration.getDataConf());
                });

            function triggerNextImage () {

                if (results.length <= 0) return;
                if (counter_at_request < request_counter) return;

                let next_one = results.shift();

                (function(result_id) {
                    $('#img-'+ next_one).on('load',
                        function() {
                            $.get("link/" + configuration.getDataConf() + "/" + result_id).done(
                                function(result) {
                                    if (result.length <= 0) return;

                                    $("#lnk-" + result_id).attr('href', result);
                                }
                            );

                            triggerNextImage();
                        }
                     );
                })(next_one);

                $('#img-'+ next_one).attr("src", "image/" + configuration.getDataConf() + "/"+next_one+"/resize/regionmarker");

                $("#card-"+ next_one).removeClass('invisible');

                //add_file_info(next_one);
                //add_ppn_info(next_one);
                add_iconclass_info(next_one);
            };

            triggerNextImage();

        })(request_counter);
    };

    that = {
        update : update
    };

    let url_params = new URLSearchParams(window.location.search);

    if (url_params.has('ids')) {

        var ids = url_params.get('ids');

        if (ids.length > 0) {
            ids = ids.split(/\s*,\s*/).map(Number);

            //console.log(ids.length);

            update(ids);
        }
    }

    return that;
}