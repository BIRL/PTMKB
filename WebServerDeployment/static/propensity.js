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
            navigator.clipboard.writeText(response.token).then(() => {
                alert('Token copied to clipboard!');
            }).catch(err => {
                alert('Failed to copy token: ' + err);
            });
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
            if (response.reset) {
                var dataToUpdate = JSON.parse(user);
                dataToUpdate['token'] = response.token;
                sessionStorage.setItem('user', JSON.stringify(dataToUpdate));
                alert('Token reset! Copy the new token to use!');
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

var suggestions = null;

document.addEventListener("DOMContentLoaded", async () => {
    checkForLogin();

    const res = await fetch(`/ptmkb/ptms_list`);
    const data = await res.json();
    suggestions = data['ptms'];
    // Set up an autocomplete function
    const input_elem = document.getElementById('sequence_value');
    var prevSeq = '';
    input_elem.addEventListener('input', function (e) {

        // Function to get the current caret position in a contenteditable element
        function getCaretPosition(element) {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);

            // Create a range from the start of the content to the caret
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.startContainer, range.startOffset);

            return preCaretRange.toString().length;  // Return the caret position
        }

        // Function to restore the caret (cursor) position in the contenteditable element
        function restoreCaretPosition(element, position) {
            const selection = window.getSelection();
            const range = document.createRange();

            // Get the child nodes of the contenteditable element
            const childNodes = element.childNodes;

            // Find the correct node and position within it to restore the caret
            let currentPos = 0;
            let targetNode = null;
            let targetOffset = position;

            // Loop through the child nodes to find the correct position
            for (let i = 0; i < childNodes.length; i++) {
                const child = childNodes[i];

                // If it's a text node, check the length
                if (child.nodeType === 3) {
                    const textLength = child.textContent.length;
                    if (currentPos + textLength >= position) {
                        targetNode = child;
                        targetOffset = position - currentPos;
                        break;
                    }
                    currentPos += textLength;
                } else if (child.nodeType === 1) {
                    // If it's an element node (like <span>), we need to skip it
                    const childLength = child.textContent.length;
                    if (currentPos + childLength >= position) {
                        targetNode = child;
                        targetOffset = position - currentPos;
                        break;
                    }
                    currentPos += childLength;
                }
            }

            if (targetNode) {
                range.setStart(targetNode, targetOffset);
                range.setEnd(targetNode, targetOffset);

                selection.removeAllRanges();
                selection.addRange(range);
                element.focus();
            }
        }

        var requestTerm = input_elem.textContent.toUpperCase();
        let caretPos;
        if (requestTerm.length > 21) {
            input_elem.innerHTML = prevSeq;
            restoreCaretPosition(input_elem, 21);
            return;
        }
        caretPos = getCaretPosition(input_elem);

        const middleIndex = Math.floor(requestTerm.length / 2);
        if (requestTerm.length >= 13 && requestTerm.length % 2 === 1) {
            const middleChar = requestTerm[middleIndex];
            const beforeMiddle = requestTerm.slice(0, middleIndex);
            const afterMiddle = requestTerm.slice(middleIndex + 1);
            
            input_elem.innerHTML = beforeMiddle + 
            `<span class="middle-char">${middleChar}</span>` + 
            afterMiddle;
        } else {
            input_elem.innerHTML = `${requestTerm}`;
        }

        prevSeq = input_elem.innerHTML;
        document.getElementById('sequenceLength').innerHTML = requestTerm.length;
        restoreCaretPosition(input_elem, caretPos);

        // setPos.setStart(input_elem.firstChild, cursorPos);
        // setPos.collapse(true)
        // set.removeAllRanges();
        // set.addRange(setPos);
        // input_elem.focus();
    });
    $('#ptm_value').on('input', async function() {
        const requestTerm = $(this).val();
        if (requestTerm.length < 1) {
            $('#suggestions').hide();
            return;
        }
        let currData = [];
        suggestions.forEach(ptm => {
            if (ptm.toLowerCase().indexOf(requestTerm.toLowerCase()) >= 0) {
                currData.push(ptm);
            }
        });

        try {
            const suggestionsBox = $('#suggestions');
            suggestionsBox.empty();
            
            if (currData.length > 0) {
                currData.forEach(item => {
                    const suggestionItem = $(`<div class="suggestion-item">${item}</div>`);
                    
                    suggestionItem.on('click', function() {
                        $('#ptm_value').val(item);
                        suggestionsBox.hide();
                    });

                    suggestionsBox.append(suggestionItem);
                });
                suggestionsBox.show();
            } else {
                suggestionsBox.hide();
            }
        } catch (error) {
            console.error("Error: ", error);
            $('#suggestions').hide();
        }
    });

    $(document).on('click', function(event) {
        if (!$(event.target).closest('.input-group').length) {
            $('#suggestions').hide();
        }
    });

    $('#form_value').on('keydown', function(event) {
        if (document.getElementById('form_submit').disabled)
            return;
        if (event.key === 'Enter') {
            calculate();
        }
    });

    
    const urlParams = new URLSearchParams(window.location.search);
    const ptm = urlParams.get('ptm');
    const seq = urlParams.get('seq');
    console.log(ptm, seq);
    if (ptm && seq) {
        const middleIndex = Math.floor(seq.length / 2);
        const middleChar = seq[middleIndex];
        const beforeMiddle = seq.slice(0, middleIndex);
        const afterMiddle = seq.slice(middleIndex + 1);
        document.getElementById('sequence_value').innerHTML = beforeMiddle + 
        `<span class="middle-char">${middleChar}</span>` + 
        afterMiddle;
        document.getElementById('ptm_value').value = ptm;
        await calculate();
        history.replaceState( { ptm, seq }, '', '/propensity');
    }
});

async function exampleSearch() {
    const value = document.getElementById('exampleInput').textContent;
    const sequence = value.split(';')[0].trim();
    const middleIndex = Math.floor(sequence.length / 2);
    const middleChar = sequence[middleIndex];
    const beforeMiddle = sequence.slice(0, middleIndex);
    const afterMiddle = sequence.slice(middleIndex + 1);
    
    document.getElementById('sequence_value').innerHTML = beforeMiddle + 
                                                            `<span class="middle-char">${middleChar}</span>` + 
                                                            afterMiddle;
    document.getElementById('sequenceLength').innerHTML = sequence.length;
    document.getElementById('ptm_value').value = value.split(';')[1].trim()
    calculate()
}

async function calculate() {
    try{document.getElementById('ptmInfo').innerHTML = '';}catch(e){};
    document.getElementById('subsequenceDiv').innerHTML  = '';
    document.getElementById('ptmVector').innerHTML = '';
    document.getElementById('ptmTable').innerHTML = '';
    document.getElementById('messageDiv').innerHTML = "";
    document.getElementById('vectorInfo').style.display = 'none';
    document.getElementById('tableInfo').style.display = 'none';
    const AA = "A C D E F G H I K L M N P Q R S T V W Y".split(' ');
    AA.push('-');

    const subsequence = document.getElementById('sequence_value').textContent;
    const ptm = document.getElementById('ptm_value').value;

    var validAA = new Boolean(true);
    subsequence.split('').forEach(aa => {
        if (!AA.includes(aa.toUpperCase())) {
            validAA = false;
        }
    });

    if (!validAA) {
        document.getElementById('messageDiv').innerHTML = "<h5>Please make sure all residues are correct one-letter amino acid representations!</h5>";
    } else {
        if (subsequence.length < 13 || subsequence.length > 21) {
            document.getElementById('messageDiv').innerHTML = "<h5>Please enter a subsequence length between 13 and 21 residues!</h5>";
        } else {
            if (subsequence.length % 2 !== 1) {
                document.getElementById('messageDiv').innerHTML = "<h5>Please make sure the subsequence is of the correct window size!</h5>";
            } else {
            let temp = []
                suggestions.forEach(s => {
                    if (s.toLowerCase() === ptm.toLowerCase()) {
                        temp.push(s);
                    }
                })
                if (temp.length === 0) {
                    document.getElementById('messageDiv').innerHTML = "<h5>Please enter a valid Post-Translational Modification!</h5>";
                } else {
                    // Perform search here based on the middle sequence and the PTM
                    const residue = subsequence[Math.floor(subsequence.length / 2)];
                    const data = await fetch(
                        encodeURI(
                            `/ptmkb/pos_matrix?ptm=${encodeURIComponent(ptm)}&residue=${encodeURIComponent(residue)}&table=log-e`
                        )
                    ).then(res => {
                        return res.json();
                    }).catch(error => {
                        console.log(error);
                    });
                    if (data.message) { // This means there was no table.
                        document.getElementById('messageDiv').innerHTML = `<h5>No log odds matrix exists for ${ptm} for residue ${residue.toUpperCase()}!</h5>`;
                    } else {
                        // Now, finally, display the calculations, table, and vector
                        document.getElementById('subsequenceDiv').innerHTML  = '';
                        subsequence.split('').forEach((residue, index) => {
                            const span = document.createElement('span')
                            span.textContent = residue;
                            const color = index === Math.floor(subsequence.length / 2) ? '#ff0000' : '#444';
                            span.setAttribute('style', `text-align: center; font-size: 28px; color: ${color}; font-weight: bold;`);
                            document.getElementById('subsequenceDiv').appendChild(span);
                        });
                        // document.getElementById('subsequenceDiv').innerHTML = `<h2 style="text-align: center; font-size: 28px; color: #444; font-weight: bold;">${subsequence.toUpperCase()}</h2>`
                        document.getElementById('ptmVector').innerHTML = await displayVector(data, subsequence);
                        document.getElementById('ptmTable').innerHTML = displayTable(data, ptm, residue, subsequence);
                        document.getElementById('vectorInfo').style.display = 'block';
                        document.getElementById('tableInfo').style.display = 'block';
                    }
                }
            }
        }
    }
}

async function fetch_ptm_scores(vectorData) {
    let scores = {};
    try {
        const response = await fetch('/ptmkb/get_protein_log', {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(vectorData)
        });
        scores = await response.json();
    } catch (err) {
        scores = {};
    }
    return scores
}

function getLongestCenteredArray(values) {
    // Get the middle index
    const mid = Math.floor(values.length / 2);
    let leftCount = 0;
    let rightCount = 0;

    // Count from left (starting at mid)
    for (let i = mid; i < values.length; i++) {
        if (values[i] !== '-inf') {
            leftCount++;
        } else {
            break;
        }
    }

    // Count from right (starting at mid)
    for (let i = mid; i >= 0; i--) {
        if (values[i] !== '-inf') {
            rightCount++;
        } else {
            break;
        }
    }

    // Determine the slice to make
    const sliceToMake = Math.max(leftCount, rightCount);

    // Return the slice
    return values.slice(sliceToMake, values.length - sliceToMake);
}

async function displayVector(data, subsequence) {
    subsequence = subsequence.toUpperCase();
    // const KEYS = Object.keys(data);
    let KEYS = [];

    let middleIndex = Math.floor(subsequence.length / 2);

    let subsequence_indices = [];

    for (let i = -middleIndex; i <= middleIndex; i++) {
        var key = (i > 0) ? `+${i}` : `${i}`;
        KEYS.push(key);
        const index = i + middleIndex;  // Adjust to get the correct index from the string
        if (index >= 0 && index < subsequence.length) {
            subsequence_indices.push(subsequence[index]);  // Add the character at that position in the string
        }
    }

    var values = new Array();
    KEYS.sort((l, s) => {
        return parseInt(l) - parseInt(s);
    });

    KEYS.forEach((key, index) => {
        try {
            let extractedValue = data[key][subsequence[index]];
            if (typeof(extractedValue) !== "number") {
                if (subsequence[index] === '-')
                    extractedValue = '-inf';
                values.push(extractedValue);
            }
            else {
                values.push(
                    Math.round(data[key][subsequence[index]] * 100) / 100
                );
            }
        } catch (error) {
            values.push('-inf');
        }
    });
    // That was easy - Now comes the hard part
    // HTML manupulation...

    // Display the vector first so I can get over this
    var vectorData = new Object();
    KEYS.forEach((key, index) => {
        var item = new Object();
        item[subsequence[index]] = values[index];
        vectorData[key] = item;
    });
    
    // <table class="table table-bordered table-responsive th td" id="dataVector" style="display: none; font-family: 'Courier New', Courier, monospace; margin: 0 auto">
    //     <thead id="vectorHead" style="text-align: center"></thead>
    //     <tbody id="vectorBody" style="text-align: center"></tbody>
    // </table>

    // const vectorTag = document.getElementById('dataVector');
    // const vectorHead = document.getElementById('vectorHead');
    // const vectorBody = document.getElementById('vectorBody');
    const vectorTag = document.createElement('table');
    vectorTag.setAttribute('id', 'dataVector');
    const vectorHead = document.createElement('thead');
    vectorHead.setAttribute('id', 'vectorHead');
    const vectorBody = document.createElement('tbody');
    vectorBody.setAttribute('id', 'vectorBody');

    vectorHead.innerHTML = ''
    vectorBody.innerHTML = ''

    let vector = [];

    KEYS.forEach((key, index) => {
        const header = document.createElement("th");
        header.textContent = key;
        header.setAttribute("style", "border: 1px solid black; background-color: #A0C4FF;")
        for (let [in_key, value] of Object.entries(vectorData[key])) {
            vector.push(
                vectorData[key][in_key]
            );
        }
        vectorHead.appendChild(header);
    });

    vector.forEach((dataPoint, index) => {
        const cell = document.createElement("td");
        cell.textContent = dataPoint;
        // Change color of cell
        if (dataPoint === '-inf')
            cell.style.backgroundColor = `rgba(0, 0, 255, 0.1)`;

        if (index == 10)
            cell.style.backgroundColor = '#F2C998';
        vectorBody.appendChild(cell);
    });
    const tdValues = vectorBody.querySelectorAll('td');

    vector = {};
    Object.keys(vectorData).forEach(key => {
        const innerObj = vectorData[key];  // Get the inner object
        Object.values(innerObj).forEach(value => {
            vector[key] = value;  // Push each value into the array
        });
    });

    // Now let's calculate the additive and multiplicative scores here...
    // I know, this is a bad idea. I should make an API out of this.
    var scores = await fetch_ptm_scores(vector)
                .then(json => {
                    return json;
                });
    var json = {
        "logSum": scores['logSum'],
        "logLogProduct": scores['logLogProduct']
    }

    // Now I'll work on the general info on the PTM
    const table = document.getElementById('ptmInfo');
    table.innerHTML = '';
    for (var [key, value] of Object.entries(json)) {
        const row = document.createElement('tr');
        row.className = "PropensityTable-row";
        const keyCell = document.createElement('td');
        keyCell.className = "PropensityTable-key";
        keyCell.style.width = '300px';
        keyCell.style.fontWeight = 1000;
        const valueCell = document.createElement('td');
        valueCell.className = "PropensityTable-value";
        keyCell.textContent = key
                                .replace(/([a-z](?=[A-Z]))/g, '$1 ')
                                .replace(/^./, function(str){ return str.toUpperCase(); })
        keyCell.className = 'key';
        valueCell.className = 'value';
        valueCell.style.width = '200px';
        valueCell.textContent = value;

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        const notes = document.createElement('td');
        notes.className = 'PropensityTable-notes';

        // Make notes
        var tag = new String();
        if (key === "logSum") {
            tag = "<math><munderover><mo>∑</mo><mn>i=1</mn><mi>n</mi></munderover><msub><mi>x</mi><mi>i</mi></msub><mtext>, where&nbsp;</mtext><msub><mi>x</mi><mi>i</mi></msub><mo>≠</mo><mtext>'-inf'</mtext></math>";
        }
        // else if (key === "multiplicativeScore") {
        //     tag = "<math><munderover><mo>∏</mo><mi>i=1</mi><mn>n</mn></munderover><msub><mi>x</mi><mi>i</mi></msub><mtext>, where&nbsp;</mtext><msub><mi>x</mi><mi>i</mi></msub><mo>≠</mo><mtext>'-inf' and&nbsp;</mtext><msub><mi>x</mi><mi>i</mi></msub><mo>≠</mo><mtext>0</mtext></math>";
        // }
        else {
            tag = "<math><mrow><mo>ln</mo><mo>(</mo><mfrac><mn>1</mn><mrow><mrow><mn>-1</mn><mo>×</mo></mrow><munderover><mo>∏</mo><mi>i=1</mi><mn>n</mn></munderover><msub><mi>x</mi><mi>i</mi></msub></mrow></mfrac><mo>)</mo></mrow><mtext>, where&nbsp;</mtext><msub><mi>x</mi><mi>i</mi></msub><mo>≠</mo><mtext>'-inf' and&nbsp;</mtext><mi>i</mi><mo>≠</mo><mtext>floor(N/2)</mtext></math>";
        }
        notes.innerHTML = tag;
        row.appendChild(notes);
        table.appendChild(row);
    }

    // Append and return
    vectorTag.appendChild(vectorHead);
    vectorTag.appendChild(vectorBody);

    return vectorTag.outerHTML;
}

function displayTable(data, ptm, site, subsequence) {

    subsequence = subsequence.toUpperCase();
    // const KEYS = Object.keys(data);
    let subsequenceKeys = [];

    let middleIndex = Math.floor(subsequence.length / 2);

    let subsequence_indices = [];

    for (let i = -middleIndex; i <= middleIndex; i++) {
        var key = (i > 0) ? `+${i}` : `${i}`;
        subsequenceKeys.push(key);
        const index = i + middleIndex;  // Adjust to get the correct index from the string
        if (index >= 0 && index < subsequence.length) {
            subsequence_indices.push(subsequence[index]);  // Add the character at that position in the string
        }
    }

    var highlightedKeys = {};
    subsequenceKeys.sort((l, s) => {
        return parseInt(l) - parseInt(s);
    });

    subsequenceKeys.forEach((key, index) => {
        highlightedKeys[key] = subsequence[index];
    });

    var colorMapping = (value) => {
        let adjValue = Math.exp(value)
        adjValue = Math.min(Math.max(adjValue, 0), 1);
        const alpha = Math.min(1, adjValue);
        return `rgba(255, 0, 0, ${alpha})`;
    };
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

    // const xlabel = document.getElementById("xlabel");
    // xlabel.innerHTML = "";

    // const label_x = document.createElement("strong")
    // label_x.textContent = `${ptm} - Position Relative to Modification Site`
    
    // xlabel.appendChild(label_x);
    const dataTable = document.createElement('table');
    // dataTable.classList.add('table');

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
        colHeader.setAttribute("style", "text-align: center; background-color: #D0E0E3; border: 1px solid black;");
        row.appendChild(colHeader);
        tableBody.appendChild(row);
    });

    // Create a new table from scratch
    const introRow = document.createElement("tr");
    const introHeader = document.createElement("th");
    introHeader.textContent = ""; //"Amino Acid";
    introHeader.setAttribute("style", "border: 1px solid black;");
    introRow.appendChild(introHeader);
    tableHead.appendChild(introRow);
    
    var site_index = 0;

    KEYS.forEach((key, index) => {
        const header = document.createElement("th");
        header.textContent = key;
        if (parseInt(key) == 0) {
            site_index = index;
        }
        header.setAttribute("style", "text-align: center; border: 1px solid black; background-color: #A0C4FF;")
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
                cell.setAttribute("style", "border-right: 3px solid black; text-align: center;")
            if (outer == AA.length - 1)
                cell.setAttribute("style", "border-bottom: 3px solid black; text-align: center;")
            if (index == Object.keys(KEYS).length - 1 && outer == AA.length - 1)
                cell.setAttribute("style", "border-right: 3px solid black; border-bottom: 3px solid black; text-align: center;")
            // Set colour
            // if (outer%2 == 0)
            //     cell.style.backgroundColor = '#F0F0F0';
            // else {
            //     cell.style.backgroundColor = '#FFFFFF';
            // }
            cell.style.borderRight = "1px solid black";
            cell.style.borderLeft = "1px solid black";
            cell.style.borderTop = "1px solid black";
            cell.style.borderBottom = "1px solid black";
            if (value !== '-inf')
                cell.style.backgroundColor = colorMapping(value)
            else
                cell.style.backgroundColor = `rgba(0, 0, 255, 0.1)`;
            if (subsequenceKeys.includes(key) && highlightedKeys[key] == aa) {
                cell.style.backgroundColor = `rgba(0, 255, 0, 0.3)`;
            }
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
    const title = document.createElement('h3')
    title.innerHTML = `${ptm} at site ${site.toUpperCase()}`;
    title.style.textAlign = 'center';
    body.append(title);
    body.appendChild(dataTable);

    const newHtmlDocument = document.implementation.createHTMLDocument('New Page');
    newHtmlDocument.documentElement.appendChild(head);
    newHtmlDocument.documentElement.appendChild(body);

    // dataTable.style.display = "table"; // Show the table
    return newHtmlDocument.documentElement.outerHTML;
}
