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

// Some contants - don't ask me why I'm declaring here.

var ptmSites = null;
var currentSequence = null;

function getValue(obj, key, defaultValue = null) {
    if (obj === undefined || obj === null)
        return null;
    return key in obj ? obj[key] : defaultValue;
}

const ptmColorMapping = {
    // Classical colors for more commonly occurring PTMs
    "Acetylation": "#D94F37",  // Slightly darker Tomato
    "Phosphorylation": "#1A7EC7",  // Slightly darker Dodger Blue
    "Ubiquitination": "#2A8B2A",  // Slightly darker Lime Green
    "Methylation": "#D33600",  // Slightly darker Orange Red
    "Oxidation": "#D10000",  // Slightly darker Red
    "Sumoylation": "#1E6B1E",  // Slightly darker Forest Green
    "Dephosphorylation": "#6A1DB0",  // Slightly darker Blue Violet

    // Lighter, pastel-like colors for others
    "ADP-ribosylation": "#F28C9D",  // Slightly darker Light Pink
    "Amidation": "#F13E9C",  // Slightly darker Hot Pink
    "AMPylation": "#E4007D",  // Slightly darker Deep Pink
    "Biotinylation": "#C085C7",  // Slightly darker Plum
    "Blocked amino end": "#D16ED2",  // Slightly darker Violet
    "Butyrylation": "#C155C0",  // Slightly darker Orchid
    "C-linked Glycosylation": "#A850C0",  // Slightly darker Medium Orchid
    "Carbamidation": "#8826B9",  // Slightly darker Dark Orchid
    "Carboxyethylation": "#7326B0",  // Slightly darker Blue Violet
    "Carboxylation": "#6A4FD5",  // Slightly darker Medium Slate Blue
    "Cholesterol ester": "#3A5BAE",  // Slightly darker Royal Blue
    "Citrullination": "#6FA8D7",  // Slightly darker Sky Blue
    "Crotonylation": "#96BFE7",  // Slightly darker Light Blue
    "D-glucuronoylation": "#A2C8D9",  // Slightly darker Powder Blue
    "Deamidation": "#9BDBDB",  // Slightly darker Pale Turquoise
    "Deamination": "#00B0A5",  // Slightly darker Dark Turquoise
    "Decanoylation": "#34D0BD",  // Slightly darker Turquoise
    "Decarboxylation": "#3EACB2",  // Slightly darker Medium Turquoise
    "Disulfide bond": "#00BFBF",  // Slightly darker Aqua
    "Farnesylation": "#00E466",  // Slightly darker Spring Green
    "Formation of an isopeptide bond": "#72E700",  // Slightly darker Chartreuse
    "Formylation": "#9BEB2F",  // Slightly darker Green Yellow
    "Gamma-carboxyglutamic acid": "#8CEB8C",  // Slightly darker Pale Green
    "Geranylgeranylation": "#7ADA7A",  // Slightly darker Light Green
    "Glutarylation": "#00D98D",  // Slightly darker Medium Spring Green
    "Glutathionylation": "#2FB932",  // Slightly darker Lime Green
    "GPI-anchor": "#329756",  // Slightly darker Medium Sea Green
    "Hydroxyceramide ester": "#58B69E",  // Slightly darker Medium Aquamarine
    "Hydroxylation": "#1B9C91",  // Slightly darker Light Sea Green
    "Iodination": "#7C9B86",  // Slightly darker Light Olive Green
    "Lactoylation": "#D1F2D1",  // Slightly darker Honeydew
    "Lactylation": "#D9F8F3",  // Slightly darker Mint Cream
    "Lipoylation": "#C2FFFF",  // Slightly darker Light Cyan
    "Malonylation": "#D1E8FF",  // Slightly darker Alice Blue
    "Myristoylation": "#E4E4E4",  // Slightly darker White Smoke
    "N-carbamoylation": "#FFE3F0",  // Slightly darker Lavender Blush
    "N-linked Glycosylation": "#F0C9D0",  // Slightly darker Misty Rose
    "N-palmitoylation": "#F7E68A",  // Slightly darker Lemon Chiffon
    "Neddylation": "#F6E497",  // Slightly darker Light Goldenrod Yellow
    "Nitration": "#FFFFB3",  // Slightly darker Light Yellow
    "O-linked Glycosylation": "#E2C300",  // Slightly darker Gold
    "O-palmitoleoylation": "#E1D45A",  // Slightly darker Khaki
    "O-palmitoylation": "#E2C300",  // Slightly darker Gold
    "Octanoylation": "#F2D093",  // Slightly darker Moccasin
    "Phosphatidylethanolamine amidation": "#F7E1DD",  // Slightly darker Seashell
    "Propionylation": "#F7D0D0",  // Slightly darker Pink Lavender
    "Pyrrolidone carboxylic acid": "#E8C08D",  // Slightly darker Wheat
    "Pyrrolylation": "#F1C397",  // Slightly darker Navajo White
    "Pyruvate": "#F4D0A9",  // Slightly darker Blanched Almond
    "S-archaeol": "#D1E8FF",  // Slightly darker Alice Blue
    "S-carbamoylation": "#E1D45A",  // Slightly darker Khaki
    "S-Cyanation": "#C9A7D9",  // Slightly darker Thistle
    "S-cysteinylation": "#D1C9E6",  // Slightly darker Lavender
    "S-diacylglycerol": "#B8B8B8",  // Slightly darker Light Gray
    "S-linked Glycosylation": "#A1B7D1",  // Slightly darker Light Steel Blue
    "S-nitrosylation": "#A3A3A3",  // Slightly darker Gray
    "S-palmitoylation": "#A8A8A8",  // Slightly darker Silver
    "Serotonylation": "#C7C7C7",  // Slightly darker Gainsboro
    "Stearoylation": "#F2F2F2",  // Slightly darker Ghost White
    "Succinylation": "#E5E5E5",  // Slightly darker Very Light Gray
    "Sulfation": "#A7C8D9",  // Slightly darker Powder Blue
    "Sulfhydration": "#C7C7C7",  // Slightly darker Gainsboro
    "Sulfoxidation": "#B8B8B8",  // Slightly darker Light Gray
    "Thiocarboxylation": "#D9F8F3",  // Slightly darker Mint Cream
    "Ubiquitination": "#2A8B2A",  // Slightly darker Lime Green
    "UMPylation": "#A3A3A3"  // Slightly darker Gray
};

document.addEventListener("DOMContentLoaded", () => {
    checkForLogin();
    document.getElementById('protein3DStructure').style.display = 'none';
    // Set up an autocomplete function
    $('#form_value').on('input', async function() {
        const requestTerm = $(this).val();
        if (requestTerm.length < 1) {
            $('#suggestions').hide();
            return;
        }

        try {
            const res = await fetch(`/ptmkb/protein_autofill?_id=${requestTerm}`);
            const data = await res.json();
            const suggestions = data['ids'];
            
            const suggestionsBox = $('#suggestions');
            suggestionsBox.empty();
            
            if (suggestions.length > 0) {
                suggestions.forEach(item => {
                    const suggestionItem = $(`<div class="suggestion-item">${item}</div>`);
                    
                    suggestionItem.on('click', function() {
                        $('#form_value').val(item);
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
            search();
        }
    });
});

// Split the sequence like it is done in UniProt
function splitSequence(sequence) {
    const splits = [];
    for (let i = 0; i < sequence.length; i += 10) {
        splits.push(sequence.slice(i, i + 10));
    }
    let total = 0;
    const response = splits.map(split => {
        total += split.length;
        const result = [split, total];
        return result;
    });
    return response;
}

/*

    JPRED

*/

async function getJPredInference(seq, acc, ptms) {
    // Show loading spinner
    document.getElementById('jpredPredictions').classList.add('lds-dual-ring');
    document.getElementById('jpredPredictions').style.alignContent = 'center';

    fetch('/ptmkb/unrel/submitJpred',  {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ "sequence": seq  })
    }).then(res => {
        return res.json();
    }).then(obj => {
        // When a job is submitted successfully, submit a new job and check status
        if (obj.jobid) {
            submitJob(obj['jobid'], acc, ptms);
        } else {
            // Handle the case where the sequence is too long for JPred
            document.getElementById('jpredPredictions').classList.remove('lds-dual-ring');
            document.getElementById('jpredPredictions').innerHTML = '<h5>The sequence is too long and cannot be predicted by JPred!</h5>';
        }
    }).catch(err => {
        document.getElementById('jpredPredictions').classList.remove('lds-dual-ring');
        document.getElementById('jpredPredictions').innerHTML = '<h5>Error while submitting sequence. Please try again!</h5>';
    });
}

let currentJobAbortController = null; // Global variable to store the current active abort controller

async function submitJob(jobid, acc, ptms) {
    // If there's an active job polling, abort it
    if (currentJobAbortController) {
        currentJobAbortController.abort();
    }
    try {
        // Create a new abort controller for the current job
        currentJobAbortController = new AbortController();
        const signal = currentJobAbortController.signal;

        let jobFinished = false;
        let resultResponse;

        // Poll for the job status until it's finished
        while (!jobFinished) {
            // Sleep for 3 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Make the fetch request with the signal to support aborting
            const resultResponseRaw = await fetch(`/ptmkb/unrel/getJpred?jobid=${jobid}`, { signal });
            
            // If the request is aborted, throw an error and break out of the loop
            if (resultResponseRaw.status === 0) {
                break;
            }

            resultResponse = await resultResponseRaw.json();

            // Check if the job is finished
            jobFinished = resultResponse['response'];
        }

        // Only process the result if polling was not aborted
        if (jobFinished) {
            formatJpredResponse(resultResponse['content'], acc, ptms);  // Assuming this function processes the HTML as expected
        }
    } catch (error) {
        // Handle any errors, including aborting
        if (error.name === 'AbortError') {
            console.log('Job polling aborted');
        } else {
            console.error('Error:', error);
        }
        return error.message;
    }
}

function formatJpredResponse(response, acc, ptms) {
    // Parse the response as HTML
    let parser = new DOMParser();
    let parsedHtml = parser.parseFromString(response, 'text/html');
    
    // Find the content inside the <code> tag
    let codeChunk = parsedHtml.querySelector('code').textContent;

    // Initialize the formatted response object
    let formattedResponse = { alignment: {}, prediction: {} };

    // Process each line of the code chunk
    let lines = codeChunk.split('\n');
    lines.forEach(line => {
        if (line.trim() !== '') {
            let [key, value] = line.split(':').map(part => part.trim());
            
            // Check if the key contains 'UniRef' or 'QUERY' for alignment
            if (key.includes('UniRef') || key.includes('QUERY')) {
                formattedResponse.alignment[key] = value;
            } else {
                // If the key is empty, default it to 'Pos'
                if (!key) {
                    key = 'Pos';
                }
                formattedResponse.prediction[key] = value;
            }
        }
    });

    generateHtmlForJPred(formattedResponse, acc, ptms);
}

function generateHtmlForJPred(data, acc, ptms) {
    // Going to populate the data JSON with another value.
    data['ptms'] = {};


    let indices = new Set();
    ptms.forEach(ptm => {
        indices.add(ptm[0]);
        if (data['ptms'][ptm[0]]) { // If it already exists..
            if (!data['ptms'][ptm[0]].includes(ptm[1])) { // If the PTM doesn't already exist in the list,
                data['ptms'][ptm[0]].push(ptm[1]); // add it
            }
        } else { // Else make a new array
            data['ptms'][ptm[0]] = [ptm[1]];
        }
    });
    indices = Array.from(indices);
    document.getElementById('jpredInfo').innerHTML = '';
    // Set a base font size for both labels and sequences
    const fontSize = '14px';

    // Create the main HTML structure
    const htmlContent = document.createElement('div');
    htmlContent.setAttribute('style', 'padding: 20px;');

    // Add first box for Sequence Alignment Data
    const alignmentBox = document.createElement('div');
    alignmentBox.setAttribute('style', 'font-family: "Courier New", Courier, monospace; margin-bottom: 30px; padding: 20px; white-space:nowrap');
    const alignmentHeader = document.createElement('h2');
    alignmentHeader.textContent = 'JPred Alignment';
    alignmentBox.appendChild(alignmentHeader);

    // Create the alignment section (scrollable container)
    const alignmentScrollContainer = document.createElement('div');
    alignmentScrollContainer.setAttribute('style', 'display: flex; justify-content: flex-start; align-items: flex-start; margin-top: 20px; padding-right: 10px;');
    alignmentBox.appendChild(alignmentScrollContainer);

    // Create the labels box for the alignment section
    const labelsBox = document.createElement('div');
    labelsBox.setAttribute('style', `background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 1; font-size: ${fontSize}; max-width: 200px; margin-right: 20px;`);
    alignmentScrollContainer.appendChild(labelsBox);

    // Create the sequences box for the alignment section
    const sequencesBox = document.createElement('div');
    sequencesBox.setAttribute('style', `background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 2; font-size: ${fontSize}; white-space: nowrap`);
    alignmentScrollContainer.appendChild(sequencesBox);

    // Append labels and sequences for the alignment data
    Object.keys(data.alignment).forEach(key => {
        // Add functionality to highlight sequences for the entire stuff
        // Already have the code - just need to implement it
        const labelDiv = document.createElement('div');
        labelDiv.setAttribute('style', `font-weight: bold; margin-bottom: 10px; white-space: nowrap; color: ${key.includes('QUERY') ? 'red' : 'black'};`);
        const aUri = document.createElement('a');
        aUri.textContent = key;
        if (key !== 'QUERY') {
            let keyUri = key;
            if (keyUri.includes('_UPI')) {
                keyUri = keyUri.replace('UniRef90_', '')
            }
            aUri.setAttribute('href', `https://www.ebi.ac.uk/ebisearch/search.ebi?db=allebi&query=${keyUri}`);
            aUri.setAttribute('target', `_blank`);
            aUri.setAttribute('rel', `noopener noreferrer`);
            aUri.setAttribute('style', `cursor: pointer;`);
        }
        labelDiv.appendChild(aUri);
        labelsBox.appendChild(labelDiv);

        // Create sequence div
        const sequenceDiv = document.createElement('div');
        sequenceDiv.setAttribute('style', 'white-space: nowrap; margin-bottom: 10px;');
        if (key === 'QUERY') {
            data.alignment[key].split('').forEach((char, idx) => {
                const span = document.createElement('span');
                span.textContent = char;
                if (indices.includes(idx+1)) {
                    span.classList.add('highlighted');
                    let uniquePtms = new Set();
                    ptms.forEach(ptm => {
                        if (ptm[0] === idx+1) {
                            uniquePtms.add(ptm[1]);
                        }
                    });
                    uniquePtms = Array.from(uniquePtms);
                    // Use the PTMs list for color
                    const ptmColors = uniquePtms.map(ptmType => ptmColorMapping[ptmType] || '#f39c12');
                    if (uniquePtms.length > 1) {
                        // Dynamically calculate the percentage for each color block based on the number of colors
                        const percentagePerColor = 100 / ptmColors.length;
                        
                        // Create the gradient by mapping over ptmColors
                        const gradient = ptmColors
                            .map((color, idx) => {
                                const startPercentage = idx * percentagePerColor; // Starting percentage for this color block
                                const endPercentage = startPercentage + percentagePerColor; // Ending percentage for this color block
                                return `${color} ${startPercentage}% ${endPercentage}%`; // Define the color block from start to end
                            })
                            .join(', ');
                    
                        // Apply the generated linear gradient to the background
                        span.setAttribute('data-ptm', uniquePtms.join(';'));
                        span.style.background = `linear-gradient(to bottom, ${gradient})`;
                        span.style.backgroundSize = '100% 100%';
                    } else {
                        span.style.backgroundColor = ptmColors[0];
                    }
                    span.addEventListener("mouseenter", (e) => {
                        if (uniquePtms.length > 0) {
                            // Create a tooltip element
                            const tooltip = document.createElement("div");
                            tooltip.classList.add("custom-tooltip");
                            tooltip.textContent = uniquePtms.join(", ");  // Display all PTMs for this position
        
                            // Append the tooltip to the body
                            document.body.appendChild(tooltip);
        
                            // Position the tooltip near the character
                            const rect = e.target.getBoundingClientRect(); // Get the character's position
                            tooltip.style.position = "absolute";
                            tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                            tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                            tooltip.style.zIndex = 10; // Ensure it's above other content
        
                            // Add the 'visible' class to the tooltip to show it
                            setTimeout(() => {
                                tooltip.classList.add("visible");
                            }, 10); // Small delay for the transition to kick in
        
                            // Store tooltip for later removal
                            e.target.tooltip = tooltip;
                        }
                    });
    
                    // Add mouseleave event to remove the tooltip
                    span.addEventListener("mouseleave", (e) => {
                        const tooltip = e.target.tooltip;
                        if (tooltip) {
                            tooltip.remove(); // Remove the tooltip when the mouse leaves
                            delete e.target.tooltip; // Clean up the tooltip reference
                        }
                    });
                }
                sequenceDiv.appendChild(span);
            });
        } else {
            sequenceDiv.textContent = data.alignment[key];
        }
        // sequenceDiv.textContent = data.alignment[key];
        sequencesBox.appendChild(sequenceDiv);
    });

    const jpredAlignment = document.createElement('h5');
    const alignmentPopup = document.createElement('a');
    alignmentPopup.addEventListener('click', function() {
        const newWindow = window.open('', '_blank', 'width=800, height=600');
        newWindow.document.write('<link rel="stylesheet" type="text/css" href="../static/styles.css">');
        newWindow.document.write('<body>' + alignmentBox.outerHTML + '</body>');
        newWindow.document.close()
    });
    alignmentPopup.textContent = "Click here to view JPred Alignments!";
    alignmentPopup.setAttribute('style', "color: #1a0dab; text-decoration: underline; font-weight: normal; cursor: pointer;");
    jpredAlignment.appendChild(alignmentPopup); // = `<a onclick="windowOpener()" ></a>`;
    htmlContent.appendChild(jpredAlignment);

    // Now make a popup here.

    // Add second box for Prediction Data
    const predictionBox = document.createElement('div');
    predictionBox.setAttribute('style', 'padding: 20px; border: 2px solid #ddd; border-radius: 10px; background-color: #f9f9f9;');

    // Create the prediction section (scrollable container)
    const predictionScrollContainer = document.createElement('div');
    predictionScrollContainer.setAttribute('style', 'display: flex; justify-content: flex-start; align-items: flex-start; margin-top: 20px; padding-right: 10px;');
    predictionBox.appendChild(predictionScrollContainer);

    // Create the labels box for the prediction section
    const predictionLabelsBox = document.createElement('div');
    predictionLabelsBox.setAttribute('style', `background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 1; font-size: ${fontSize}; max-width: 100px; margin-right: 20px;`);
    predictionScrollContainer.appendChild(predictionLabelsBox);

    // Create the sequences box for the prediction section (with scrolling)
    const predictionSequencesBox = document.createElement('div');
    predictionSequencesBox.setAttribute('id', 'jpredSequenceBox');
    predictionSequencesBox.setAttribute('style', `background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 2; font-size: ${fontSize}; white-space: nowrap; max-height: 400px; overflow-y: hidden;`);
    predictionScrollContainer.appendChild(predictionSequencesBox);

    const jpredKeyMapping = {
        'Pos': "The position of the residue in the protein sequence",
        'OrigSeq': "The protein sequence",
        'Jnet': "Final secondary structure prediction for protein sequence",
        'jhmm': "Jnet hmm profile prediction",
        'jpssm': "Jnet PSIBLAST pssm profile prediction",
        'Lupas 14': "Lupas Coil prediction of window size 14 (- = < 50% probability, c = b/w 50% and 90% probability, C = > 90% probability)",
        'Lupas 21': "Lupas Coil prediction of window size 21 (- = < 50% probability, c = b/w 50% and 90% probability, C = > 90% probability)",
        'Lupas 28': "Lupas Coil prediction of window size 28 (- = < 50% probability, c = b/w 50% and 90% probability, C = > 90% probability)",
        'Jnet_25': "Jnet bruial prediction (< 25% solvent accessibility)",
        'Jnet_5': "Jnet bruial prediction (< 5% exposure)",
        'Jnet_0': "Jnet bruial prediction (0% exposure)",
        'Jnet Rel': "Jnet reliability of prediction accuracy, ranges from 0 to 9, bigger is better",
    }

    // Append labels and sequences for the prediction data
    Object.keys(data.prediction).forEach(key => {
        // Create label div
        const predictionLabelDiv = document.createElement('div');
        predictionLabelDiv.setAttribute('style', `font-weight: bold; margin-bottom: 10px; white-space: nowrap; color: ${key.includes('QUERY') ? 'red' : 'black'};`);
        // Create the key tooltips over here
        predictionLabelDiv.textContent = key;
        predictionLabelDiv.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement("div");
            tooltip.classList.add("custom-tooltip");
            try {
                tooltip.textContent = jpredKeyMapping[key];  // Display all PTMs for this position
            } catch (e) {
                tooltip.textContent = '';
            }

            // Append the tooltip to the body
            document.body.appendChild(tooltip);

            // Position the tooltip near the character
            const rect = e.target.getBoundingClientRect(); // Get the character's position
            tooltip.style.position = "absolute";
            tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
            tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
            tooltip.style.zIndex = 10; // Ensure it's above other content

            // Add the 'visible' class to the tooltip to show it
            setTimeout(() => {
                tooltip.classList.add("visible");
            }, 10); // Small delay for the transition to kick in

            // Store tooltip for later removal
            e.target.tooltip = tooltip;
        });
        predictionLabelDiv.addEventListener('mouseleave', (e) => {
            const tooltip = e.target.tooltip;
            if (tooltip) {
                tooltip.remove(); // Remove the tooltip when the mouse leaves
                delete e.target.tooltip; // Clean up the tooltip reference
            }
        });
        predictionLabelsBox.appendChild(predictionLabelDiv);

        // Create sequence div
        const predictionSequenceDiv = document.createElement('div');
        predictionSequenceDiv.setAttribute('style', 'white-space: nowrap; margin-bottom: 10px;');
        if (key === 'OrigSeq') {
            // Highlight PTMs (maybe static colour for now)
            // use "indices" here
            let subsequence = data.prediction[key];
            subsequence.split('').forEach((char, index) => {
                let font = document.createElement('span');
                font.textContent = char;
                // let font = `<font>${char}</font>`
                if (indices.includes(index+1)) {
                    font.classList.add('highlighted');
                    font.setAttribute('data-idx', index);
                    // Get PTMs from original data using indices
                    let uniquePtms = new Set();
                    ptms.forEach(ptm => {
                        if (ptm[0] === index+1) {
                            uniquePtms.add(ptm[1]);
                        }
                    });
                    uniquePtms = Array.from(uniquePtms);
                    // Use the PTMs list for color
                    const ptmColors = uniquePtms.map(ptmType => ptmColorMapping[ptmType] || '#f39c12');
                    if (uniquePtms.length > 1) {
                        // Dynamically calculate the percentage for each color block based on the number of colors
                        const percentagePerColor = 100 / ptmColors.length;
                        
                        // Create the gradient by mapping over ptmColors
                        const gradient = ptmColors
                            .map((color, idx) => {
                                const startPercentage = idx * percentagePerColor; // Starting percentage for this color block
                                const endPercentage = startPercentage + percentagePerColor; // Ending percentage for this color block
                                return `${color} ${startPercentage}% ${endPercentage}%`; // Define the color block from start to end
                            })
                            .join(', ');
                    
                        // Apply the generated linear gradient to the background
                        font.setAttribute('data-ptm', uniquePtms.join(';'));
                        font.style.background = `linear-gradient(to bottom, ${gradient})`;
                        font.style.backgroundSize = '100% 100%';
                    } else {
                        font.style.backgroundColor = ptmColors[0];
                    }

                    font.addEventListener("mouseenter", (e) => {
                        if (uniquePtms.length > 0) {
                            // Create a tooltip element
                            const tooltip = document.createElement("div");
                            tooltip.classList.add("custom-tooltip");
                            tooltip.textContent = uniquePtms.join(", ");  // Display all PTMs for this position
        
                            // Append the tooltip to the body
                            document.body.appendChild(tooltip);
        
                            // Position the tooltip near the character
                            const rect = e.target.getBoundingClientRect(); // Get the character's position
                            tooltip.style.position = "absolute";
                            tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                            tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                            tooltip.style.zIndex = 10; // Ensure it's above other content
        
                            // Add the 'visible' class to the tooltip to show it
                            setTimeout(() => {
                                tooltip.classList.add("visible");
                            }, 10); // Small delay for the transition to kick in
        
                            // Store tooltip for later removal
                            e.target.tooltip = tooltip;
                        }
                    });
        
                    // Add mouseleave event to remove the tooltip
                    font.addEventListener("mouseleave", (e) => {
                        const tooltip = e.target.tooltip;
                        if (tooltip) {
                            tooltip.remove(); // Remove the tooltip when the mouse leaves
                            delete e.target.tooltip; // Clean up the tooltip reference
                        }
                    });

                    // One more event to highlight everything below it.
                    font.addEventListener('click', (e) => {
                        let idx = Number.parseInt(e.target.getAttribute('data-idx'));
                        const divs = document.getElementById('jpredSequenceBox').querySelectorAll('div');
                        divs.forEach((div, outerIdx) => {
                            if (outerIdx !== 1) { // We will not mess with OrigSeq div
                                const spans =  div.querySelectorAll('span');
                                spans.forEach((span, innerIdx) => {
                                    if (innerIdx === idx) {
                                        span.classList.add('highlighted');
                                        span.style.backgroundColor = "#e3e272";
                                    } else {
                                        if (span.className === 'highlighted') {
                                            span.classList.remove('highlighted');
                                            span.style.backgroundColor = "";
                                        }
                                    }
                                });
                            }
                        });
                    });

                }
                
                predictionSequenceDiv.appendChild(font);
            });
        } else if (key === 'Jnet' || key === 'jhmm' || key === 'jpssm') {
            let htmlString = '';
            data.prediction[key].split('').forEach((char, idx) => {
                if (char === 'H') {
                    htmlString += `<span data-idx="${idx}" style="color: #e90055;">${char}</span>`
                } else if (char === 'E') {
                    htmlString += `<span data-idx="${idx}" style="color: #ffa800;">${char}</span>`
                } else {
                    htmlString += `<span data-idx="${idx}">${char}</span>`
                }
            });
            predictionSequenceDiv.innerHTML = htmlString;
        } else if (key === 'Jnet_25' || key === 'Jnet_5' || key === 'Jnet_0') {
            let htmlString = '';
            data.prediction[key].split('').forEach((char, idx) => {
                if (char === 'B') {
                    htmlString += `<span data-idx="${idx}" style="color: #aa0000;">${char}</span>`
                } else {
                    htmlString += `<span data-idx="${idx}">${char}</span>`
                }
            });
            predictionSequenceDiv.innerHTML = htmlString;
        } else if (key === 'Jnet Rel') {
            let htmlString = '';
            data.prediction[key].split('').forEach((char, idx) => {
                if (char === '9' || char === '8' || char === '7') {
                    htmlString += `<span data-idx="${idx}" style="color: #00aa00;">${char}</span>`
                } else {
                    htmlString += `<span data-idx="${idx}">${char}</span>`
                }
            });
            predictionSequenceDiv.innerHTML = htmlString;
        } else {
            data.prediction[key].split('').forEach((char, idx) => {
                predictionSequenceDiv.innerHTML += `<span data-idx="${idx}">${char}</span>`;
            });
            
        }
        predictionSequencesBox.appendChild(predictionSequenceDiv);
    });

    // Find the target div to append the content
    const targetDiv = document.getElementById('jpredPredictions');
    targetDiv.classList.remove('lds-dual-ring');
    targetDiv.appendChild(htmlContent);

    // Append the two sections to the target div
    // targetDiv.appendChild(alignmentBox);
    targetDiv.appendChild(predictionBox);
    const jpredDownloadBtn = document.createElement('button');
    jpredDownloadBtn.classList.add('additional-button');
    jpredDownloadBtn.textContent = `Download Alignments and Predictions for ${acc} (JSON)`;
    jpredDownloadBtn.addEventListener('click', () => {
        var jsonString = JSON.stringify(data, null, 2);
        var blob = new Blob([jsonString], { type: 'application/json' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${acc}_jpred.json`;
        link.click();
    });
    document.getElementById('jpredInfo').appendChild(jpredDownloadBtn);
}

/*
    DISPLAY PTM DETAILS AFTER SELECTING
*/

// Also temp function for gathering PTM data
async function fetchData(ptm, char, table) {
    try {
        return await fetch(
            `/ptmkb/pos_matrix?ptm=${encodeURIComponent(ptm)}&residue=${encodeURIComponent(char)}&table=${encodeURIComponent(table)}`
        )
        .then(res => res.json());
    } catch (err) {
        console.error('Error:', err);
    }
}

async function preparePTMDetails(localizedSequence, localizedSequenceInfo, ptmsData) {
    // Prepare to display the localized sequence with bolded PTMs
    const detailsPanel = document.getElementById("detailsPanel");
    detailsPanel.innerHTML = ``;

    // Create a container to hold the localized sequence with bolded PTMs
    const sequenceDisplay = document.createElement('div');
    sequenceDisplay.classList.add('localized-sequence'); // Apply localized-sequence class
    const sequenceDisplayTitle = document.createElement('div')
    sequenceDisplayTitle.innerHTML = '<h4>Local Sequence Window</h4>'

    let centerChar = ''; // Use this later on

    // Loop through the localized sequence text and bold PTMs
    localizedSequence.split('').forEach((char, index) => {
        // Get the global index for this character in the full sequence

        // Check if this position has PTMs (adjust the index to global sequence)
        let formattedChar = document.createElement('span');
        formattedChar.textContent = char;

        if (localizedSequenceInfo[index] !== null) {
            var tempArr = JSON.parse(localizedSequenceInfo[index]);
            var uniquePTMs = new Set(tempArr.map(arr => arr[1]));
            uniquePTMs = Array.from(uniquePTMs);
            // If PTMs exist at this position, make the character bold
            if (index === 10) {
                formattedChar.setAttribute('style', "font-weight: 700; font-size: 48px; user-select: none; cursor: pointer");
                centerChar = char;
            }
            else
                formattedChar.setAttribute('style', "user-select: none; cursor: pointer;");

            const ptmColors = uniquePTMs.map(ptmType => ptmColorMapping[ptmType] || '#f39c12');

            if (uniquePTMs.length > 1) {
                // Dynamically calculate the percentage for each color block based on the number of colors
                const percentagePerColor = 100 / ptmColors.length;
            
                // Create the gradient by mapping over ptmColors
                const gradient = ptmColors
                    .map((color, idx) => {
                        const startPercentage = idx * percentagePerColor; // Starting percentage for this color block
                        const endPercentage = startPercentage + percentagePerColor; // Ending percentage for this color block
                        return `${color} ${startPercentage}% ${endPercentage}%`; // Define the color block from start to end
                    })
                    .join(', ');
            
                // Apply the generated linear gradient to the background
                formattedChar.style.background = `linear-gradient(to bottom, ${gradient})`;
                formattedChar.style.backgroundSize = '100% 100%'; // Ensure the gradient covers the entire element
            } else {
                formattedChar.style.backgroundColor = ptmColors[0];
            }

            formattedChar.addEventListener("mouseenter", (e) => {
                if (uniquePTMs.length > 0) {
                    // Create a tooltip element
                    const tooltip = document.createElement("div");
                    tooltip.classList.add("custom-tooltip");
                    tooltip.textContent = uniquePTMs.join(", ");  // Display all PTMs for this position

                    // Append the tooltip to the body
                    document.body.appendChild(tooltip);

                    // Position the tooltip near the character
                    const rect = e.target.getBoundingClientRect(); // Get the character's position
                    tooltip.style.position = "absolute";
                    tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                    tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                    tooltip.style.zIndex = 10; // Ensure it's above other content

                    // Add the 'visible' class to the tooltip to show it
                    setTimeout(() => {
                        tooltip.classList.add("visible");
                    }, 10); // Small delay for the transition to kick in

                    // Store tooltip for later removal
                    e.target.tooltip = tooltip;
                }
            });

            // Add mouseleave event to remove the tooltip
            formattedChar.addEventListener("mouseleave", (e) => {
                const tooltip = e.target.tooltip;
                if (tooltip) {
                    tooltip.remove(); // Remove the tooltip when the mouse leaves
                    delete e.target.tooltip; // Clean up the tooltip reference
                }
            });

            formattedChar.classList.add('highlighted');
            formattedChar.setAttribute('data-all-ptms', localizedSequenceInfo[index]);
        }
        sequenceDisplay.appendChild(formattedChar);
    });

    // Final DIV for displaying the position
    const positionDiv = document.createElement('div');
    positionDiv.innerHTML = `<h5>Position - </h5>`
    positionDiv.style.padding = '20px';

    // Create a table to display the PTM details as key-value pairs
    const ptmInfo = document.createElement('div');
    ptmInfo.classList.add('protein-info-container'); // Apply the table styles
    ptmInfo.style.backgroundColor = '#eeeeee';

    // Create the table header row
    // const headerRow = document.createElement('tr');
    // const headerKey = document.createElement('th');
    // headerKey.textContent = 'Key';
    // const headerValue = document.createElement('th');
    // headerValue.textContent = 'Value';
    // headerRow.appendChild(headerKey);
    // headerRow.appendChild(headerValue);
    // ptmTable.appendChild(headerRow);

    function convertPubMedReferencesMinor(text) {
        const pubMedRegex = /(\d+)/g; // Regex to match PubMed references

        return text.replace(pubMedRegex, (match, id) => {
            const url = `https://www.ncbi.nlm.nih.gov/pubmed/?term=${id}`; // Construct the URL
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">PMID:${match}</a>&nbsp`; // Create the link
        });
    }

    // Create a row for PTM type and position
    ptmsData.forEach(async (ptm) => {

        // Create a table to display the PTM details as key-value pairs
        const ptmTable = document.createElement('table');
        ptmTable.classList.add('table'); // Apply the table styles
        const row = document.createElement('tr');

        const keyCell = document.createElement('td');
        keyCell.classList.add('key');
        keyCell.textContent = 'PTM';
        
        const valueCell = document.createElement('td');
        valueCell.classList.add('value');
        valueCell.innerHTML = `${ptm[1]} `;

        // We're going to fetch the PTM's details using the PTM and the residue it is modified on.
        await fetch(`/ptmkb/getPTM?ptm=${ptm[1]}&aa=${centerChar}`).then(res => {
            return res.json();
        }).then(json => {
            entries = json['response'];
            entries.forEach((entry, index) => {
                valueCell.innerHTML += `<a target="_blank" href="https://proteininformationresource.org/cgi-bin/resid?id=${entry['@id']}">[${entry['@id']}]</a>`
            })
        }).catch(error => {
            console.error(error);
        })

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        ptmTable.appendChild(row);

        // Add position to table
        const positionRow = document.createElement('tr');
        const positionKeyCell = document.createElement('td');
        positionKeyCell.classList.add('key');
        positionKeyCell.textContent = 'Position';
        
        const positionValueCell = document.createElement('td');
        positionValueCell.classList.add('value');
        positionValueCell.innerHTML = `${ptm[0]}`; // PTM Position
        positionDiv.innerHTML = `<h5>Position - ${ptm[0]}</h5>`
        
        // positionRow.appendChild(positionKeyCell);
        // positionRow.appendChild(positionValueCell);
        // ptmTable.appendChild(positionRow);

        // Add evidence identifiers to table
        const evidenceRow = document.createElement('tr');
        const evidenceKeyCell = document.createElement('td');
        evidenceKeyCell.classList.add('key');
        evidenceKeyCell.textContent = 'Evidence Identifiers';

        const evidenceValueCell = document.createElement('td');
        evidenceValueCell.classList.add('value');
        const evidenceIdentifiers = convertPubMedReferencesMinor(ptm[2]);
        evidenceValueCell.innerHTML = evidenceIdentifiers;

        evidenceRow.appendChild(evidenceKeyCell);
        evidenceRow.appendChild(evidenceValueCell);
        ptmTable.appendChild(evidenceRow);

        // Fetch additional PTM details like score and matrix if required
        const freqTableResp = await fetchData(ptm[1], centerChar, 'freq');
        const logTableResp = await fetchData(ptm[1], centerChar, 'log-e');

        if (!logTableResp.message) {
            const scoreRow = document.createElement('tr');
            const scoreKeyCell = document.createElement('td');
            scoreKeyCell.classList.add('key');
            const scoresLabel = document.createElement('a');
            scoresLabel.textContent = "Scores";
            scoreKeyCell.appendChild(scoresLabel);
            const scoreValueCell = document.createElement('td');
            scoreValueCell.classList.add('value');

            const scores = await fetch(`/ptmkb/get_protein_log_scores?ptm=${encodeURIComponent(ptm[1])}&subsequence=${encodeURIComponent(localizedSequence)}`)
            .then(res => {
                return res.json();
            }).catch(error => {
                console.error(error);
            });

            const logSum = typeof(scores['logSum']) === 'string' ? "NIL" : scores['logSum'].toFixed(2);
            const logLogProduct = typeof(scores['logLogProduct']) === 'string' ? "NIL" : scores['logLogProduct'].toFixed(2);

            if (logSum !== 'NIL' || logLogProduct !== 'NIL') {
                const scoresHelp = document.createElement('a');
                scoresHelp.classList.add('question-mark');
                scoresHelp.textContent = "?";
                scoresHelp.addEventListener('click', (e) => {
                    // Yes, this is actually the case every single time.
                    const detailsDiv = e.target.parentNode.parentNode.parentNode.parentNode.parentNode;
                    // We obtain the sequence this way
                    var sequence = [];
                    detailsDiv.querySelector('.localized-sequence').querySelectorAll('span').forEach(span => {
                        sequence.push(span.textContent);
                    });
                    sequence = sequence.join('');
                    // Now we obtain the PTM
                    var ptm = detailsDiv.querySelectorAll('.value')[0].textContent.split('[')[0].trim();
                    // Now we send it over to the new page.
                    window.location.href = `/propensity?ptm=${ptm}&seq=${sequence}`;
                });

                scoresHelp.addEventListener('mouseenter', (e) => {
                    const tooltip = document.createElement("div");
                    tooltip.classList.add("custom-tooltip");
                    tooltip.textContent = "Click here to find how the values are calculated.";

                    // Append the tooltip to the body
                    document.body.appendChild(tooltip);

                    // Position the tooltip near the character
                    const rect = e.target.getBoundingClientRect(); // Get the character's position
                    tooltip.style.position = "absolute";
                    tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                    tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                    tooltip.style.zIndex = 10; // Ensure it's above other content

                    // Add the 'visible' class to the tooltip to show it
                    setTimeout(() => {
                        tooltip.classList.add("visible");
                    }, 10); // Small delay for the transition to kick in

                    // Store tooltip for later removal
                    e.target.tooltip = tooltip;
                })

                scoresHelp.addEventListener('mouseleave', (e) => {
                    const tooltip = e.target.tooltip;
                    if (tooltip) {
                        tooltip.remove();
                        delete e.target.tooltip;
                    }
                })

                scoreKeyCell.appendChild(scoresHelp);
            }

            scoreValueCell.innerHTML = `<strong>Log Sum:</strong> ${logSum} <br><strong>Log-Log Product:</strong> ${logLogProduct}`;

            scoreRow.appendChild(scoreKeyCell);
            scoreRow.appendChild(scoreValueCell);
            ptmTable.appendChild(scoreRow);
        } else {
            console.log(logTableResp);
        }

        ptmInfo.appendChild(ptmTable);
        // Create a wrapper for the table
        // const tableContainer = document.createElement('div');
        // tableContainer.classList.add('protein-info-container');
        // tableContainer.appendChild(ptmTable);
    });
    
    
    detailsPanel.innerHTML = '';
    // Append the sequence to the details panel
    // Append the table container to the details panel
    detailsPanel.appendChild(sequenceDisplayTitle);
    detailsPanel.appendChild(sequenceDisplay);
    detailsPanel.appendChild(positionDiv);
    detailsPanel.appendChild(ptmInfo);

    // Show the details panel with styles applied
    detailsPanel.style.display = 'block';
    function scrollIfNotInView(element) {
        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    
        if (!isInViewport) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    scrollIfNotInView(document.getElementsByClassName('localized-sequence')[0]);
}

// Function to display additional details about the clicked highlighted text (PTM data)
async function displayPTMDetails(event) {
    // Retrieve PTM information from the clicked highlighted span
    const ptmsData = JSON.parse(event.target.getAttribute("data-all-ptms"));

    // Get the parent sequence block of the clicked highlighted text
    const clickedSpan = event.target;
    const clickedBlock = clickedSpan.closest('.sequence-block');  // Find the parent .sequence-block

    // Initialize totalText to store the entire sequence
    let totalText = '';
    let totalTextInfo = new Array();

    // Append previous block's text if available
    const previousBlock = clickedBlock.previousElementSibling;
    if (previousBlock) {
        const previousBlockText = previousBlock.querySelector('.sequence-text').textContent;
        previousBlock.querySelector('.sequence-text').querySelectorAll('span').forEach((span, index) => {
            totalTextInfo.push(span.getAttribute('data-all-ptms'));
        });
        totalText += previousBlockText;
    }
    while (totalText.length < 11) {
        totalTextInfo.unshift(null);
        totalText = '-' + totalText;
    }

    // Add the current block's text (clicked block)
    const sequenceText = clickedBlock.querySelector('.sequence-text');
    const spans = sequenceText.querySelectorAll('span');
    
    spans.forEach((span, index) => {
        totalTextInfo.push(span.getAttribute('data-all-ptms'));

        const clickedResidueIndex = Array.from(clickedBlock.querySelector('.sequence-text').children).indexOf(clickedSpan);
        if (index == clickedResidueIndex)
            totalText += '<' + span.textContent + '>';
        else
            totalText += span.textContent;
    });

    // Append next block's text if available
    const nextBlock = clickedBlock.nextElementSibling;
    if (nextBlock) {
        const nextBlockText = nextBlock.querySelector('.sequence-text').textContent;
        nextBlock.querySelector('.sequence-text').querySelectorAll('span').forEach((span, index) => {
            totalTextInfo.push(span.getAttribute('data-all-ptms'));
        });
        totalText += nextBlockText;
    }
    while (totalText.length < 32) {
        totalText = totalText + '-';
        totalTextInfo.push(null);
    }

    // Find the position of the marked residue (the one surrounded by < >)
    const clickedResidueIndex = totalText.indexOf('<');
    const endClickedIndex = totalText.indexOf('>', clickedResidueIndex);

    // Calculate the start and end positions for the localized sequence
    const start = Math.max(0, clickedResidueIndex - 10);  // Ensure not going out of bounds for previous residues
    const end = Math.min(totalText.length, endClickedIndex + 10 + 1);  // Ensure not going out of bounds for next residues

    // Extract the localized sequence based on the start and end indices
    var localizedSequence = totalText.slice(start, end);
    var localizedSequenceInfo = totalTextInfo.slice(start, end);
    localizedSequenceInfo = localizedSequenceInfo.slice(0, 21)
    localizedSequence = localizedSequence.replace('<', '')
    localizedSequence = localizedSequence.replace('>', '')
    localizedSequence = localizedSequence.slice(0, 21)

    preparePTMDetails(localizedSequence, localizedSequenceInfo, ptmsData);
    initializePTMClickListenersForPTMSequence();
}

// Function to initialize the sequence blocks and attach event listeners
function initializePTMClickListenersForProteinSequence() {
    // Attach event listeners for the highlighted spans (to display PTM info)
    const highlightedSpans = document.querySelectorAll('.highlighted');
    highlightedSpans.forEach(span => {
        span.addEventListener('click', displayPTMDetails);
    });
}

function initializePTMClickListenersForPTMSequence() {
    const localSpans = document.querySelector('.localized-sequence').querySelectorAll('span');
    document.querySelectorAll('.custom-tooltip').forEach(function(tooltip) {
        tooltip.remove();  // This removes the tooltip element from the DOM
    });
    localSpans.forEach((span) => {
        if (span.getAttribute('data-all-ptms')) {
            span.addEventListener('click', (e) => {
                let localizedSequenceIndex = 0;
                const ptmsData = JSON.parse(e.target.getAttribute('data-all-ptms'));
                localizedSequenceIndex = ptmsData[0][0];
                const blocks = document.getElementById('sequenceDisplayer').querySelectorAll('.sequence-block');
                let sequence = '';
                let allSpans = []
                blocks.forEach((block) => {
                    block.querySelectorAll('.sequence-text').forEach((spans) => {
                        sequence += spans.textContent;
                        spans.querySelectorAll('span').forEach(s => {
                            allSpans.push(s);
                        })
                    });
                });

                // Get index from original protein sequence
                let max = Math.max(localizedSequenceIndex - 11, 0)
                let min = Math.min(localizedSequenceIndex + 10, (sequence.length))
                let localizedSequence = sequence.slice(max, min);
                let localSpans = allSpans.slice(max, min)
                if (localizedSequenceIndex - 11 < 0) {
                    while (localizedSequence.length != 21) {
                        localizedSequence = '-' + localizedSequence;
                        const tempSpan = document.createElement('span')
                        tempSpan.textContent = '-';
                        localSpans.unshift(tempSpan);
                    }
                }
                if (localizedSequenceIndex + 10 > (sequence.length)) {
                    while (localizedSequence.length != 21) {
                        localizedSequence += '-';
                        const tempSpan = document.createElement('span')
                        tempSpan.textContent = '-';
                        localSpans.push(tempSpan);
                    }
                }

                let localizedSequenceInfo = []
                localSpans.forEach((localSpan) => {
                    localizedSequenceInfo.push(localSpan.getAttribute('data-all-ptms'));
                })

                preparePTMDetails(localizedSequence, localizedSequenceInfo, ptmsData);
                initializePTMClickListenersForPTMSequence()
            });
        }
    });
}

// Function to display the protein sequence with color-coded PTM highlights
function displayProteinSequence(sequence, modificationData, additionalUniprotInfo, lastUpdate, acc) {
    // Display additional information about the protein sequence
    // KEYS
            // "length": 568,
            // "molWeight": 63351,
            // "crc64": "0A020B7FB34132F9",
            // "md5": "BA05ABF472C72920B0D36DB229B3D33B"
    document.getElementById('uniprotSequence').innerHTML = '';

    // Create the table for displaying the key-value pairs
    const uniprotTable = document.createElement('table');
    uniprotTable.classList.add('table'); // Apply the table styles
    
    // Loop through each key in the array and add it to the table
    ["length", "molWeight", "crc64", "md5", "lastUpdate"].forEach((key) => {
        const row = document.createElement('tr');
    
        // Create the key cell
        const keyCell = document.createElement('td');
        keyCell.classList.add('key');
        
        let toUseAsKey = ''
        if (key !== "molWeight" && key !== "length" && key !== "lastUpdate") {
            toUseAsKey = key.toUpperCase();
        } else {
            toUseAsKey = key.replace(/([a-z](?=[A-Z]))/g, '$1 ')
            .replace(/^./, function(str){ return str.toUpperCase(); })
        }
        keyCell.textContent = toUseAsKey;
    
        // Create the value cell
        const valueCell = document.createElement('td');
        valueCell.classList.add('value');
        let value = new String();
        if (key === "lastUpdate") {
            value = lastUpdate;
        } else {
            value = additionalUniprotInfo[key];
        }
        valueCell.textContent = value;
    
        // Append the cells to the row
        row.appendChild(keyCell);
        row.appendChild(valueCell);
    
        // Append the row to the table
        uniprotTable.appendChild(row);
    });
    
    // Append the table to the uniprotSequence container
    document.getElementById('uniprotSequence').appendChild(uniprotTable);
    
    const ptmDownloadBtn = document.createElement('button');
    ptmDownloadBtn.classList.add('additional-button');
    ptmDownloadBtn.textContent = `Download PTM data for ${acc} (JSON)`
    ptmDownloadBtn.addEventListener('click', () => {
        var jsonString = JSON.stringify(modificationData, null, 2);
        var blob = new Blob([jsonString], { type: 'application/json' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${acc}_ptms.json`;
        link.click();
    });
    document.getElementById('uniprotSequence').appendChild(ptmDownloadBtn);

    // Add protein sequence with highlights based on PTMs
    const container = document.getElementById("sequenceDisplayer");

    // Clear any previous content in the container
    container.innerHTML = "";

    // Split the sequence into blocks of 10 characters
    let blocks = splitSequence(sequence);

    // Iterate over each block in the sequence
    blocks.forEach((block, blockIndex) => {
        // Create a block div for each individual block
        const blockDiv = document.createElement("div");
        blockDiv.classList.add("sequence-block");

        // Create a span for each character in the block
        let sequenceText = document.createElement("span");
        sequenceText.classList.add("sequence-text");

        // Create an object to track PTMs at each position
        const ptmsAtPositions = {};
        const allPtmsAtPositions = {};

        // Iterate over the characters in the block
        block[0].split('').forEach((char, index) => {
            // Create a span for each character
            const charSpan = document.createElement("span");
            charSpan.textContent = char;

            // Get the global 0-indexed position of this character
            const charIndex = blockIndex * 10 + index;  // Global 0-indexed position

            // Look for all matching modification data entries (first element is index, second is PTM)
            modificationData.forEach((mod, index) => {
                if (mod[0] === charIndex + 1) { // Convert to 1-indexed

                    // Add PTM to the object if it's not already added for this position
                    if (!ptmsAtPositions[charIndex]) {
                        ptmsAtPositions[charIndex] = [];
                    }
                    if (!allPtmsAtPositions[charIndex]) {
                        allPtmsAtPositions[charIndex] = [];
                    }

                    ptmsAtPositions[charIndex].push(mod[1]);
                    allPtmsAtPositions[charIndex].push(mod);

                    // Get the current 'data-ptm' value from the dataset (if exists)
                    let existingPtms = charSpan.getAttribute('data-ptm') || ''; // Retrieve data-ptm from the dataset

                    // If there are already PTMs, append the new PTM (separate by a semicolon)
                    if (existingPtms !== '') {
                        // Append the new PTM, ensuring no duplicates (separated by semicolons)
                        if (!existingPtms.split(';').includes(mod[1])) {
                            existingPtms += `;${mod[1]}`;
                        }
                        charSpan.setAttribute('data-ptm', existingPtms);
                    } else {
                        // Otherwise, just set the current PTM type
                        charSpan.setAttribute('data-ptm', mod[1]);
                    }
                }
            });

            for (const [key, value] of Object.entries(allPtmsAtPositions)) {
                for (i = 0; i < value.length; i++) {
                    if (value[i][0] === charIndex + 1) { // Convert to 1-indexed
                        // We're going to join the redundant sub arrays together based on the PTMs
                        let grouped = {};

                        value.forEach(entry => {
                            const modType = entry[1];
                            const ids = entry[2];

                            if (!grouped[modType]) {
                                grouped[modType] = {
                                    index: entry[0],
                                    ids: new Set() 
                                };
                            }
                            ids.split(';').forEach(id => grouped[modType].ids.add(id));
                        });

                        let result = Object.keys(grouped).map(modType => {
                            return [
                                grouped[modType].index,
                                modType,
                                Array.from(grouped[modType].ids).join(';')
                            ];
                        });
                        charSpan.setAttribute('data-all-ptms', JSON.stringify(result));
                        break;
                    }
                }
            }

            // After collecting all PTMs for the character, handle highlighting
            var ptmsForThisPosition = ptmsAtPositions[charIndex] || [];
            ptmsForThisPosition = new Set(ptmsForThisPosition);
            ptmsForThisPosition = Array.from(ptmsForThisPosition);

            // Handle multiple PTMs at the same position (apply gradient background)
            if (ptmsForThisPosition.length > 0) {
                // Get colors from ptmColorMapping
                const ptmColors = ptmsForThisPosition.map(ptmType => ptmColorMapping[ptmType] || '#f39c12');

                // Ensure that the span is highlighted
                charSpan.classList.add("highlighted");

                // Calculate the gradient percentile for each color block
                const gradientPercentile = 100 / ptmsForThisPosition.length;

                // If there are multiple PTMs, apply the gradient background class
                if (ptmColors.length > 1) {
                    // Create the gradient using the colors from ptmColorMapping
                    const gradient = ptmColors
                        .map((color, idx) => {
                            // Calculate start and end percentages for each color block
                            const startPercentage = idx * gradientPercentile;  // Starting percentage for this color block
                            const endPercentage = startPercentage + gradientPercentile;  // Ending percentage for this color block
                            return `${color} ${startPercentage}% ${endPercentage}%`;  // Define the color block from start to end
                        })
                        .join(', ');

                    // Apply the generated linear gradient to the background
                    charSpan.style.background = `linear-gradient(to bottom, ${gradient})`;
                    charSpan.style.backgroundSize = '100% 100%'; // Ensure the gradient covers the entire span
                } else {
                    // If only one PTM, apply the single PTM color class
                    charSpan.style.backgroundColor = ptmColors[0];
                }
            }

            // Add a hover event to show the custom tooltip
            charSpan.addEventListener("mouseenter", (e) => {
                var ptmsForThisChar = ptmsAtPositions[charIndex] || [];
                ptmsForThisChar = new Set(ptmsForThisPosition);
                ptmsForThisChar = Array.from(ptmsForThisPosition);
                if (ptmsForThisChar.length > 0) {
                    // Create a tooltip element
                    const tooltip = document.createElement("div");
                    tooltip.classList.add("custom-tooltip");
                    tooltip.textContent = ptmsForThisChar.join(", ");  // Display all PTMs for this position

                    // Append the tooltip to the body
                    document.body.appendChild(tooltip);

                    // Position the tooltip near the character
                    const rect = e.target.getBoundingClientRect(); // Get the character's position
                    tooltip.style.position = "absolute";
                    tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                    tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                    tooltip.style.zIndex = 10; // Ensure it's above other content

                    // Add the 'visible' class to the tooltip to show it
                    setTimeout(() => {
                        tooltip.classList.add("visible");
                    }, 10); // Small delay for the transition to kick in

                    // Store tooltip for later removal
                    e.target.tooltip = tooltip;
                }
            });

            // Add mouseleave event to remove the tooltip
            charSpan.addEventListener("mouseleave", (e) => {
                const tooltip = e.target.tooltip;
                if (tooltip) {
                    tooltip.remove(); // Remove the tooltip when the mouse leaves
                    delete e.target.tooltip; // Clean up the tooltip reference
                }
            });

            // Append the character span to the sequence text span
            sequenceText.appendChild(charSpan);
        });

        // Set the block number
        const blockNumber = document.createElement("span");
        blockNumber.classList.add("block-number");
        blockNumber.textContent = block[1]; // The block number (block[1])

        // Append both the sequence chunk and the block number to the block div
        blockDiv.appendChild(sequenceText);
        blockDiv.appendChild(blockNumber);

        // Append the block div to the main container
        container.appendChild(blockDiv);
    });

    // After blocks are created, initialize the click event listeners
    initializePTMClickListenersForProteinSequence();
}


// We're going to gather all of the PTMs of all sequences and make a table out of it.
function generatePTMHtmlTable() {
    const sequenceTexts = document.getElementById('sequenceDisplayer').querySelectorAll('.sequence-text');
    let sequencesArr = new Array();
    sequenceTexts.forEach((seqText) => {
        let spans = seqText.querySelectorAll('span');
        spans.forEach(span => {
            if (span.getAttribute('data-ptm')) {
                ptms = span.getAttribute('data-ptm').split(';');
                ptms.forEach((ptm) => {
                    sequencesArr.push({
                        'aa': span.textContent,
                        'ptm': ptm
                    });
                });
            }
        });
    });

    let ptmCounts = {};
    let aminoAcids = ["A", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "Y"]
    sequencesArr.forEach(entry => {
        const { aa, ptm } = entry;
    
        // If the PTM doesn't exist in the ptmCounts object, initialize it
        if (!ptmCounts[ptm]) {
            ptmCounts[ptm] = {};
        }
    
        // If the amino acid doesn't exist for the current PTM, initialize it
        if (!ptmCounts[ptm][aa]) {
            ptmCounts[ptm][aa] = 0;
        }
    
        // Increment the count for the amino acid under the given PTM
        ptmCounts[ptm][aa]++;
    });
    ptmKeys = Object.keys(ptmCounts);

    // Create the table container
    const tableContainer = document.createElement('div');
    tableContainer.setAttribute('id', 'ptmTableSummary');
    tableContainer.style.padding = '20px';
    tableContainer.style.maxWidth = '1000px';
    tableContainer.style.margin = 'auto';
    // tableContainer.style.fontFamily = "'Courier New', Courier, monospace";

    // Create the table wrapper
    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';

    // Create the table element
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #ddd';

    // Create the table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Create the first header cell for PTM Type
    const th = document.createElement('th');
    // th.textContent = 'PTM Type';
    th.style.padding = '10px';
    th.style.textAlign = 'center';
    th.style.border = '1px solid #ddd';
    th.style.backgroundColor = '#f4f4f4';
    th.style.fontWeight = 'bold';
    headerRow.appendChild(th);

    // Create the rest of the header cells for amino acids
    aminoAcids.forEach(aa => {
        const th = document.createElement('th');
        th.textContent = aa;
        th.style.padding = '10px';
        th.style.textAlign = 'center';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#f4f4f4';
        th.style.fontWeight = 'bold';
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create the table body
    const tbody = document.createElement('tbody');
    ptmKeys.forEach(ptm => {
        const row = document.createElement('tr');
        
        // Create a cell for PTM Type
        const ptmCell = document.createElement('th');
        ptmCell.textContent = ptm;
        ptmCell.style.padding = '10px';
        ptmCell.style.textAlign = 'center';
        ptmCell.style.border = '1px solid #ddd';
        ptmCell.style.backgroundColor = '#f4f4f4';
        row.appendChild(ptmCell);
        
        // Loop through each amino acid and check if it exists in the current PTM data
        aminoAcids.forEach(aa => {
            const td = document.createElement('td');
            td.style.padding = '10px';
            td.style.textAlign = 'center';
            td.style.border = '1px solid #ddd';
            td.style.backgroundColor = '#f4f4f4';
            
            if (ptmCounts[ptm][aa]) {
                td.style.fontWeight = 'regular';
                td.textContent = ptmCounts[ptm][aa];
            } else {
                td.textContent = '-';
            }
            
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);
    
    return tableContainer
}

/*
    GOING TO SHOW PREDICTED (AlphaFold) VS ACTUAL (RCSB Database) STRUCTURES
*/

async function displayPDBStructures(uniprotAC, alphafoldPdbData, ptms) {
    document.getElementById('rcsbPdbInfo').innerHTML = '';
    let indices = new Set();
    ptms.forEach(ptm => {
        indices.add(ptm[0]);
    });
    indices = Array.from(indices);


    document.getElementById('afPdbStructure').classList.add('lds-dual-ring');
    document.getElementById('rcsbPdbStructure').classList.add('lds-dual-ring');
    // We also have to collect it for RCSB data
    let responseStr = ``;
    const rcsbJson = {
        "request_options": {
            "return_all_hits": true
        },
        "query": {
          "type": "group",
          "logical_operator": "and",
          "nodes": [
            {
              "type": "terminal",
              "service": "text",
              "parameters": {
                "operator": "exact_match",
                "value": uniprotAC,
                "attribute": "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession"
              }
            },
            {
              "type": "terminal",
              "service": "text",
              "parameters": {
                "operator": "exact_match",
                "value": "UniProt",
                "attribute": "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_name"
              }
            }
          ]
        },
        "return_type": "entry"
      };

    if (alphafoldPdbData) {
        // First and foremost - get calculations
        const afCalculations = await fetch('/ptmkb/structure_calculations', {
            method: 'POST',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ "raw_pdb_data": alphafoldPdbData })
        }).then(async (res) => {
            return await res.json();
        });

        const downloadButton = document.createElement('button');
        downloadButton.setAttribute('id', 'afPdbDownload');
        downloadButton.classList.add('additional-button');
        downloadButton.textContent = 'Download DSSP/Shrake-Rupley calculations (JSON)';
        downloadButton.addEventListener('click', () => {
            var jsonString = JSON.stringify(afCalculations, null, 2);
            var blob = new Blob([jsonString], { type: 'application/json' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${uniprotAC}_af_pdb.json`;
            link.click();
        });
        
        $3Dmol.createViewer("afPdbStructure", {
            defaultcolors: $3Dmol.rasmolElementColors,
            callback: (e) => {
                e.addModel(alphafoldPdbData, 'pdb', { vibrate: true });

                // show/hide indices
                // let idxLabels = []
                // document.getElementById('afShowIndices').addEventListener('click', () => {
                //     if (document.getElementById('afShowIndices').getAttribute('data-showing') === 'false') {
                //         // create indices labels
                //         var residues = {};
                //         const atoms = e.getAtomsFromSel({});
                //         atoms.forEach(function(atom) {
                //             if (!residues[atom.resi]) {
                //                 if (atom.atom === 'CA') {
                //                     residues[atom.resi] = atom;
                //                 }
                //             }
                //         });
                //         residues = Object.values(residues);
                        
                //         residues.forEach(res => {
                //             idxLabels.push(
                //                 e.addLabel(
                //                     res.resi,
                //                     {
                //                         position: res,
                //                         showBackground: false,
                //                         fontColor: 'black',
                //                         fontSize: 14,
                //                         alignment: 'center',
                //                     },
                //                     {resi: res.resi},
                //                     true
                //                 )
                //             );
                //         });
                //         document.getElementById('afShowIndices').setAttribute('data-showing', 'true');
                //     } else {
                //         // just delete all indices labels using the stored information
                //         idxLabels.forEach((idxLabel) => {
                //             e.removeLabel(idxLabel);
                //         });
                //         idxLabels.splice(0, idxLabels.length);
                //         document.getElementById('afShowIndices').setAttribute('data-showing', 'false');
                //     }
                //     e.render();
                // });
                e.setStyle( {}, { cartoon: { colorscheme: 'ssPyMol' } }); // Default style is 2
                e.zoomTo();
                document.getElementById('afPdbStructure').classList.remove('lds-dual-ring');
                let labels = []
                        
                // Going to set another event listener here
                document.getElementById('afClearLabels').addEventListener('click', () => {
                    labels.forEach(l => {
                        e.removeLabel(l);
                    });
                    labels.splice(0, labels.length);
                });
                        
                // And another event listener here
                document.getElementById('afShowDetails').addEventListener('click', () => {
                    if (document.getElementById('afShowDetails').getAttribute('data-type') === "3") {
                        e.setStyle( {}, { stick: { radius: 0.15 } } );
                        e.render();
                        document.getElementById('afShowDetails').setAttribute('data-type', "1");
                    } else if (document.getElementById('afShowDetails').getAttribute('data-type') === "1") {
                        e.setStyle( {}, { cartoon: { colorscheme: 'ssPyMol' } } );
                        e.render();
                        document.getElementById('afShowDetails').setAttribute('data-type', "2");
                    } else {
                        e.setStyle( { stick: { radius: 0.15 }, cartoon: { colorscheme: 'ssPyMol' } } );
                        e.render();
                        document.getElementById('afShowDetails').setAttribute('data-type', "3");
                    }
                });
                        
                // ... and another one...
                document.getElementById('afCenter').addEventListener('click', () => {
                    e.zoomTo();
                    e.center();
                });

                e.setClickable(
                    {},
                    true,
                    function(atom, viewer, event, container) {
                        const labelIndices = labels.map((lab) => {
                            return lab.stylespec.position.resi;
                        });
                        if (!labelIndices.includes(atom.resi)) {
                            var label = `${atom.resi} - ${atom.resn}`;
                            if (indices.includes(atom.resi)) {
                                // Set up the label to include everything
                                // Gather all PTMs
                                label += ' ('
                                let uniquePtms = new Set();
                                ptms.forEach(ptm => {
                                    if (ptm[0] === atom.resi) {
                                        uniquePtms.add(ptm[1]);
                                    }
                                });
                                uniquePtms = Array.from(uniquePtms);
                                uniquePtms.forEach(ptm => {
                                    label += `${ptm}, `;
                                });
                                label = label.slice(0, label.length-2);
                                label += ")";
                            }

                            // Use DSSP and Shrake-Rupley values
                            const idx = (atom.resi - 1);
                            try{
                                label += ` --- SASA: ${afCalculations['SASA'][idx].toFixed(3)}Å² - DSSP: ${afCalculations['simplified'][idx]}`;
                            } catch (e) {}
                            if (afCalculations['detailed'][idx] !== ' ') {
                                label += ` (${afCalculations['detailed'][idx]})`;
                            }
                            const labelObj = viewer.addLabel(
                                label, {
                                    position: atom,
                                    backgroundColor: 'black',
                                    backgroundOpacity: 1.0,
                                    fontColor: 'white',
                                    fontSize: 12,
                                }
                            );
                            labels.push(
                                labelObj
                            );
                        } else {
                            var labelToDelete = labels.map(l => {
                                if (l.stylespec.position.resi === atom.resi) {
                                    return l;
                                } else {
                                    return null;
                                }
                            });
                            labelToDelete = labelToDelete.find(e => { return e !== null; });
                            viewer.removeLabel(labelToDelete);
                            const indexToDelete = labels.indexOf(labelToDelete)
                            if (indexToDelete !== -1) {
                                labels.splice(indexToDelete, 1);
                            }
                        }
                    }
                );
                e.render();
            }
        });
        document.getElementById('afPdbInfo').innerHTML = `
            <h3 style="text-align: center; font-size: 28px; color: #444; font-weight: bold;">AlphaFold PDB Info</h3>
            <table class="table">
                <tr>
                    <td class="key">Sequence</td>
                    <td class="value">${afCalculations['sequence']}</td>
                </tr>
                <tr>
                    <td class="key">Structure (Simple)</td>
                    <td class="value">${afCalculations['simplified'].join('')}</td>
                </tr>
                <tr>
                    <td class="key">Structure (Detailed)</td>
                    <td class="value">${String(afCalculations['detailed'].join('')).replaceAll(' ', '-')}</td>
                </tr>
                <tr>
                    <td class="key">Solvent Accessible Surface Area (Å²)</td>
                    <td class="value">${afCalculations['SASA'].map(sasa => sasa.toFixed(3)).join(' - ')}</td>
                </tr>
            </table>
        `;
        document.getElementById('afPdbInfo').appendChild(downloadButton);

        document.getElementById('afProfile').style.display = 'block';
        document.getElementById('afHRef').innerHTML = `<a href="https://alphafold.ebi.ac.uk/entry/${uniprotAC}" target="_blank">AlphaFold Predicted Structure</a>`
    } else {
        document.getElementById('afHRef').innerHTML = `<h5>No AlphaFold Structure exists.</h5>`;
    }

    let rcsbData = await fetch(
        encodeURI(`https://search.rcsb.org/rcsbsearch/v2/query?json=${JSON.stringify(rcsbJson)}`)
    )
    .then((res) => {
        if (res.status === 200) {
            return res.json();
        }
        return null;
    }).catch(error => {
        console.error(error);
    });

    let response = getValue(rcsbData, 'result_set');
    var identifiers = []

    if (response !== null) {
        identifiers = response.map(item => item.identifier);
        // The 0th index will always have the best result.
        const id = response[0]['identifier'];
        // We will have to use the ID to get the actual PDB entry from the RCSB database.
        rcsbData = await fetch(
            encodeURI(`https://files.rcsb.org/download/${id}.pdb`)
        ).then(async (res) => {
            // Use this PDB data to display actual PDB structure.
            res = await res.text();
            const rcsbCalculations = await fetch('/ptmkb/structure_calculations', {
                method: 'POST',
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ "raw_pdb_data": res })
            }).then(async (res) => {
                return await res.json();
            });

            const downloadButton = document.createElement('button');
            downloadButton.setAttribute('id', 'rcsbPdbDownload');
            downloadButton.classList.add('additional-button');
            downloadButton.textContent = 'Download DSSP/Shrake-Rupley calculations';
            downloadButton.addEventListener('click', () => {
                var jsonString = JSON.stringify(rcsbCalculations, null, 2);
                var blob = new Blob([jsonString], { type: 'application/json' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${uniprotAC}_rcsb_pdb_${id}.json`;
                link.click();
            });
            
            $3Dmol.createViewer("rcsbPdbStructure", {
                defaultcolors: $3Dmol.rasmolElementColors,
                callback: (e) => {
                    e.addModel(res, 'pdb');
                    
                    // For indices and showing labels and stuff
                    var residues = {};
                    const atoms = e.getAtomsFromSel({});
                    var minIndex = null;
                    atoms.forEach(function(atom, index) {
                        if (!residues[atom.resi] && atom.chain === 'A') {
                            if (minIndex === null) {
                                minIndex = atom.resi;
                            }
                            residues[atom.resi] = atom;
                        }
                    });
                    residues = Object.values(residues);

                    e.setStyle( {chain: 'A'}, { cartoon: { colorscheme: 'ssPyMol' } }); // Default style is 2
                    e.zoomTo();
                    document.getElementById('rcsbPdbStructure').classList.remove('lds-dual-ring');
                    let labels = []
                            
                    // Going to set another event listener here
                    document.getElementById('rcsbClearLabels').addEventListener('click', () => {
                        labels.forEach(l => {
                            e.removeLabel(l);
                        });
                        labels.splice(0, labels.length);
                    });
                            
                    // And another event listener here
                    document.getElementById('rcsbShowDetails').addEventListener('click', () => {
                        if (document.getElementById('rcsbShowDetails').getAttribute('data-type') === "3") {
                            e.setStyle( {chain: 'A'}, { stick: { radius: 0.15 } } );
                            e.render();
                            document.getElementById('rcsbShowDetails').setAttribute('data-type', "1");
                        } else if (document.getElementById('rcsbShowDetails').getAttribute('data-type') === "1") {
                            e.setStyle( {chain: 'A'}, { cartoon: { colorscheme: 'ssPyMol' } } );
                            e.render();
                            document.getElementById('rcsbShowDetails').setAttribute('data-type', "2");
                        } else {
                            e.setStyle( {chain: 'A'}, { stick: { radius: 0.15 }, cartoon: { colorscheme: 'ssPyMol' } } );
                            e.render();
                            document.getElementById('rcsbShowDetails').setAttribute('data-type', "3");
                        }
                    });
                    // ... and another one...
                    document.getElementById('rcsbCenter').addEventListener('click', () => {
                        e.zoomTo();
                        e.center();
                    });
    
                    e.setClickable(
                        {chain: 'A'},
                        true,
                        function(atom, viewer, event, container) {
                            // Map by residue ID and find one that isn't null
                            // That will be the basis for selection
                            var currResidues = residues.map((res) => {
                                if (res.resi === atom.resi) {
                                    return res;
                                } else {
                                    return null;
                                }
                            });
                            const currRes = currResidues.find(e => { return e !== null; });
                            // Check if a residue has been picked
                            if (currRes) {
                                // Now check if a label exists already for it in the labels array
                                const labelIndices = labels.map(lab => {
                                    return lab.stylespec.position.resi;
                                });
                                if (!labelIndices.includes(currRes.resi)) {
                                    // If it doesn't, make one
                                    // At this point, Cognitive Complexity be damned
                                    var label = `${atom.resi} - ${atom.resn}`;
        
                                    // Use DSSP and Shrake-Rupley values
                                    var idx = residues.map(res => {
                                        return res.resi;
                                    });
                                    idx = idx.indexOf(currRes.resi);
                                    try{
                                        label += ` --- SASA: ${rcsbCalculations['SASA'][idx].toFixed(3)}Å² - DSSP: ${rcsbCalculations['simplified'][idx]}`;
                                    } catch (e) {}
                                    if (rcsbCalculations['detailed'][idx] !== ' ') {
                                        label += ` (${rcsbCalculations['detailed'][idx]})`;
                                    }
                                    const labelObj = viewer.addLabel(
                                        label, {
                                            position: atom,
                                            backgroundColor: 'black',
                                            backgroundOpacity: 1.0,
                                            fontColor: 'white',
                                            fontSize: 12,
                                        }
                                    );
                                    labels.push(
                                        labelObj
                                    );
                                } else {
                                    // Otherwise, remove it.
                                    var labelToDelete = labels.map(l => {
                                        if (l.stylespec.position.resi === atom.resi) {
                                            return l;
                                        } else {
                                            return null;
                                        }
                                    });
                                    labelToDelete = labelToDelete.find(e => { return e !== null; });
                                    viewer.removeLabel(labelToDelete);
                                    const indexToDelete = labels.indexOf(labelToDelete)
                                    if (indexToDelete !== -1) {
                                        labels.splice(indexToDelete, 1);
                                    }
                                }
                            }
                        }
                    );
                    e.render();
                }
            });
            document.getElementById('rcsbPdbInfo').innerHTML = `
                <h3 style="text-align: center; font-size: 28px; color: #444; font-weight: bold;">RCSB PDB Info</h3>
                <table class="table">
                    <tr>
                        <td class="key">Sequence</td>
                        <td class="value">${rcsbCalculations['sequence']}</td>
                    </tr>
                    <tr>
                        <td class="key">Structure (Simple)</td>
                        <td class="value">${rcsbCalculations['simplified'].join('')}</td>
                    </tr>
                    <tr>
                        <td class="key">Structure (Detailed)</td>
                        <td class="value">${String(rcsbCalculations['detailed'].join('')).replaceAll(' ', '-')}</td>
                    </tr>
                    <tr>
                        <td class="key">Solvent Accessible Surface Area (Å²)</td>
                        <td class="value">${rcsbCalculations['SASA'].map(sasa => sasa.toFixed(3)).join(' - ')}</td>
                    </tr>
                </table>
            `;
            document.getElementById('rcsbPdbInfo').appendChild(downloadButton);

            document.getElementById('rcsbProfile').style.display = 'block';
            document.getElementById('rcsbHRef').innerHTML = `<a href="https://www.rcsb.org/structure/${id}" target="_blank">RCSB Verified Structure</a>`;
            // responseStr += `- Actual Structure (Right, <a id="PDB_${id}" href="https://www.rcsb.org/structure/${id}" target="_blank">RCSB</a>).</h5>`
        }).catch(error => {
            document.getElementById('rcsbHRef').innerHTML = `<h5>No RCSB Structure exists.</h5>`;
            console.error(error);
            // responseStr += `- Error: no PDB entry found in RCSB.</h5>`
        });

        document.getElementById('pdbDropdownSelect').innerHTML = '';

        identifiers.forEach((identifier, idx) => {
            const option = document.createElement('option');
            option.text = identifier;
            document.getElementById('pdbDropdownSelect').add(option);
        });

        document.getElementById('pdbDropdownSelect').addEventListener('change', async function(event) {
            document.getElementById('rcsbProfile').style.display = 'none';
            document.getElementById('rcsbPdbStructure').classList.add('lds-dual-ring');
            document.getElementById('rcsbPdbInfo').innerHTML = ``;
            const selectedValue = event.target.value;
            
            rcsbData = await fetch(
                encodeURI(`https://files.rcsb.org/download/${selectedValue}.pdb`)
            ).then(async (res) => {
                // Use this PDB data to display actual PDB structure.
                res = await res.text();
                const rcsbCalculations = await fetch('/ptmkb/structure_calculations', { // Use this later on
                    method: 'POST',
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ "raw_pdb_data": res })
                }).then(async (res) => {
                    return await res.json();
                });

                const downloadButton = document.createElement('button');
                downloadButton.setAttribute('id', 'afPdbDownload');
                downloadButton.classList.add('additional-button');
                downloadButton.textContent = 'Download DSSP/Shrake-Rupley calculations';
                downloadButton.addEventListener('click', () => {
                    var jsonString = JSON.stringify(rcsbCalculations, null, 2);
                    var blob = new Blob([jsonString], { type: 'application/json' });
                    var link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${uniprotAC}_rcsb_pdb_${selectedValue}.json`;
                    link.click();
                });
                
                $3Dmol.createViewer("rcsbPdbStructure", {
                    defaultcolors: $3Dmol.rasmolElementColors,
                    callback: (e) => {
                        e.addModel(res, 'pdb');
                        
                        // For indices and showing labels and stuff
                        var residues = {};
                        const atoms = e.getAtomsFromSel({});
                        var minIndex = null;
                        var counter = 0;
                        atoms.forEach(function(atom) {
                            if (!residues[atom.resi] && atom.chain === 'A') {
                                if (minIndex === null) {
                                    minIndex = atom.resi;
                                }
                                residues[atom.resi] = atom;
                            }
                        });
                        residues = Object.values(residues);
    
                        e.setStyle( {chain: 'A'}, { cartoon: { colorscheme: 'ssPyMol' } }); // Default style is 2
                        e.zoomTo();
                        document.getElementById('rcsbPdbStructure').classList.remove('lds-dual-ring');
                        let labels = []
                                
                        // Going to set another event listener here
                        document.getElementById('rcsbClearLabels').addEventListener('click', () => {
                            labels.forEach(l => {
                                e.removeLabel(l);
                            });
                            labels.splice(0, labels.length);
                        });
                                
                        // And another event listener here
                        document.getElementById('rcsbShowDetails').addEventListener('click', () => {
                            if (document.getElementById('rcsbShowDetails').getAttribute('data-type') === "3") {
                                e.setStyle( {chain: 'A'}, { stick: { radius: 0.15 } } );
                                e.render();
                                document.getElementById('rcsbShowDetails').setAttribute('data-type', "1");
                            } else if (document.getElementById('rcsbShowDetails').getAttribute('data-type') === "1") {
                                e.setStyle( {chain: 'A'}, { cartoon: { colorscheme: 'ssPyMol' } } );
                                e.render();
                                document.getElementById('rcsbShowDetails').setAttribute('data-type', "2");
                            } else {
                                e.setStyle( {chain: 'A'}, { stick: { radius: 0.15 }, cartoon: { colorscheme: 'ssPyMol' } } );
                                e.render();
                                document.getElementById('rcsbShowDetails').setAttribute('data-type', "3");
                            }
                        });
                        // ... and another one...
                        document.getElementById('rcsbCenter').addEventListener('click', () => {
                            e.zoomTo();
                            e.center();
                        });
        
                        e.setClickable(
                            {chain: 'A'},
                            true,
                            function(atom, viewer, event, container) {
                                // Map by residue ID and find one that isn't null
                                // That will be the basis for selection
                                var currResidues = residues.map((res) => {
                                    if (res.resi === atom.resi) {
                                        return res;
                                    } else {
                                        return null;
                                    }
                                });
                                const currRes = currResidues.find(e => { return e !== null; });
                                // Check if a residue has been picked
                                if (currRes) {
                                    // Now check if a label exists already for it in the labels array
                                    const labelIndices = labels.map(lab => {
                                        return lab.stylespec.position.resi;
                                    });
                                    if (!labelIndices.includes(currRes.resi)) {
                                        // If it doesn't, make one
                                        // At this point, Cognitive Complexity be damned
                                        var label = `${atom.resi} - ${atom.resn}`;
            
                                        // Use DSSP and Shrake-Rupley values
                                        var idx = residues.map(res => {
                                            return res.resi;
                                        });
                                        idx = idx.indexOf(currRes.resi);
                                        try{
                                            label += ` --- SASA: ${rcsbCalculations['SASA'][idx].toFixed(3)}Å² - DSSP: ${rcsbCalculations['simplified'][idx]}`;
                                        } catch (e) {}
                                        if (rcsbCalculations['detailed'][idx] !== ' ') {
                                            label += ` (${rcsbCalculations['detailed'][idx]})`;
                                        }
                                        const labelObj = viewer.addLabel(
                                            label, {
                                                position: atom,
                                                backgroundColor: 'black',
                                                backgroundOpacity: 1.0,
                                                fontColor: 'white',
                                                fontSize: 12,
                                            }
                                        );
                                        labels.push(
                                            labelObj
                                        );
                                    } else {
                                        // Otherwise, remove it.
                                        var labelToDelete = labels.map(l => {
                                            if (l.stylespec.position.resi === atom.resi) {
                                                return l;
                                            } else {
                                                return null;
                                            }
                                        });
                                        labelToDelete = labelToDelete.find(e => { return e !== null; });
                                        viewer.removeLabel(labelToDelete);
                                        const indexToDelete = labels.indexOf(labelToDelete)
                                        if (indexToDelete !== -1) {
                                            labels.splice(indexToDelete, 1);
                                        }
                                    }
                                }
                            }
                        );
                        e.render();
                    }
                });
                document.getElementById('rcsbPdbInfo').innerHTML = `
                    <h3 style="text-align: center; font-size: 28px; color: #444; font-weight: bold;">RCSB PDB Info</h3>
                    <table class="table">
                        <tr>
                            <td class="key">Sequence</td>
                            <td class="value">${rcsbCalculations['sequence']}</td>
                        </tr>
                        <tr>
                            <td class="key">Structure (Simple)</td>
                            <td class="value">${rcsbCalculations['simplified'].join('')}</td>
                        </tr>
                        <tr>
                            <td class="key">Structure (Detailed)</td>
                            <td class="value">${String(rcsbCalculations['detailed'].join('')).replaceAll(' ', '-')}</td>
                        </tr>
                        <tr>
                            <td class="key">Solvent Accessible Surface Area (Å²)</td>
                            <td class="value">${rcsbCalculations['SASA'].map(sasa => sasa.toFixed(3)).join(' - ')}</td>
                        </tr>
                    </table>
                `;
                document.getElementById('rcsbPdbInfo').appendChild(downloadButton);
                
                document.getElementById('rcsbProfile').style.display = 'block';
                document.getElementById('rcsbHRef').innerHTML = `<a href="https://www.rcsb.org/structure/${selectedValue}" target="_blank">RCSB Verified Structure</a>`;
            }).catch(error => {
                document.getElementById('rcsbHRef').innerHTML = `<h5>Internet connection error - try again!</h5>`;
                console.log(error);
            });
        });
    } else {
        document.getElementById('rcsbHRef').innerHTML = `<h5>No RCSB Structure exists for ${uniprotAC}.</h5>`;
    }
    try{document.getElementById('afPdbStructure').classList.remove('lds-dual-ring');} catch(e) {}
    try{document.getElementById('rcsbPdbStructure').classList.remove('lds-dual-ring');} catch(e) {}
}

function generateHtmlForPdbStructure(data, target, ptms) {
    const additionalContent = document.createElement('div');
    additionalContent.setAttribute('style', "width: 500px;");

    // Add a box for Sequence, Simplified Structure, Detailed Structure, and SASA
    const structureBox = document.createElement('div');
    structureBox.setAttribute('style', 'padding: 20px; border: 2px solid #ddd; border-radius: 10px; background-color: #f9f9f9; margin-bottom: 30px; width: 500px;');

    // Create the scrollable container for the new content
    const scrollContainer = document.createElement('div');
    scrollContainer.setAttribute('style', 'display: flex; justify-content: flex-start; align-items: flex-start; margin-top: 20px; padding-right: 10px; width: 500px;');
    structureBox.appendChild(scrollContainer);

    // Create the labels box for the new section
    const labelsBox = document.createElement('div');
    labelsBox.setAttribute('style', 'background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 1; font-size: 14px; max-width: 100px; margin-right: 20px;');
    scrollContainer.appendChild(labelsBox);

    // Create the sequences box for the new section
    const sequencesBox = document.createElement('div');
    sequencesBox.setAttribute('style', 'background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; flex: 2; font-size: 14px; white-space: pre-wrap; overflow-x: auto;');
    scrollContainer.appendChild(sequencesBox);

    // Add the labels and sequences for the new section
    // Iterate over the new keys: "sequence", "simplified", "detailed", "SASA"
    const labels = ['sequence', 'simplified', 'detailed'];
    labels.forEach((label) => {
        // Add label to the labels box
        const labelDiv = document.createElement('div');
        labelDiv.setAttribute('style', 'font-weight: bold; margin-bottom: 10px; white-space: nowrap;');
        labelDiv.textContent = label.charAt(0).toUpperCase() + label.slice(1);  // Capitalize first letter
        labelsBox.appendChild(labelDiv);

        // Create corresponding sequence div
        const sequenceDiv = document.createElement('div');
        sequenceDiv.setAttribute('style', 'white-space: nowrap; margin-bottom: 10px;');

        // if (label === 'pos') {
        //     for (i = 0; i < data['sequence'].length; i++) {
        //         const span = document.createElement('span');
        //         span.textContent = (i+1);
        //         sequenceDiv.appendChild(span);
        //     }
        // } else if (label === 'SASA') {
        //     // For SASA, display the values as numbers
        //     data[label].forEach((value, idx) => {
        //         const span = document.createElement('span');
        //         span.textContent = value.toFixed(2) + '\u00A0|\u00A0';  // Display as fixed-point numbers
        //         sequenceDiv.appendChild(span);
        //     });
        if (label !== 'sequence') {
            data[label].forEach((char) => {
                const span = document.createElement('span');
                if (char === ' ')
                    char = '.';
                span.textContent = char;
                sequenceDiv.appendChild(span);
            });
        } else {
            let indices = new Set();
            ptms.forEach(ptm => {
                indices.add(ptm[0]);
            });
            indices = Array.from(indices);

            data[label].split('').forEach((char, idx) => {
                const span = document.createElement('span');
                span.textContent = char;
                
                if (indices.includes(idx + 1)) { // We found PTM
                    span.classList.add('highlighted');
                    let uniquePtms = new Set();
                    ptms.forEach(ptm => {
                        if (ptm[0] === idx+1) {
                            uniquePtms.add(ptm[1]);
                        }
                    });
                    uniquePtms = Array.from(uniquePtms);
                    // Use the PTMs list for color
                    const ptmColors = uniquePtms.map(ptmType => ptmColorMapping[ptmType] || '#f39c12');
                    if (uniquePtms.length > 1) {
                        // Dynamically calculate the percentage for each color block based on the number of colors
                        const percentagePerColor = 100 / ptmColors.length;
                        
                        // Create the gradient by mapping over ptmColors
                        const gradient = ptmColors
                            .map((color, idx) => {
                                const startPercentage = idx * percentagePerColor; // Starting percentage for this color block
                                const endPercentage = startPercentage + percentagePerColor; // Ending percentage for this color block
                                return `${color} ${startPercentage}% ${endPercentage}%`; // Define the color block from start to end
                            })
                            .join(', ');
                    
                        // Apply the generated linear gradient to the background
                        span.setAttribute('data-ptm', uniquePtms.join(';'));
                        span.style.background = `linear-gradient(to bottom, ${gradient})`;
                        span.style.backgroundSize = '100% 100%';
                    } else {
                        span.style.backgroundColor = ptmColors[0];
                    }
                    span.addEventListener("mouseenter", (e) => {
                        if (uniquePtms.length > 0) {
                            // Create a tooltip element
                            const tooltip = document.createElement("div");
                            tooltip.classList.add("custom-tooltip");
                            tooltip.textContent = uniquePtms.join(", ");  // Display all PTMs for this position
        
                            // Append the tooltip to the body
                            document.body.appendChild(tooltip);
        
                            // Position the tooltip near the character
                            const rect = e.target.getBoundingClientRect(); // Get the character's position
                            tooltip.style.position = "absolute";
                            tooltip.style.left = `${rect.left + window.scrollX}px`; // Adjust for any page scroll
                            tooltip.style.top = `${rect.top + window.scrollY - 30}px`; // Position above the character
                            tooltip.style.zIndex = 10; // Ensure it's above other content
        
                            // Add the 'visible' class to the tooltip to show it
                            setTimeout(() => {
                                tooltip.classList.add("visible");
                            }, 10); // Small delay for the transition to kick in
        
                            // Store tooltip for later removal
                            e.target.tooltip = tooltip;
                        }
                    });
    
                    // Add mouseleave event to remove the tooltip
                    span.addEventListener("mouseleave", (e) => {
                        const tooltip = e.target.tooltip;
                        if (tooltip) {
                            tooltip.remove(); // Remove the tooltip when the mouse leaves
                            delete e.target.tooltip; // Clean up the tooltip reference
                        }
                    });
                }

                sequenceDiv.appendChild(span);
            });
        }

        sequencesBox.appendChild(sequenceDiv);
    });

    // Append the entire structure box to the main container
    additionalContent.appendChild(structureBox);

    // Append the additional content to the target div
    const targetDiv = document.getElementById(target);
    targetDiv.appendChild(additionalContent);
}
/*
    THIS IS PURELY FOR DISPLAYING PROTEIN STATISTICS
*/

function updateStats(ptmData) {
    const totalSites = ptmData.length;
    const uniquePTMs = new Set(ptmData.map(ptm => ptm[1])); // Extract unique PTM types
    
    // Count all string values from the third element (semicolon-separated)
    let totalStrings = 0;
    ptmData.forEach(ptm => {
        let strings = [];

        if (typeof(ptm[2]) === "string") {
            strings = ptm[2].split(';'); // Split the third element by semicolon
        } else if (typeof(ptm[2]) == "number") {
            strings = [Number(ptm[2])];
        }
        totalStrings += strings.length; // Count the number of strings in this list
    });

    // Populate the HTML with the calculated values
    document.getElementById('total-sites').textContent = `${totalSites}`;
    document.getElementById('unique-ptms').textContent = `${uniquePTMs.size}`;
    document.getElementById('experimentally-verified').textContent = `${totalStrings}`;

    document.getElementById('proteinStatisticsContainer').appendChild(generatePTMHtmlTable());
}

// Function to handle PTM highlighting (this is where you can remove highlights if unchecked)
function colorPTMs(checkbox) {
    console.log("Calling this function!");
    const ptmType = checkbox.value;  // PTM type from the checkbox value
    const isChecked = checkbox.checked;

    // Find all highlighted spans in the sequence
    const highlightedSpans = document.getElementById('sequenceDisplayer').querySelectorAll('span');

    highlightedSpans.forEach(span => {
        // Get the list of PTMs applied to the current span (separated by semicolons)
        var ptmsForThisChar = span.getAttribute('data-ptm') ? span.getAttribute('data-ptm').split(';') : [];
        var allOtherPTMs = document.getElementById('checkboxContainer').querySelectorAll('li');
        allOtherPTMs = Array.from(new Set(Object.values(allOtherPTMs).map(label => {
            if (label.children[0].checked === true)
                return label.children[0].getAttribute('value');
        })));
        allOtherPTMs = allOtherPTMs.filter(item => item != ptmType);
        console.log(allOtherPTMs, typeof(allOtherPTMs));
        // Check if the span has the corresponding PTM type
        if (ptmsForThisChar.includes(ptmType)) {
            // If unchecked, we need to check if all associated PTM checkboxes are unchecked
            if (!isChecked) {
                // Check if all PTMs for this span are unchecked
                const allOtherPTMUnchecked = ptmsForThisChar.every(ptm => {
                    const checkbox = document.getElementById(ptm);
                    return checkbox && !checkbox.checked;  // Return true if the PTM checkbox is unchecked
                });

                if (allOtherPTMUnchecked) {
                    // Remove the highlight if all PTMs are unchecked
                    span.style.backgroundColor = '';  // Remove the background color (or reset it)
                    span.classList.remove('highlighted');  // Remove the 'highlighted' class
                    span.style.background = '';  // Remove the gradient
                    span.style.backgroundSize = '';  // Remove the background size
                }
            } else if (isChecked) {
                // If there are multiple PTMs, apply a gradient background
                // Gotta get the list of currently activated PTMs
                if (ptmsForThisChar.length > 1) {

                    // Calculate the percentage for each color block
                    const gradientPercentile = 100 / ptmsForThisChar.length;
            
                    // Create the gradient string by mapping over the PTMs and defining color blocks
                    const gradient = ptmsForThisChar
                        .map((ptm, idx) => {
                            const startPercentage = idx * gradientPercentile; // Calculate start percentage
                            const endPercentage = startPercentage + gradientPercentile; // Calculate end percentage
                            return `${ptmColorMapping[ptm]} ${startPercentage}% ${endPercentage}%`; // Define the color block from start to end
                        })
                        .join(', '); // Join all color blocks with commas
            
                    // Apply the linear gradient to the span element
                    span.style.background = `linear-gradient(to bottom, ${gradient})`;
                    span.style.backgroundSize = '100% 100%'; // Ensure the gradient covers the entire span
                } else {
                    // If only one PTM, apply the single PTM color as a solid background
                    span.style.backgroundColor = ptmColorMapping[ptmType];
                }
                // Add the 'highlighted' class
                span.classList.add('highlighted');
            }
        }
    });
}

// Function to fetch the PDB file from AlphaFold and render it inside the specified div
async function fetchProteinStructure(uniprotAccession) {
    document.getElementById('protein3DStructure').classList.add('lds-dual-ring')
    document.getElementById('protein3DStructureInfo').style.display = 'none';
    const apiUrl = `https://alphafold.ebi.ac.uk/api/prediction/${uniprotAccession}`;

    try {
        // Fetch the list of JSON objects with prediction data
        const response = await fetch(apiUrl);
        if (!response.ok) {
            // throw new Error(`Failed to fetch prediction data: ${response.statusText}`);
            document.getElementById('protein3DStructure').innerHTML = `<h5>No 3D structure found!</h5><span class="question-mark" title="This is your tooltip text!"></span>`
            document.getElementById('protein3DStructure').classList.remove('lds-dual-ring');
        }
        else {
            const data = await response.json();

            // If the response contains multiple entries, you can iterate over them
            for (let entry of data) {
                // Check if the 'pdbUrl' exists in the response entry
                if (entry.pdbUrl) {
                    // Fetch the raw PDB file from the pdbUrl
                    return await fetchAndRenderPDB(entry.pdbUrl, uniprotAccession, 'pdb');
                }
            }
        }

    } catch (error) {
        console.error("Error fetching protein structure:", error);
        document.getElementById('protein3DStructure').innerHTML = `<h5>Block Error ${e}</h5>`
        document.getElementById('protein3DStructure').classList.remove('lds-dual-ring');
        return null;
    }
}

async function fetchAndRenderPDB(url, uniprotAccession, datatype) {
    try {
        // Fetch the raw PDB file as bytes
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDB file: ${response.statusText}`);
        }

        const data = await response.text();  // Read as text
        return data;
    } catch (error) {
        console.error("Error rendering PDB file:", error);
        return null;
    }
}

// USE THIS to populate ONLY APPLICABLE CHECKBOXES
function populateCheckboxesFromResult(data) {
    const uniquePTMs = new Set(data.map(ptm => ptm[1]));
    const checkboxContainer = document.getElementById('checkboxContainer');
    // const arr = data['ptms'];

    const checkboxList = [];

    // For each PTM, create a checkbox
    for (let ptm of uniquePTMs.values()) {
        const checkboxWrapper = document.createElement('label');
        checkboxWrapper.htmlFor = ptm;
        checkboxWrapper.innerHTML = `
            <li>
                <input type="checkbox" id="${ptm}" name="${ptm}" value="${ptm}" checked="true">
                <label for="${ptm}">${ptm}</label>
            </li>
        `;

        const color = ptmColorMapping[ptm] || "#FFFFFF";
        const checkboxLabel = checkboxWrapper.querySelector('label');
        checkboxLabel.style.border = `2px solid ${color}`;
        checkboxLabel.style.padding = '5px';
        checkboxLabel.style.marginBottom = '10px';
        checkboxLabel.style.display = 'inline-block';
        checkboxLabel.style.backgroundColor = 'black';
        checkboxLabel.style.color = 'white';

        // Event listener for checkbox change
        checkboxWrapper.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                checkboxLabel.style.backgroundColor = 'black';
                checkboxLabel.style.color = 'white';
            } else {
                checkboxLabel.style.backgroundColor = 'white';
                checkboxLabel.style.color = 'black';
            }

            // Call colorPTMs function to update the highlights based on checked boxes
            colorPTMs(e.target);
        });

        checkboxList.push(checkboxWrapper);
        checkboxContainer.appendChild(checkboxWrapper);
    }

    // Filter checkboxes based on search query
    function filterCheckboxes() {
        const query = searchBox.value.toLowerCase();
        checkboxList.forEach(wrapper => {
            const labelText = wrapper.innerText.toLowerCase();
            if (labelText.includes(query)) {
                wrapper.style.display = ''; // Show if it matches
            } else {
                wrapper.style.display = 'none'; // Hide if it doesn't match
            }
        });
    }

    // searchBox.addEventListener('input', filterCheckboxes);
    // filterCheckboxes();
}

// Function for getting the subsequence for vector calculation
function sliceWithPadding(sequenceArray, index, length = 10) {
    const totalLength = 2 * length + 1; // Total items including the index itself
    let start = index - length;
    let end = index + length + 1; // +1 to include the item at `index`

    // Handle cases where the start or end is out of bounds
    if (start < 0) {
        const padding = new Array(-start).fill('-');
        const slice = sequenceArray.slice(0, end);
        return [...padding, ...slice];
    } else if (end > sequenceArray.length) {
        const slice = sequenceArray.slice(start);
        const padding = new Array(end - sequenceArray.length).fill('-');
        return [...slice, ...padding];
    } else {
        return sequenceArray.slice(start, end);
    }
}

async function fetchOptions() {
    const response = await fetch("/api/options");
    const options = await response.json();

    const select = document.getElementById("ptmSelect");

    options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
}

async function exampleSearch(element) {
    document.getElementById('form_value').value = element.textContent;
    if (document.getElementById('form_submit').disabled === false) {
        search();
    }
}

async function search() {
    // I need to clean this messy code...
    const id = document.getElementById('form_value').value.trim();
    if (id) {
        if (currentJobAbortController) {
            currentJobAbortController.abort();
        }
        document.getElementById('afProfile').style.display = 'none';
        document.getElementById('rcsbProfile').style.display = 'none';
        document.getElementById('proteinStatisticsContainer').style.display = 'none';
        document.getElementById('protein3DStructure').innerHTML = '';
        document.getElementById('protein3DStructureInfo').innerHTML = '';
        document.getElementById('proteinInfoContainer').style.display = 'none';
        try {document.getElementById('ptmTableSummary').remove();} catch(e) {} // Special case
        document.getElementById('pdbMajor').style.display = 'none';
        document.getElementById('jpredMajor').style.display = 'none';
        document.getElementById('jpredPredictions').innerHTML = '';
        document.getElementById('jpredInfo').innerHTML = '<h5>Predicting, please wait!</h5><br><h5>(This can take minutes depending on the sequence and job queues)</h5>';
        // document.getElementById('ptmSearch').style.display = 'none';
        document.getElementById('giantCheckboxContainer').style.display = 'none';
        document.getElementById('form_submit').disabled = true;
        const table = document.getElementById('proteinInfo');
        table.innerHTML = ''
        document.getElementById('foundProtein').style.display = 'none';
        document.getElementById('checkboxContainer').innerHTML = '';
        document.getElementById('checkboxContainer').style.display = 'none';
        document.getElementById('iframeContainer').setAttribute('style', "display: block;");
        document.getElementById('iframeLoader').setAttribute('class', 'lds-dual-ring');
        document.getElementById('sequenceDisplayer').style.display = "none";
        document.getElementById('sequenceDisplayer').innerHTML = '';
        document.getElementById("tableHead").innerHTML = '';
        document.getElementById("tableBody").innerHTML = '';
        document.getElementById("xlabel").innerHTML = "";
        document.getElementById('ptmSiteInfo').style.display = 'none';
        document.getElementById('iframeData').textContent = "Searching protein...";
        document.getElementById('iframeData2').textContent = "";
        document.getElementById('iframeData3').textContent = "";
        try {
            const response = await fetch("/ptmkb/search_result", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ "id": id })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.found) {
                    ptmSites = data.result['PTMs']
                    document.getElementById('iframeData').textContent = "Loading protein info...";
                    const proteinInfo = await fetch("/ptmkb/fetch_uniprot", {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ "id": id })
                    }).then((res) => {
                        return res.json();
                    }).then(async (json) => {
                        // Now do something with that JSON.
                        if (json.message === "") {
                            // Time to fill the table
                            for (var [key, value] of Object.entries(json)) {
                                if (key !== "message" && key !== "proteinSequenceFull" && key !== "lastUpdate") {
                                    const row = document.createElement('tr');
                                    const keyCell = document.createElement('td');
                                    const valueCell = document.createElement('td');
                                    keyCell.textContent = key
                                                            .replace(/([a-z](?=[A-Z]))/g, '$1 ')
                                                            .replace(/^./, function(str){ return str.toUpperCase(); })
                                                            .replace('Uni Prot', 'UniProt');
                                    keyCell.className = 'key';
                                    // Special case #1
                                    if (key === 'proteinFunction' || key === 'subcellularLocalizations') {
                                        function convertPubMedReferences(text) {
                                            const pubMedRegex = /PubMed:(\d+)/g; // Regex to match PubMed references
                                        
                                            return text.replace(pubMedRegex, (match, id) => {
                                                const url = `https://www.ncbi.nlm.nih.gov/pubmed/?term=${id}`; // Construct the URL
                                                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${match}</a>`; // Create the link
                                            });
                                        }
                                        valueCell.innerHTML = convertPubMedReferences(value);
                                    } else if (key === 'uniProtID' || key === 'uniProtAC') {
                                        valueCell.innerHTML = `<a href="https://www.uniprot.org/uniprotkb/${value}">${value}</a>`;
                                    } else
                                        valueCell.textContent = value;
                                    // Special case #2 (this is admittedly just for fun)
                                    valueCell.className = 'value';
                                    row.appendChild(keyCell);
                                    row.appendChild(valueCell);
                                    table.appendChild(row);
                                }
                            }
                            currentSequence = json.proteinSequence;

                            // Formatting purpose... because
                            let updatedPtmData = []
                            data.result.PTMs.forEach(ptm => {
                                if (ptm[0] <= json.proteinSequence.length) {
                                    updatedPtmData.push(ptm);
                                }
                            });
                            
                            let pdbData = await fetchProteinStructure(json.uniProtAC);
                            populateCheckboxesFromResult(updatedPtmData)
                            displayProteinSequence(json.proteinSequence, updatedPtmData, json.proteinSequenceFull, json.lastUpdate, json.uniProtAC);
                            updateStats(updatedPtmData)
                            getJPredInference(json.proteinSequence, json.uniProtAC, updatedPtmData);
                            displayPDBStructures(json.uniProtAC, pdbData, updatedPtmData);

                            document.getElementById('sequenceDisplayer').setAttribute('style', "display: block;");
                            document.getElementById('iframeData').textContent = "";
                            document.getElementById('iframeData2').textContent = "Hover on a highlighted amino acid to view the PTM; click on a highlighted amino acid to view details of the PTM below."
                            document.getElementById('iframeData3').textContent = "You can click on the boxes below to hide certain PTMs in the above sequence.";
                            document.getElementById('foundProtein').style.display = 'block';
                            document.getElementById('checkboxContainer').style.display = 'block';
                            document.getElementById('giantCheckboxContainer').style.display = 'block';
                            document.getElementById('proteinInfoContainer').style.display = 'block';
                            document.getElementById('proteinStatisticsContainer').style.display = 'block';
                            document.getElementById('jpredMajor').style.display = 'block';
                            document.getElementById('pdbMajor').style.display = 'block';
                            document.getElementById('detailsPanel').innerHTML = `<h3>Click on a PTM to view details here!</h3>`
                        }
                        else {
                            document.getElementById('iframeData').textContent = `${json.message}`;
                        }
                        document.getElementById('iframeLoader').setAttribute('class', '');
                    });
                } else {
                    document.getElementById('iframeData').textContent = "No protein found";
                }
            } else {
                console.error("Response not OK: ", response.statusText);
                document.getElementById('iframeData').textContent = `Could not make a valid response to server - please try again!`;
            }
        } catch (e) {
            console.error("Error: ", e);
            document.getElementById('iframeData').textContent = `Encountered server error - please try again!`;
        }
    }
    document.getElementById('form_submit').disabled = false;
    document.getElementById('iframeLoader').setAttribute('class', '');
}

function displayTable(data, ptm, site, mapping) {
    
    var colorMapping = (value) => {};
    if (mapping === 'freq') {
        colorMapping = (value) => {
            value = Math.min(Math.max(value, 0), 1);
            const alpha = Math.min(1, value);
            return `rgba(255, 0, 0, ${alpha})`;
        }
    } else if (mapping === 'log-e') {
        colorMapping = (value) => {
            let adjValue = Math.exp(value)
            adjValue = Math.min(Math.max(adjValue, 0), 1);
            const alpha = Math.min(1, adjValue);
            return `rgba(255, 0, 0, ${alpha})`;
        }
    }

    const tableData = document.createElement('table');
    tableData.classList.add('table');
    tableData.classList.add('table-bordered');
    tableData.classList.add('table-responsive');
    tableData.classList.add('th');
    tableData.classList.add('td');
    tableData.setAttribute('id', 'dataTable');
    tableData.setAttribute('style', "display: none; font-family: Arial, sans-serif;;  text-align: center;");
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
        colHeader.setAttribute("style", "background-color: #D0E0E3; border: 3px solid black;");
        row.appendChild(colHeader);
        tableBody.appendChild(row);
    });

    // Create a new table from scratch
    const introRow = document.createElement("tr");
    const introHeader = document.createElement("th");
    introHeader.textContent = "Amino Acid";
    introHeader.setAttribute("style", "border: 3px solid black;");
    introRow.appendChild(introHeader);
    tableHead.appendChild(introRow);
    
    var site_index = 0;

    KEYS.forEach((key, index) => {
        const header = document.createElement("th");
        header.textContent = key;
        if (parseInt(key) == 0) {
            site_index = index;
        }
        header.setAttribute("style", "border: 3px solid black; background-color: #A0C4FF;")
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
            if (index == site_index) {
                // cell.style.backgroundColor = '#F2C998';
                cell.style.borderRight = "2px solid black";
                cell.style.borderLeft = "2px solid black";
            }
            if (value !== '-inf')
                cell.style.backgroundColor = colorMapping(value)
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
    const title = document.createElement('h3')
    title.innerHTML = `${ptm} at site ${site}`;
    title.style.textAlign = 'center';
    body.append(title);
    body.appendChild(dataTable);

    const newHtmlDocument = document.implementation.createHTMLDocument('New Page');
    newHtmlDocument.documentElement.appendChild(head);
    newHtmlDocument.documentElement.appendChild(body);

    // dataTable.style.display = "table"; // Show the table
    return newHtmlDocument.documentElement.outerHTML;
}
