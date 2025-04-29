document.addEventListener('DOMContentLoaded', function() {
    const progressBar = document.querySelector('.progress-bar');
    const questionCards = document.querySelectorAll('.question-card');
    const totalQuestions = questionCards.length;

    document.querySelectorAll('.next-btn').forEach(button => {
        button.addEventListener('click', function() {
            const currentQuestion = parseInt(this.getAttribute('data-question'));
            const currentCard = document.getElementById(`question-${currentQuestion}`);
            const nextCard = document.getElementById(`question-${currentQuestion + 1}`);

            const radioInputs = currentCard.querySelectorAll('input[type="radio"]');
            const isAnswered = Array.from(radioInputs).some(input => input.checked);

            if (isAnswered) {
                currentCard.style.display = 'none';
                nextCard.style.display = 'block';

                const progress = ((currentQuestion + 1) / totalQuestions) * 100;
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
                progressBar.textContent = `${Math.round(progress)}%`;
            } else {

                alert('Please select an answer before proceeding.');
            }
        });
    });

    document.querySelectorAll('.prev-btn').forEach(button => {
        button.addEventListener('click', function() {
            const currentQuestion = parseInt(this.getAttribute('data-question'));
            const currentCard = document.getElementById(`question-${currentQuestion}`);
            const prevCard = document.getElementById(`question-${currentQuestion - 1}`);

            currentCard.style.display = 'none';
            prevCard.style.display = 'block';

            const progress = ((currentQuestion - 1) / totalQuestions) * 100;
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
            progressBar.textContent = `${Math.round(progress)}%`;
        });
    });

    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            const lastQuestion = totalQuestions;
            const lastCard = document.getElementById(`question-${lastQuestion}`);

            const radioInputs = lastCard.querySelectorAll('input[type="radio"]');
            const isAnswered = Array.from(radioInputs).some(input => input.checked);

            if (isAnswered) {

                let allAnswered = true;
                for (let i = 1; i <= totalQuestions; i++) {
                    const card = document.getElementById(`question-${i}`);
                    const inputs = card.querySelectorAll('input[type="radio"]');
                    const answered = Array.from(inputs).some(input => input.checked);
                    if (!answered) {
                        allAnswered = false;
                        break;
                    }
                }

                if (allAnswered) {

                    questionCards.forEach(card => {
                        card.style.display = 'none';
                    });

                    document.getElementById('results-section').style.display = 'block';
                    document.getElementById('loading-spinner').style.display = 'block';
                    document.getElementById('results-content').style.display = 'none';

                    const form = document.getElementById('footprintForm');
                    const formData = new FormData(form);

                    fetch(form.action, {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {

                        document.getElementById('loading-spinner').style.display = 'none';
                        document.getElementById('results-content').style.display = 'block';
                        document.querySelector('.progress-bar').style.display = 'block';


                        const score = parseInt(data.score);
                        document.getElementById('score-value').textContent = score;

                        const footprintProgressBar = document.getElementById('footprint-progress');
                        footprintProgressBar.style.width = `${score}%`;
                        footprintProgressBar.setAttribute('aria-valuenow', score);

                        if (score < 30) {
                            footprintProgressBar.className = 'progress-bar bg-success';
                        } else if (score < 60) {
                            footprintProgressBar.className = 'progress-bar bg-warning';
                        } else {
                            footprintProgressBar.className = 'progress-bar bg-danger';
                        }

                        footprintProgressBar.textContent = `${score}/100`;

                        document.getElementById('advice-message').textContent = data.message;
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        document.getElementById('loading-spinner').style.display = 'none';
                        document.getElementById('results-content').style.display = 'block';
                        document.querySelector('.progress-bar').style.display = 'block';
                        document.getElementById('results-content').innerHTML =
                         '<div class="alert alert-danger">Error calculating footprint. Please try again.</div>';
                    });
                } else {

                    alert('Please answer all questions before submitting.');
                }
            } else {

                alert('Please select an answer before proceeding.');
            }
        });
    }
});
