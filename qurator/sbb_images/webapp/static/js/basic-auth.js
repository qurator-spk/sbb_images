function BasicAuth(auth_area) {

    let initialized=false;
    let user=null;
    let that=null;

    function logout() {
        user=null;
        $.get({'url': 'authenticate',  'username': "some", "password": "some"}).
            done(that.enable_logout).
            fail(that.enable_login);
    }

    that = {
        user: function() { return user; },

        enable_login:
            function () {
                user=null;
                let login_html =
                `
                <div class="alert alert-info mb-3">
                    <span> [Logged out] </span>
                    <button class="btn btn-primary ml-2" id="login">Login</button>
                </div>
                `;

                $(auth_area).html(login_html);
                $('#login').click(
                    function(token) {
                        $.get('authenticate').done(
                            function(auth) {
                                user = auth.user;
                                that.enable_logout();
                            }
                        );
                    }
                );
            },
        enable_logout:
            function (logout_html=null) {

                let default_logout_html =
                    `
                    <div class="alert alert-success mb-3">
                        <span> [${user}] </span>
                        <button class="btn btn-secondary ml-2" id="logout">Logout</button>
                    </div>
                    `;

                if (logout_html==null) $(auth_area).html(default_logout_html);
                else $(auth_area).html(logout_html);

                $('#logout').click(logout);
            },

        getUser:
            function () {

                $.get({'url': 'auth-test', 'async': false}).
                    done(
                        function(auth) {
                            if (auth.user != user) {
                                user = auth.user;
                                that.enable_logout();
                            }
                        }).
                    fail(
                        function() {
                            if ((user != null) || (!initialized)){
                                initialized=true;
                                that.enable_login();
                            }
                        }
                    );

                return user;
             }
    };

    return that;
}