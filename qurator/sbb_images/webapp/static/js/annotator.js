
function makeAnnotator() {

    let selected_class = "";
    let the_label = null;
    let pre_classification = null;

    function setPreviewImage(img) {

        $('#label-rgn').html('');

        $.get("prediction/" + img)
            .done(
                function(classification) {
                    console.log(classification);

                    pre_classification = classification;

                    $("#preview").attr("src", "");
                    $("#preview").attr("src", "image/" + img);
                }
            );
    }

    function gotoRandomImage() {

        $.get("randomid?selected_class=" + selected_class).done(
            function(rowid) {

                the_label = null;
                pre_classification = null;

                if (rowid > 0) {
                    window.history.pushState({image: rowid}, 'image-page', 'annotator.html?image=' + rowid);

                    setPreviewImage(rowid)
                }
                else {
                    $("#preview").attr("src", "");
                    $("#preview").attr("alt", "Everything has been labeled.");
                    $('#label-rgn').html('');
                }
            }
        );
    }

    function nextImage() {

        if (the_label == null) {

            if ((pre_classification == null) || (pre_classification.length==0)) return;

            label_it(pre_classification);

            return;
        }

        let url_params = new URLSearchParams(window.location.search);

        //console.log('nextImage');

        var post_data =
            {
                rowid : url_params.get('image'),
                label : the_label
            };

        $('#label-rgn').html("");
        the_label = null;
        pre_classification = null;

        $.ajax(
            {
                url:  "annotate",
                data: JSON.stringify(post_data),
                type: 'POST',
                contentType: "application/json",
                success: gotoRandomImage,
                error:
                    function(error) {
                        console.log(error);
                    }
            }
        );
    };

    function label_it(label) {

        the_label = label;

        $('#label-rgn').html('<span class="badge badge-info">' + label + '</span>');
    };

    function makeClassSelection(labels) {

        let selection_html =
            `<div class="form-group mt-2">
                    <select class="form-control" id="class-select">
                    </select>
            </div>`;

        $.get("haspredictions")
            .done(
                function(hasPredictions) {
                    //console.log('hasPredictions', hasPredictions);

                    if (!hasPredictions) return;

                    $('#select-rgn').html(selection_html);

                    let tmp = "<option value=''> Keine Vorklassifikation </option>";

                    $.each(labels,
                        function(index, label) {
                            tmp += "<option value='" + label+ "'>" + label + "</option>";
                        }
                    );

                    $('#class-select').html(tmp);

                    $('#class-select').change(
                        function() {
                            selected_class = $('#class-select').val();

                            gotoRandomImage();
                        }
                    );
                }
            );
    }

    function makeButtons(labels) {
        let tmp="";
        $.each(labels,
            function(index, label) {
                tmp += '<button class="btn btn-lg btn-secondary btn-sm mr-1 mt-1" id="label-btn-' +
                        index + '">' + label + '</button>';
            }
        );

        $('#btn-region').html(tmp);

        $.each(labels,
            function(index, label) {
                $('#label-btn-' + index).click(function() { label_it(label); });
            }
        );
    }

    function init () {
        $.get("labels")
            .done(
                function( labels ) {

                    makeButtons(labels);

                    makeClassSelection(labels);

                    let url_params = new URLSearchParams(window.location.search);

                    if (url_params.has('image')) {
                        window.history.pushState({image: url_params.get('image')}, 'image-page',
                                                "annotator.html?image=" + url_params.get('image'));

                        setPreviewImage(url_params.get('image'))
                    }
                    else {
                        gotoRandomImage();
                    }
                }
            );

        $('#next-btn').click(nextImage);

        $('#preview').on('load',
            function() {
                if (pre_classification==null) return;
                if (pre_classification.length==0) return;

                $('#label-rgn').html('<span class="badge badge-danger">' + pre_classification + '</span>');
            }
        );
    }

    $(window).on("popstate",
        function () {
            setPreviewImage(history.state.image);
        }
    );

    let that =
        {
            init: function() { init(); }
        };

    return that;
}

$(document).ready(
    function() {
        let annotator = makeAnnotator();

        annotator.init();
    }
);

