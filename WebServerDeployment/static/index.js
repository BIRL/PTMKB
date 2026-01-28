async function exampleSearch(element) {
    var input = '';
    if (element.textContent === "Search") {
        input = document.getElementById('form_value').value;
    } else {
        input = element.textContent;
    }
    window.location.href = `/search?searchId=${input}`;
}