async function login() {
    document.getElementById('errorMsg').textContent = '';
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    if (username !== '' && password !== '') {
        // Send a POST request and validate user credentials.
        const response = await fetch('/ptmkb/login', {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    "username": username,
                    "password": password
                }
            )
        }).then(async (res) => {
            return await res.json();
        }).catch(err => {
            console.error(err);
        });
        if (response.verify) { // The user has been authenticated - proceed!
            console.log("Verified!");
            sessionStorage.setItem('user', JSON.stringify(response.info));
            document.location.href = '/';
        } else {
            document.getElementById('errorMsg').textContent = response.message;
        }
    } else {
        // Now print a message stating what needs to be done.
        if (username === '') {
            document.getElementById('errorMsg').textContent = "Please enter your username to login.";
        } else if (password === '') {
            document.getElementById('errorMsg').textContent = "Please enter your password to login.";
        }
    }
}

async function signup() {
    document.getElementById('errorMsg').textContent = '';
    const username = document.getElementById('signupUsername').value;
    const password1 = document.getElementById('signupPassword1').value;
    const password2 = document.getElementById('signupPassword2').value;
    if (username !== '' && password1 !== '' && password2 !== '') {
        const regex = /^[a-z0-9]+$/i;
        if (!regex.test(username)) {
            document.getElementById('errorMsg').textContent = "The username must have alphanumeric characters only!";
        } else {
            if (username.length < 8 || username.length > 32) {
                document.getElementById('errorMsg').textContent = "The username must be between 8 and 32 characters long!";
            } else {
                if (password1 !== password2) {
                    document.getElementById('errorMsg').textContent = "Ensure that both passwords match!";
                } else {
                    const response = await fetch('/ptmkb/check_existing_user', {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({'username': username})
                    }).then(async (res) => {
                        return await res.json();
                    }).catch(err => {
                        console.error(err);
                    });
                    if (response.exists) {
                        document.getElementById('errorMsg').textContent = "The username already exists!";
                    } else {
                        const response = await fetch('/ptmkb/registration', {
                            method: "POST",
                            headers: {
                                "Accept": "application/json",
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({'username': username, 'password': password1})
                        }).then(async (res) => {
                            return await res.json();
                        }).catch(err => {
                            console.error(err);
                        });
                        if (response.registered)
                            document.getElementById('errorMsg').textContent = "Successful! Please log in above.";
                        else
                        document.getElementById('errorMsg').textContent = "Error - please try signing up later!";
                    }
                }
            }
        }
    } else {
        if (username === '') {
            document.getElementById('errorMsg').textContent = "Please enter your username for sign up.";
        } else if (password1 === '' || password2 === '') {
            document.getElementById('errorMsg').textContent = "Please enter your password for sign up.";
        }
    }
}