export const setupImageUploader = (uploaderElement) => {
    if (!uploaderElement) return;
    const input = uploaderElement.querySelector('input[type="file"]');
    const preview = uploaderElement.querySelector('.image-uploader__preview');
    
    const showPreview = (file) => {
        const reader = new FileReader();
        reader.onload = () => { preview.src = reader.result; uploaderElement.classList.add('has-preview'); };
        reader.readAsDataURL(file);
    };
    
    const handleFiles = (files) => {
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            showPreview(files[0]);
        }
    };
    
    uploaderElement.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(input.files));
    uploaderElement.addEventListener('dragover', (e) => { e.preventDefault(); uploaderElement.classList.add('drag-over'); });
    uploaderElement.addEventListener('dragleave', () => uploaderElement.classList.remove('drag-over'));
    uploaderElement.addEventListener('drop', (e) => { e.preventDefault(); uploaderElement.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
};