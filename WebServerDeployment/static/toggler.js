
function toggleNavbar() {
    const navbarItems = document.querySelector('.navbar-items');
    const toggleButton = document.querySelector('.navbar-toggler');
    navbarItems.classList.toggle('active');
    toggleButton.classList.toggle('active');
}