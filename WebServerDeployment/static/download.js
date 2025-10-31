function scrollToSection(elementName) {
    document.getElementById(elementName)
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
                console.error(err);
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
                console.error(err);
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
                    console.error('Failed to reset token: ' + err);
                });
            } else {
                console.error('Failed to reset token');
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
                console.error(err);
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

var tables = null;

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById('aa').style.display = 'none';
    document.getElementById('tab').style.display = 'none';
    document.getElementById('download').style.display = 'none';
    document.getElementById('downloadButton').style.display = 'none';
    document.getElementById('ptmSelect').value = '';
    document.getElementById('tableSelect').value = '';
    checkForLogin();
    tables = await fetch('/ptmkb/all_ptms_tables').then(res => res.json());
    Object.keys(tables).forEach(key => {
        const option = document.createElement('option');
        option.textContent = key;
        document.getElementById('ptmSelect').appendChild(option);
    });
    document.getElementById('ptmSelect').addEventListener('change', (e) => {
        getAminoAcids(e.target);
    })
    getAminoAcids()
});

var currentData = {};

const mapping = {
    'Frequency': 'freq',
    'Log Odd (base e)': 'log-e'
}

async function saveFile() {
    const ptm = document.getElementById("ptmSelect").value;
    const aa = document.getElementById("aaSelect").value;
    const table = document.getElementById("tableSelect").value;
    const format = document.getElementById("downloadSelect").value;
    fetch(
        "/ptmkb/download",
        {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    "ptm": ptm,
                    "aa": aa,
                    "table": mapping[table],
                    "format": format,
                    "rounded": true,
                }
            )
        }
    ).then((res) => {
        if (!res.ok) {
            throw new Error("Failed somewhere");
        }
        return res.blob();
    }).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ptm}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.log(error);
    });
}

async function getAminoAcids() {
    // Hide/remove everything.
    document.getElementById('ptmTable').innerHTML = '';
    document.getElementById('aa').style.display = 'none';
    document.getElementById('tab').style.display = 'none';
    document.getElementById('download').style.display = 'none';
    document.getElementById('downloadButton').style.display = 'none';
    document.getElementById('aaSelect').innerHTML = '';
    // Now call the Fetch API.
    const ptm = document.getElementById('ptmSelect').value;
    // fetch(`/ptmkb/getAminoAcids?ptm=${encodeURIComponent(ptm)}`).then((res) => {
    //     return res.json();
    // }).then((json) => {
    //     if (json.data) {
    //         const aaList = document.getElementById('aaSelect');
    //         json.data.forEach((aa) => {
    //             const option = document.createElement('option');
    //             option.textContent = aa;
    //             aaList.appendChild(option);
    //         });
    //         aaList.value = '';
    //         document.getElementById('aa').style.display = 'block';
    //         aaList.addEventListener('change', displayTablesList)
    //     }
    // }).catch((error) => {
    //     console.error(error);
    // });

    const aaList = document.getElementById('aaSelect');
    Array.from(Object.keys(tables[ptm])).forEach((aa) => {
        const option = document.createElement('option');
        option.textContent = aa;
        aaList.appendChild(option);
    });
    aaList.value = '';
    document.getElementById('aa').style.display = 'block';
    aaList.addEventListener('change', displayTablesList)
}

async function displayTablesList() {
    document.getElementById('ptmTable').innerHTML = '';
    document.getElementById('download').style.display = 'none';
    document.getElementById('downloadButton').style.display = 'none';
    document.getElementById('tab').style.display = 'block';
    document.getElementById('tableSelect').addEventListener('change', displayTableAndDownload);
    

    const ptm = document.getElementById('ptmSelect').value;
    const aa = document.getElementById('aaSelect').value;
    const table = document.getElementById('tableSelect').value;

    if (ptm && aa && table) {
        displayTableAndDownload();
    }
}

async function displayTableAndDownload() {

    document.getElementById('ptmTable').innerHTML = '';
    document.getElementById('ptmTable').classList.add('lds-dual-ring');
    document.getElementById('download').style.display = 'block';
    document.getElementById('downloadButton').style.display = 'block';

    const ptm = document.getElementById('ptmSelect').value;
    const aa = document.getElementById('aaSelect').value;
    const table = document.getElementById('tableSelect').value;
    
    // fetch(`/ptmkb/pos_matrix?ptm=${encodeURIComponent(ptm)}&residue=${encodeURIComponent(aa)}&table=${encodeURIComponent(mapping[table])}`)
    // .then(res => {
    //     return res.json();
    // }).then(json => {
    //     displayTable(json);
    //     document.getElementById('ptmTable').classList.remove('lds-dual-ring');
    // }).catch(error => {
    //     console.error(error);
    // });
    document.getElementById('ptmTable').classList.remove('lds-dual-ring');
    displayTable(tables[ptm][aa][mapping[table]]);
}

function displayTable(data) {
    let mapping = document.getElementById('tableSelect').value;
    let maps = {
        'Frequency': 'freq',
        'Log Odd (base e)': 'log-e',
        // 'Log Odd (base 2)': 'log2'
    }
    mapping = maps[mapping];
    var colorMapping = (value) => {};
    if (mapping === 'freq') {
        colorMapping = (value) => {
            value = Math.min(Math.max(value, 0), 1);
            const alpha = Math.min(1, value);
            return `rgba(255, 0, 0, ${alpha})`;
        }
    } else if (mapping === 'log-e') {
        colorMapping = (value) => {
            let adjValue = Math.exp(value);
            adjValue = Math.min(Math.max(adjValue, 0), 1);
            const alpha = Math.min(1, adjValue);
            return `rgba(255, 0, 0, ${alpha})`;
        }
    } else if (mapping === 'log2') {
        colorMapping = (value) => {
            let adjValue = Math.pow(2, value);
            adjValue = Math.min(Math.max(adjValue, 0), 1);
            const alpha = Math.min(1, adjValue);
            return `rgba(255, 0, 0, ${alpha})`;
        }
    }

    currentData = data;
    const tableData = document.createElement('table');
    tableData.classList.add('table');
    tableData.classList.add('table-bordered');
    tableData.classList.add('table-responsive');
    tableData.classList.add('th');
    tableData.classList.add('td');
    tableData.setAttribute('id', 'dataTable');
    tableData.setAttribute('style', "display: none; font-family: 'Courier New', Courier, monospace;  text-align: center;");
    const tableHead = document.createElement("thead");
    tableHead.setAttribute('id', 'tableHead');
    const tableBody = document.createElement("tbody");
    tableBody.setAttribute('id', 'tableBody');

    const dataTable = document.createElement('table');


    const AA = "A C D E F G H I K L M N P Q R S T V W Y".split(' ');
    const KEYS = Object.keys(data);
    KEYS.sort((l, s) => {
        return parseInt(l) - parseInt(s);
    });

    AA.forEach(aa => {
        const row = document.createElement("tr");
        row.setAttribute("id", aa);
        const colHeader = document.createElement("th");
        colHeader.textContent = aa;
        colHeader.setAttribute("style", "text-align: center; background-color: #D0E0E3; border: 1px solid black; width: 60px; height: 20px;");
        row.appendChild(colHeader);
        tableBody.appendChild(row);
    });

    // Create a new table from scratch
    const introRow = document.createElement("tr");
    const introHeader = document.createElement("th");
    introHeader.textContent = "";
    introHeader.setAttribute("style", "border: 1px solid black; text-align: center;");
    introRow.appendChild(introHeader);
    tableHead.appendChild(introRow);
    
    var site_index = 0;

    KEYS.forEach((key, index) => {
        const header = document.createElement("th");
        header.textContent = key;
        if (parseInt(key) == 0) {
            site_index = index;
        }
        header.setAttribute("style", "text-align: center; border: 1px solid black; background-color: #A0C4FF; width: 60px; height: 20px;")
        tableHead.children[0].appendChild(header);
    })

    AA.forEach((aa, outer) => {
        
        aaHeader = tableBody.querySelector(`#${aa}`);

        KEYS.forEach((key, index)=> {
            const cell = document.createElement("td");
            cell.style.textAlign = 'center';
            const value = data[key][aa];
            // Set value
            if (typeof value === 'number')
                cell.textContent = value.toFixed(2);
            else
                cell.textContent = "-inf";
            // Set border lines for table
            if (index == Object.keys(KEYS).length - 1)
                cell.setAttribute("style", "border-right: 1px solid black; text-align: center;")
            if (outer == AA.length - 1)
                cell.setAttribute("style", "border-bottom: 1px solid black; text-align: center;")
            if (index == Object.keys(KEYS).length - 1 && outer == AA.length - 1)
                cell.setAttribute("style", "border-right: 1px solid black; border-bottom: 1px solid black; text-align: center;")
            // Set colour
            // if (outer%2 == 0)
            //     cell.style.backgroundColor = '#F0F0F0';
            // else {
            //     cell.style.backgroundColor = '#FFFFFF';
            // }
            cell.style.border = "1px solid black";
            if (index == site_index) {
                // cell.style.backgroundColor = '#F2C998';
                cell.style.borderRight = "2px solid black";
                cell.style.borderLeft = "2px solid black";
            }
            if (value !== '-inf') {
                cell.style.backgroundColor = colorMapping(value)
            }
            else
                cell.style.backgroundColor = `rgba(0, 0, 255, 0.1)`
            cell.style.fontWeight = 700;
            aaHeader.appendChild(cell);
        })
    });

    dataTable.appendChild(tableHead);
    dataTable.appendChild(tableBody);
    tableData.append(dataTable);

    const head = document.createElement('head');
    const body = document.createElement('body');
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    link.setAttribute('href', '../static/styles.css')
    head.appendChild(link);
    dataTable.style.display = 'table';
    body.appendChild(dataTable);
    
    document.getElementById('ptmTable').appendChild(dataTable)
}
