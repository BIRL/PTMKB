function checkForLogin() {
    const user = sessionStorage.getItem('user');
    if (user !== null) { // That means user is already logged in.
        // Append some new tabs with some functionality.
        const username = JSON.parse(user).username;
        const userTab = document.createElement('li');
        const a_user = document.createElement('a');
        a_user.classList.add('nav-link');
        a_user.setAttribute('href', '#');
        const span_user = document.createElement('span');
        span_user.classList.add('nav-item-box');
        span_user.style.color = '#0388fc';
        span_user.textContent = username;
        a_user.appendChild(span_user);
        userTab.appendChild(a_user);

        // Create a dropdown menu for additional options
        const dropdownMenu = document.createElement('div');
        dropdownMenu.classList.add('dropdown-menu');
        dropdownMenu.style.position = 'absolute';
        dropdownMenu.style.display = 'none';

        // Show dropdown when user clicks on the username link
        window.addEventListener('resize', (e) => {
            e.preventDefault();
            dropdownMenu.style.display = 'none';
        })
        a_user.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default action (if any)
            
            // Toggle dropdown visibility
            if (dropdownMenu.style.display === 'none') {
                dropdownMenu.style.display = 'block';
                const rect = a_user.getBoundingClientRect();
                var margin = 0;
                if (window.innerWidth > 1080) {
                    margin = -140;
                }
                dropdownMenu.style.top = `${rect.bottom + window.scrollY}px`;
                dropdownMenu.style.left = `${rect.left + margin + window.scrollX}px`; 
            } else {
                dropdownMenu.style.display = 'none';
            }
        });

        // Copy token to clipboard
        const copyTokenOption = document.createElement('a');
        copyTokenOption.classList.add('dropdown-item');
        copyTokenOption.href = '#';
        copyTokenOption.innerHTML = 'Copy Token to Clipboard';
        copyTokenOption.addEventListener('click', async function (e) {
            e.preventDefault();
            const response = await fetch('/ptmkb/fetch_token', {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({"username": username})
            }).then(async (res) => {
                return await res.json();
            }).catch(err => {
                // console.error(err);
            });

            if (response && response.token) {
                navigator.clipboard.writeText(response.token).then(() => {
                    const popup = document.createElement('div');
                    popup.textContent = 'Token copied!';
                    popup.style.position = 'fixed';
                    popup.style.bottom = '80px';
                    popup.style.left = '100px';
                    popup.style.transform = 'translateX(-50%)';
                    popup.style.backgroundColor = 'rgba(0, 0, 0, 1)';
                    popup.style.color = 'white';
                    popup.style.padding = '10px 20px';
                    popup.style.borderRadius = '5px';
                    popup.style.fontSize = '20px';
                    popup.style.display = 'none';
                    popup.style.opacity = '1';
                    popup.style.transition = 'opacity 1s ease-out';
                    popup.style.userSelect = 'none';
                    document.body.appendChild(popup);
                    popup.style.display = 'block';
                    setTimeout(() => {
                        popup.style.opacity = '0';
                        setTimeout(() => {
                            popup.style.display = 'none';
                            popup.style.opacity = '1';
                        }, 1000);
                    }, 3000);
                }).catch(err => {
                    alert('Failed to copy token: ' + err);
                });
            } else {
                alert('Failed to retrieve token');
            }
        });

        // Reset token (if expired)
        const resetTokenOption = document.createElement('a');
        resetTokenOption.classList.add('dropdown-item');
        resetTokenOption.href = '#';
        resetTokenOption.innerHTML = 'Reset Token';
        resetTokenOption.addEventListener('click', async function (e) {
            e.preventDefault();
            const response = await fetch('/ptmkb/reset_token', {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({"username": username})
            }).then(async (res) => {
                return await res.json();
            }).catch(err => {
                // console.error(err);
            });
            if (response && response.reset) {
                navigator.clipboard.writeText(response.token).then(() => {
                    const popup = document.createElement('div');
                    popup.textContent = 'Token reset!';
                    popup.style.position = 'fixed';
                    popup.style.bottom = '80px';
                    popup.style.left = '100px';
                    popup.style.transform = 'translateX(-50%)';
                    popup.style.backgroundColor = 'rgba(0, 0, 0, 1)';
                    popup.style.color = 'white';
                    popup.style.padding = '10px 20px';
                    popup.style.borderRadius = '5px';
                    popup.style.fontSize = '20px';
                    popup.style.display = 'none';
                    popup.style.opacity = '1';
                    popup.style.transition = 'opacity 1s ease-out';
                    popup.style.userSelect = 'none';
                    document.body.appendChild(popup);
                    popup.style.display = 'block';
                    setTimeout(() => {
                        popup.style.opacity = '0';
                        setTimeout(() => {
                            popup.style.display = 'none';
                            popup.style.opacity = '1';
                        }, 1000);
                    }, 3000);
                }).catch(err => {
                    // console.error('Failed to reset token: ' + err);
                });
            } else {
                // console.error('Failed to reset token');
            }
        });

        // Log out
        const logoutOption = document.createElement('a');
        logoutOption.classList.add('dropdown-item');
        logoutOption.href = '#';
        logoutOption.innerHTML = 'Logout';
        logoutOption.addEventListener('click', async (e) => {
            const response = await fetch('/ptmkb/logout', {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({"username": username})
            }).then(async (res) => {
                return await res.json();
            }).catch(err => {
                // console.error(err);
            });
            if (response.logout) {
                sessionStorage.removeItem('user');
                location.reload();
            }
        });

        // Append options to dropdown
        dropdownMenu.appendChild(copyTokenOption);
        dropdownMenu.appendChild(resetTokenOption);
        dropdownMenu.appendChild(logoutOption);

        // Append the dropdown menu to the user tab
        userTab.appendChild(dropdownMenu);

        // Append the user tab to the navbar
        const tabs = document.getElementById('navBar').querySelector('.navbar-items');
        tabs.appendChild(userTab);
    } else { // Otherwise, just do nothing.
        const loginTab = document.createElement('li')
        loginTab.innerHTML = `<a href="/signup-login" class="nav-link"><span class="nav-item-box">Login</span></a>`;
        const tabs = document.getElementById('navBar').querySelector('.navbar-items');
        tabs.appendChild(loginTab);
    }
}

function scrollToSection(elementName) {
    document.getElementById(elementName)
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener("DOMContentLoaded", () => {
    checkForLogin();
    const HideInfoUrlPartsPlugin = () => {
        return {
            wrapComponents: {
            InfoUrl: () => () => null
            }
        };
    };

    const ui = SwaggerUIBundle({
        url: '/openapi.json',  // This is the endpoint that FastAPI generates for the OpenAPI spec
        dom_id: '#swagger-ui',  // The div where Swagger UI will be embedded
        deepLinking: true,
        presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
        ],
        plugins: [
            HideInfoUrlPartsPlugin
        ],
        layout: "BaseLayout",
        onComplete: function() {
            // console.log("Swagger UI Loaded");
        }
    });
});