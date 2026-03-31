document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const infoText = document.querySelector('.info-text-small');
    const infoIcon = document.querySelector('.info-icon');

    if (error === 'unauthorized' && infoText) {
        infoText.classList.add('error-state');
        if (infoIcon) {
            infoIcon.classList.add('error-state');
        }
        infoText.textContent = 'Please sign in with your Ahmedabad University email id';
    }
});