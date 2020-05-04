$(document).ready(

    function() {

        function makeResultList(results) {
            let result_html = ""

            $.each(results,
                function(index, result_id) {
                    result_html += '<a ' + 'href="search.html?search_id=' + result_id +'">' +
                                        '<img class="img-fluid fit-result-image mt-2 mr-2" '
                                        + 'src="image/' + result_id + '"' +'/>' +
                                    '</a>';

                }
            );

            $('#search-results').html(result_html);
        }

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

		let url_params = new URLSearchParams(window.location.search);

        if (url_params.has('search_id')) {

            $('#img-upload').attr('src', "image/" + url_params.get('search_id'));

            $.get("similar?search_id=" + url_params.get('search_id')).done(makeResultList);
        }
	});