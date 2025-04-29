// This file will handle the accessibility menu functionality for example the animation and the display of the menu as well as the functionality of the accessibility options themselves.
document.querySelector('.AccessibilityMenu').addEventListener('click', function() {
    var options = document.querySelector('.radialMenu');
    options.classList.toggle('none');
    if (options.classList.contains('none')) {
        options.style.opacity = '0';
        setTimeout(function() {
            options.style.display = 'none';
        }, 300);
    } else {
        options.style.display = 'flex';
        setTimeout(function() {
            options.style.opacity = '1';
        }, 10);
    }
    options.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
});

document.querySelector('.AccessibilityMenu').addEventListener('keydown', function(e) {
    if (e.code === 'Enter') {
        var options = document.querySelector('.radialMenu');
        options.classList.toggle('none');
        if (options.classList.contains('none')) {
            options.style.opacity = '0';
            setTimeout(function() {
                options.style.display = 'none';
            }, 300);
        } else {
            options.style.display = 'flex';
            setTimeout(function() {
                options.style.opacity = '1';
            }, 10); 
        }
        options.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
    }
});

// screen mask start

function setupFocusTracking() {
    const highlight = document.getElementById('highlight');
    const screenMask = document.getElementById('screen-mask');

    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;

    highlight.style.top = `${screenHeight / 2 - 40}px`; 
    highlight.style.left = '0px';
    highlight.style.width = '100%';
    highlight.style.height = '80px';

    document.addEventListener('mousemove', function(e) {
        highlight.style.top = `${e.clientY - 40}px`; 
    });

    document.addEventListener('scroll', function() {
        const currentTop = parseInt(highlight.style.top, 10);
        const scrollY = window.scrollY;

        if (currentTop < scrollY) {
            highlight.style.top = `${scrollY + 100}px`;
        } else if (currentTop > scrollY + screenHeight - 80) {
            highlight.style.top = `${scrollY + screenHeight - 180}px`;
        }
    });

    document.addEventListener('keydown', function(e) {
        const currentTop = parseInt(highlight.style.top, 10);

        if (e.key === 'ArrowUp') {
            highlight.style.top = `${currentTop - 20}px`;
            e.preventDefault(); 
        } else if (e.key === 'ArrowDown') {
            highlight.style.top = `${currentTop + 20}px`;
            e.preventDefault(); 
        }
    });
}

function toggleOption(option) {
    if (option == "ScreenMask"){
        const screenMask = document.getElementById('screen-mask');
        if (screenMask) {
            screenMask.classList.toggle('active');

            if (screenMask.classList.contains('active')) {
                setupFocusTracking();

                document.addEventListener('keydown', function escHandler(e) {
                    if (e.key === 'Escape') {
                        screenMask.classList.remove('active');
                        document.removeEventListener('keydown', escHandler);
                    }
                });
            }
        }
    } else if (option == "Settings") {
        openSettings();
    }
}

// Screen mask end

// Text size start
function increasetextsize(){
    var body = document.body;
    var currentSize = window.getComputedStyle(body).fontSize;
    var newSize = parseFloat(currentSize) + 2 + 'px';
    body.style.fontSize = newSize;
}

function decreasetextsize(){
    var body = document.body;
    var currentSize = window.getComputedStyle(body).fontSize;
    var newSize = parseFloat(currentSize) - 2 + 'px';
    body.style.fontSize = newSize;
}

// Text size end


// Settings Modal functionality

function openSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.style.display = 'flex';
    }
}

function closeSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.style.display = 'none';
    }
}

// Font Type start

(function() {
    const fontFace = new FontFace('OpenDyslexic', 'url("/static/fonts/DyslexicRegular.otf")');
    document.fonts.add(fontFace);
    fontFace.load();
})();


(function() {
    const fontFace = new FontFace('San Francisco', 'url("/static/fonts/SanFrancisco.otf")');
    document.fonts.add(fontFace);
    fontFace.load();
})();

function changeFont(font) {
    var body = document.body;
    
    if (font === 'OpenDyslexic') {
        body.style.fontFamily = "'OpenDyslexic', sans-serif";

    } else if (font === 'San Francisco') {
        body.style.fontFamily = "'SF Pro', sans-serif";
    } else {
        body.style.fontFamily = font;
    }

    localStorage.setItem('preferredFont', font);
}


document.addEventListener('DOMContentLoaded', function() {
    const savedFont = localStorage.getItem('preferredFont');
    if (savedFont) {
        document.getElementById('font-select').value = savedFont;
        changeFont(savedFont);
    }
});

// Font Type end