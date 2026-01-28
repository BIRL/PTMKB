function scrollToSection(elementName) {
    document.getElementById(elementName)
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}