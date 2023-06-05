function setup_search_result_list(configuration, search) {
    let that = null;
    let iconclass_highlighted = [];

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

    function highlight_iconclass(remove=true) {

        if (remove) {
            $(".icon-badge").removeClass('selected-0');
            $(".icon-badge").removeClass('selected-1');
            $(".icon-badge").removeClass('selected-2');
            $(".icon-badge").removeClass('selected-3');
            $(".icon-badge").removeClass('selected-4');
            $(".icon-badge").removeClass('selected-5');
            $(".icon-badge").removeClass('selected-6');
        }

        $.each(iconclass_highlighted,
            function(iconclass_depth, label_class) {
                if (iconclass_depth < 1) {
                    $(`.${label_class}`).addClass("selected-0");
                }
                else if (iconclass_depth < 2) {
                    $(`.${label_class}`).addClass("selected-1");
                }
                else if (iconclass_depth < 3) {
                    $(`.${label_class}`).addClass("selected-2");
                }
                else if (iconclass_depth < 4) {
                    $(`.${label_class}`).addClass("selected-3");
                }
                else if (iconclass_depth < 5) {
                    $(`.${label_class}`).addClass("selected-4");
                }
                else if (iconclass_depth < 6) {
                    $(`.${label_class}`).addClass("selected-5");
                }
                else {
                    $(`.${label_class}`).addClass("selected-6");
                }
            }
        );
    }

    function iconclass_sanitize(part) {
        part = part.replace(/\+/g,"p");
        part = part.replace(/\(/g,"bo");
        part = part.replace(/\)/g,"bc");
        part = part.replace(/:/g,"col");
        part = part.replace(/\./g,"dot");

        return part;
    }

    function add_iconclass_info (image_id) {

        $.get("image-iconclass/"+ configuration.getDataConf() + "/"  + image_id,
            function(results) {

                let info_html = "";
                let iconclass_badges = [];

                $.each(results,
                    function(index, result) {
                        let label_classes_joined="icon-badge";
                        let label_classes=[];
                        $.each(result.parts,
                            function(index, part){
                                part = iconclass_sanitize(part)

                                label_classes_joined += " icon-" + part;
                                label_classes.push("icon-"+part);
                            }
                        );

                        info_html +=
                            `
                            <a id="icon-badge-${image_id}-${index}" data-toggle="tooltip" title="${result.text}">
                                <span class="badge badge-pill badge-info mr-1 ${label_classes_joined}">
                                    ${result.label}
                                </span>
                            </a>
                            `;

                        iconclass_badges.push(label_classes);
                    }
                );
                $("#card-info-"+ image_id).html(info_html);

                highlight_iconclass(false);

                $.each(iconclass_badges,
                    function(badge_index, label_classes) {
                            $(`#icon-badge-${image_id}-${badge_index}`).click(
                                function() {
                                    iconclass_highlighted = label_classes;
                                    highlight_iconclass();
                                }
                            );
                    }
                );
            }
        );
    };

    function add_tag_info (image_id) {

        $.get("image-tags/"+ configuration.getDataConf() + "/"  + image_id,
            function(results) {

                let info_html = "";

                $.each(results,
                    function(index, result) {

                        info_html +=
                            `
                            <a id="tag-badge-${image_id}-${index}" class="" data-toggle="tooltip" title="${result.user} : ${result.timestamp}">
                                    <span class="badge badge-pill badge-info d-inline-flex mt-2" style="align-items: center">
                                            ${result.tag}
                                    <button type="button" class="btn-sm close ml-2" id="tag-delete-${image_id}-${index}" aria-label="Dismiss">
                                        &times;
                                    </button>
                                    </span>
                                </span>
                            </a>
                            `;
                    }
                );
                $("#card-info-"+ image_id).html(info_html);

                 $.each(results,
                    function(index, result) {
                        (function(img_id, tag_id, tag) {
                            $(`#tag-delete-${img_id}-${tag_id}`).click(
                                function(){
                                    console.log("Delete " + img_id + "-" + tag );

                                    (function(tag_id) {
                                        console.log(tag, img_id)

                                        let request =
                                        {
                                            success:
                                                function(){
                                                    add_tag_info(img_id);
                                                },
                                            error: function(){},
                                            url: "delete-image-tag/"+ configuration.getDataConf() + "/" + img_id,
                                            data: JSON.stringify({ "tag": tag }),
                                            type: "POST",
                                            contentType: "application/json"
                                        };
                                    $.ajax(request);
                                    })(tag_id);
                                }
                             );
                        })(image_id, index, result.tag);
                    }
                 );
            }
        );
    };

    let request_counter = 0;

    function update(results) {
        request_counter += 1;

        (function(counter_at_request, ids) {

            $("#tag-controls").addClass("d-none");
            $('#search-results').html("");

            let result_html = "";

            $.each(ids,
                function(index, result_id) {

                    if (counter_at_request < request_counter) return;

                    result_html += `
                         <div class="card invisible" id="card-${result_id}" data-toggle="tooltip" data-placement="bottom" title="">
                             <div class="card-body">
                                 <div class="d-flex justify-content-between">
                                    <span class="badge badge-light" >${index + 1}</span>
                                    <input class="justify-content-end tag-selectable" type="checkbox" id="select-${result_id}" />
                                 </div>
                                 <a id="more-btn-${result_id}" class="btn btn-link" href="">
                                     <span class="badge badge-pill badge-light badge-primary mb-1" data-toggle="tooltip" title="Click to find similar based on this image." onclick="$(this).tooltip('hide')">
                                         More
                                     </span>
                                 </a><br>
                                 <a href="image/${configuration.getDataConf()}/${result_id}/full" id="lnk-${result_id}" target="_blank" rel="noopener noreferrer">
                                     <img class="img-fluid fit-result-image" id="img-${result_id}" src="" rel="noopener noreferrer" referrerpolicy="no-referrer"/>
                                 </a>
                                 <div class="row  justify-content-center text-center">
                                     <div class="d-inline-flex">
                                         <div class="flex-column" style="max-width: 250px" id="card-info-${result_id}" />
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     `;
                }
            );

            $('#search-results').html(result_html);

            $.each(ids,
                function(index, result_id) {

                    (function(rid, dconf) {
                      $(`#more-btn-${result_id}`).click(
                        function() {
                            search(rid, dconf);
                        });

                      $(`#select-${result_id}`).data("image_id", result_id);
                    })(result_id, configuration.getDataConf());
                });

            function triggerNextImage () {

                if (ids.length <= 0) return;
                if (counter_at_request < request_counter) return;

                let next_one = ids.shift();

                (function(result_id) {
                    $('#img-'+ result_id).on('load',
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

                add_tag_info(next_one);
            };

            triggerNextImage();

        })(request_counter, results["ids"]);

        if ("highlight_labels" in results) {

            that.highlightIconclass(results["highlight_labels"]);
        }
        else {
            iconclass_highlighted=[];
        }

        if (results["ids"].length > 0)  $("#tag-controls").removeClass("d-none");
    };

    $("#add-tag").click(
        function() {
            //console.log("add-tag");

            let ids = [];
            $('.tag-selectable:checkbox:checked').each(
                function() {
                    ids.push($(this).data("image_id"));
                });

            (function(update_ids) {
            let request =
            {
                success:
                    function(){
                        $.each(update_ids,
                            function(idx, uid) {
                                //console.log(uid)
                                add_tag_info(uid);
                            }
                        );

                        $(".tag-selectable").prop("checked", false);
                    },
                error: function(){},
                url: "add-image-tag/"+ configuration.getDataConf(),
                data: JSON.stringify({ "ids" : ids, "tag": $("#add-tag-input").val() }),
                type: "POST",
                contentType: "application/json"
            };

            $.ajax(request);
            })(ids);
        }
    );

    $("#select-all").click(
        function() {
            //console.log("select-all");

            $(".tag-selectable").prop("checked", true);
        }
    );

    $("#select-none").click(
        function() {
            //console.log("select-none");

            $(".tag-selectable").prop("checked", false);
        }
    );

    that = {
        update : update,
        highlightIconclass:
            function(labels) {

                iconclass_highlighted = [];

                $.each(labels,
                    function(index, label) {
                        label = iconclass_sanitize(label);
                        iconclass_highlighted.push("icon-" + label);
                    });

                highlight_iconclass();
            }
    };

    return that;
}