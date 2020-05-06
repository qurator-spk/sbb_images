$(document).ready(

    function() {

        function makeResultList(results) {
            let result_html = ""

            $.each(results,
                function(index, result_id) {

                    result_html +=
                            `
                            <div class="row-fluid">
                                <div class="card">
                                    <div class="card-body">
                                    <a href="search.html?search_id=${result_id}" class="btn-sm">More</a><br>
                                    <a  href="" id="img-${result_id}">
                                        <img class="img-fluid fit-result-image" src="image/${result_id}"/>
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
                    $.get("link/" + result_id).done(
                        function(result) {
                            $("#img-" + result_id).attr('href', result);
                        }
                    );
                }
            );
        }

        let url_params = new URLSearchParams(window.location.search);

        if (url_params.has('search_id')) {

            let upload_html =
            `
                <div class="card mt-2 mb-1">
                    <div class="card-body">
                        <img class="img-fluid fit-image mt-3" id='img-upload' src=""/>
                    </div>
                </div>
            `
            $("#search-rgn").html(upload_html);

            $("#search-rgn").html(upload_html);

            $('#img-upload').attr('src', "image/" + url_params.get('search_id'));

            $.get("similar?search_id=" + url_params.get('search_id')).done(makeResultList);
        }
        else {

            let upload_html =
            `
                <div class="card mt-2 mb-1">
                    <div class="card-body">
                        <img class="img-fluid fit-image mt-3" id='img-upload' src=""/>
                        <form action="similar" method="post" enctype="multipart/form-data">
                            <label for="the-image" class="btn btn-primary mt-3">Upload search image</label>
                            <input type="file" name="file" id="the-image" style="display: none;"/>
                        </form>
                    </div>
                </div>
            `

            $("#search-rgn").html(upload_html);

            $("#the-image").change(function(){

                let fileInput = $('#the-image')[0]
                let file = fileInput.files[0];

                let reader = new FileReader();

                reader.onload =
                    function (e) {
                        $('#img-upload').attr('src', e.target.result);
                        $('#search-results').html("");
                    };

                reader.readAsDataURL(file);

                let formData = new FormData();
                formData.append('file', file);

                $.ajax(
                    {
                        url:  "similar",
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
            });
        }
	});