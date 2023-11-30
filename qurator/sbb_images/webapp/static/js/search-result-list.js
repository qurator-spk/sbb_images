function setup_search_result_list(configuration, search, next_batch) {
    let that = null;
    let iconclass_highlighted = [];
    let tag_highlighted = "";

    let has_links  = false;
    let has_tags = false;
    let has_iconclass = false;
    let region_annotator = "";

    function check_for_info(afterwards) {
        $.get("hasiconclass/" + configuration.getDataConf(),
            function(hasit) {
                has_iconclass = hasit;

                $.get("hastags/" + configuration.getDataConf(),
                    function(hasit) {
                        has_tags = hasit;

                        $.get("haslinks/" + configuration.getDataConf(),
                            function(hasit) {
                                has_links = hasit;

                                $.get("regionannotator",
                                    function(reanno) {

                                        console.log(reanno);
                                        region_annotator = reanno;

                                        afterwards();
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }

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
                $("#card-"+ image_id).tooltip();

                $("#card-"+ image_id).click(
                    function() {
                        $(this).tooltip('hide');
                    });

//                (function(filename) {
//                $("#card-" + image_id + "-number").click(
//                    function () {
//                        $(this).tooltip('hide');
//                        console.log(filename);
//                        navigator.clipboard.writeText(filename);
//                    }
//                );
//                })(result['file']);
            }
        );
    };

    function highlight_tags(remove=true) {

        if (remove) {
            $(".tag-badge").removeClass('selected-6');
        }

        $(tag_highlighted).addClass('selected-6');
    }

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

                        let remove_button_html = `
                            <button type="button" class="btn-sm close ml-2" id="tag-delete-${image_id}-${index}" aria-label="Dismiss">
                                &times;
                            </button>
                        `;

                        if (result.read_only) {
                            remove_button_html = "";
                        }

                        info_html +=
                            `
                            <a id="tag-badge-${image_id}-${index}" class="" data-toggle="tooltip" title="${result.user} : ${result.timestamp}">
                                    <span id="tag-span-${image_id}-${index}" class="tag-badge tag-${result.tag} badge badge-pill badge-info d-inline-flex mt-2" style="align-items: center">
                                        ${result.tag}
                                        ${remove_button_html}
                                    </span>
                                </span>
                            </a>`;
                    }
                );
                $("#card-info-"+ image_id).html(info_html);

                highlight_tags(false);

                $.each(results,
                    function(index, result) {
                        (function(img_id, tag_id, tag) {
                            $(`#tag-badge-${img_id}-${tag_id}`).tooltip();

                            $(`#tag-span-${img_id}-${tag_id}`).click(
                                function() {
                                    tag_highlighted = `.tag-${tag}`;

                                    highlight_tags();
                                }
                            );

                            $(`#tag-delete-${img_id}-${tag_id}`).click(
                                function(){

                                    $(`#tag-badge-${img_id}-${tag_id}`).tooltip('hide');

                                    (function(tag_id) {
                                        console.log(tag, img_id)

                                        let request =
                                        {
                                            success:
                                                function(){
                                                    add_tag_info(img_id);
                                                },
                                            error: function(){},
                                            url: "delete-image-tag/"+ configuration.getDataConf(),
                                            data: JSON.stringify({ "ids": [img_id],  "tag": tag}),
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
    let batches = [];
    let num_results = 0;
    let result_number = 0;

    function update(results, start=false) {
        if (start) {
            request_counter += 1;
            batches = [ results ];
            num_results = 0;
            result_number = 0;
        }
        else {
            if (batches.length > 0) {
                batches.push(results);
                return;
            }
            batches.push(results);
        }

        while(batches.length > 0)
        (function(counter_at_request, ids, at_pos) {

            if (at_pos == 0) {
                $("#tag-controls").addClass("d-none");
                $('#search-results').html("");
            }

            let result_html = "";

            let valid_ids = [];
            $.each(ids,
                function(index, result_id) {

                    if (counter_at_request < request_counter) return;

                    if ($(`#card-${result_id}`).length > 0) return;

                    valid_ids.push(result_id);
                    result_number += 1

                    let region_annotator_html="";

                    if (region_annotator.length > 0) {
                        region_annotator_html = `
                            <a class="btn btn-link" href=""  id="iiif-lnk-${result_id}" target="_blank" rel="noopener noreferrer">
                                <span class="badge badge-pill badge-light badge-primary mb-1" data-toggle="tooltip" title="Click to annotate regions in this image." onclick="$(this).tooltip('hide')">
                                    Annotate
                                </span>
                            </a>
                        `;
                    }

                    result_html += `
                         <div class="card invisible" id="card-${result_id}" data-toggle="tooltip" data-placement="bottom" title="">
                             <div class="card-body">
                                 <div class="d-flex justify-content-between">
                                    <span class="badge badge-light" id="card-${result_id}-number">${result_number}</span>
                                    <input class="justify-content-end tag-selectable" type="checkbox" id="select-${result_id}" />
                                 </div>
                                 <a id="more-btn-${result_id}" class="btn btn-link" href="">
                                     <span class="badge badge-pill badge-light badge-primary mb-1" data-toggle="tooltip" title="Click to find similar based on this image." onclick="$(this).tooltip('hide')">
                                         More
                                     </span>
                                 </a>
                                 ${region_annotator_html}
                                 <br>
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

            if (counter_at_request < request_counter) return;

            if (num_results == 0) $('#search-results').html(result_html);
            else $('#search-results').append(result_html);

            num_results += ids.length;


            $.each(valid_ids,
                function(index, result_id) {

                    if (counter_at_request < request_counter) return;

                    (function(rid, dconf) {
                      $(`#more-btn-${result_id}`).click(
                        function() {
                            $(this).tooltip('hide');
                            search(rid, dconf);
                        });

                      $(`#select-${result_id}`).data("image_id", result_id);

                      $(`#more-btn-${result_id}`).tooltip();

                      //$(`#card-${result_id}-number`).tooltip();

                    })(result_id, configuration.getDataConf());
                }
            );

            function triggerNextImage (valid_ids) {

                if (ids.length <= 0) return;
                if (counter_at_request < request_counter) return;

                let next_one = valid_ids.shift();

                (function(result_id) {
                    $('#img-'+ result_id).on('load',
                        function() {

                            $.get("link/" + configuration.getDataConf() + "/" + result_id).done(
                                function(result) {
                                    if (result.length <= 0) return;

                                    $("#lnk-" + result_id).attr('href', result);
                                }
                            );

                            if (region_annotator.length > 0) {
                                $.get("iiif-link/" + configuration.getDataConf() + "/" + result_id).done(
                                    function(result) {
                                        if (result.length <= 0) return;

                                        let annotate_lnk = region_annotator + "?image=" + encodeURIComponent(result);

                                        $("#iiif-lnk-" + result_id).attr('href', annotate_lnk);
                                    }
                                );
                            }

                            triggerNextImage(valid_ids);
                        }
                    );

                    $('#img-'+ result_id).attr("src",
                        "image/" + configuration.getDataConf() + "/"+result_id+"/resize/regionmarker");

                    $("#card-"+ result_id).removeClass('invisible');

                    add_file_info(result_id);
                    //add_ppn_info(next_one);
                    if (has_iconclass) add_iconclass_info(result_id);

                    if (has_tags) {
                        add_tag_info(result_id);
                    }

                 })(next_one);
            };

            triggerNextImage(valid_ids);

        })(request_counter, batches.pop()["ids"]);

        if ("highlight_labels" in results) {
            that.highlightIconclass(results["highlight_labels"]);
        }
        else {
            iconclass_highlighted=[];
        }

        if (results["ids"].length > 0)  $("#tag-controls").removeClass("d-none");
    };

    let tag_mode = "add";

    $("#tag-select-add").click(
        function() {
            tag_mode = "add";

            $("#tag-button").html($(this).html());
        });

    $("#tag-select-remove").click(
        function() {
            tag_mode = "remove";

            $("#tag-button").html($(this).html());
        });

    $("#tag-button").click(
        function() {
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
                                add_tag_info(uid);
                            }
                        );
                    },
                error: function(){},
                data: JSON.stringify({ "ids" : ids, "tag": $("#tag-input").val() }),
                type: "POST",
                contentType: "application/json"
            };

            if (tag_mode === "add") {
                request['url'] = "add-image-tag/"+ configuration.getDataConf();
            }
            else if (tag_mode == "remove") {
                request['url'] = "delete-image-tag/"+ configuration.getDataConf();
            }

            $.ajax(request);
            })(ids);
        }
    );

    let select_first=5;

    $("#select-images").click(
        function() {
            $(".tag-selectable").prop("checked", false);

            $.each($(".tag-selectable"),
                function(index, selectable) {
                    if (index >= select_first) return;

                    $(selectable).prop("checked", true);
                });
        }
    );

    $.each([5,10,20,40,80],
        function(index, val) {

            (function(sf) {
            $("#select-first-" + sf).click(
                function() {
                    select_first = sf;
                    $("#select-images").html(`Select first ${select_first}`);

                    $.each($(".tag-selectable"),
                        function(index, selectable) {
                            if (index >= select_first) return;

                            $(selectable).prop("checked", true);
                        });
                });
            })(val);
        });

     $("#select-none").click(
         function() {
             $(".tag-selectable").prop("checked", false);
         }
     );

     $("#get-spreadsheet").click(
        function() {
            let ids = [];
            $('.tag-selectable:checkbox:checked').each(
                function() {
                    ids.push($(this).data("image_id"));
                }
            );

            (function(ids) {
            let xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                    if ((this.readyState !== 4) || (this.status !== 200)) return;

                    let downloadUrl = URL.createObjectURL(xhttp.response);
                    let alink = document.createElement("a");
                    document.body.appendChild(alink);
                    alink.style = "display: none";
                    alink.href = downloadUrl;
                    alink.download = xhttp.getResponseHeader("content-disposition").match(/.*filename=(.*)$/)[1];
                    alink.click();
            };
            xhttp.open("POST", "get-spreadsheet/" + configuration.getDataConf(), true);
            xhttp.setRequestHeader("Content-Type", "application/json");
            xhttp.responseType = "blob";
            xhttp.send(JSON.stringify({ "ids" : ids}));
            })(ids);
        }
     );

    let nextBatchTimeout=null;

    $("#search-results-container").scroll(
        function() {
            let se = $("#search-results");

            if ($(this).scrollTop() + $(this).height() >= se.height()) {

                if (nextBatchTimeout !== null) clearTimeout(nextBatchTimeout);

                nextBatchTimeout =
                    setTimeout(
                        function() {
                            next_batch();
                        }, 1000);
            }
        }
    );

    that = {
        update :
            function(results, start) {
                (function(res, st) {
                    check_for_info(function() {update(res, st); });
                 })(results, start);
            },
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