document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('profileImage');
    if (!fileInput.files[0]) {
        showResult('Please select an image to upload', 'danger');
        return;
    }
    
    const file = fileInput.files[0];
    if (!file.type.match('image.*')) {
        showResult('Please select a valid image file', 'danger');
        return;
    }
    
    document.getElementById('uploadStatus').style.display = 'block';
    document.getElementById('uploadResult').style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', file);
    
    fetch('/api/update_profile_pic', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('uploadStatus').style.display = 'none';
        
        if (data.success) {
            showResult(data.message, 'success');

            const profileImg = document.querySelector('img.rounded-circle');
            profileImg.src = data.profile_pic;
            

            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showResult(data.message, 'danger');
        }
    })
    .catch(error => {
        document.getElementById('uploadStatus').style.display = 'none';
        showResult('An error occurred while uploading the image', 'danger');
        console.error('Error:', error);
    });
});

function showResult(message, type) {
    const resultDiv = document.getElementById('uploadResult');
    const alert = resultDiv.querySelector('.alert');
    
    alert.textContent = message;
    alert.className = 'alert alert-' + type;
    resultDiv.style.display = 'block';
}