// basic implementation of the changing of the profile settings options

function selectoption(option) {
    if (option === 'Customisation') {
        document.querySelector('.update-pfp').style.display = 'block';
        document.querySelector('.security').style.display = 'none';
    } else if (option === 'Security') {
        document.querySelector('.update-pfp').style.display = 'none';
        document.querySelector('.security').style.display = 'block';
    }
    

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.classList.add('hover-effect');
    });
}
