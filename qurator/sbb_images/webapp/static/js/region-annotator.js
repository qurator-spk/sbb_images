(function() {

function makeAnnotator() {

    let anno=null;
    let basic_auth=null;

    function annotation_url_input() {
        console.log("annotation_url_input");
    }

    function add_annotation(annotation, onSuccess) {
        let post_data = { "annotation": annotation, "url" : $("#image-view").attr("src") };

        $.ajax({
                url:  "add-annotation",
                data: JSON.stringify(post_data),
                type: 'POST',
                contentType: "application/json",
                success: onSuccess,
                error:
                    function(error) {
                        console.log(error);
                    }
            }
        );
    }

    function update_annotation(annotation, onSuccess) {
        let post_data = { "annotation": annotation };

        $.ajax({
                url:  "update-annotation",
                data: JSON.stringify(post_data),
                type: 'POST',
                contentType: "application/json",
                success: onSuccess,
                error:
                    function(error) {
                        console.log(error);
                    }
            }
        );
    }

    function delete_annotation(anno_id, onSuccess) {
        let post_data = { "anno_id": anno_id };

        $.ajax({
                url:  "delete-annotation",
                data: JSON.stringify(post_data),
                type: 'POST',
                contentType: "application/json",
                success: onSuccess,
                error:
                    function(error) {
                        console.log(error);
                    }
            }
        );
    }

    function add_url(img_url, onSuccess) {
        let post_data = { "url" : img_url };

        $.ajax({
                url:  "add-url",
                data: JSON.stringify(post_data),
                type: 'POST',
                contentType: "application/json",
                success: onSuccess,
                error:
                    function(error) {
                        console.log(error);
                    }
            }
        );
    }


    function annotation_setup(img_url) {

        if (anno != null) {
            anno.destroy();

            $('#toolbar').html("");
        }

        $("#editor").removeClass("d-none");

        anno = Annotorious.init({
          image: 'image-view',
          locale: 'auto',
          allowEmpty: true,
          readyOnly: true
        });

        anno.readOnly = true;

        if (basic_auth.getUser() != null) {
            anno.setAuthInfo({
              id: basic_auth.getUser(),
              displayName: basic_auth.getUser()
            });

            Annotorious.Toolbar(anno, $('#toolbar')[0]);

            anno.readOnly=false;
        }

        Annotorious.BetterPolygon(anno);

        anno.on('createAnnotation',
            function(annotation, overrideId) {
                add_annotation(annotation,
                    function() {
                        update_annotation_list();
                    }
                );
            }
        );

        anno.on('deleteAnnotation',
            function(annotation) {
                delete_annotation(annotation['id'],
                    function() {
                        update_annotation_list();
                    }
                );
            }
        );

        anno.on('updateAnnotation',
            function(annotation, previous) {
                update_annotation(annotation,
                    function() {
                        update_annotation_list();
                    }
                );
            }
        );

        update_annotation_list();
    }

    function annotation_url_submit() {
        let img_url = $("#annotation-url").val();

        console.log(img_url);

        if ($("#action").val() === "add") {
            add_url(img_url,
                function() {
                    $("#action").val("annotate")
                }
            );
        }
        else {
            $("#image-view").attr("src", img_url);

            // load_url(img_url);
        }
    }

    function render_list(results) {
        console.log(results);

        if (anno === null) return;

        anno.clearAnnotations();

        $.each(results,
            function(index, result) {
                anno.addAnnotation(result['annotation'], result['read_only']);
            }
        );
    }

    function update_annotation_list() {

        if (basic_auth.getUser() === null) {
            if (anno === null) return;

            anno.clearAnnotations();
        }
        else {
            let post_data = { "url" : $("#image-view").attr("src") };

            $.ajax({
                    url:  "get-annotations",
                    data: JSON.stringify(post_data),
                    type: 'POST',
                    contentType: "application/json",
                    success: render_list,
                    error:
                        function(error) {
                            console.log(error);
                        }
                }
            );
        }
    }

    function update_admin_state() {
        $.get("isadmin",
            function(result) {
                if (result.isadmin) {
                    $("#add-action").prop("disabled", false);
                }
            }
        );
    }

    function init() {
        $("#annotation-url").on('input', annotation_url_input);

        $("#annotation-url").on('keydown',
            function(e) {
                if (e.keyCode === 13) annotation_url_submit();
            });

        basic_auth = BasicAuth('#auth-area');

        (function(enable_login, enable_logout) {

        basic_auth.enable_logout =
            function() {
                enable_logout();

                update_admin_state();

                if (anno === null) return;

                anno.setAuthInfo({
                    id: basic_auth.getUser(),
                    displayName: basic_auth.getUser()
                });

                Annotorious.Toolbar(anno, $('#toolbar')[0]);

                anno.readOnly = false;

                update_annotation_list();
            }

        basic_auth.enable_login =
            function() {
                enable_login();

                $("#action").val("annotate");
                $("#add-action").prop("disabled", true);

                if (anno === null) return;

                anno.clearAuthInfo();

                $('#toolbar').html("");

                anno.readOnly = true;

                update_annotation_list();
            };

        })(basic_auth.enable_login, basic_auth.enable_logout);

        if (basic_auth.getUser() != null) {
            update_admin_state();
        }

        $("#image-view").on("load",
            function() {
                annotation_setup($("#image-view").attr('src'));
            }
        );
    }

    let that =
        {
            init: function() { init(); }
        };

    return that;
}

$(document).ready(
    function() {
        var annotator = makeAnnotator();

        annotator.init();
    }
);

})();