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

        function highlight(label_classes) {

            $(".icon-badge").removeClass('selected-0');
            $(".icon-badge").removeClass('selected-1');
            $(".icon-badge").removeClass('selected-2');
            $(".icon-badge").removeClass('selected-3');
            $(".icon-badge").removeClass('selected-4');
            $(".icon-badge").removeClass('selected-5');
            $(".icon-badge").removeClass('selected-6');

            $.each(label_classes,
                function(index, label_class) {
                    if (index < 1) {
                        $(`.${label_class}`).addClass("selected-0");
                    }
                    else if (index < 2) {
                        $(`.${label_class}`).addClass("selected-1");
                    }
                    else if (index < 3) {
                        $(`.${label_class}`).addClass("selected-2");
                    }
                    else if (index < 4) {
                        $(`.${label_class}`).addClass("selected-3");
                    }
                    else if (index < 5) {
                        $(`.${label_class}`).addClass("selected-4");
                    }
                    else if (index < 6) {
                        $(`.${label_class}`).addClass("selected-5");
                    }
                    else {
                        $(`.${label_class}`).addClass("selected-6");
                    }
                }
            );
        }

        $.get("image-iconclass/"+ configuration.getDataConf() + "/"  + image_id,
            function(results) {

                let info_html = "";
                let iconclass_classes = [];

                $.each(results,
                    function(index, result) {
                        let label_classes_joined="icon-badge";
                        let label_classes=[];
                        $.each(result.parts,
                            function(index, part){
                                part = part.replace(/\+/,"p");
                                part = part.replace(/\(/,"bo");
                                part = part.replace(/\)/,"bc");
                                part = part.replace(/:/,"col");
                                part = part.replace(/\./,"dot");

                                label_classes_joined += " icon-" + part;
                                label_classes.push("icon-"+part);
                            }
                        );

                        info_html +=
                            `
                            <a id="icon-badge-${image_id}-${index}">
                                <span class="badge badge-pill badge-info mr-1 ${label_classes_joined}"
                                        data-toggle="tooltip" title="${result.text}" >
                                    ${result.label}
                                </span>
                            </a>
                            `;

                        iconclass_classes.push(label_classes);
                    }
                );
                $("#card-info-"+ image_id).html(info_html);

                $.each(iconclass_classes,
                    function(index, label_classes) {
                            $(`#icon-badge-${image_id}-${index}`).click(
                                function() {
                                    highlight(label_classes);
                                }
                            );
                    }
                );
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
                                    <a id="more-btn-${result_id}">
                                        <span class="badge badge-pill badge-light badge-primary mb-1" data-toggle="tooltip" title="Click to find similar based on this image.">
                                            More
                                        </span>
                                    </a><br>
                                    <a href="image/${configuration.getDataConf()}/${result_id}/full" id="lnk-${result_id}" target="_blank" rel="noopener noreferrer">
                                        <img class="img-fluid fit-result-image" id="img-${result_id}" src="" rel="noopener noreferrer" referrerpolicy="no-referrer"/>
                                    </a>
                                    <div id="card-info-${result_id}" style="width: 100%;display: table-caption;"> </div>
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

                add_file_info(next_one);
                //add_ppn_info(next_one);
                add_iconclass_info(next_one);
            };

            triggerNextImage();

        })(request_counter);
    };

    that = {
        update : update
    };

//    let url_params = new URLSearchParams(window.location.search);
//    if (url_params.has('ids')) {
//
//        var ids = url_params.get('ids');
//
//        if (ids.length > 0) {
//            ids = ids.split(/\s*,\s*/).map(Number);
//
//
//            update(ids);
//        }
//    }

    return that;
}